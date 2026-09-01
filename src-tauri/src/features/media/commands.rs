//! media（FFmpeg）的 tauri command 薄壳。
//! 目录/多选展开与 ffprobe 探测归 query，参数决策归 adapter/policy。

use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tokio::sync::OnceCell;

use super::adapter::{self, MediaCtx, PrProbe};
use super::query;
use crate::core::adapter::{preview_result, PreviewResult};
use crate::core::deps::{command_path, ffmpeg_encoders, resolve_tool, ToolName};
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};

/// copy+滤镜冲突时的兜底编码器优先序（与旧前端一致，libx264 系优先）。
const FALLBACK_PREFERENCE: [&str; 7] = [
    "libx264",
    "libopenh264",
    "h264_videotoolbox",
    "h264_amf",
    "h264_nvenc",
    "h264_qsv",
    "mpeg4",
];

/// 编码器探测进程级缓存：预览随表单高频刷新，不能每次跑 ffmpeg -encoders。
static ENCODER_FALLBACK: OnceCell<Option<String>> = OnceCell::const_new();

async fn media_ctx(app: &AppHandle) -> MediaCtx {
    let fallback = ENCODER_FALLBACK
        .get_or_init(|| async {
            let encoders = ffmpeg_encoders(app.clone()).await.unwrap_or_default();
            FALLBACK_PREFERENCE
                .iter()
                .find(|name| encoders.iter().any(|e| e == *name))
                .map(|s| s.to_string())
        })
        .await;
    MediaCtx {
        encoder_fallback: fallback.clone(),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSubmitResult {
    pub task_ids: Vec<String>,
}

#[tauri::command]
pub async fn media_preview(app: AppHandle, intent: TaskIntent) -> Result<PreviewResult, String> {
    let ctx = media_ctx(&app).await;
    let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

fn ffmpeg_spec(
    plan: crate::core::adapter::AdapterPlan,
    tool_path: PathBuf,
    intent: TaskIntent,
) -> TaskSpec {
    let cwd = match plan.cwd {
        CwdPolicy::Inherit => None,
        CwdPolicy::ExeDir => tool_path.parent().map(|p| p.to_path_buf()),
        CwdPolicy::Explicit(dir) => Some(std::path::PathBuf::from(dir)),
    };
    TaskSpec {
        feature: Feature::Media,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None,
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        output_paths: plan.output_paths,
        env_path: Some(command_path()),
        intent, // media 无敏感字段，intent 无需 sanitize
        parser: None,
        cleanup_dir: None,
    }
}

/// 常规媒体处理提交：inputs（文件/目录）后端展开，每个文件一个任务。
#[tauri::command]
pub async fn media_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    inputs: Vec<String>,
    intent: TaskIntent,
) -> Result<BatchSubmitResult, String> {
    let TaskIntent::Form(data) = &intent else {
        // 专家模式：argv 原文单任务提交
        let ctx = media_ctx(&app).await;
        let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
        let (tool_path, _) = resolve_tool(&app, &ToolName::Ffmpeg)
            .ok_or_else(|| rust_i18n::t!("backend.media.commands.ffmpegMissing").to_string())?;
        let id = hub.submit(ffmpeg_spec(plan, tool_path, intent.clone()));
        return Ok(BatchSubmitResult { task_ids: vec![id] });
    };

    let include_subtitles = data
        .get("operation")
        .and_then(|v| v.as_str())
        .is_some_and(|op| op == "subtitle-extract");
    let expanded = query::expand_media_inputs(inputs, Some(include_subtitles))?;
    if expanded.is_empty() {
        return Err(rust_i18n::t!("backend.media.commands.noMediaFiles").to_string());
    }

    // 指定了输出目录时先建目录：ffmpeg 不会自建，默认目录也可能尚未落盘
    if let Some(directory) = data
        .get("outputDirectory")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    }

    let ctx = media_ctx(&app).await;
    let (tool_path, _) = resolve_tool(&app, &ToolName::Ffmpeg)
        .ok_or_else(|| rust_i18n::t!("backend.media.commands.ffmpegMissing").to_string())?;

    // 先为全部文件完成 plan，确保第一个任务入队后不再有可失败的准备步骤。
    let specs = expanded
        .into_iter()
        .map(|input| {
            // 每文件一个意图：重跑语义精确到单文件
            let mut file_data = data.clone();
            if let Some(map) = file_data.as_object_mut() {
                map.insert("input".into(), serde_json::Value::String(input));
            }
            let file_intent = TaskIntent::Form(file_data);
            let plan = adapter::plan(&file_intent, &ctx).map_err(|e| e.to_string())?;
            Ok(ffmpeg_spec(plan, tool_path.clone(), file_intent))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let task_ids = specs.into_iter().map(|spec| hub.submit(spec)).collect();
    Ok(BatchSubmitResult { task_ids })
}

/// PR 兼容转码提交（旧 run_pr_compatible 的任务系统化）：探测每个文件后按编排规则提交。
#[tauri::command]
pub async fn media_pr_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    inputs: Vec<String>,
    output_directory: Option<String>,
) -> Result<BatchSubmitResult, String> {
    let (tool_path, _) = resolve_tool(&app, &ToolName::Ffmpeg)
        .ok_or_else(|| rust_i18n::t!("backend.media.commands.ffmpegMissing").to_string())?;
    let (ffprobe, _) = resolve_tool(&app, &ToolName::Ffprobe)
        .ok_or_else(|| rust_i18n::t!("backend.media.commands.ffprobeMissing").to_string())?;

    let mut expanded = Vec::new();
    for input in inputs {
        let input_path = PathBuf::from(input);
        if input_path.is_dir() {
            expanded.extend(query::media_files_in(&input_path)?);
        } else if input_path.is_file() {
            expanded.push(input_path);
        } else {
            return Err(rust_i18n::t!("backend.media.commands.inputMissing").to_string());
        }
    }
    expanded.sort();
    expanded.dedup();
    if expanded.is_empty() {
        return Err(rust_i18n::t!("backend.media.commands.noMediaFiles").to_string());
    }

    // 探测与 plan 全部完成后再准备目录；任一步失败都不会产生部分入队。
    let mut prepared = Vec::with_capacity(expanded.len());
    for path in expanded {
        let (video, audio, subtitles) = query::probe_streams(&ffprobe, &path).await?;
        let probe = PrProbe {
            video,
            audio,
            subtitles,
        };
        let (plan, output) = adapter::pr_plan(&path, &probe, output_directory.as_deref())?;
        let intent = TaskIntent::Form(serde_json::json!({
            "prCompatible": true,
            "input": path.to_string_lossy(),
            "outputDirectory": output_directory.clone(),
        }));
        prepared.push((plan, output, intent));
    }

    for (_, output, _) in &prepared {
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let specs = prepared
        .into_iter()
        .map(|(plan, _, intent)| ffmpeg_spec(plan, tool_path.clone(), intent));
    let task_ids = specs.map(|spec| hub.submit(spec)).collect();
    Ok(BatchSubmitResult { task_ids })
}

/// 输入预扫描：目录递归展开为媒体文件，供前端文件列表展示。
/// 复用提交时的 expand_media_inputs，保证与实际执行语义一致。
#[tauri::command]
pub fn media_scan_inputs(
    inputs: Vec<String>,
    include_subtitles: bool,
) -> Result<Vec<String>, String> {
    query::expand_media_inputs(inputs, Some(include_subtitles))
}
