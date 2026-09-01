//! bilibili 原生扫码登录（自 lib.rs 回迁）。
//! 注意：这不是 spawn BBDown 进程——QR 生成/轮询/凭证校验是 Rust 原生 reqwest 流，
//! QR 以 SVG dataUrl 经事件推送（架构文档 §4.2 扩展点的实际形态）。
//! BBDown.data 按原 CLI 语义保存在随应用附带的 BBDown 可执行文件目录。

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use qrcode::QrCode;
use reqwest::{
    header::{COOKIE, REFERER},
    Client, Url,
};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

use crate::core::deps::ToolName;
use crate::core::query::{JobState, RunResult};

const BBDOWN_QR_GENERATE_URL: &str =
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main-fe-header";
const BBDOWN_QR_POLL_URL: &str = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll";
const BILIBILI_NAV_URL: &str = "https://api.bilibili.com/x/web-interface/nav";
const BBDOWN_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BBDOWN_COOKIE_KEYS: [&str; 7] = [
    "SESSDATA",
    "bili_jct",
    "DedeUserID",
    "DedeUserID__ckMd5",
    "sid",
    "buvid3",
    "buvid4",
];

fn merge_cookie_fields(target: &mut HashMap<String, String>, source: HashMap<String, String>) {
    for key in BBDOWN_COOKIE_KEYS {
        if let Some(value) = source.get(key).filter(|value| !value.is_empty()) {
            target.insert(key.to_string(), value.clone());
        }
    }
}

fn has_required_bbdown_cookie(fields: &HashMap<String, String>) -> bool {
    ["SESSDATA", "bili_jct", "DedeUserID"]
        .iter()
        .all(|key| fields.get(*key).is_some_and(|value| !value.is_empty()))
}

fn cookie_header(fields: &HashMap<String, String>) -> String {
    BBDOWN_COOKIE_KEYS
        .iter()
        .filter_map(|key| {
            fields
                .get(*key)
                .map(|value| format!("{key}={}", value.replace(',', "%2C")))
        })
        .collect::<Vec<_>>()
        .join(";")
}

fn merge_cookie_url(target: &mut HashMap<String, String>, value: &str) {
    if let Ok(url) = Url::parse(value) {
        let fields = url
            .query_pairs()
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
        merge_cookie_fields(target, fields);
    }
}

async fn validate_bbdown_cookie(client: &Client, cookie: &str) -> Result<(), String> {
    let response = client
        .get(BILIBILI_NAV_URL)
        .header(COOKIE, cookie)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| {
            rust_i18n::t!(
                "backend.bilibili.login.validate_cookie_failed",
                error = error
            )
            .to_string()
        })?;
    if !response.status().is_success() {
        return Err(rust_i18n::t!(
            "backend.bilibili.login.validate_cookie_failed",
            error = format!("HTTP {}", response.status())
        )
        .to_string());
    }
    let body: serde_json::Value = response.json().await.map_err(|error| {
        rust_i18n::t!(
            "backend.bilibili.login.parse_validate_result_failed",
            error = error
        )
        .to_string()
    })?;
    if body
        .pointer("/data/isLogin")
        .and_then(serde_json::Value::as_bool)
        == Some(true)
    {
        Ok(())
    } else {
        Err(rust_i18n::t!("backend.bilibili.login.cookie_incomplete").to_string())
    }
}

fn save_bbdown_data(data_path: &Path, completed: &str) -> Result<(), String> {
    let temporary = data_path.with_extension(format!("data.{}.tmp", Uuid::new_v4()));
    std::fs::write(&temporary, completed).map_err(|error| {
        rust_i18n::t!("backend.bilibili.login.write_failed", error = error).to_string()
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600)).map_err(
            |error| {
                rust_i18n::t!(
                    "backend.bilibili.login.set_permissions_failed",
                    error = error
                )
                .to_string()
            },
        )?;
    }
    std::fs::rename(&temporary, data_path).map_err(|error| {
        rust_i18n::t!("backend.bilibili.login.save_data_failed", error = error).to_string()
    })?;
    Ok(())
}

async fn validate_and_save_bbdown_data(
    client: &Client,
    data_path: &Path,
    cookies: &HashMap<String, String>,
) -> Result<(), String> {
    if !has_required_bbdown_cookie(cookies) {
        return Err(rust_i18n::t!("backend.bilibili.login.poll_cookie_incomplete").to_string());
    }
    let completed = cookie_header(cookies);
    validate_bbdown_cookie(client, &completed).await?;
    save_bbdown_data(data_path, &completed)
}

/// 本地 `BBDown.data` 须包含 BBDown 必要 Cookie 字段才可能处于登录态。
fn saved_bbdown_cookie(data_path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(data_path).ok()?;
    let fields = content
        .split(';')
        .filter_map(|pair| pair.split_once('='))
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .collect::<HashMap<_, _>>();
    has_required_bbdown_cookie(&fields).then(|| content.trim().to_string())
}

/// 查询当前登录态：文件缺失、字段不全或在线校验未通过（含 Cookie 过期、
/// 网络不可用）一律收敛为未登录；只有请求客户端本身构造失败才走 Err。
pub(crate) async fn bbdown_login_status(working_dir: &Path) -> Result<bool, String> {
    let Some(cookie) = saved_bbdown_cookie(&working_dir.join("BBDown.data")) else {
        return Ok(false);
    };
    let client = Client::builder()
        .user_agent(BBDOWN_USER_AGENT)
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|error| {
            rust_i18n::t!("backend.bilibili.login.init_failed", error = error).to_string()
        })?;
    Ok(validate_bbdown_cookie(&client, &cookie).await.is_ok())
}

pub(crate) fn bbdown_logout(working_dir: &Path) -> Result<(), String> {
    match std::fs::remove_file(working_dir.join("BBDown.data")) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => {
            Err(rust_i18n::t!("backend.bilibili.login.logout_failed", error = error).to_string())
        }
    }
}

async fn generate_bbdown_qr(client: &Client) -> Result<(String, String), String> {
    let response = client
        .get(BBDOWN_QR_GENERATE_URL)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| {
            rust_i18n::t!(
                "backend.bilibili.login.fetch_login_url_failed",
                error = error
            )
            .to_string()
        })?;
    if !response.status().is_success() {
        return Err(rust_i18n::t!(
            "backend.bilibili.login.fetch_login_url_failed",
            error = format!("HTTP {}", response.status())
        )
        .to_string());
    }
    let body: serde_json::Value = response.json().await.map_err(|error| {
        rust_i18n::t!(
            "backend.bilibili.login.parse_login_url_failed",
            error = error
        )
        .to_string()
    })?;
    if body.pointer("/code").and_then(serde_json::Value::as_i64) != Some(0) {
        return Err(rust_i18n::t!(
            "backend.bilibili.login.login_url_api_failed",
            message = body
                .pointer("/message")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    rust_i18n::t!("backend.bilibili.login.unknown_error").to_string()
                })
        )
        .to_string());
    }
    let url = body
        .pointer("/data/url")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.login.missing_qr_url").to_string())?;
    let qrcode_key = body
        .pointer("/data/qrcode_key")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.login.missing_qr_key").to_string())?;
    Ok((url.to_string(), qrcode_key.to_string()))
}

fn bbdown_qr_data_url(url: &str) -> Result<String, String> {
    let code = QrCode::new(url.as_bytes()).map_err(|error| {
        rust_i18n::t!("backend.bilibili.login.qr_generate_failed", error = error).to_string()
    })?;
    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(320, 320)
        .build();
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        BASE64.encode(svg.as_bytes())
    ))
}

async fn poll_bbdown_qr(
    client: &Client,
    qrcode_key: &str,
) -> Result<(i64, HashMap<String, String>, Option<String>), String> {
    let mut poll_url = Url::parse(BBDOWN_QR_POLL_URL).map_err(|error| {
        rust_i18n::t!(
            "backend.bilibili.login.parse_poll_url_failed",
            error = error
        )
        .to_string()
    })?;
    poll_url
        .query_pairs_mut()
        .append_pair("qrcode_key", qrcode_key)
        .append_pair("source", "main-fe-header");
    let response = client
        .get(poll_url)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| {
            rust_i18n::t!("backend.bilibili.login.poll_failed", error = error).to_string()
        })?;
    if !response.status().is_success() {
        return Err(rust_i18n::t!(
            "backend.bilibili.login.poll_failed",
            error = format!("HTTP {}", response.status())
        )
        .to_string());
    }

    // The current Bilibili response may intentionally leave the credentials
    // out of data.url and deliver them only as Set-Cookie headers. Keep these
    // values before consuming the response body, matching the behavior of
    // current Bilibili clients.
    let response_cookies = response
        .cookies()
        .map(|cookie| (cookie.name().to_string(), cookie.value().to_string()))
        .collect::<Vec<_>>();
    let body: serde_json::Value = response.json().await.map_err(|error| {
        rust_i18n::t!("backend.bilibili.login.parse_poll_failed", error = error).to_string()
    })?;
    let code = body
        .pointer("/data/code")
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.login.missing_poll_code").to_string())?;
    let mut cookies = HashMap::new();
    merge_cookie_fields(
        &mut cookies,
        response_cookies.into_iter().collect::<HashMap<_, _>>(),
    );
    let url = body
        .pointer("/data/url")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    if let Some(value) = &url {
        merge_cookie_url(&mut cookies, value);
    }
    Ok((code, cookies, url))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginQr {
    job_id: String,
    data_url: String,
}

/// BBDown 的 `Program.APP_DIR` 就是可执行文件目录；登录与下载必须共享这里的
/// `BBDown.data`、config、archive 等原生状态文件。
pub(crate) fn bbdown_directory(executable: &Path) -> Result<PathBuf, String> {
    executable
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.login.bbdown_dir_unavailable").to_string())
}

#[derive(Debug)]
enum BbdownLoginError {
    Failed(String),
}

async fn run_bbdown_login(
    app: &AppHandle,
    job_id: &str,
    data_path: &Path,
) -> Result<(), BbdownLoginError> {
    let client = Client::builder()
        .user_agent(BBDOWN_USER_AGENT)
        .build()
        .map_err(|error| {
            BbdownLoginError::Failed(
                rust_i18n::t!("backend.bilibili.login.init_failed", error = error).to_string(),
            )
        })?;

    let (url, qrcode_key) = generate_bbdown_qr(&client)
        .await
        .map_err(BbdownLoginError::Failed)?;
    let data_url = bbdown_qr_data_url(&url).map_err(BbdownLoginError::Failed)?;
    let _ = app.emit(
        "bbdown-login-qr",
        LoginQr {
            job_id: job_id.to_string(),
            data_url,
        },
    );
    for _ in 0..180 {
        sleep(Duration::from_secs(1)).await;
        let (status, cookies, _url) = poll_bbdown_qr(&client, &qrcode_key)
            .await
            .map_err(BbdownLoginError::Failed)?;
        match status {
            86101 | 86090 => {}
            86038 => {
                return Err(BbdownLoginError::Failed(
                    rust_i18n::t!("backend.bilibili.login.qr_expired").to_string(),
                ));
            }
            0 => {
                validate_and_save_bbdown_data(&client, data_path, &cookies)
                    .await
                    .map_err(BbdownLoginError::Failed)?;
                return Ok(());
            }
            other => {
                return Err(BbdownLoginError::Failed(
                    rust_i18n::t!(
                        "backend.bilibili.login.login_failed_with_code",
                        code = other
                    )
                    .to_string(),
                ));
            }
        }
    }
    Err(BbdownLoginError::Failed(
        rust_i18n::t!("backend.bilibili.login.qr_timeout").to_string(),
    ))
}

pub(crate) async fn spawn_bbdown_login_job(
    app: AppHandle,
    working_dir: PathBuf,
) -> Result<RunResult, String> {
    std::fs::create_dir_all(&working_dir).map_err(|error| error.to_string())?;
    let data_path = working_dir.join("BBDown.data");
    let _ = std::fs::remove_file(working_dir.join("qrcode.png"));
    let job_id = Uuid::new_v4().to_string();
    let tool = ToolName::Bbdown;
    let _ = app.emit(
        "job-state",
        JobState {
            job_id: job_id.clone(),
            tool: tool.clone(),
            state: "running",
            exit_code: None,
            message: rust_i18n::t!("backend.bilibili.login.running").to_string(),
        },
    );

    let task_app = app.clone();
    let task_job_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        let outcome = run_bbdown_login(&task_app, &task_job_id, &data_path).await;
        let (state_name, exit_code, message) = match outcome {
            Ok(()) => (
                "completed",
                Some(0),
                rust_i18n::t!("backend.bilibili.login.login_success").to_string(),
            ),
            Err(BbdownLoginError::Failed(error)) => (
                "failed",
                None,
                rust_i18n::t!("backend.bilibili.login.login_not_signed_in", error = error)
                    .to_string(),
            ),
        };
        let _ = task_app.emit(
            "job-state",
            JobState {
                job_id: task_job_id,
                tool: ToolName::Bbdown,
                state: state_name,
                exit_code,
                message,
            },
        );
    });
    Ok(RunResult { job_id })
}
