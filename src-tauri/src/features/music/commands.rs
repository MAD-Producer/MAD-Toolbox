//! music（musicdl）的 tauri command（自 lib.rs 归位）。
//! - 搜索 = 查询（§4.1）：结果经 musicdl-search-result 事件流式回填页面，自带 30 分钟超时，
//!   完成信号沿用 job-state 事件；
//! - 下载/歌单 = 作业：产出 TaskSpec 进任务系统。

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::oneshot;
use tokio::time::sleep;
use uuid::Uuid;

use super::sessions::{self, MusicSearchRegistry, PreparedSessionDir};
use super::types::{
    MusicdlAdapterOutput, MusicdlPlaylistRequest, MusicdlPreviewRequest, MusicdlSearchRequest,
    MusicdlSearchResponse,
};
use super::{cli, runtime};
use crate::core::deps::{command_path, musicdl_python, resolve_tool, ToolName};
use crate::core::process::spawn_tree;
use crate::core::query::{JobState, RunResult};
use crate::core::settings::{load_app_settings, unified_output_directory};
use crate::core::task::types::{Feature, Pool, TaskIntent, TaskProgress};
use crate::core::task::{LineParser, ParsedSignal, TaskHub, TaskSpec};

/// adapter 逐首下载时输出 `musicdl-progress: 3/20`，据此驱动任务卡进度条。
fn download_progress_parser() -> LineParser {
    Arc::new(|line: &str| {
        let Some(rest) = line.trim().strip_prefix("musicdl-progress: ") else {
            return Vec::new();
        };
        let Some((done, total)) = rest.split_once('/') else {
            return Vec::new();
        };
        let (Ok(done), Ok(total)) = (done.trim().parse::<u64>(), total.trim().parse::<u64>())
        else {
            return Vec::new();
        };
        if total == 0 || done > total {
            return Vec::new();
        }
        vec![ParsedSignal::Progress(TaskProgress {
            percent: Some(done as f64 / total as f64 * 100.0),
            detail: Some(format!("{done}/{total} 首")),
        })]
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskSubmitResult {
    task_id: String,
}

/// 表单快照中可承载登录凭证的字段：落库 intent 前清空（与 bilibili sanitize_intent 同一推论）。
const FORM_SNAPSHOT_SENSITIVE_FIELDS: &[&str] = &["cookies", "rawInit", "rawRequests"];

fn sanitized_form_snapshot(form: Option<serde_json::Value>) -> serde_json::Value {
    let mut form = form.unwrap_or_else(|| serde_json::json!({}));
    if let Some(map) = form.as_object_mut() {
        for field in FORM_SNAPSHOT_SENSITIVE_FIELDS {
            map.insert(
                (*field).to_string(),
                serde_json::Value::String(String::new()),
            );
        }
    }
    form
}

/// 返回的是等效 musicdl CLI 展示文本，不是 Python adapter 的内部 argv。
#[tauri::command]
pub(crate) fn musicdl_preview(request: MusicdlPreviewRequest) -> Result<String, String> {
    cli::equivalent_preview(&request)
}

#[tauri::command]
pub(crate) async fn musicdl_search(
    app: AppHandle,
    registry: State<'_, MusicSearchRegistry>,
    mut request: MusicdlSearchRequest,
) -> Result<RunResult, String> {
    request.keyword = request.keyword.trim().to_string();
    request.music_sources = request
        .music_sources
        .into_iter()
        .map(|source| source.trim().to_string())
        .filter(|source| !source.is_empty())
        .collect();
    if request.keyword.is_empty() {
        return Err("请填写歌曲、歌手或专辑关键词".into());
    }
    if request.music_sources.is_empty() {
        return Err("请至少选择一个音乐源".into());
    }
    if request.music_sources.len() > 60 {
        return Err("音乐源数量超过安全限制".into());
    }
    request.search_size_per_source = request.search_size_per_source.clamp(1, 100);
    for (label, value) in [
        ("客户端设置", &request.init_music_clients_cfg),
        ("请求设置", &request.requests_overrides),
        ("线程设置", &request.clients_threadings),
        ("搜索规则", &request.search_rules),
    ] {
        if !value.is_object() {
            return Err(format!("{label}必须是 JSON 对象"));
        }
    }
    request.output_directory = request
        .output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if request.output_directory.is_none() {
        request.output_directory = unified_output_directory(&app);
    }
    if let Some(directory) = &request.output_directory {
        std::fs::create_dir_all(directory)
            .map_err(|error| format!("无法创建音乐下载目录：{error}"))?;
    }

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请先按照页面提示安装".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = runtime::adapter_path(&app)?;
    let session_id = Uuid::new_v4().to_string();
    let session_directory = PreparedSessionDir::search(&app, &session_id)?;
    let request_path = session_directory.path().join("request.json");
    let state_path = session_directory.path().join("results.pickle");
    let bytes = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    std::fs::write(&request_path, bytes).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&request_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }

    let argv = vec![
        adapter.to_string_lossy().into_owned(),
        "search".into(),
        request_path.to_string_lossy().into_owned(),
        state_path.to_string_lossy().into_owned(),
    ];
    let env_path = command_path();
    let proxy = load_app_settings(&app).proxy;
    let mut child = spawn_tree(&python, &argv, None, Some(&env_path), proxy.as_deref())
        .map_err(|error| format!("无法启动 musicdl 搜索：{error}"))?;
    let stdout = child.take_stdout();
    let stderr = child.take_stderr();
    let timeout_killer = child.killer();
    let cancel_requested = registry.register(session_id.clone(), child.killer());
    let source_count = request.music_sources.len();
    let _ = app.emit(
        "job-state",
        JobState {
            job_id: session_id.clone(),
            tool: ToolName::Musicdl,
            state: "running",
            exit_code: None,
            message: format!("musicdl 正在搜索 {source_count} 个音乐源"),
        },
    );

    let task_app = app.clone();
    let task_job_id = session_id.clone();
    let task_registry = registry.inner().clone();
    tauri::async_runtime::spawn(async move {
        let (payload_tx, payload_rx) = oneshot::channel::<MusicdlAdapterOutput>();
        let stdout_task = stdout.map(|stdout| {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                let mut payload_tx = Some(payload_tx);
                while let Ok(Some(line)) = lines.next_line().await {
                    if let Ok(payload) = serde_json::from_str::<MusicdlAdapterOutput>(&line) {
                        if let Some(sender) = payload_tx.take() {
                            let _ = sender.send(payload);
                        }
                    }
                }
            })
        });
        let stderr_task = stderr.map(|stderr| {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(_)) = lines.next_line().await {}
            })
        });

        let (mut state_name, exit_code, mut message) = tokio::select! {
            status = child.wait() => match status {
                Ok(status) if status.success() => (
                    "completed",
                    status.code(),
                    "musicdl 搜索完成".to_string(),
                ),
                Ok(status) => (
                    "failed",
                    status.code(),
                    "musicdl 搜索失败".to_string(),
                ),
                Err(error) => (
                    "failed",
                    None,
                    format!("无法等待 musicdl 搜索：{error}"),
                ),
            },
            _ = sleep(Duration::from_secs(1800)) => {
                timeout_killer.kill_tree();
                let exit_code = child.wait().await.ok().and_then(|status| status.code());
                (
                    "failed",
                    exit_code,
                    "musicdl 搜索超过 30 分钟，已停止；请减少音乐源或检查网络".to_string(),
                )
            },
        };
        if let Some(task) = stdout_task {
            let _ = task.await;
        }
        if let Some(task) = stderr_task {
            let _ = task.await;
        }

        let canceled =
            task_registry.finish(&task_job_id) || cancel_requested.load(Ordering::Acquire);
        if canceled {
            state_name = "canceled";
            message = "musicdl 搜索已取消".into();
        }

        let mut response = None;
        if state_name == "completed" {
            match payload_rx.await {
                Ok(payload) => {
                    let count = payload.results.len();
                    response = Some(MusicdlSearchResponse {
                        session_id: task_job_id.clone(),
                        results: payload.results,
                    });
                    message = format!("musicdl 搜索完成，共 {count} 项结果");
                }
                Err(_) => {
                    message = "无法解析 musicdl 搜索结果，请升级或重新安装 musicdl".into();
                }
            }
        }
        let final_state = if state_name == "completed" && message.starts_with("无法解析") {
            "failed"
        } else {
            state_name
        };
        if final_state == "completed" {
            let _ = session_directory.into_path();
        } else {
            drop(session_directory);
        }
        if let Some(response) = response {
            let _ = task_app.emit("musicdl-search-result", response);
        }
        let _ = task_app.emit(
            "job-state",
            JobState {
                job_id: task_job_id,
                tool: ToolName::Musicdl,
                state: final_state,
                exit_code,
                message,
            },
        );
    });
    Ok(RunResult { job_id: session_id })
}

#[tauri::command]
pub(crate) fn musicdl_search_cancel(
    registry: State<'_, MusicSearchRegistry>,
    job_id: String,
) -> Result<(), String> {
    let job_id = sessions::canonical_session_id(&job_id)?;
    if registry.cancel(&job_id) {
        Ok(())
    } else {
        Err("musicdl 搜索不存在或已经结束".into())
    }
}

#[tauri::command]
pub(crate) fn musicdl_session_release(
    app: AppHandle,
    registry: State<'_, MusicSearchRegistry>,
    session_id: String,
) -> Result<(), String> {
    let session_id = sessions::canonical_session_id(&session_id)?;
    if registry.is_active(&session_id) {
        return Err("musicdl 搜索仍在运行，请先停止搜索".into());
    }
    sessions::release_search_session(&app, &session_id)
}

#[tauri::command]
pub(crate) async fn musicdl_download(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    registry: State<'_, MusicSearchRegistry>,
    session_id: String,
    indices: Vec<usize>,
    downsample: bool,
    form: Option<serde_json::Value>,
) -> Result<TaskSubmitResult, String> {
    let session_id = sessions::canonical_session_id(&session_id)?;
    if registry.is_active(&session_id) {
        return Err("musicdl 搜索仍在运行，请等待搜索完成".into());
    }
    if indices.is_empty() {
        return Err("请至少选择一首音乐".into());
    }
    if indices.len() > 1000 {
        return Err("一次选择的音乐数量超过限制".into());
    }
    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请重新检测依赖".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = runtime::adapter_path(&app)?;
    let source_state_path =
        sessions::search_session_path(&app, &session_id)?.join("results.pickle");
    if !source_state_path.is_file() {
        return Err("musicdl 搜索结果已失效，请重新搜索".into());
    }
    let selected = serde_json::to_string(&indices).map_err(|error| error.to_string())?;
    // 输出目录以搜索会话落盘的 request.json 为准（搜索时已解析默认值），
    // 作为下载任务的工作目录兼任务卡"打开输出位置"的锚点
    let output_directory =
        std::fs::read(sessions::search_session_path(&app, &session_id)?.join("request.json"))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .and_then(|value| {
                value
                    .get("outputDirectory")
                    .and_then(|v| v.as_str())
                    .map(str::to_owned)
            });
    let task_directory = PreparedSessionDir::task(&app)?;
    let task_state_path = task_directory.path().join("results.pickle");
    std::fs::copy(&source_state_path, &task_state_path)
        .map_err(|error| format!("无法准备 musicdl 下载会话：{error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&task_state_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    // 音乐下载作业进任务系统（§3：musicdl 旁路取消）；搜索维持查询语义
    let mut argv = vec![
        adapter.to_string_lossy().into_owned(),
        "download".into(),
        task_state_path.to_string_lossy().into_owned(),
        selected,
    ];
    if downsample {
        argv.push("downsample".into());
    }
    let task_id = hub.submit(TaskSpec {
        feature: Feature::Music,
        pool: Pool::Download,
        title: format!("音乐下载（{} 首）", indices.len()),
        tool: "musicdl".into(),
        tool_path: python,
        tool_version: None,
        argv_redacted: argv.clone(),
        argv,
        cwd: output_directory.clone().map(std::path::PathBuf::from),
        output_paths: output_directory
            .clone()
            .map(|d| vec![d])
            .unwrap_or_default(),
        env_path: Some(command_path()),
        intent: TaskIntent::Form(serde_json::json!({
            "musicdl": "download",
            "sessionId": session_id,
            "indices": indices,
            "form": sanitized_form_snapshot(form),
            "denoise": downsample,
        })),
        parser: Some(download_progress_parser()),
        on_failure: None,
        cleanup_dir: Some(task_directory.into_path()),
    });
    Ok(TaskSubmitResult { task_id })
}

#[tauri::command]
pub(crate) async fn musicdl_playlist(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    mut request: MusicdlPlaylistRequest,
    form: Option<serde_json::Value>,
) -> Result<TaskSubmitResult, String> {
    request.playlist_url = request.playlist_url.trim().to_string();
    request.music_sources = request
        .music_sources
        .into_iter()
        .map(|source| source.trim().to_string())
        .filter(|source| !source.is_empty())
        .collect();
    if request.playlist_url.is_empty() {
        return Err("请填写歌单链接".into());
    }
    if request.music_sources.is_empty() || request.music_sources.len() > 60 {
        return Err("请选择 1–60 个音乐源".into());
    }
    for (label, value) in [
        ("客户端设置", &request.init_music_clients_cfg),
        ("请求设置", &request.requests_overrides),
        ("线程设置", &request.clients_threadings),
        ("搜索规则", &request.search_rules),
    ] {
        if !value.is_object() {
            return Err(format!("{label}必须是 JSON 对象"));
        }
    }
    request.output_directory = request
        .output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| unified_output_directory(&app));
    let output_directory = request
        .output_directory
        .as_ref()
        .ok_or_else(|| "无法确定音乐导出目录".to_string())?;
    std::fs::create_dir_all(output_directory)
        .map_err(|error| format!("无法创建音乐导出目录：{error}"))?;

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请重新检测依赖".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = runtime::adapter_path(&app)?;
    let task_directory = PreparedSessionDir::task(&app)?;
    let request_path = task_directory.path().join("playlist-request.json");
    std::fs::write(
        &request_path,
        serde_json::to_vec(&request).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&request_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    // 歌单下载作业进任务系统（§3：musicdl 旁路取消）
    let argv = vec![
        adapter.to_string_lossy().into_owned(),
        "playlist".into(),
        request_path.to_string_lossy().into_owned(),
    ];
    let task_id = hub.submit(TaskSpec {
        feature: Feature::Music,
        pool: Pool::Download,
        title: format!("歌单下载 {}", request.playlist_url),
        tool: "musicdl".into(),
        tool_path: python,
        tool_version: None,
        argv_redacted: argv.clone(),
        argv,
        cwd: Some(std::path::PathBuf::from(output_directory.clone())),
        output_paths: vec![output_directory.clone()],
        env_path: Some(command_path()),
        intent: TaskIntent::Form(serde_json::json!({
            "musicdl": "playlist",
            "playlistUrl": request.playlist_url,
            "form": sanitized_form_snapshot(form),
            "denoise": request.downsample,
        })),
        parser: Some(download_progress_parser()),
        on_failure: None,
        cleanup_dir: Some(task_directory.into_path()),
    });
    Ok(TaskSubmitResult { task_id })
}
