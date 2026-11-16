//! 公共 BT tracker 列表：拉取、按天缓存与回退链。
//! mt_dependencies 合并 XIU2 和 ngosang 列表，每日更新。
//! 列表仅通过 mt_dependencies 的自有 CDN 分发，获取失败时使用本地缓存。
//! 缓存放应用数据目录 aria2/ 下。

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::core::settings::app_data_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedTrackers {
    fetched_at: String,
    trackers: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerListResult {
    pub trackers: Vec<String>,
    pub fetched_at: String,
    /// true = 命中本地缓存（未刷新或拉取失败回退）。
    pub cached: bool,
}

const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

fn cache_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    Some(
        app_data_dir(app)
            .ok()?
            .join("aria2")
            .join("trackers-merged.json"),
    )
}

fn read_cache(app: &AppHandle) -> Option<CachedTrackers> {
    let bytes = std::fs::read(cache_path(app)?).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// 只读本地缓存（不关心新鲜度、不发网络）：预览命令用。
pub(crate) fn cached_trackers(app: &AppHandle) -> Vec<String> {
    read_cache(app)
        .map(|cached| cached.trackers)
        .unwrap_or_default()
}

fn write_cache(app: &AppHandle, cached: &CachedTrackers) {
    let Some(path) = cache_path(app) else {
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

async fn fetch_fresh(app: &AppHandle) -> Result<CachedTrackers, String> {
    let (_version, text) = crate::core::deps::fetch_mirror_tracker_text(app, "merged").await?;
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
        trackers,
    })
}

/// 提交下载用的 tracker 列表：缓存新鲜（24h 内）直接用，否则尝试刷新；
/// 失败回退本地缓存（无论新旧），再退空。拉取失败不阻断下载——
/// tracker 只是加速器，DHT 与种子自带 tracker 仍是主路径。
pub(crate) async fn for_submit(app: &AppHandle) -> Vec<String> {
    if let Some(cached) = read_cache(app).filter(cache_fresh) {
        return cached.trackers;
    }
    match fetch_fresh(app).await {
        Ok(cached) => {
            write_cache(app, &cached);
            cached.trackers
        }
        Err(_) => read_cache(app)
            .map(|cached| cached.trackers)
            .unwrap_or_default(),
    }
}

/// 预览/表单刷新用的完整查询：refresh=true 绕过 TTL 强拉。
pub(crate) async fn tracker_list(
    app: &AppHandle,
    refresh: bool,
) -> Result<TrackerListResult, String> {
    if !refresh {
        if let Some(cached) = read_cache(app).filter(cache_fresh) {
            return Ok(TrackerListResult {
                trackers: cached.trackers,
                fetched_at: cached.fetched_at,
                cached: true,
            });
        }
    }
    match fetch_fresh(app).await {
        Ok(cached) => {
            write_cache(app, &cached);
            Ok(TrackerListResult {
                trackers: cached.trackers,
                fetched_at: cached.fetched_at,
                cached: false,
            })
        }
        Err(error) => {
            // 拉取失败回退过期缓存，并附失败说明
            if let Some(cached) = read_cache(app) {
                return Ok(TrackerListResult {
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
