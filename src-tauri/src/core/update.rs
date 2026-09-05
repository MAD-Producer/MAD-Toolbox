//! 应用更新：check_for_update 拉取更新清单比较版本（启动静默检查 + 设置页展示），
//! Windows 安装包流式写盘并增量验签，macOS 继续由 tauri-plugin-updater 就地安装。

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Url};
use tauri_plugin_updater::UpdaterExt;

#[cfg(not(target_os = "windows"))]
use std::sync::atomic::AtomicU64;
#[cfg(not(target_os = "windows"))]
use std::sync::Mutex;
#[cfg(not(target_os = "windows"))]
use std::time::Instant;
#[cfg(target_os = "windows")]
use tauri::Manager;

use super::deps::bundled_binary;
use super::settings::load_app_settings;

const MANIFEST_URL: &str =
    "https://github.com/MAD-Producer/MAD-Toolbox/releases/latest/download/latest-%EDITION%.json";
const MIRROR_MANIFEST_URL: &str = "https://dl.mad.org.cn/sd/mt/latest-%EDITION%.json";
const RELEASE_URL_PREFIX: &str = "https://github.com/MAD-Producer/MAD-Toolbox/releases/tag/v";
/// MAD Producer OpenList 下载目录。`/@s/mt` 是分享页面，实际文件需走 `/sd/mt/...`。
const MIRROR_BASE_URL: &str = "https://dl.mad.org.cn/";
/// 清单请求超时；下载阶段在 check 后单独放宽
const UPDATER_TIMEOUT: Duration = Duration::from_secs(30);
/// 安装包下载不设整体超时（镜像源较慢），仅放宽到 1 小时兜底
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(3600);
/// 进度事件最小间隔，避免大文件下载时事件洪泛
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(500);
#[cfg(target_os = "windows")]
const STAGED_INSTALLER_NAME: &str = "MAD-Toolbox-update.exe";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateCheck {
    current_version: String,
    latest_version: String,
    update_available: bool,
    release_url: String,
    source: UpdateSource,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum UpdateSource {
    Github,
    Mirror,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateDownloadProgress {
    received: u64,
    total: Option<u64>,
}

/// 安装版本检测：Full 捆绑 ffmpeg 等 sidecar，Lite 不捆绑 ffmpeg。
/// 只查应用安装目录/资源目录，系统 PATH 上的 ffmpeg 不影响判定。
fn installed_edition(app: &AppHandle) -> &'static str {
    if bundled_binary(app, "ffmpeg").is_some() {
        "full"
    } else {
        "lite"
    }
}

fn manifest_endpoint(app: &AppHandle, source: UpdateSource) -> Result<Url, String> {
    let template = match source {
        UpdateSource::Github => MANIFEST_URL,
        UpdateSource::Mirror => MIRROR_MANIFEST_URL,
    };
    template
        .replace("%EDITION%", installed_edition(app))
        .parse()
        .map_err(|_| rust_i18n::t!("backend.update.manifestInvalidUrl").to_string())
}

fn mirror_download_url(download_url: &Url, version: &str) -> Result<Url, String> {
    let file_name = download_url
        .path_segments()
        .and_then(Iterator::last)
        .filter(|segment| !segment.is_empty())
        .ok_or_else(|| rust_i18n::t!("backend.update.manifestInvalidUrl").to_string())?;
    let version_dir = format!("v{version}");
    let mut mirror_url: Url = MIRROR_BASE_URL
        .parse()
        .map_err(|_| rust_i18n::t!("backend.update.manifestInvalidUrl").to_string())?;
    mirror_url
        .path_segments_mut()
        .map_err(|_| rust_i18n::t!("backend.update.manifestInvalidUrl").to_string())?
        .extend(["sd", "mt", &version_dir, file_name]);
    Ok(mirror_url)
}

#[cfg(target_os = "windows")]
fn updater_public_key(app: &AppHandle) -> Result<&str, String> {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|config| config.get("pubkey"))
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "updater public key is missing".to_string())
}

#[cfg(target_os = "windows")]
fn decode_base64_text(value: &str) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let bytes = STANDARD.decode(value).map_err(|error| error.to_string())?;
    String::from_utf8(bytes).map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
async fn remove_file_if_exists(path: &std::path::Path) -> Result<(), String> {
    match tokio::fs::remove_file(path).await {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(target_os = "windows")]
async fn download_and_launch_windows(
    app: &AppHandle,
    download_url: &Url,
    encoded_signature: &str,
) -> Result<(), String> {
    use minisign_verify::{PublicKey, Signature};
    use tokio::io::AsyncWriteExt;

    let public_key = PublicKey::decode(&decode_base64_text(updater_public_key(app)?)?)
        .map_err(|error| error.to_string())?;
    let signature = Signature::decode(&decode_base64_text(encoded_signature)?)
        .map_err(|error| error.to_string())?;
    let mut verifier = public_key
        .verify_stream(&signature)
        .map_err(|error| error.to_string())?;

    let mut client_builder = reqwest::Client::builder()
        .user_agent(format!("MAD-Toolbox/{}", app.package_info().version))
        .timeout(DOWNLOAD_TIMEOUT);
    if let Some(proxy) = load_app_settings(app).proxy {
        let proxy = reqwest::Proxy::all(proxy.as_str())
            .map_err(|_| rust_i18n::t!("backend.update.invalidProxy").to_string())?;
        client_builder = client_builder.proxy(proxy);
    }
    let client = client_builder.build().map_err(|error| error.to_string())?;
    let mut response = client
        .get(download_url.clone())
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| error.to_string())?;
    let total = response.content_length();

    let staging_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("update");
    tokio::fs::create_dir_all(&staging_dir)
        .await
        .map_err(|error| error.to_string())?;
    let installer_path = staging_dir.join(STAGED_INSTALLER_NAME);
    let partial_path = installer_path.with_extension("exe.part");
    remove_file_if_exists(&partial_path).await?;
    remove_file_if_exists(&installer_path).await?;

    let result = async {
        let mut file = tokio::fs::File::create(&partial_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut received = 0_u64;
        let mut last_emit = std::time::Instant::now();
        while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
            file.write_all(&chunk)
                .await
                .map_err(|error| error.to_string())?;
            verifier.update(&chunk);
            received += chunk.len() as u64;
            if last_emit.elapsed() >= PROGRESS_EMIT_INTERVAL {
                last_emit = std::time::Instant::now();
                let _ = app.emit(
                    "update-download-progress",
                    UpdateDownloadProgress { received, total },
                );
            }
        }
        file.flush().await.map_err(|error| error.to_string())?;
        file.sync_all().await.map_err(|error| error.to_string())?;
        drop(file);
        verifier.finalize().map_err(|error| error.to_string())?;
        tokio::fs::rename(&partial_path, &installer_path)
            .await
            .map_err(|error| error.to_string())?;
        let _ = app.emit(
            "update-download-progress",
            UpdateDownloadProgress {
                received,
                total: total.or(Some(received)),
            },
        );
        std::process::Command::new(&installer_path)
            .args(["/P", "/R", "/UPDATE"])
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    .await;

    if result.is_err() {
        let _ = remove_file_if_exists(&partial_path).await;
        let _ = remove_file_if_exists(&installer_path).await;
    }
    result
}

#[cfg(target_os = "windows")]
pub(crate) fn cleanup_staged_installer(app: &AppHandle) {
    if let Ok(directory) = app.path().app_cache_dir() {
        let installer = directory.join("update").join(STAGED_INSTALLER_NAME);
        let _ = std::fs::remove_file(&installer);
        let _ = std::fs::remove_file(installer.with_extension("exe.part"));
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn cleanup_staged_installer(_app: &AppHandle) {}

async fn check_update_from_source(
    app: &AppHandle,
    source: UpdateSource,
) -> Result<UpdateCheck, String> {
    let current = app.package_info().version.to_string();
    let update_available = Arc::new(AtomicBool::new(false));
    let comparator_result = Arc::clone(&update_available);
    let mut builder = app
        .updater_builder()
        .endpoints(vec![manifest_endpoint(app, source)?])
        .map_err(|error| rust_i18n::t!("backend.update.manifestFailed", error = error).to_string())?
        .version_comparator(move |current, release| {
            comparator_result.store(release.version > current, Ordering::Relaxed);
            true
        })
        .timeout(UPDATER_TIMEOUT);
    if let Some(proxy) = load_app_settings(&app).proxy {
        let proxy = proxy
            .parse()
            .map_err(|_| rust_i18n::t!("backend.update.invalidProxy").to_string())?;
        builder = builder.proxy(proxy);
    }
    let updater = builder.build().map_err(|error| {
        rust_i18n::t!("backend.update.manifestFailed", error = error).to_string()
    })?;
    let release = updater
        .check()
        .await
        .map_err(|error| rust_i18n::t!("backend.update.manifestFailed", error = error).to_string())?
        .ok_or_else(|| rust_i18n::t!("backend.update.releaseParseFailed").to_string())?;
    Ok(UpdateCheck {
        latest_version: release.version.clone(),
        update_available: update_available.load(Ordering::Relaxed),
        release_url: format!("{RELEASE_URL_PREFIX}{}", release.version),
        current_version: current,
        source,
    })
}

#[tauri::command]
pub(crate) async fn check_for_update(
    app: AppHandle,
    prefer_mirror: bool,
) -> Result<UpdateCheck, String> {
    let primary = if prefer_mirror {
        UpdateSource::Mirror
    } else {
        UpdateSource::Github
    };
    let fallback = if prefer_mirror {
        UpdateSource::Github
    } else {
        UpdateSource::Mirror
    };
    match check_update_from_source(&app, primary).await {
        Ok(update) => Ok(update),
        Err(_) => check_update_from_source(&app, fallback).await,
    }
}

#[tauri::command]
pub(crate) async fn install_update(app: AppHandle, use_mirror: bool) -> Result<String, String> {
    let source = if use_mirror {
        UpdateSource::Mirror
    } else {
        UpdateSource::Github
    };
    let mut builder = app
        .updater_builder()
        .endpoints(vec![manifest_endpoint(&app, source)?])
        .map_err(|error| rust_i18n::t!("backend.update.manifestFailed", error = error).to_string())?
        .timeout(UPDATER_TIMEOUT);
    if let Some(proxy) = load_app_settings(&app).proxy {
        let proxy = proxy
            .parse()
            .map_err(|_| rust_i18n::t!("backend.update.invalidProxy").to_string())?;
        builder = builder.proxy(proxy);
    }
    let updater = builder.build().map_err(|error| {
        rust_i18n::t!("backend.update.manifestFailed", error = error).to_string()
    })?;
    let mut update = updater
        .check()
        .await
        .map_err(|error| rust_i18n::t!("backend.update.manifestFailed", error = error).to_string())?
        .ok_or_else(|| rust_i18n::t!("backend.update.alreadyUpToDate").to_string())?;
    // OpenList 按版本保存发布文件；镜像模式的清单和安装包均走 OpenList。
    if use_mirror {
        update.download_url = mirror_download_url(&update.download_url, &update.version)?;
    }
    update.timeout = Some(DOWNLOAD_TIMEOUT);

    #[cfg(target_os = "windows")]
    {
        download_and_launch_windows(&app, &update.download_url, &update.signature)
            .await
            .map_err(|error| {
                rust_i18n::t!("backend.update.downloadFailed", error = error).to_string()
            })?;
        app.exit(0);
        Ok(update.version.clone())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Tauri 命令的 future 需要 Send：进度状态用原子量/锁共享；结束时补发一次最终进度
        let received = Arc::new(AtomicU64::new(0));
        let total: Arc<Mutex<Option<u64>>> = Arc::new(Mutex::new(None));
        let last_emit = Arc::new(Mutex::new(Instant::now()));
        let progress_app = app.clone();
        let on_chunk = {
            let received = Arc::clone(&received);
            let total = Arc::clone(&total);
            let last_emit = Arc::clone(&last_emit);
            move |chunk: usize, content_length: Option<u64>| {
                received.fetch_add(chunk as u64, Ordering::Relaxed);
                if let Some(length) = content_length {
                    *total.lock().unwrap() = Some(length);
                }
                let mut last_emit = last_emit.lock().unwrap();
                if last_emit.elapsed() >= PROGRESS_EMIT_INTERVAL {
                    *last_emit = Instant::now();
                    let _ = progress_app.emit(
                        "update-download-progress",
                        UpdateDownloadProgress {
                            received: received.load(Ordering::Relaxed),
                            total: *total.lock().unwrap(),
                        },
                    );
                }
            }
        };
        let finish_app = app.clone();
        let on_finish = {
            let received = Arc::clone(&received);
            let total = Arc::clone(&total);
            move || {
                let _ = finish_app.emit(
                    "update-download-progress",
                    UpdateDownloadProgress {
                        received: received.load(Ordering::Relaxed),
                        total: total
                            .lock()
                            .unwrap()
                            .or(Some(received.load(Ordering::Relaxed))),
                    },
                );
            }
        };
        update
            .download_and_install(on_chunk, on_finish)
            .await
            .map_err(|error| {
                rust_i18n::t!("backend.update.downloadFailed", error = error).to_string()
            })?;
        // macOS：就地替换 .app 后需要重启进程（tauri 核心 API，等价 process 插件的 relaunch）
        app.request_restart();
        Ok(update.version.clone())
    }
}
