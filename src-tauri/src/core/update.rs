//! 应用更新：check_for_update 拉 GitHub 最新 Release 比较版本（启动静默检查 + 设置页展示），
//! install_update 经 tauri-plugin-updater 下载验签并就地安装，支持镜像源与设置页代理。

use reqwest::header::ACCEPT;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

use super::deps::bundled_binary;
use super::settings::load_app_settings;

const RELEASES_LATEST_URL: &str =
    "https://api.github.com/repos/MAD-Producer/MAD-Toolbox/releases/latest";
const MANIFEST_URL: &str =
    "https://github.com/MAD-Producer/MAD-Toolbox/releases/latest/download/latest-%EDITION%.json";
/// MAD Producer 官方镜像：代理 GitHub 直链，供无法直连 GitHub 的用户手动切换
const MIRROR_PREFIX: &str = "https://store.madproducer.cn/";
/// 未认证 GitHub API 限流 60 次/时/IP，仅手动触发足够；超时覆盖连接到响应读完
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// 清单请求超时；下载阶段在 check 后单独放宽
const UPDATER_TIMEOUT: Duration = Duration::from_secs(30);
/// 安装包下载不设整体超时（镜像源较慢），仅放宽到 1 小时兜底
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(3600);
/// 进度事件最小间隔，避免大文件下载时事件洪泛
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(500);

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateCheck {
    current_version: String,
    latest_version: String,
    update_available: bool,
    release_url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateDownloadProgress {
    received: u64,
    total: Option<u64>,
}

/// 解析失败返回 None，调用方按无更新处理，避免格式意外时误报。
fn parse_version(text: &str) -> Option<(u64, u64, u64)> {
    let mut segments = text
        .trim()
        .trim_start_matches(['v', 'V'])
        .split(|character| character == '-' || character == '+')
        .next()?
        .split('.');
    let major = segments.next()?.parse().ok()?;
    let minor = segments.next()?.parse().ok()?;
    let patch = segments.next()?.parse().ok()?;
    (segments.next().is_none()).then_some((major, minor, patch))
}

/// 安装版本检测：Full 捆绑 ffmpeg 等 sidecar，Lite 只带 BBDown。
/// 只查应用安装目录/资源目录，系统 PATH 上的 ffmpeg 不影响判定。
fn installed_edition(app: &AppHandle) -> &'static str {
    if bundled_binary(app, "ffmpeg").is_some() {
        "full"
    } else {
        "lite"
    }
}

#[tauri::command]
pub(crate) async fn check_for_update(app: AppHandle) -> Result<UpdateCheck, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("MAD-Toolbox/{current}"))
        .timeout(REQUEST_TIMEOUT);
    // GitHub 直连在部分地区不可达：沿用设置页全局代理（下载器同款语义）
    if let Some(proxy) = load_app_settings(&app).proxy {
        let proxy = reqwest::Proxy::all(proxy.as_str())
            .map_err(|_| rust_i18n::t!("backend.update.invalidProxy").to_string())?;
        builder = builder.proxy(proxy);
    }
    let client = builder.build().map_err(|error| {
        rust_i18n::t!("backend.update.requestInitFailed", error = error).to_string()
    })?;
    let response = client
        .get(RELEASES_LATEST_URL)
        .header(ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|_| rust_i18n::t!("backend.update.githubUnreachable").to_string())?;
    let release: GithubRelease = response
        .error_for_status()
        .map_err(|error| match error.status() {
            Some(status) => {
                rust_i18n::t!("backend.update.githubRejected", status = status).to_string()
            }
            None => rust_i18n::t!("backend.update.githubUnreachable").to_string(),
        })?
        .json()
        .await
        .map_err(|_| rust_i18n::t!("backend.update.releaseParseFailed").to_string())?;
    let update_available = parse_version(&release.tag_name)
        .zip(parse_version(&current))
        .is_some_and(|(latest, current)| latest > current);
    Ok(UpdateCheck {
        latest_version: release
            .tag_name
            .trim()
            .trim_start_matches(['v', 'V'])
            .to_string(),
        update_available,
        release_url: release.html_url,
        current_version: current,
    })
}

#[tauri::command]
pub(crate) async fn install_update(
    app: AppHandle,
    use_mirror: bool,
) -> Result<String, String> {
    let edition = installed_edition(&app);
    let endpoint = if use_mirror {
        format!("{MIRROR_PREFIX}{}", MANIFEST_URL.replace("%EDITION%", edition))
    } else {
        MANIFEST_URL.replace("%EDITION%", edition)
    };
    let mut builder = app
        .updater_builder()
        .endpoints(vec![endpoint
            .parse()
            .map_err(|_| rust_i18n::t!("backend.update.manifestInvalidUrl").to_string())?])
        .map_err(|error| {
            rust_i18n::t!("backend.update.manifestFailed", error = error).to_string()
        })?
        .timeout(UPDATER_TIMEOUT);
    if let Some(proxy) = load_app_settings(&app).proxy {
        let proxy = proxy
            .parse()
            .map_err(|_| rust_i18n::t!("backend.update.invalidProxy").to_string())?;
        builder = builder.proxy(proxy);
    }
    let updater = builder
        .build()
        .map_err(|error| {
            rust_i18n::t!("backend.update.manifestFailed", error = error).to_string()
        })?;
    let mut update = updater
        .check()
        .await
        .map_err(|error| {
            rust_i18n::t!("backend.update.manifestFailed", error = error).to_string()
        })?
        .ok_or_else(|| rust_i18n::t!("backend.update.alreadyUpToDate").to_string())?;
    // 清单本身可经镜像获取，但其中的下载直链仍是 GitHub：镜像模式下重写后再下载
    if use_mirror {
        update.download_url = format!("{MIRROR_PREFIX}{}", update.download_url)
            .parse()
            .map_err(|_| rust_i18n::t!("backend.update.manifestInvalidUrl").to_string())?;
    }
    update.timeout = Some(DOWNLOAD_TIMEOUT);

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
    let on_finish = {
        let received = Arc::clone(&received);
        let total = Arc::clone(&total);
        move || {
            let _ = app.emit(
                "update-download-progress",
                UpdateDownloadProgress {
                    received: received.load(Ordering::Relaxed),
                    total: total.lock().unwrap().or(Some(received.load(Ordering::Relaxed))),
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
    // Windows：install 已退出应用并交由 NSIS passive 安装器接管（装完自动重启应用）；
    // macOS：就地替换 .app 后需要重启进程
    #[cfg(not(target_os = "windows"))]
    tauri_plugin_process::restart(&app);
    Ok(update.version.clone())
}

#[cfg(test)]
mod tests {
    use super::parse_version;

    #[test]
    fn parses_semver_tag_with_prefix_and_suffix() {
        assert_eq!(parse_version("v0.10.1"), Some((0, 10, 1)));
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("v1.2.3-beta.1"), Some((1, 2, 3)));
        assert_eq!(parse_version("v1.2.3+build.7"), Some((1, 2, 3)));
    }

    #[test]
    fn rejects_malformed_tags() {
        assert_eq!(parse_version("v1.2"), None);
        assert_eq!(parse_version("main"), None);
        assert_eq!(parse_version("v1.2.x"), None);
        assert_eq!(parse_version(""), None);
    }
}
