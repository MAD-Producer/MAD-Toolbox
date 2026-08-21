//! 应用更新检查：拉取 GitHub 最新 Release 与当前版本比较。
//! 系统浏览器打开 Release 页面

use reqwest::header::ACCEPT;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::time::Duration;

use super::settings::load_app_settings;

const RELEASES_LATEST_URL: &str =
    "https://api.github.com/repos/MAD-Producer/MAD-Toolbox/releases/latest";
/// 未认证 GitHub API 限流 60 次/时/IP，仅手动触发足够；超时覆盖连接到响应读完
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

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

#[tauri::command]
pub(crate) async fn check_for_update(app: AppHandle) -> Result<UpdateCheck, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("MAD-Toolbox/{current}"))
        .timeout(REQUEST_TIMEOUT);
    // GitHub 直连在部分地区不可达：沿用设置页全局代理（下载器同款语义）
    if let Some(proxy) = load_app_settings(&app).proxy {
        let proxy = reqwest::Proxy::all(proxy.as_str())
            .map_err(|_| "代理地址无效，请检查设置中的代理配置".to_string())?;
        builder = builder.proxy(proxy);
    }
    let client = builder
        .build()
        .map_err(|error| format!("初始化更新检查请求失败：{error}"))?;
    let response = client
        .get(RELEASES_LATEST_URL)
        .header(ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|_| "GitHub 无法连通，请检查网络或代理设置".to_string())?;
    let release: GithubRelease = response
        .error_for_status()
        .map_err(|error| match error.status() {
            Some(status) => format!("GitHub 拒绝了更新检查请求（HTTP {status}），请稍后再试"),
            None => "GitHub 无法连通，请检查网络或代理设置".to_string(),
        })?
        .json()
        .await
        .map_err(|_| "解析 GitHub Release 信息失败".to_string())?;
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
