//! aria2 的 tauri command 薄壳。下载经 core/task（一次性任务语义）；
//! tracker 列表查询走独立命令（带缓存与回退链，见 trackers.rs）。

use std::{io::Read, sync::Arc};

use tauri::{AppHandle, State};

use super::adapter::{self, Aria2Ctx};
use super::trackers::{self, TrackerListResult};
use super::types::Aria2Intent;
use crate::core::adapter::{preview_result, PreviewResult, SubmitResult};
use crate::core::deps::{execution_path, resolve_tool, ToolName};
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};

fn torrent_private(bytes: &[u8]) -> Result<bool, bendy::decoding::Error> {
    use bendy::decoding::{Decoder, Error};

    let mut decoder = Decoder::new(bytes).with_max_depth(64);
    let mut root = decoder
        .next_object()?
        .ok_or_else(|| Error::missing_field("info"))?
        .try_into_dictionary()?;
    let mut private = None;
    while let Some((key, value)) = root.next_pair()? {
        if key == b"info" {
            let mut info = value.try_into_dictionary()?;
            private = Some(false);
            while let Some((key, value)) = info.next_pair()? {
                if key == b"private" {
                    private = Some(match value.try_into_integer()? {
                        "0" => false,
                        "1" => true,
                        other => return Err(Error::unexpected_token("0 or 1", other)),
                    });
                }
            }
        }
    }
    drop(root);
    if decoder.next_object()?.is_some() {
        return Err(Error::unexpected_token("end of torrent", "trailing data"));
    }
    private.ok_or_else(|| Error::missing_field("info"))
}

fn read_torrent(intent: &TaskIntent) -> Result<Option<bool>, String> {
    let TaskIntent::Form(data) = intent else {
        return Ok(None);
    };
    let form: Aria2Intent = serde_json::from_value(data.clone()).map_err(|e| e.to_string())?;
    if form.torrent_file.trim().is_empty() {
        return Ok(None);
    }
    // 64 MiB 足以容纳百万级分片哈希；限制错误选择的大文件及恶意元数据的内存占用。
    const MAX_TORRENT_BYTES: u64 = 64 * 1024 * 1024;
    let invalid = || rust_i18n::t!("backend.aria2.commands.invalid_torrent").to_string();
    let file = std::fs::File::open(form.torrent_file.trim()).map_err(|_| invalid())?;
    if !file.metadata().map_err(|_| invalid())?.is_file() {
        return Err(invalid());
    }
    let mut bytes = Vec::new();
    file.take(MAX_TORRENT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| invalid())?;
    if bytes.len() as u64 > MAX_TORRENT_BYTES {
        return Err(invalid());
    }
    let private = torrent_private(&bytes).map_err(|_| invalid())?;
    Ok(Some(private))
}

#[tauri::command]
pub fn aria2_preview(app: AppHandle, intent: TaskIntent) -> Result<PreviewResult, String> {
    // 预览只读本地缓存，不发起网络请求——所见 tracker 可能与提交时新鲜拉取的不同
    let ctx = Aria2Ctx {
        trackers: trackers::cached_trackers(&app),
        private_torrent: read_torrent(&intent)?,
    };
    let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

#[tauri::command]
pub async fn aria2_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    intent: TaskIntent,
) -> Result<SubmitResult, String> {
    let mut ctx = Aria2Ctx {
        private_torrent: read_torrent(&intent)?,
        ..Default::default()
    };
    adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    let (tool_path, _) = resolve_tool(&app, &ToolName::Aria2)
        .ok_or_else(|| rust_i18n::t!("backend.aria2.commands.aria2_not_found").to_string())?;
    if adapter::needs_trackers(&intent, &ctx) {
        ctx.trackers = trackers::for_submit(&app).await;
    }
    let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    let cwd = match plan.cwd {
        CwdPolicy::Inherit => None,
        CwdPolicy::ExeDir => tool_path.parent().map(|p| p.to_path_buf()),
        CwdPolicy::Explicit(dir) => Some(std::path::PathBuf::from(dir)),
    };
    // 指定了输出目录时先建目录：目录不存在时 spawn 就会失败，
    // 走不到 aria2 的 --dir 自建逻辑（同 media 流程的先例）
    if let Some(directory) = &cwd {
        std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    }

    // 进度行解析出百分比时发进度信号驱动任务卡进度条
    let parser =
        Some(Arc::new(|line: &str| adapter::parse_progress(line).into_iter().collect()) as _);

    let spec = TaskSpec {
        feature: Feature::Aria2,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None,
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        output_paths: plan.output_paths,
        env_path: Some(execution_path(&app)),
        intent: adapter::sanitize_intent(&intent),
        parser,
        cleanup_dir: None,
    };
    Ok(SubmitResult {
        task_id: hub.submit(spec),
    })
}

#[tauri::command]
pub async fn aria2_tracker_list(
    app: AppHandle,
    refresh: bool,
) -> Result<TrackerListResult, String> {
    trackers::tracker_list(&app, refresh).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn privacy_is_read_only_from_the_info_dictionary() {
        assert!(torrent_private(b"d4:infod7:privatei1eee").unwrap());
        assert!(!torrent_private(b"d4:infod7:privatei0eee").unwrap());
        assert!(!torrent_private(b"d4:infode7:privatei1ee").unwrap());
        assert!(!torrent_private(b"d7:comment12:7:privatei1e4:infodee").unwrap());
    }

    #[test]
    fn ambiguous_or_incomplete_metadata_is_rejected() {
        for bytes in [
            b"de".as_slice(),
            b"d4:infoi1ee",
            b"d4:infod7:private1:1ee",
            b"d4:infod7:privatei2eee",
            b"d4:infod7:privatei0e7:privatei1eee",
            b"d4:infod7:privatei1ee",
            b"d4:infodeeextra",
        ] {
            assert!(torrent_private(bytes).is_err(), "{bytes:?}");
        }
    }
}
