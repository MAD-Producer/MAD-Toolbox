//! music（musicdl）的 tauri command（自 lib.rs 归位）。
//! - 搜索 = 查询（§4.1）：结果经 musicdl-search-result 事件流式回填页面，自带 30 分钟超时，
//!   完成信号沿用 job-state 事件；
//! - 下载/歌单 = 作业：产出 TaskSpec 进任务系统。

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
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
use crate::core::task::{LineParser, TaskHub, TaskSpec};

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
        vec![TaskProgress {
            percent: Some(done as f64 / total as f64 * 100.0),
            detail: Some(
                rust_i18n::t!("backend.music.progressCount", done = done, total = total)
                    .to_string(),
            ),
        }]
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskSubmitResult {
    task_id: String,
}

/// 表单快照中可承载登录凭证的字段：落库 intent 前清空（与 bilibili sanitize_intent 同一推论）。
/// "cookies" 是旧版本的明文 Cookie 字段，保留以兜住升级用户的存量本地表单。
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

const STDERR_TAIL_LINES: usize = 3;

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
        return Err(rust_i18n::t!("backend.music.keywordRequired").to_string());
    }
    if request.music_sources.is_empty() {
        return Err(rust_i18n::t!("backend.music.sourceRequired").to_string());
    }
    if request.music_sources.len() > 60 {
        return Err(rust_i18n::t!("backend.music.sourceLimitExceeded").to_string());
    }
    request.search_size_per_source = request.search_size_per_source.clamp(1, 100);
    for (label, value) in [
        (
            rust_i18n::t!("backend.music.labelClientConfig"),
            &request.init_music_clients_cfg,
        ),
        (
            rust_i18n::t!("backend.music.labelRequests"),
            &request.requests_overrides,
        ),
        (
            rust_i18n::t!("backend.music.labelThreading"),
            &request.clients_threadings,
        ),
        (
            rust_i18n::t!("backend.music.labelSearchRules"),
            &request.search_rules,
        ),
    ] {
        if !value.is_object() {
            return Err(rust_i18n::t!("backend.music.mustBeJsonObject", label = label).to_string());
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
        std::fs::create_dir_all(directory).map_err(|error| {
            rust_i18n::t!("backend.music.downloadDirFailed", error = error).to_string()
        })?;
    }

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| rust_i18n::t!("backend.music.musicdlNotInstalledHint").to_string())?;
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
    let mut child =
        spawn_tree(&python, &argv, None, Some(&env_path), proxy.as_deref()).map_err(|error| {
            rust_i18n::t!("backend.music.searchSpawnFailed", error = error).to_string()
        })?;
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
            message: rust_i18n::t!("backend.music.searchingSources", count = source_count)
                .to_string(),
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
        let stderr_tail = Arc::new(Mutex::new(Vec::<String>::new()));
        let stderr_task = stderr.map(|stderr| {
            let tail = stderr_tail.clone();
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let mut buffer = tail.lock().unwrap();
                    if buffer.len() >= STDERR_TAIL_LINES {
                        buffer.remove(0);
                    }
                    buffer.push(line);
                }
            })
        });

        let (mut state_name, exit_code, mut message) = tokio::select! {
            status = child.wait() => match status {
                Ok(status) if status.success() => (
                    "completed",
                    status.code(),
                    rust_i18n::t!("backend.music.searchCompleted").to_string(),
                ),
                Ok(status) => (
                    "failed",
                    status.code(),
                    rust_i18n::t!("backend.music.searchFailed").to_string(),
                ),
                Err(error) => (
                    "failed",
                    None,
                    rust_i18n::t!("backend.music.searchWaitFailed", error = error).to_string(),
                ),
            },
            _ = sleep(Duration::from_secs(1800)) => {
                timeout_killer.kill_tree();
                let exit_code = child.wait().await.ok().and_then(|status| status.code());
                (
                    "failed",
                    exit_code,
                    rust_i18n::t!("backend.music.searchTimeout").to_string(),
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
            message = rust_i18n::t!("backend.music.searchCanceled").to_string();
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
                    message =
                        rust_i18n::t!("backend.music.searchCompletedWithCount", count = count)
                            .to_string();
                }
                Err(_) => {
                    message = rust_i18n::t!("backend.music.searchResultParseFailed").to_string();
                }
            }
        }
        let final_state = if state_name == "completed"
            && message == rust_i18n::t!("backend.music.searchResultParseFailed").to_string()
        {
            "failed"
        } else {
            state_name
        };
        if final_state == "failed" {
            let tail = stderr_tail.lock().unwrap().join("\n");
            if !tail.is_empty() {
                message = format!("{message}\n{tail}");
            }
        }
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
        Err(rust_i18n::t!("backend.music.searchNotFoundOrFinished").to_string())
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
        return Err(rust_i18n::t!("backend.music.searchStillRunningStopFirst").to_string());
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
        return Err(rust_i18n::t!("backend.music.searchStillRunningWait").to_string());
    }
    if indices.is_empty() {
        return Err(rust_i18n::t!("backend.music.selectionRequired").to_string());
    }
    if indices.len() > 1000 {
        return Err(rust_i18n::t!("backend.music.selectionLimitExceeded").to_string());
    }
    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| rust_i18n::t!("backend.music.musicdlNotInstalledRedetect").to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = runtime::adapter_path(&app)?;
    let source_state_path =
        sessions::search_session_path(&app, &session_id)?.join("results.pickle");
    if !source_state_path.is_file() {
        return Err(rust_i18n::t!("backend.music.searchResultExpired").to_string());
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
    std::fs::copy(&source_state_path, &task_state_path).map_err(|error| {
        rust_i18n::t!("backend.music.downloadSessionFailed", error = error).to_string()
    })?;
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
        title: rust_i18n::t!("backend.music.downloadTaskTitle", count = indices.len()).to_string(),
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
        return Err(rust_i18n::t!("backend.music.playlistUrlRequired").to_string());
    }
    if request.music_sources.is_empty() || request.music_sources.len() > 60 {
        return Err(rust_i18n::t!("backend.music.playlistSourceRange").to_string());
    }
    for (label, value) in [
        (
            rust_i18n::t!("backend.music.labelClientConfig"),
            &request.init_music_clients_cfg,
        ),
        (
            rust_i18n::t!("backend.music.labelRequests"),
            &request.requests_overrides,
        ),
        (
            rust_i18n::t!("backend.music.labelThreading"),
            &request.clients_threadings,
        ),
        (
            rust_i18n::t!("backend.music.labelSearchRules"),
            &request.search_rules,
        ),
    ] {
        if !value.is_object() {
            return Err(rust_i18n::t!("backend.music.mustBeJsonObject", label = label).to_string());
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
        .ok_or_else(|| rust_i18n::t!("backend.music.exportDirUnresolved").to_string())?;
    std::fs::create_dir_all(output_directory).map_err(|error| {
        rust_i18n::t!("backend.music.exportDirFailed", error = error).to_string()
    })?;

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| rust_i18n::t!("backend.music.musicdlNotInstalledRedetect").to_string())?;
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
        title: rust_i18n::t!(
            "backend.music.playlistTaskTitle",
            url = request.playlist_url
        )
        .to_string(),
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
        cleanup_dir: Some(task_directory.into_path()),
    });
    Ok(TaskSubmitResult { task_id })
}
