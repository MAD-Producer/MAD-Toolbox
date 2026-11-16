//! 公共 BT tracker 列表：拉取、按天缓存与回退链。
//! 主源 XIU2/TrackersListCollection（每日更新，best.txt），备选 ngosang/trackerslist。
//! 抓取链优先走镜像通道（mt_dependencies Release 随每日同步发布的列表，经 OpenList
//! 固定入口分发，国内可达性最好），失败再直连 GitHub raw / jsDelivr 保新鲜。
//! 缓存放应用数据目录 aria2/ 下。

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::core::settings::{app_data_dir, load_app_settings};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackerSource {
    /// XIU2/TrackersListCollection best.txt（精选，约 20 条）。
    Xiu2,
    /// ngosang/trackerslist trackers_best.txt（带存活检测）。
    Ngosang,
}

impl TrackerSource {
    /// 清单 `trackers` 节的键名，同时用作缓存文件名标签。
    fn key(self) -> &'static str {
        match self {
            Self::Xiu2 => "xiu2",
            Self::Ngosang => "ngosang",
        }
    }

    fn urls(self) -> &'static [&'static str] {
        match self {
            Self::Xiu2 => &[
                "https://raw.githubusercontent.com/XIU2/TrackersListCollection/master/best.txt",
                "https://cdn.jsdelivr.net/gh/XIU2/TrackersListCollection@master/best.txt",
            ],
            Self::Ngosang => &[
                "https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt",
                "https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt",
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedTrackers {
    fetched_at: String,
    source: TrackerSource,
    trackers: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerListResult {
    pub source: TrackerSource,
    pub trackers: Vec<String>,
    pub fetched_at: String,
    /// true = 命中本地缓存（未刷新或拉取失败回退）。
    pub cached: bool,
}

const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const FETCH_TIMEOUT: Duration = Duration::from_secs(15);

fn cache_path(app: &AppHandle, source: TrackerSource) -> Option<std::path::PathBuf> {
    Some(
        app_data_dir(app)
            .ok()?
            .join("aria2")
            .join(format!("trackers-{}.json", source.key())),
    )
}

fn read_cache(app: &AppHandle, source: TrackerSource) -> Option<CachedTrackers> {
    let bytes = std::fs::read(cache_path(app, source)?).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// 只读本地缓存（不关心新鲜度、不发网络）：预览命令用。
pub(crate) fn cached_trackers(app: &AppHandle, source: TrackerSource) -> Vec<String> {
    read_cache(app, source)
        .map(|cached| cached.trackers)
        .unwrap_or_default()
}

fn write_cache(app: &AppHandle, source: TrackerSource, cached: &CachedTrackers) {
    let Some(path) = cache_path(app, source) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(bytes) = serde_json::to_vec_pretty(cached) {
        // 临时文件 + 原子替换：并发刷新不会把缓存文件写成半截
        let tmp = path.with_extension("json.tmp");
        if std::fs::write(&tmp, bytes).is_ok() {
            let _ = std::fs::rename(&tmp, &path);
        }
    }
}

fn cache_fresh(cached: &CachedTrackers) -> bool {
    let Ok(ttl) = chrono::Duration::from_std(CACHE_TTL) else {
        return false;
    };
    chrono::DateTime::parse_from_rfc3339(&cached.fetched_at)
        .map(|fetched| chrono::Utc::now().signed_duration_since(fetched) < ttl)
        .unwrap_or(false)
}

/// aria2 `--bt-tracker` 支持的 announce 协议。
const ANNOUNCE_PREFIXES: [&str; 5] = ["udp://", "http://", "https://", "ws://", "wss://"];

/// 过滤空行、注释与非 announce 行（一行一个 URL）。
/// 语义过滤兜住错误内容：上游/镜像误吐 HTML 时不会把标签当 tracker 注入。
pub(crate) fn parse_trackers(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            ANNOUNCE_PREFIXES.iter().any(|p| lower.starts_with(p))
        })
        .map(str::to_string)
        .collect()
}

fn tracker_client(app: &AppHandle) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder().timeout(FETCH_TIMEOUT);
    if let Some(proxy) = load_app_settings(app).proxy {
        builder = builder.proxy(reqwest::Proxy::all(proxy).map_err(|error| error.to_string())?);
    }
    builder.build().map_err(|error| error.to_string())
}

async fn fetch_text(app: &AppHandle, urls: &[&str]) -> Result<String, String> {
    let client = tracker_client(app)?;
    let mut last_error = String::new();
    for url in urls {
        match client.get(*url).send().await {
            Ok(response) => match response.error_for_status() {
                Ok(response) => match response.text().await {
                    Ok(text) => return Ok(text),
                    Err(error) => last_error = error.to_string(),
                },
                Err(error) => last_error = error.to_string(),
            },
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(last_error)
}

async fn fetch_fresh(app: &AppHandle, source: TrackerSource) -> Result<CachedTrackers, String> {
    // 镜像优先：OpenList 固定入口的分发链路比 GitHub raw 稳定。
    // 镜像失败或解析不出有效 announce 时继续走上游直连，不让内容错误挡住回退链
    let text = match crate::core::deps::fetch_mirror_tracker_text(app, source.key()).await {
        Ok((_version, text)) if !parse_trackers(&text).is_empty() => text,
        _ => fetch_text(app, source.urls()).await?,
    };
    let trackers = parse_trackers(&text);
    if trackers.is_empty() {
        return Err(rust_i18n::t!(
            "backend.aria2.commands.tracker_fetch_failed",
            e = "empty list"
        )
        .to_string());
    }
    Ok(CachedTrackers {
        fetched_at: chrono::Utc::now().to_rfc3339(),
        source,
        trackers,
    })
}

/// 提交下载用的 tracker 列表：缓存新鲜（24h 内）直接用，否则尝试刷新；
/// 失败回退本地缓存（无论新旧），再退空。拉取失败不阻断下载——
/// tracker 只是加速器，DHT 与种子自带 tracker 仍是主路径。
pub(crate) async fn for_submit(app: &AppHandle, source: TrackerSource) -> Vec<String> {
    if let Some(cached) = read_cache(app, source).filter(cache_fresh) {
        return cached.trackers;
    }
    match fetch_fresh(app, source).await {
        Ok(cached) => {
            write_cache(app, source, &cached);
            cached.trackers
        }
        Err(_) => read_cache(app, source)
            .map(|cached| cached.trackers)
            .unwrap_or_default(),
    }
}

/// 预览/表单刷新用的完整查询：refresh=true 绕过 TTL 强拉。
pub(crate) async fn tracker_list(
    app: &AppHandle,
    source: TrackerSource,
    refresh: bool,
) -> Result<TrackerListResult, String> {
    if !refresh {
        if let Some(cached) = read_cache(app, source).filter(cache_fresh) {
            return Ok(TrackerListResult {
                source: cached.source,
                trackers: cached.trackers,
                fetched_at: cached.fetched_at,
                cached: true,
            });
        }
    }
    match fetch_fresh(app, source).await {
        Ok(cached) => {
            write_cache(app, source, &cached);
            Ok(TrackerListResult {
                source: cached.source,
                trackers: cached.trackers,
                fetched_at: cached.fetched_at,
                cached: false,
            })
        }
        Err(error) => {
            // 拉取失败回退过期缓存，并附失败说明
            if let Some(cached) = read_cache(app, source) {
                return Ok(TrackerListResult {
                    source: cached.source,
                    trackers: cached.trackers,
                    fetched_at: cached.fetched_at,
                    cached: true,
                });
            }
            Err(rust_i18n::t!("backend.aria2.commands.tracker_fetch_failed", e = error).to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::parse_trackers;

    #[test]
    fn parses_lines_and_skips_comments_and_blank() {
        let text = "\n# comment\nudp://a:80/announce\n  \nhttp://b/announce\nhttps://c/announce\nwss://d/announce\n";
        assert_eq!(
            parse_trackers(text),
            vec![
                "udp://a:80/announce".to_string(),
                "http://b/announce".to_string(),
                "https://c/announce".to_string(),
                "wss://d/announce".to_string(),
            ]
        );
    }

    #[test]
    fn non_announce_content_is_filtered() {
        // 上游/镜像误吐 HTML 时不得把标签当 tracker 注入
        let html = "<!DOCTYPE html>\n<html>\nftp://ignored/announce\ntelnet://x\n";
        assert!(parse_trackers(html).is_empty());
        assert!(parse_trackers("").is_empty());
        assert!(parse_trackers("# only comment").is_empty());
    }
}
