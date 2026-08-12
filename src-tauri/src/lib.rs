use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Local;
use qrcode::QrCode;
use reqwest::{
    header::{COOKIE, REFERER},
    Client, Url,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    ffi::OsString,
    fmt::Write as _,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
    sync::oneshot,
    time::{sleep, timeout, Duration},
};
use uuid::Uuid;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hide_async_command_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

fn hide_std_command_window(command: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

fn background_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    hide_async_command_window(&mut command);
    command
}

#[derive(Default)]
struct AppState {
    cancel_senders: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum ToolName {
    Bbdown,
    YtDlp,
    Musicdl,
    Ffmpeg,
    Ffprobe,
    Mediainfo,
    Deno,
    Python,
}

impl ToolName {
    fn executable(&self) -> &'static str {
        match self {
            Self::Bbdown => "BBDown",
            Self::YtDlp => "yt-dlp",
            Self::Musicdl => "musicdl",
            Self::Ffmpeg => "ffmpeg",
            Self::Ffprobe => "ffprobe",
            Self::Mediainfo => "mediainfo",
            Self::Deno => "deno",
            Self::Python => {
                if cfg!(target_os = "windows") {
                    "python"
                } else {
                    "python3"
                }
            }
        }
    }

    fn label(&self) -> &'static str {
        match self {
            Self::Bbdown => "BBDown",
            Self::YtDlp => "yt-dlp",
            Self::Musicdl => "musicdl",
            Self::Ffmpeg => "FFmpeg",
            Self::Ffprobe => "ffprobe",
            Self::Mediainfo => "MediaInfo CLI",
            Self::Deno => "Deno",
            Self::Python => "Python 3",
        }
    }

    fn required(&self) -> bool {
        !matches!(self, Self::Ffprobe | Self::Musicdl | Self::Python)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DependencyStatus {
    tool: ToolName,
    label: String,
    available: bool,
    bundled: bool,
    bundled_available: bool,
    system_available: bool,
    source: Option<String>,
    path: Option<String>,
    version: Option<String>,
    required: bool,
    install_hint: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunRequest {
    tool: ToolName,
    args: Vec<String>,
    fallback_args: Option<Vec<String>>,
    working_dir: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunResult {
    job_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobLog {
    job_id: String,
    tool: ToolName,
    stream: &'static str,
    line: String,
    timestamp: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobState {
    job_id: String,
    tool: ToolName,
    state: &'static str,
    exit_code: Option<i32>,
    message: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticJob {
    job_id: String,
    tool: ToolName,
    state: String,
    exit_code: Option<i32>,
    message: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticLog {
    job_id: String,
    tool: ToolName,
    stream: String,
    line: String,
    timestamp: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticExportRequest {
    job: DiagnosticJob,
    logs: Vec<DiagnosticLog>,
    output_path: String,
    include_logs: bool,
    include_dependency_paths: bool,
    redact_personal_data: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticExportResult {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogExportRequest {
    job: DiagnosticJob,
    logs: Vec<DiagnosticLog>,
    output_path: String,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum DependencyPreference {
    #[default]
    Bundled,
    System,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    default_output_directory: Option<String>,
    #[serde(default)]
    dependency_preference: DependencyPreference,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginQr {
    job_id: String,
    data_url: String,
}

#[derive(Serialize)]
struct MediaInspection {
    path: String,
    summary: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlSearchRequest {
    keyword: String,
    music_sources: Vec<String>,
    init_music_clients_cfg: serde_json::Value,
    requests_overrides: serde_json::Value,
    clients_threadings: serde_json::Value,
    search_rules: serde_json::Value,
    output_directory: Option<String>,
    search_size_per_source: usize,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlPlaylistRequest {
    playlist_url: String,
    music_sources: Vec<String>,
    init_music_clients_cfg: serde_json::Value,
    requests_overrides: serde_json::Value,
    clients_threadings: serde_json::Value,
    search_rules: serde_json::Value,
    output_directory: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlSearchResult {
    index: usize,
    song_name: String,
    singers: String,
    album: String,
    extension: String,
    file_size: String,
    duration: String,
    bitrate: Option<u64>,
    codec: String,
    sample_rate: Option<u64>,
    channels: Option<u64>,
    source: String,
    root_source: String,
    cover_url: Option<String>,
    lossless: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlSearchResponse {
    session_id: String,
    results: Vec<MusicdlSearchResult>,
}

#[derive(Debug, Deserialize)]
struct MusicdlAdapterOutput {
    results: Vec<MusicdlSearchResult>,
}

fn command_path() -> OsString {
    let inherited = env::var_os("PATH").unwrap_or_default();
    let mut paths = Vec::new();
    #[cfg(target_os = "macos")]
    paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/opt/homebrew/sbin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/usr/sbin"),
        PathBuf::from("/sbin"),
    ]);
    #[cfg(target_os = "windows")]
    {
        if cfg!(debug_assertions) {
            paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources"));
        }
        if let Some(profile) = env::var_os("USERPROFILE") {
            let profile = PathBuf::from(profile);
            paths.push(profile.join(".local").join("bin"));
            paths.push(profile.join("scoop").join("shims"));
        }
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            let python_root = local.join("Programs").join("Python");
            paths.push(python_root.join("Scripts"));
            if let Ok(entries) = std::fs::read_dir(&python_root) {
                for entry in entries.flatten().filter(|entry| entry.path().is_dir()) {
                    paths.push(entry.path());
                    paths.push(entry.path().join("Scripts"));
                }
            }
            paths.push(local.join("Microsoft").join("WinGet").join("Links"));
            paths.push(local.join("pipx").join("bin"));
            paths.push(local.join("Microsoft").join("WindowsApps"));
        }
        if let Some(app_data) = env::var_os("APPDATA") {
            let python_root = PathBuf::from(app_data).join("Python");
            if let Ok(entries) = std::fs::read_dir(python_root) {
                for entry in entries.flatten() {
                    paths.push(entry.path().join("Scripts"));
                }
            }
        }
        if let Some(program_data) = env::var_os("ProgramData") {
            paths.push(PathBuf::from(program_data).join("chocolatey").join("bin"));
        }
    }
    #[cfg(not(target_os = "windows"))]
    if let Some(home) = env::var_os("HOME") {
        paths.push(PathBuf::from(home).join(".local").join("bin"));
    }
    if let Ok(current) = env::current_exe() {
        if let Some(parent) = current.parent() {
            paths.push(parent.to_path_buf());
        }
    }
    paths.extend(env::split_paths(&inherited));
    env::join_paths(paths).unwrap_or(inherited)
}

fn executable_filename(name: &str) -> String {
    if cfg!(target_os = "windows") && !name.to_ascii_lowercase().ends_with(".exe") {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn find_system_binary(name: &str) -> Option<PathBuf> {
    let filename = executable_filename(name);
    for directory in env::split_paths(&command_path()) {
        let candidate = directory.join(&filename);
        #[cfg(target_os = "windows")]
        if matches!(name.to_ascii_lowercase().as_str(), "python" | "python3")
            && directory
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("WindowsApps"))
        {
            continue;
        }
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn same_binary(left: &Path, right: &Path) -> bool {
    left == right
        || left
            .canonicalize()
            .ok()
            .zip(right.canonicalize().ok())
            .map(|(left, right)| left == right)
            .unwrap_or(false)
}

fn find_distinct_system_binary(name: &str, bundled: Option<&Path>) -> Option<PathBuf> {
    let filename = executable_filename(name);
    for directory in env::split_paths(&command_path()) {
        let candidate = directory.join(&filename);
        #[cfg(target_os = "windows")]
        if matches!(name.to_ascii_lowercase().as_str(), "python" | "python3")
            && directory
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("WindowsApps"))
        {
            continue;
        }
        if candidate.is_file()
            && !bundled
                .map(|bundled| same_binary(&candidate, bundled))
                .unwrap_or(false)
        {
            return Some(candidate);
        }
    }
    None
}

fn bundled_binary(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let target_name = executable_filename(name);
    let target = env::var("TARGET").unwrap_or_else(|_| {
        if cfg!(target_os = "windows") {
            "x86_64-pc-windows-msvc".into()
        } else {
            "aarch64-apple-darwin".into()
        }
    });
    let dev_binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(format!(
            "{name}-{target}{}",
            if cfg!(target_os = "windows") {
                ".exe"
            } else {
                ""
            }
        ));
    let mut candidates = Vec::new();
    if cfg!(debug_assertions) {
        candidates.push(dev_binary);
    }
    if let Ok(current) = env::current_exe() {
        if let Some(parent) = current.parent() {
            candidates.push(parent.join(&target_name));
        }
    }
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join(&target_name));
        candidates.push(resources.join("binaries").join(&target_name));
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn resolve_tool(app: &AppHandle, tool: &ToolName) -> Option<(PathBuf, bool)> {
    let bundled = bundled_binary(app, tool.executable()).map(|path| (path, true));
    let system = find_distinct_system_binary(
        tool.executable(),
        bundled.as_ref().map(|(path, _)| path.as_path()),
    )
    .map(|path| (path, false));

    if matches!(tool, ToolName::Bbdown) {
        // Full/Lite both ship BBDown. Never silently switch to a separately
        // installed copy: BBDown must read and write the data file beside the
        // executable included in this app.
        bundled
    } else if matches!(
        load_app_settings(app).dependency_preference,
        DependencyPreference::System
    ) {
        system.or(bundled)
    } else {
        bundled.or(system)
    }
}

#[cfg(any(not(target_os = "windows"), test))]
fn musicdl_launcher_python(script: &str) -> Option<PathBuf> {
    // pipx can generate a shell/Python polyglot launcher. In that form the
    // shebang is /bin/sh and the real virtualenv interpreter is quoted on the
    // following exec line, so inspect quoted executable paths first.
    for line in script.lines().take(12) {
        for quoted in line.split('"').skip(1).step_by(2) {
            let candidate = PathBuf::from(quoted);
            if candidate
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("python"))
            {
                return Some(candidate);
            }
        }
    }
    let shebang = script
        .lines()
        .next()
        .and_then(|line| line.strip_prefix("#!"))
        .map(str::trim)?;
    let fields = shebang.split_whitespace().collect::<Vec<_>>();
    if fields.first() == Some(&"/usr/bin/env") {
        fields
            .get(1)
            .filter(|name| name.starts_with("python"))
            .map(PathBuf::from)
    } else {
        fields.first().and_then(|value| {
            let candidate = PathBuf::from(value);
            candidate
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("python"))
                .then_some(candidate)
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
    let script = std::fs::read_to_string(executable)
        .map_err(|error| format!("无法读取 musicdl 启动脚本：{error}"))?;
    let hint = musicdl_launcher_python(&script)
        .ok_or_else(|| "无法识别 musicdl 使用的 Python 环境，请使用 pipx 重新安装".to_string())?;
    let interpreter = if hint.is_absolute() {
        hint
    } else {
        find_system_binary(
            hint.to_str()
                .ok_or_else(|| "musicdl 的 Python 启动信息无效".to_string())?,
        )
        .ok_or_else(|| "找不到 musicdl 使用的 Python 解释器".to_string())?
    };
    interpreter
        .is_file()
        .then_some(interpreter)
        .ok_or_else(|| "musicdl 使用的 Python 解释器不存在，请使用 pipx 重新安装".to_string())
}

#[cfg(target_os = "windows")]
fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Some(python_root) = executable.parent().and_then(Path::parent) {
        candidates.push(python_root.join("python.exe"));
    }
    if let Some(pipx_home) = env::var_os("PIPX_HOME") {
        candidates.push(
            PathBuf::from(pipx_home)
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
    }
    if let Some(profile) = env::var_os("USERPROFILE") {
        let profile = PathBuf::from(profile);
        candidates.push(
            profile
                .join("pipx")
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
        candidates.push(
            profile
                .join(".local")
                .join("share")
                .join("pipx")
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
    }
    if let Some(local) = env::var_os("LOCALAPPDATA") {
        candidates.push(
            PathBuf::from(local)
                .join("pipx")
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
    }
    if let Some(pipx) = find_system_binary("pipx") {
        let mut command = std::process::Command::new(pipx);
        hide_std_command_window(&mut command);
        if let Ok(output) = command
            .args(["environment", "--value", "PIPX_LOCAL_VENVS"])
            .output()
        {
            if output.status.success() {
                let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !root.is_empty() {
                    candidates.push(
                        PathBuf::from(root)
                            .join("musicdl")
                            .join("Scripts")
                            .join("python.exe"),
                    );
                }
            }
        }
    }
    if let Some(system) = find_system_binary("python") {
        candidates.push(system);
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "找不到 musicdl 使用的 Python 环境，请使用 pipx 重新安装".into())
}

fn musicdl_adapter(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if cfg!(debug_assertions) {
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("musicdl-adapter.py"),
        );
    }
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("musicdl-adapter.py"));
    }
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "找不到 MAD Toolbox musicdl 适配器".to_string())
}

fn musicdl_sessions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_dir(app)?.join("musicdl-sessions");
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }
    Ok(path)
}

async fn tool_version(path: &Path, tool: &ToolName) -> Option<String> {
    let mut command = Command::new(path);
    hide_async_command_window(&mut command);
    command.env("PATH", command_path());
    command.kill_on_drop(true);
    command.arg(if matches!(tool, ToolName::Bbdown) {
        "--help"
    } else {
        "--version"
    });
    let output = timeout(Duration::from_secs(3), command.output())
        .await
        .ok()?
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = if stdout.trim().is_empty() {
        stderr
    } else {
        stdout
    };
    let first_line = if matches!(tool, ToolName::Bbdown) {
        text.lines()
            .find(|line| line.contains("BBDown version"))
            .or_else(|| text.lines().find(|line| !line.trim().is_empty()))?
            .trim()
    } else {
        text.lines().find(|line| !line.trim().is_empty())?.trim()
    };
    let shortened = if matches!(tool, ToolName::Ffmpeg | ToolName::Ffprobe) {
        first_line
            .split_whitespace()
            .take(3)
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        first_line.chars().take(100).collect()
    };
    Some(shortened)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

#[tauri::command]
fn app_settings(app: AppHandle) -> AppSettings {
    load_app_settings(&app)
}

fn load_app_settings(app: &AppHandle) -> AppSettings {
    settings_path(app)
        .ok()
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_app_settings(app: AppHandle, mut settings: AppSettings) -> Result<AppSettings, String> {
    settings.default_output_directory = settings
        .default_output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(directory) = &settings.default_output_directory {
        if !Path::new(directory).is_dir() {
            return Err("默认导出目录不存在或不是目录".into());
        }
    }
    let path = settings_path(&app)?;
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(&settings).map_err(|error| error.to_string())?;
    std::fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    std::fs::rename(&temporary, &path).map_err(|error| error.to_string())?;
    Ok(settings)
}

/// BBDown's own `Program.APP_DIR` is the directory containing the executable.
/// Run it from that directory so its native `BBDown.data`, config, archive and
/// QR files stay exactly where the original CLI expects them.
fn bbdown_directory(executable: &Path) -> Result<PathBuf, String> {
    executable
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法确定 BBDown 所在目录".to_string())
}

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

#[cfg(test)]
fn parse_query_fields(value: &str, separator: char) -> HashMap<String, String> {
    value
        .split(separator)
        .filter_map(|field| {
            let (key, value) = field.trim().split_once('=')?;
            let key = key.trim();
            if key.is_empty() {
                return None;
            }
            Some((key.to_string(), value.trim().to_string()))
        })
        .collect()
}

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

async fn validate_bbdown_cookie(
    client: &Client,
    nav_url: &str,
    cookie: &str,
) -> Result<(), String> {
    let response = client
        .get(nav_url)
        .header(COOKIE, cookie)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("验证 BBDown Cookie 失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "验证 BBDown Cookie 失败：HTTP {}",
            response.status()
        ));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析账号验证结果失败：{error}"))?;
    if body
        .pointer("/data/isLogin")
        .and_then(serde_json::Value::as_bool)
        == Some(true)
    {
        Ok(())
    } else {
        Err("BBDown Cookie 数据不完整或账号验证未通过".into())
    }
}

fn save_bbdown_data(data_path: &Path, completed: &str) -> Result<(), String> {
    let temporary = data_path.with_extension(format!("data.{}.tmp", Uuid::new_v4()));
    std::fs::write(&temporary, completed).map_err(|error| format!("写入登录数据失败：{error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("设置登录数据权限失败：{error}"))?;
    }
    std::fs::rename(&temporary, data_path)
        .map_err(|error| format!("保存完整 BBDown.data 失败：{error}"))?;
    Ok(())
}

async fn validate_and_save_bbdown_data(
    client: &Client,
    data_path: &Path,
    cookies: &HashMap<String, String>,
) -> Result<(), String> {
    if !has_required_bbdown_cookie(cookies) {
        return Err("B站二维码轮询没有返回完整 Cookie（SESSDATA、bili_jct、DedeUserID）".into());
    }
    let completed = cookie_header(cookies);
    validate_bbdown_cookie(client, BILIBILI_NAV_URL, &completed).await?;
    save_bbdown_data(data_path, &completed)
}

#[derive(Debug)]
enum BbdownLoginError {
    Cancelled,
    Failed(String),
}

async fn generate_bbdown_qr(client: &Client) -> Result<(String, String), String> {
    let response = client
        .get(BBDOWN_QR_GENERATE_URL)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("获取 B站登录地址失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("获取 B站登录地址失败：HTTP {}", response.status()));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析 B站登录地址失败：{error}"))?;
    if body.pointer("/code").and_then(serde_json::Value::as_i64) != Some(0) {
        return Err(format!(
            "B站登录地址接口失败：{}",
            body.pointer("/message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("未知错误")
        ));
    }
    let url = body
        .pointer("/data/url")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "B站登录接口没有返回二维码地址".to_string())?;
    let qrcode_key = body
        .pointer("/data/qrcode_key")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "B站登录接口没有返回二维码密钥".to_string())?;
    Ok((url.to_string(), qrcode_key.to_string()))
}

fn bbdown_qr_data_url(url: &str) -> Result<String, String> {
    let code =
        QrCode::new(url.as_bytes()).map_err(|error| format!("生成登录二维码失败：{error}"))?;
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
    poll_bbdown_qr_at(client, BBDOWN_QR_POLL_URL, qrcode_key).await
}

async fn poll_bbdown_qr_at(
    client: &Client,
    poll_url: &str,
    qrcode_key: &str,
) -> Result<(i64, HashMap<String, String>, Option<String>), String> {
    let mut poll_url =
        Url::parse(poll_url).map_err(|error| format!("解析 B站轮询地址失败：{error}"))?;
    poll_url
        .query_pairs_mut()
        .append_pair("qrcode_key", qrcode_key)
        .append_pair("source", "main-fe-header");
    let response = client
        .get(poll_url)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("轮询 B站登录状态失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("轮询 B站登录状态失败：HTTP {}", response.status()));
    }

    // The current Bilibili response may intentionally leave the credentials
    // out of data.url and deliver them only as Set-Cookie headers. Keep these
    // values before consuming the response body, matching the behavior of
    // current Bilibili clients.
    let response_cookies = response
        .cookies()
        .map(|cookie| (cookie.name().to_string(), cookie.value().to_string()))
        .collect::<Vec<_>>();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析 B站登录状态失败：{error}"))?;
    let code = body
        .pointer("/data/code")
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "B站登录状态响应缺少 data.code".to_string())?;
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

async fn run_bbdown_login(
    app: &AppHandle,
    job_id: &str,
    data_path: &Path,
    cancel_rx: &mut oneshot::Receiver<()>,
) -> Result<(), BbdownLoginError> {
    let client = Client::builder()
        .user_agent(BBDOWN_USER_AGENT)
        .build()
        .map_err(|error| BbdownLoginError::Failed(format!("初始化 B站登录请求失败：{error}")))?;

    emit_log(
        app,
        job_id,
        &ToolName::Bbdown,
        "stdout",
        "获取登录地址...".into(),
    );
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
    emit_log(
        app,
        job_id,
        &ToolName::Bbdown,
        "stdout",
        "生成二维码成功，请打开并扫描，或扫描打印的二维码".into(),
    );

    let mut scanned = false;
    for _ in 0..180 {
        tokio::select! {
            _ = &mut *cancel_rx => return Err(BbdownLoginError::Cancelled),
            _ = sleep(Duration::from_secs(1)) => {}
        }
        let (status, cookies, _url) = poll_bbdown_qr(&client, &qrcode_key)
            .await
            .map_err(BbdownLoginError::Failed)?;
        match status {
            86101 => {}
            86090 => {
                if !scanned {
                    scanned = true;
                    emit_log(
                        app,
                        job_id,
                        &ToolName::Bbdown,
                        "stdout",
                        "扫码成功，请确认...".into(),
                    );
                }
            }
            86038 => {
                return Err(BbdownLoginError::Failed("二维码已过期，请重新扫码".into()));
            }
            0 => {
                emit_log(
                    app,
                    job_id,
                    &ToolName::Bbdown,
                    "stdout",
                    "登录成功，正在保存 Cookie...".into(),
                );
                validate_and_save_bbdown_data(&client, data_path, &cookies)
                    .await
                    .map_err(BbdownLoginError::Failed)?;
                return Ok(());
            }
            other => {
                return Err(BbdownLoginError::Failed(format!(
                    "B站登录失败，二维码状态码 {other}"
                )));
            }
        }
    }
    Err(BbdownLoginError::Failed("二维码登录超时".into()))
}

async fn spawn_bbdown_login_job(
    app: AppHandle,
    state: State<'_, AppState>,
    working_dir: PathBuf,
) -> Result<RunResult, String> {
    std::fs::create_dir_all(&working_dir).map_err(|error| error.to_string())?;
    let data_path = working_dir.join("BBDown.data");
    let _ = std::fs::remove_file(working_dir.join("qrcode.png"));
    let job_id = Uuid::new_v4().to_string();
    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    state
        .cancel_senders
        .lock()
        .map_err(|_| "任务状态锁定失败".to_string())?
        .insert(job_id.clone(), cancel_tx);
    let tool = ToolName::Bbdown;
    emit_log(&app, &job_id, &tool, "system", "$ BBDown login".into());
    let _ = app.emit(
        "job-state",
        JobState {
            job_id: job_id.clone(),
            tool: tool.clone(),
            state: "running",
            exit_code: None,
            message: "BBDown 正在运行".into(),
        },
    );

    let task_app = app.clone();
    let task_job_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        let outcome = run_bbdown_login(&task_app, &task_job_id, &data_path, &mut cancel_rx).await;
        let (state_name, exit_code, message) = match outcome {
            Ok(()) => (
                "completed",
                Some(0),
                "BBDown Cookie 数据已补全并验证登录成功".to_string(),
            ),
            Err(BbdownLoginError::Cancelled) => ("cancelled", None, "BBDown 已取消".to_string()),
            Err(BbdownLoginError::Failed(error)) => {
                ("failed", None, format!("BBDown 账号未登录：{error}"))
            }
        };
        if let Ok(mut senders) = task_app.state::<AppState>().cancel_senders.lock() {
            senders.remove(&task_job_id);
        }
        emit_log(
            &task_app,
            &task_job_id,
            &ToolName::Bbdown,
            "system",
            message.clone(),
        );
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

fn strip_ansi_codes(line: &str) -> String {
    let mut output = String::with_capacity(line.len());
    let mut characters = line.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '\u{1b}' && characters.peek() == Some(&'[') {
            characters.next();
            for code in characters.by_ref() {
                if code.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            output.push(character);
        }
    }
    output
}

fn redact_output_line(line: &str) -> String {
    let mut redacted = strip_ansi_codes(line);
    for key in [
        "SESSDATA",
        "bili_jct",
        "access_token",
        "refresh_token",
        "authorization",
        "proxy-authorization",
        "password",
        "passwd",
        "api_key",
        "api-key",
        "cookies",
        "cookie",
        "token",
    ] {
        let mut search_from = 0;
        while let Some(offset) = redacted[search_from..]
            .to_ascii_lowercase()
            .find(&key.to_ascii_lowercase())
        {
            let label_end = search_from + offset + key.len();
            let mut delimiter = label_end;
            while redacted[delimiter..].starts_with('"')
                || redacted[delimiter..].starts_with('\'')
                || redacted[delimiter..].starts_with(char::is_whitespace)
            {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            if !redacted[delimiter..].starts_with('=') && !redacted[delimiter..].starts_with(':') {
                search_from = label_end;
                continue;
            }
            delimiter += 1;
            while redacted[delimiter..].starts_with(char::is_whitespace) {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            let quote = redacted[delimiter..]
                .chars()
                .next()
                .filter(|character| *character == '"' || *character == '\'');
            let start = delimiter + quote.map(char::len_utf8).unwrap_or(0);
            let hide_remainder = matches!(
                key,
                "authorization" | "proxy-authorization" | "cookie" | "cookies"
            ) && quote.is_none();
            let end = if hide_remainder {
                redacted.len()
            } else {
                redacted[start..]
                    .find(|character: char| {
                        quote
                            .map(|quote| character == quote)
                            .unwrap_or_else(|| character.is_whitespace() || character == ';')
                    })
                    .map(|value_offset| start + value_offset)
                    .unwrap_or(redacted.len())
            };
            redacted.replace_range(start..end, "***");
            search_from = start + 3;
        }
    }
    redacted
}

fn redact_urls(line: &str) -> String {
    let mut redacted = line.to_string();
    loop {
        let http = redacted.find("http://");
        let https = redacted.find("https://");
        let start = match (http, https) {
            (Some(left), Some(right)) => left.min(right),
            (Some(value), None) | (None, Some(value)) => value,
            (None, None) => break,
        };
        let end = redacted[start..]
            .find(char::is_whitespace)
            .map(|offset| start + offset)
            .unwrap_or(redacted.len());
        redacted.replace_range(start..end, "<URL_REDACTED>");
    }
    redacted
}

fn sanitize_diagnostic_text(line: &str, redact_personal_data: bool, home: Option<&str>) -> String {
    let mut sanitized = redact_output_line(line);
    if redact_personal_data {
        sanitized = redact_urls(&sanitized);
        if let Some(home) = home.filter(|value| !value.is_empty()) {
            sanitized = sanitized.replace(home, "$HOME");
        }
    }
    sanitized
}

fn system_command_text(program: &str, args: &[&str]) -> Option<String> {
    let mut command = std::process::Command::new(program);
    hide_std_command_window(&mut command);
    let output = command.args(args).output().ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
}

fn platform_system_info() -> (String, String, String, String) {
    #[cfg(target_os = "macos")]
    {
        let version = system_command_text("/usr/bin/sw_vers", &["-productVersion"])
            .unwrap_or_else(|| "未知".into());
        let build = system_command_text("/usr/bin/sw_vers", &["-buildVersion"])
            .unwrap_or_else(|| "未知".into());
        let cpu = system_command_text("/usr/sbin/sysctl", &["-n", "machdep.cpu.brand_string"])
            .unwrap_or_else(|| "未知".into());
        let memory = system_command_text("/usr/sbin/sysctl", &["-n", "hw.memsize"])
            .and_then(|value| value.parse::<u64>().ok())
            .map(|bytes| format!("{:.1} GiB", bytes as f64 / 1_073_741_824.0))
            .unwrap_or_else(|| "未知".into());
        (version, build, cpu, memory)
    }
    #[cfg(target_os = "windows")]
    {
        let version = system_command_text("cmd.exe", &["/C", "ver"])
            .unwrap_or_else(|| "Windows 10/11".into());
        let build = env::var("OS").unwrap_or_else(|_| "Windows_NT".into());
        let cpu = env::var("PROCESSOR_IDENTIFIER").unwrap_or_else(|_| "未知".into());
        let memory = system_command_text(
            "powershell.exe",
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ],
        )
        .and_then(|value| value.parse::<u64>().ok())
        .map(|bytes| format!("{:.1} GiB", bytes as f64 / 1_073_741_824.0))
        .unwrap_or_else(|| "未知".into());
        (version, build, cpu, memory)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        (
            env::consts::OS.into(),
            "未知".into(),
            "未知".into(),
            "未知".into(),
        )
    }
}

fn safe_command(tool: &ToolName, args: &[String]) -> String {
    const SECRET_FLAGS: &[&str] = &[
        "--cookie",
        "-c",
        "--access-token",
        "-token",
        "--proxy",
        "--username",
        "--password",
        "--cookies-from-browser",
    ];
    let mut output = vec![tool.executable().to_string()];
    let mut redact_next = false;
    for arg in args {
        if redact_next {
            output.push("***".into());
            redact_next = false;
        } else {
            output.push(arg.clone());
            redact_next = if matches!(tool, ToolName::Musicdl) {
                [
                    "-i",
                    "--init-music-clients-cfg",
                    "-r",
                    "--requests-overrides",
                ]
                .contains(&arg.as_str())
            } else {
                SECRET_FLAGS.contains(&arg.as_str())
            };
        }
    }
    output.join(" ")
}

fn validate_args(args: &[String]) -> Result<(), String> {
    if args.len() > 500 {
        return Err("参数数量超过安全限制".into());
    }
    if args.iter().any(|arg| arg.contains('\0')) {
        return Err("参数包含无效字符".into());
    }
    Ok(())
}

fn ensure_ffmpeg_location(args: &mut Vec<String>, ffmpeg: &Path) {
    if !args.iter().any(|arg| arg == "--ffmpeg-location") {
        args.splice(
            0..0,
            [
                "--ffmpeg-location".into(),
                ffmpeg.to_string_lossy().into_owned(),
            ],
        );
    }
}

fn emit_log(app: &AppHandle, job_id: &str, tool: &ToolName, stream: &'static str, line: String) {
    let _ = app.emit(
        "job-log",
        JobLog {
            job_id: job_id.into(),
            tool: tool.clone(),
            stream,
            line,
            timestamp: Local::now().format("%H:%M:%S").to_string(),
        },
    );
}

fn yt_dlp_browser_cookie_fallback_requested(line: &str) -> bool {
    let normalized = line.to_ascii_lowercase().replace('’', "'");
    [
        "sign in to confirm",
        "confirm you're not a bot",
        "use --cookies-from-browser",
        "use --cookies",
    ]
    .iter()
    .any(|marker| normalized.contains(marker))
}

async fn stream_output<R>(
    reader: R,
    app: AppHandle,
    job_id: String,
    tool: ToolName,
    stream: &'static str,
) -> bool
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut reader = BufReader::new(reader);
    let mut bytes = Vec::new();
    let mut browser_cookie_fallback_requested = false;
    loop {
        bytes.clear();
        let Ok(length) = reader.read_until(b'\n', &mut bytes).await else {
            break;
        };
        if length == 0 {
            break;
        }
        while matches!(bytes.last(), Some(b'\n' | b'\r')) {
            bytes.pop();
        }
        let line = String::from_utf8_lossy(&bytes);
        if matches!(tool, ToolName::YtDlp) && yt_dlp_browser_cookie_fallback_requested(&line) {
            browser_cookie_fallback_requested = true;
        }
        // BBDown also prints an ANSI-colored QR code. The GUI presents the
        // generated PNG instead, so omit those unreadable terminal rows.
        if matches!(tool, ToolName::Bbdown)
            && line.chars().filter(|character| *character == '█').count() > 40
        {
            continue;
        }
        // Preserve the original CLI output in the task center; credential
        // redaction remains available for the diagnostic ZIP export.
        emit_log(&app, &job_id, &tool, stream, strip_ansi_codes(&line));
    }
    browser_cookie_fallback_requested
}

fn spawn_child(
    executable: &Path,
    args: &[String],
    working_dir: Option<&Path>,
    tool: &ToolName,
) -> Result<Child, String> {
    let mut command = Command::new(executable);
    hide_async_command_window(&mut command);
    command
        .args(args)
        .env("PATH", command_path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(directory) = working_dir {
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        command.current_dir(directory);
    }
    command
        .spawn()
        .map_err(|error| format!("无法启动 {}：{error}", tool.label()))
}

async fn wait_for_child(
    mut child: Child,
    app: AppHandle,
    job_id: String,
    tool: ToolName,
    cancel_rx: &mut oneshot::Receiver<()>,
) -> (&'static str, Option<i32>, String, bool, bool) {
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let task_app = app.clone();
    let task_job_id = job_id.clone();
    let stdout_task = stdout.map(|pipe| {
        tauri::async_runtime::spawn(stream_output(
            pipe,
            task_app.clone(),
            task_job_id.clone(),
            tool.clone(),
            "stdout",
        ))
    });
    let stderr_task = stderr.map(|pipe| {
        tauri::async_runtime::spawn(stream_output(
            pipe,
            task_app,
            task_job_id,
            tool.clone(),
            "stderr",
        ))
    });

    let (state_name, exit_code, message, cancelled) = tokio::select! {
        result = child.wait() => {
            match result {
                Ok(status) if status.success() => {
                    ("completed", status.code(), format!("{} 已完成", tool.label()), false)
                }
                Ok(status) => ("failed", status.code(), format!("{} 执行失败", tool.label()), false),
                Err(error) => ("failed", None, format!("{} 等待进程失败：{error}", tool.label()), false),
            }
        }
        _ = cancel_rx => {
            let _ = child.kill().await;
            ("cancelled", None, format!("{} 已取消", tool.label()), true)
        }
    };

    let stdout_requested = match stdout_task {
        Some(task) => task.await.unwrap_or(false),
        None => false,
    };
    let stderr_requested = match stderr_task {
        Some(task) => task.await.unwrap_or(false),
        None => false,
    };
    (
        state_name,
        exit_code,
        message,
        cancelled,
        stdout_requested || stderr_requested,
    )
}

async fn spawn_job(
    app: AppHandle,
    state: State<'_, AppState>,
    tool: ToolName,
    executable: PathBuf,
    args: Vec<String>,
    working_dir: Option<PathBuf>,
    fallback_args: Option<Vec<String>>,
) -> Result<RunResult, String> {
    validate_args(&args)?;
    if let Some(fallback_args) = &fallback_args {
        validate_args(fallback_args)?;
    }
    let job_id = Uuid::new_v4().to_string();
    let child = spawn_child(&executable, &args, working_dir.as_deref(), &tool)?;
    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    state
        .cancel_senders
        .lock()
        .map_err(|_| "任务状态锁定失败".to_string())?
        .insert(job_id.clone(), cancel_tx);

    emit_log(
        &app,
        &job_id,
        &tool,
        "system",
        format!("$ {}", safe_command(&tool, &args)),
    );
    let _ = app.emit(
        "job-state",
        JobState {
            job_id: job_id.clone(),
            tool: tool.clone(),
            state: "running",
            exit_code: None,
            message: format!("{} 正在运行", tool.label()),
        },
    );

    let task_app = app.clone();
    let task_job_id = job_id.clone();
    let task_tool = tool.clone();
    tauri::async_runtime::spawn(async move {
        let (mut state_name, mut exit_code, mut message, cancelled, browser_cookie_error) =
            wait_for_child(
                child,
                task_app.clone(),
                task_job_id.clone(),
                task_tool.clone(),
                &mut cancel_rx,
            )
            .await;

        if !cancelled && cancel_rx.try_recv().is_ok() {
            state_name = "cancelled";
            exit_code = None;
            message = format!("{} 已取消", task_tool.label());
        }

        if state_name == "failed" && browser_cookie_error && !cancelled {
            if let Some(retry_args) = fallback_args.as_ref() {
                emit_log(
                    &task_app,
                    &task_job_id,
                    &task_tool,
                    "system",
                    "yt-dlp 首次请求未使用浏览器 Cookie，检测到需要登录，正在使用浏览器 Cookie 重试。"
                        .into(),
                );
                emit_log(
                    &task_app,
                    &task_job_id,
                    &task_tool,
                    "system",
                    format!("$ {}", safe_command(&task_tool, retry_args)),
                );
                match spawn_child(&executable, retry_args, working_dir.as_deref(), &task_tool) {
                    Ok(retry_child) => {
                        let (retry_state, retry_exit_code, retry_message, _, _) = wait_for_child(
                            retry_child,
                            task_app.clone(),
                            task_job_id.clone(),
                            task_tool.clone(),
                            &mut cancel_rx,
                        )
                        .await;
                        state_name = retry_state;
                        exit_code = retry_exit_code;
                        message = retry_message;
                    }
                    Err(error) => {
                        state_name = "failed";
                        exit_code = None;
                        message = format!("yt-dlp 浏览器 Cookie 重试无法启动：{error}");
                    }
                }
            }
        }
        if let Ok(mut senders) = task_app.state::<AppState>().cancel_senders.lock() {
            senders.remove(&task_job_id);
        }
        // Keep files generated by the CLI itself, including qrcode.png.
        emit_log(
            &task_app,
            &task_job_id,
            &task_tool,
            "system",
            message.clone(),
        );
        let _ = task_app.emit(
            "job-state",
            JobState {
                job_id: task_job_id,
                tool: task_tool,
                state: state_name,
                exit_code,
                message,
            },
        );
    });
    Ok(RunResult { job_id })
}

#[tauri::command]
async fn dependency_status(app: AppHandle) -> Vec<DependencyStatus> {
    let tools = [
        ToolName::Bbdown,
        ToolName::YtDlp,
        ToolName::Musicdl,
        ToolName::Ffmpeg,
        ToolName::Ffprobe,
        ToolName::Mediainfo,
        ToolName::Deno,
        ToolName::Python,
    ];
    let mut statuses = Vec::new();
    for tool in tools {
        let bundled_path = bundled_binary(&app, tool.executable());
        let mut system_path =
            find_distinct_system_binary(tool.executable(), bundled_path.as_deref());
        if matches!(tool, ToolName::Python) && system_path.is_none() {
            system_path = resolve_tool(&app, &ToolName::Musicdl)
                .and_then(|(musicdl, _)| musicdl_python(&musicdl).ok());
        }
        let resolved = if matches!(tool, ToolName::Python) {
            system_path.clone().map(|path| (path, false))
        } else {
            resolve_tool(&app, &tool)
        };
        let version = if let Some((path, _)) = &resolved {
            tool_version(path, &tool).await
        } else {
            None
        };
        statuses.push(DependencyStatus {
            label: tool.label().into(),
            available: resolved.is_some(),
            bundled: resolved
                .as_ref()
                .map(|(_, bundled)| *bundled)
                .unwrap_or(false),
            bundled_available: bundled_path.is_some(),
            system_available: system_path.is_some(),
            source: resolved.as_ref().map(|(_, bundled)| {
                if *bundled {
                    "bundled".into()
                } else {
                    "system".into()
                }
            }),
            path: resolved
                .as_ref()
                .map(|(path, _)| path.to_string_lossy().into_owned()),
            version,
            required: tool.required(),
            install_hint: if resolved.is_none() {
                match tool {
                    ToolName::Musicdl => Some(if cfg!(target_os = "windows") {
                        "py -m pip install --user --upgrade pipx; py -m pipx ensurepath; py -m pipx install musicdl"
                            .into()
                    } else {
                        "brew install python pipx && pipx ensurepath && pipx install musicdl"
                            .into()
                    }),
                    ToolName::Python => Some(if cfg!(target_os = "windows") {
                        "winget install --id Python.Python.3.13 -e --accept-package-agreements --accept-source-agreements".into()
                    } else {
                        "brew install python".into()
                    }),
                    ToolName::Bbdown => None,
                    _ => Some(if cfg!(target_os = "windows") {
                        "请在 PowerShell 中分别使用 winget 安装 FFmpeg、yt-dlp、MediaInfo CLI 和 Deno"
                            .into()
                    } else {
                        "brew install ffmpeg yt-dlp media-info deno".into()
                    }),
                }
            } else {
                None
            },
            tool,
        });
    }
    statuses
}

#[tauri::command]
fn export_job_log(request: LogExportRequest) -> Result<DiagnosticExportResult, String> {
    let output = PathBuf::from(request.output_path);
    let parent = output
        .parent()
        .filter(|path| path.is_dir())
        .ok_or_else(|| "日志导出目录不存在".to_string())?;
    let mut text = format!(
        "MAD Toolbox task log\njob: {}\ntool: {}\nstate: {}\nmessage: {}\n\n",
        request.job.job_id,
        request.job.tool.label(),
        request.job.state,
        redact_output_line(&request.job.message)
    );
    for log in request.logs {
        let _ = writeln!(
            text,
            "[{}] [{}] [{}] {}",
            log.timestamp,
            log.tool.label(),
            log.stream,
            &log.line
        );
    }
    let temporary = parent.join(format!(".mad-toolbox-log-{}.tmp", Uuid::new_v4()));
    std::fs::write(&temporary, text).map_err(|error| format!("无法写入任务日志：{error}"))?;
    if output.is_file() {
        std::fs::remove_file(&output).map_err(|error| format!("无法覆盖任务日志：{error}"))?;
    }
    std::fs::rename(&temporary, &output).map_err(|error| format!("无法保存任务日志：{error}"))?;
    Ok(DiagnosticExportResult {
        path: output.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
async fn export_job_diagnostics(
    app: AppHandle,
    request: DiagnosticExportRequest,
) -> Result<DiagnosticExportResult, String> {
    let output = PathBuf::from(request.output_path.trim());
    if output.file_name().is_none()
        || output
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| !value.eq_ignore_ascii_case("zip"))
            .unwrap_or(true)
    {
        return Err("诊断包导出路径必须以 .zip 结尾".into());
    }
    let parent = output
        .parent()
        .filter(|path| path.is_dir())
        .ok_or_else(|| "诊断包导出目录不存在".to_string())?;
    if output.exists() && !output.is_file() {
        return Err("诊断包导出目标不是普通文件".into());
    }
    let temporary_output = parent.join(format!(".mad-toolbox-{}.tmp.zip", Uuid::new_v4()));

    let export_root = app_data_dir(&app)?
        .join("diagnostic-exports")
        .join(Uuid::new_v4().to_string());
    let package_name = format!(
        "MAD-Toolbox-Diagnostics-{}",
        request.job.job_id.chars().take(8).collect::<String>()
    );
    let package_dir = export_root.join(package_name);
    std::fs::create_dir_all(&package_dir)
        .map_err(|error| format!("无法创建诊断包临时目录：{error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&export_root, std::fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }

    let home = env::var(if cfg!(target_os = "windows") {
        "USERPROFILE"
    } else {
        "HOME"
    })
    .ok();
    let sanitize = |value: &str| {
        sanitize_diagnostic_text(value, request.redact_personal_data, home.as_deref())
    };
    let created_at = Local::now();
    let app_version = app.package_info().version.to_string();
    let (os_version, os_build, cpu, memory) = platform_system_info();
    let locale = env::var("LC_ALL")
        .or_else(|_| env::var("LANG"))
        .unwrap_or_else(|_| "未知".into());

    let mut dependencies = dependency_status(app.clone()).await;
    for dependency in &mut dependencies {
        if !request.include_dependency_paths {
            dependency.path = None;
        } else if let Some(path) = &dependency.path {
            dependency.path = Some(sanitize(path));
        }
        dependency.install_hint = None;
    }

    let logs = if request.include_logs {
        request
            .logs
            .iter()
            .map(|log| {
                serde_json::json!({
                    "timestamp": log.timestamp,
                    "tool": log.tool,
                    "stream": log.stream,
                    "line": sanitize(&log.line),
                })
            })
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    let diagnostics = serde_json::json!({
        "schemaVersion": 1,
        "createdAt": created_at.to_rfc3339(),
        "application": {
            "name": app.package_info().name,
            "version": app_version,
        },
        "system": {
            "os": env::consts::OS,
            "architecture": env::consts::ARCH,
            "osVersion": os_version,
            "osBuild": os_build,
            "cpu": cpu,
            "memory": memory,
            "locale": locale,
            "timezoneOffset": created_at.format("%:z").to_string(),
        },
        "task": {
            "jobId": request.job.job_id,
            "tool": request.job.tool,
            "state": request.job.state,
            "exitCode": request.job.exit_code,
            "message": sanitize(&request.job.message),
        },
        "dependencies": dependencies,
        "exportOptions": {
            "logsIncluded": request.include_logs,
            "dependencyPathsIncluded": request.include_dependency_paths,
            "personalDataRedacted": request.redact_personal_data,
            "credentialsAlwaysRedacted": true,
            "secureStoreAndTemplatesExcluded": true,
        },
        "logs": logs,
    });
    let json = serde_json::to_vec_pretty(&diagnostics)
        .map_err(|error| format!("无法生成诊断信息：{error}"))?;
    std::fs::write(package_dir.join("diagnostics.json"), json)
        .map_err(|error| format!("无法写入诊断信息：{error}"))?;

    let summary = format!(
        "MAD Toolbox 诊断包\n\
         \n\
         创建时间：{}\n\
         应用版本：{}\n\
         系统：{} {} ({}) / {}\n\
         CPU：{}\n\
         内存：{}\n\
         区域：{}\n\
         \n\
         任务 ID：{}\n\
         工具：{}\n\
         状态：{}\n\
         退出码：{}\n\
         消息：{}\n\
         \n\
         日志：{}\n\
         依赖路径：{}\n\
         隐私脱敏：{}\n",
        created_at.to_rfc3339(),
        app_version,
        env::consts::OS,
        os_version,
        os_build,
        env::consts::ARCH,
        cpu,
        memory,
        locale,
        request.job.job_id,
        request.job.tool.label(),
        request.job.state,
        request
            .job
            .exit_code
            .map(|value| value.to_string())
            .unwrap_or_else(|| "无".into()),
        sanitize(&request.job.message),
        if request.include_logs {
            format!("已包含 {} 条", request.logs.len())
        } else {
            "未包含".into()
        },
        if request.include_dependency_paths {
            "已包含"
        } else {
            "未包含"
        },
        if request.redact_personal_data {
            "已启用"
        } else {
            "未启用"
        },
    );
    std::fs::write(package_dir.join("summary.txt"), summary)
        .map_err(|error| format!("无法写入诊断摘要：{error}"))?;
    std::fs::write(
        package_dir.join("README.txt"),
        "此诊断包由 MAD Toolbox 在本机生成，不会自动上传。\n\
         诊断功能不会读取设置模板。\n\
         Cookie、Token、密码和代理认证等凭据始终会被隐藏。\n\
         请在提交给开发者前检查其中内容。\n\
         脱敏为尽力而为：第三方工具输出、文件名或自定义参数仍可能包含个人信息。\n",
    )
    .map_err(|error| format!("无法写入诊断说明：{error}"))?;
    if request.include_logs {
        let text = request
            .logs
            .iter()
            .map(|log| {
                format!(
                    "{} [{}/{}] {}",
                    log.timestamp,
                    log.tool.label(),
                    log.stream,
                    sanitize(&log.line)
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        std::fs::write(package_dir.join("task-logs.txt"), text)
            .map_err(|error| format!("无法写入任务日志：{error}"))?;
    }

    #[cfg(target_os = "macos")]
    let archive_result = background_command("/usr/bin/ditto")
        .args(["-c", "-k", "--norsrc", "--keepParent"])
        .arg(&package_dir)
        .arg(&temporary_output)
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| format!("无法启动 ZIP 打包工具：{error}"));
    #[cfg(target_os = "windows")]
    let archive_result = background_command("tar.exe")
        .args(["-a", "-c", "-f"])
        .arg(&temporary_output)
        .arg("-C")
        .arg(&export_root)
        .arg(
            package_dir
                .file_name()
                .ok_or_else(|| "诊断包临时目录无效".to_string())?,
        )
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| format!("无法启动 ZIP 打包工具：{error}"));
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let archive_result: Result<std::process::Output, String> =
        Err("当前系统暂不支持导出诊断包".into());

    let cleanup_result = std::fs::remove_dir_all(&export_root);
    let archive = archive_result?;
    if !archive.status.success() {
        let _ = std::fs::remove_file(&temporary_output);
        let reason = String::from_utf8_lossy(&archive.stderr).trim().to_string();
        return Err(format!("无法生成诊断 ZIP：{reason}"));
    }
    if cleanup_result.is_err() {
        // The ZIP is valid; stale app-private temporary data can be cleaned later.
    }
    if !temporary_output.is_file()
        || temporary_output
            .metadata()
            .map(|value| value.len())
            .unwrap_or(0)
            == 0
    {
        let _ = std::fs::remove_file(&temporary_output);
        return Err("诊断 ZIP 未正确生成".into());
    }
    if output.exists() {
        std::fs::remove_file(&output).map_err(|error| format!("无法覆盖已有诊断包：{error}"))?;
    }
    std::fs::rename(&temporary_output, &output).map_err(|error| {
        let _ = std::fs::remove_file(&temporary_output);
        format!("无法保存诊断 ZIP：{error}")
    })?;
    let exported_path = output
        .canonicalize()
        .unwrap_or_else(|_| parent.join(output.file_name().unwrap()))
        .to_string_lossy()
        .into_owned();
    Ok(DiagnosticExportResult {
        path: exported_path,
    })
}

#[tauri::command]
async fn ffmpeg_encoders(app: AppHandle) -> Result<Vec<String>, String> {
    let (ffmpeg, _) =
        resolve_tool(&app, &ToolName::Ffmpeg).ok_or_else(|| "未找到 FFmpeg".to_string())?;
    let output = background_command(ffmpeg)
        .args(["-hide_banner", "-encoders"])
        .env("PATH", command_path())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("无法读取 FFmpeg 编码器列表".into());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut encoders = text
        .lines()
        .filter_map(|line| {
            let fields = line.split_whitespace().collect::<Vec<_>>();
            if fields.len() >= 2
                && fields[0].len() == 6
                && fields[0]
                    .chars()
                    .all(|character| ".VASDFTIXB".contains(character))
            {
                Some(fields[1].to_string())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    encoders.sort();
    encoders.dedup();
    Ok(encoders)
}

#[tauri::command]
async fn run_tool(
    app: AppHandle,
    state: State<'_, AppState>,
    mut request: RunRequest,
) -> Result<RunResult, String> {
    if let Some(fallback_args) = request.fallback_args.as_ref() {
        if !matches!(request.tool, ToolName::YtDlp) {
            return Err("浏览器 Cookie 兜底只能用于 yt-dlp".into());
        }
        if !fallback_args
            .iter()
            .any(|arg| arg == "--cookies-from-browser")
        {
            return Err("浏览器 Cookie 兜底参数缺少 --cookies-from-browser".into());
        }
        validate_args(fallback_args)?;
    }
    let (resolved_executable, _bundled) = resolve_tool(&app, &request.tool)
        .ok_or_else(|| format!("未找到 {}，请先安装依赖", request.tool.label()))?;
    let executable = resolved_executable;
    let is_login = matches!(request.tool, ToolName::Bbdown)
        && request.args.first().map(String::as_str) == Some("login");
    if matches!(request.tool, ToolName::YtDlp)
        && !request.args.iter().any(|arg| arg == "--ffmpeg-location")
    {
        if let Some((ffmpeg, _)) = resolve_tool(&app, &ToolName::Ffmpeg) {
            ensure_ffmpeg_location(&mut request.args, &ffmpeg);
            if let Some(fallback_args) = request.fallback_args.as_mut() {
                ensure_ffmpeg_location(fallback_args, &ffmpeg);
            }
        }
    }

    let working_dir = if matches!(request.tool, ToolName::Bbdown) {
        Some(bbdown_directory(&executable)?)
    } else {
        request.working_dir.map(PathBuf::from)
    };

    if is_login {
        let directory = working_dir.ok_or_else(|| "无法确定 BBDown 工作目录".to_string())?;
        return spawn_bbdown_login_job(app, state, directory).await;
    }

    spawn_job(
        app,
        state,
        request.tool,
        executable,
        request.args,
        working_dir,
        request.fallback_args,
    )
    .await
}

#[tauri::command]
async fn musicdl_search(
    app: AppHandle,
    state: State<'_, AppState>,
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
        request.output_directory = app.path().download_dir().ok().map(|directory| {
            directory
                .join("MAD Toolbox")
                .join("Music")
                .to_string_lossy()
                .into_owned()
        });
    }
    if let Some(directory) = &request.output_directory {
        std::fs::create_dir_all(directory)
            .map_err(|error| format!("无法创建音乐下载目录：{error}"))?;
    }

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请先按照页面提示安装".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = musicdl_adapter(&app)?;
    let session_id = Uuid::new_v4().to_string();
    let session_directory = musicdl_sessions_dir(&app)?.join(&session_id);
    std::fs::create_dir_all(&session_directory).map_err(|error| error.to_string())?;
    let request_path = session_directory.join("request.json");
    let state_path = session_directory.join("results.pickle");
    let bytes = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    std::fs::write(&request_path, bytes).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&request_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }

    let mut child = background_command(python)
        .arg(adapter)
        .arg("search")
        .arg(&request_path)
        .arg(&state_path)
        .env("PATH", command_path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("无法启动 musicdl 搜索：{error}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    state
        .cancel_senders
        .lock()
        .map_err(|_| "任务状态锁定失败".to_string())?
        .insert(session_id.clone(), cancel_tx);

    let source_count = request.music_sources.len();
    emit_log(
        &app,
        &session_id,
        &ToolName::Musicdl,
        "system",
        format!(
            "$ musicdl GUI 搜索 {:?}（{} 个音乐源）",
            request.keyword, source_count
        ),
    );
    emit_log(
        &app,
        &session_id,
        &ToolName::Musicdl,
        "system",
        "后台搜索已启动；切换菜单不会中断任务。".into(),
    );
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
    tauri::async_runtime::spawn(async move {
        let (payload_tx, payload_rx) = oneshot::channel::<MusicdlAdapterOutput>();
        let stdout_task = stdout.map(|stdout| {
            let output_app = task_app.clone();
            let output_job_id = task_job_id.clone();
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                let mut payload_tx = Some(payload_tx);
                while let Ok(Some(line)) = lines.next_line().await {
                    if let Ok(payload) = serde_json::from_str::<MusicdlAdapterOutput>(&line) {
                        if let Some(sender) = payload_tx.take() {
                            let _ = sender.send(payload);
                        }
                    } else {
                        emit_log(
                            &output_app,
                            &output_job_id,
                            &ToolName::Musicdl,
                            "stdout",
                            strip_ansi_codes(&line),
                        );
                    }
                }
            })
        });
        let stderr_task = stderr.map(|stderr| {
            tauri::async_runtime::spawn(stream_output(
                stderr,
                task_app.clone(),
                task_job_id.clone(),
                ToolName::Musicdl,
                "stderr",
            ))
        });

        let (state_name, exit_code, mut message) = tokio::select! {
            status = child.wait() => match status {
                Ok(status) if status.success() => (
                    "completed",
                    status.code(),
                    "musicdl 搜索完成".to_string(),
                ),
                Ok(status) => (
                    "failed",
                    status.code(),
                    "musicdl 搜索失败，请查看日志".to_string(),
                ),
                Err(error) => (
                    "failed",
                    None,
                    format!("无法等待 musicdl 搜索：{error}"),
                ),
            },
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                ("cancelled", None, "musicdl 搜索已取消".to_string())
            },
            _ = sleep(Duration::from_secs(1800)) => {
                let _ = child.kill().await;
                (
                    "failed",
                    None,
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

        if state_name == "completed" {
            match payload_rx.await {
                Ok(payload) => {
                    let count = payload.results.len();
                    let response = MusicdlSearchResponse {
                        session_id: task_job_id.clone(),
                        results: payload.results,
                    };
                    let _ = task_app.emit("musicdl-search-result", response);
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
        if let Ok(mut senders) = task_app.state::<AppState>().cancel_senders.lock() {
            senders.remove(&task_job_id);
        }
        emit_log(
            &task_app,
            &task_job_id,
            &ToolName::Musicdl,
            "system",
            message.clone(),
        );
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
async fn musicdl_download(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    indices: Vec<usize>,
) -> Result<RunResult, String> {
    Uuid::parse_str(&session_id).map_err(|_| "无效的 musicdl 搜索会话".to_string())?;
    if indices.is_empty() {
        return Err("请至少选择一首音乐".into());
    }
    if indices.len() > 1000 {
        return Err("一次选择的音乐数量超过限制".into());
    }
    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请重新检测依赖".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = musicdl_adapter(&app)?;
    let state_path = musicdl_sessions_dir(&app)?
        .join(session_id)
        .join("results.pickle");
    if !state_path.is_file() {
        return Err("musicdl 搜索结果已失效，请重新搜索".into());
    }
    let selected = serde_json::to_string(&indices).map_err(|error| error.to_string())?;
    spawn_job(
        app,
        state,
        ToolName::Musicdl,
        python,
        vec![
            adapter.to_string_lossy().into_owned(),
            "download".into(),
            state_path.to_string_lossy().into_owned(),
            selected,
        ],
        None,
        None,
    )
    .await
}

#[tauri::command]
async fn musicdl_playlist(
    app: AppHandle,
    state: State<'_, AppState>,
    mut request: MusicdlPlaylistRequest,
) -> Result<RunResult, String> {
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
        .or_else(|| {
            app.path().download_dir().ok().map(|directory| {
                directory
                    .join("MAD Toolbox")
                    .join("Music")
                    .to_string_lossy()
                    .into_owned()
            })
        });
    let output_directory = request
        .output_directory
        .as_ref()
        .ok_or_else(|| "无法确定音乐导出目录".to_string())?;
    std::fs::create_dir_all(output_directory)
        .map_err(|error| format!("无法创建音乐导出目录：{error}"))?;

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请重新检测依赖".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = musicdl_adapter(&app)?;
    let session_directory = musicdl_sessions_dir(&app)?.join(Uuid::new_v4().to_string());
    std::fs::create_dir_all(&session_directory).map_err(|error| error.to_string())?;
    let request_path = session_directory.join("playlist-request.json");
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
    spawn_job(
        app,
        state,
        ToolName::Musicdl,
        python,
        vec![
            adapter.to_string_lossy().into_owned(),
            "playlist".into(),
            request_path.to_string_lossy().into_owned(),
        ],
        None,
        None,
    )
    .await
}

#[tauri::command]
fn cancel_job(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    let sender = state
        .cancel_senders
        .lock()
        .map_err(|_| "任务状态锁定失败".to_string())?
        .remove(&job_id)
        .ok_or_else(|| "任务已经结束或不存在".to_string())?;
    sender.send(()).map_err(|_| "无法取消任务".to_string())
}

#[tauri::command]
async fn check_youtube_access(proxy: Option<String>) -> Result<bool, String> {
    let curl = find_system_binary("curl").unwrap_or_else(|| {
        PathBuf::from(if cfg!(target_os = "windows") {
            "curl.exe"
        } else {
            "curl"
        })
    });
    let mut command = background_command(curl);
    command.args([
        "--location",
        "--silent",
        "--show-error",
        "--output",
        if cfg!(target_os = "windows") {
            "NUL"
        } else {
            "/dev/null"
        },
        "--max-time",
        "6",
        "--write-out",
        "%{http_code}",
    ]);
    if let Some(value) = proxy.filter(|value| !value.trim().is_empty()) {
        command.arg("--proxy").arg(value);
    }
    command.arg("https://www.youtube.com/generate_204");
    command.env("PATH", command_path()).kill_on_drop(true);
    let output = timeout(Duration::from_secs(8), command.output())
        .await
        .map_err(|_| "YouTube 网络检测超时".to_string())?
        .map_err(|error| error.to_string())?;
    let code = String::from_utf8_lossy(&output.stdout);
    Ok(output.status.success() && (code.trim() == "204" || code.trim() == "200"))
}

fn media_info_value<'a>(track: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    track
        .get(key)
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
}

fn media_info_number(track: &serde_json::Value, key: &str) -> Option<f64> {
    track.get(key).and_then(|value| {
        value
            .as_f64()
            .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
    })
}

fn human_duration(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    let seconds = total % 60;
    if hours > 0 {
        format!("{hours:02}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes:02}:{seconds:02}")
    }
}

fn media_info_summary(document: &serde_json::Value, path: &str) -> Result<String, String> {
    let tracks = document
        .pointer("/media/track")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "MediaInfo JSON 中缺少轨道信息".to_string())?;
    let mut summary = String::new();
    writeln!(summary, "文件信息").unwrap();
    writeln!(summary, "路径：{path}").unwrap();

    if let Some(general) = tracks
        .iter()
        .find(|track| media_info_value(track, "@type") == Some("General"))
    {
        if let Some(format) = media_info_value(general, "Format") {
            writeln!(summary, "封装格式：{format}").unwrap();
        }
        if let Some(profile) = media_info_value(general, "Format_Profile") {
            writeln!(summary, "格式配置：{profile}").unwrap();
        }
        if let Some(size) = media_info_number(general, "FileSize") {
            writeln!(summary, "文件大小：{:.2} MiB", size / 1_048_576.0).unwrap();
        }
        if let Some(duration) = media_info_number(general, "Duration") {
            writeln!(summary, "时长：{}", human_duration(duration)).unwrap();
        }
        if let Some(bitrate) = media_info_number(general, "OverallBitRate") {
            writeln!(summary, "总码率：{:.0} kb/s", bitrate / 1000.0).unwrap();
        }
        if let Some(title) = media_info_value(general, "Title") {
            writeln!(summary, "标题：{title}").unwrap();
        }
        if let Some(performer) = media_info_value(general, "Performer") {
            writeln!(summary, "作者/艺术家：{performer}").unwrap();
        }
    }

    let mut counters: HashMap<&str, usize> = HashMap::new();
    for track in tracks {
        let kind = media_info_value(track, "@type").unwrap_or("Other");
        if kind == "General" {
            continue;
        }
        let counter = counters.entry(kind).or_insert(0);
        *counter += 1;
        let localized = match kind {
            "Video" => "视频轨道",
            "Audio" => "音频轨道",
            "Text" => "字幕轨道",
            "Image" => "图片/封面轨道",
            "Menu" => "章节轨道",
            _ => "其他轨道",
        };
        writeln!(summary, "\n{localized} {}", *counter).unwrap();
        if let Some(format) = media_info_value(track, "Format") {
            let profile = media_info_value(track, "Format_Profile")
                .map(|value| format!(" / {value}"))
                .unwrap_or_default();
            writeln!(summary, "编码格式：{format}{profile}").unwrap();
        }
        if let Some(codec) = media_info_value(track, "CodecID") {
            writeln!(summary, "编码标识：{codec}").unwrap();
        }
        if let (Some(width), Some(height)) = (
            media_info_number(track, "Width"),
            media_info_number(track, "Height"),
        ) {
            writeln!(summary, "分辨率：{} × {}", width as u64, height as u64).unwrap();
        }
        if let Some(frame_rate) = media_info_number(track, "FrameRate") {
            writeln!(summary, "帧率：{frame_rate:.3} fps").unwrap();
        }
        if let Some(bitrate) = media_info_number(track, "BitRate") {
            writeln!(summary, "码率：{:.0} kb/s", bitrate / 1000.0).unwrap();
        }
        if let Some(bit_depth) = media_info_number(track, "BitDepth") {
            writeln!(summary, "位深：{} bit", bit_depth as u64).unwrap();
        }
        if let Some(color) = media_info_value(track, "ColorSpace") {
            let chroma = media_info_value(track, "ChromaSubsampling")
                .map(|value| format!(" / {value}"))
                .unwrap_or_default();
            writeln!(summary, "色彩：{color}{chroma}").unwrap();
        }
        if let Some(channels) = media_info_number(track, "Channels") {
            writeln!(summary, "声道数：{}", channels as u64).unwrap();
        }
        if let Some(layout) = media_info_value(track, "ChannelLayout") {
            writeln!(summary, "声道布局：{layout}").unwrap();
        }
        if let Some(sample_rate) = media_info_number(track, "SamplingRate") {
            writeln!(summary, "采样率：{:.1} kHz", sample_rate / 1000.0).unwrap();
        }
        if let Some(language) = media_info_value(track, "Language") {
            writeln!(summary, "语言：{language}").unwrap();
        }
        if let Some(title) = media_info_value(track, "Title") {
            writeln!(summary, "轨道标题：{title}").unwrap();
        }
    }
    Ok(summary.trim().to_string())
}

#[tauri::command]
async fn inspect_media(app: AppHandle, path: String) -> Result<MediaInspection, String> {
    let input = PathBuf::from(&path);
    if input.is_dir() {
        let count = media_files_in(&input)?.len();
        return Ok(MediaInspection {
            path,
            summary: format!("目录\n可处理的媒体文件：{count} 个\n默认递归子目录并忽略隐藏文件。"),
        });
    }
    if !input.is_file() {
        return Err("文件不存在".into());
    }
    let (executable, args, use_media_info_json) =
        if let Some((mediainfo, _)) = resolve_tool(&app, &ToolName::Mediainfo) {
            (
                mediainfo,
                vec!["--Output=JSON".to_string(), path.clone()],
                true,
            )
        } else if let Some((ffprobe, _)) = resolve_tool(&app, &ToolName::Ffprobe) {
            (
                ffprobe,
                vec![
                    "-hide_banner".into(),
                    "-of".into(),
                    "json".into(),
                    "-show_format".into(),
                    "-show_streams".into(),
                    path.clone(),
                ],
                false,
            )
        } else {
            return Err("未找到 MediaInfo 或 ffprobe".into());
        };
    let output = background_command(executable)
        .args(args)
        .env("PATH", command_path())
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        let reason = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("媒体信息读取失败：{reason}"));
    }
    let mut summary = String::from_utf8_lossy(&output.stdout).into_owned();
    if summary.trim().is_empty() {
        summary = String::from_utf8_lossy(&output.stderr).into_owned();
    } else if use_media_info_json {
        let document: serde_json::Value =
            serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
        summary = media_info_summary(&document, &path)?;
    }
    Ok(MediaInspection { path, summary })
}

fn media_files_in(directory: &Path) -> Result<Vec<PathBuf>, String> {
    const EXTENSIONS: &[&str] = &[
        // Video containers and elementary streams commonly handled by FFmpeg.
        "mp4", "mkv", "mov", "avi", "webm", "flv", "f4v", "m4v", "3gp", "3g2", "asf", "wmv", "vob",
        "ogv", "rm", "rmvb", "divx", "mpg", "mpeg", "mpe", "m1v", "m2v", "ts", "mts", "m2ts",
        "m2t", "mxf", "mod", "tod", "dat", "y4m", "ivf", "roq", "nsv", "nut", "dv", "qt", "ogm",
        "wtv", "dvr-ms", "gxf", "lxf", "evo", "m2p", "ps", "trp", "tp", "amv", "bik", "smk", "swf",
        "mve", "mvi", "svi", "viv", "vivo", "h264", "264", "avc", "h265", "265", "hevc", "av1",
        "vp8", "vp9", "mjpg", "mjpeg",
        // Lossless, lossy and professional audio formats.
        "mp3", "mp2", "mpa", "m4a", "aac", "flac", "wav", "wave", "ogg", "oga", "opus", "aiff",
        "aif", "aifc", "alac", "ape", "wv", "wma", "ac3", "eac3", "dts", "mka", "amr", "au", "snd",
        "caf", "tta", "dsf", "dff", "mlp", "thd", "spx", "ra", "ram", "voc", "gsm", "tak", "shn",
        "xm", "it", "s3m",
        // Text subtitle formats that FFmpeg can normally convert to SubRip.
        "srt", "ass", "ssa", "vtt", "webvtt", "sub", "mpl2", "jss", "rt", "sbv", "smi", "sami",
        "ttml", "dfxp", "lrc",
    ];
    fn visit(directory: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            let hidden = path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with('.'))
                .unwrap_or(false);
            if hidden || path.is_symlink() {
                continue;
            }
            if path.is_dir() {
                visit(&path, output)?;
            } else if path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
                .unwrap_or(false)
            {
                output.push(path);
            }
        }
        Ok(())
    }
    let mut output = Vec::new();
    visit(directory, &mut output)?;
    Ok(output)
}

fn is_text_subtitle_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            [
                "srt", "ass", "ssa", "vtt", "webvtt", "sub", "mpl2", "jss", "rt", "sbv", "smi",
                "sami", "ttml", "dfxp", "lrc",
            ]
            .iter()
            .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
}

#[tauri::command]
fn expand_media_inputs(
    paths: Vec<String>,
    include_subtitles: Option<bool>,
) -> Result<Vec<String>, String> {
    let include_subtitles = include_subtitles.unwrap_or(false);
    let mut output = Vec::new();
    for value in paths {
        let path = PathBuf::from(value);
        if path.is_dir() {
            output.extend(
                media_files_in(&path)?
                    .into_iter()
                    .filter(|item| include_subtitles || !is_text_subtitle_file(item))
                    .map(|item| item.to_string_lossy().into_owned()),
            );
        } else if path.is_file() {
            if is_text_subtitle_file(&path) && !include_subtitles {
                return Err(
                    "字幕文件请在「PR 原生兼容」中统一转为 SRT，或在「封装与抽流」中处理。".into(),
                );
            }
            output.push(path.to_string_lossy().into_owned());
        } else {
            return Err(format!("输入不存在：{}", path.to_string_lossy()));
        }
    }
    output.sort();
    output.dedup();
    Ok(output)
}

async fn probe_streams(
    ffprobe: &Path,
    input: &Path,
) -> Result<(Vec<String>, Vec<String>, Vec<String>), String> {
    let output = background_command(ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name:stream_disposition=attached_pic",
            "-of",
            "json",
        ])
        .arg(input)
        .env("PATH", command_path())
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "无法识别媒体文件 {}：{}",
            input.to_string_lossy(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let value: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    Ok(streams_from_probe(&value))
}

fn streams_from_probe(value: &serde_json::Value) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut video = Vec::new();
    let mut audio = Vec::new();
    let mut subtitles = Vec::new();
    if let Some(streams) = value["streams"].as_array() {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or_default();
            let codec = stream["codec_name"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let attached_picture = stream["disposition"]["attached_pic"].as_i64() == Some(1);
            if codec_type == "video" && !attached_picture && video.is_empty() {
                video.push(codec);
            } else if codec_type == "audio" {
                audio.push(codec);
            } else if codec_type == "subtitle" {
                subtitles.push(codec);
            }
        }
    }
    (video, audio, subtitles)
}

#[cfg(test)]
fn codecs_from_probe(value: &serde_json::Value) -> (Vec<String>, Vec<String>) {
    let (video, audio, _) = streams_from_probe(value);
    (video, audio)
}

fn pr_output_path(input: &Path, output_directory: Option<&str>, extension: &str) -> PathBuf {
    let directory = output_directory
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| input.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = input
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("output");
    directory.join(format!("{stem}.pr.{extension}"))
}

fn pr_container(video: &[String], audio_only: bool) -> &'static str {
    if audio_only {
        "wav"
    } else if !video.is_empty()
        && video
            .iter()
            .all(|codec| ["h264", "hevc"].contains(&codec.as_str()))
    {
        "mp4"
    } else {
        "mov"
    }
}

fn is_lossless_audio(audio: &[String]) -> bool {
    !audio.is_empty()
        && audio.iter().all(|codec| {
            codec.starts_with("pcm_")
                || codec.starts_with("dsd_")
                || [
                    "flac",
                    "alac",
                    "ape",
                    "wavpack",
                    "tta",
                    "tak",
                    "shorten",
                    "truehd",
                    "mlp",
                    "wmalossless",
                ]
                .contains(&codec.as_str())
        })
}

fn pr_audio_container(audio: &[String]) -> &'static str {
    if is_lossless_audio(audio) {
        "wav"
    } else if !audio.is_empty() && audio.iter().all(|codec| codec == "mp3") {
        "mp3"
    } else {
        "m4a"
    }
}

#[tauri::command]
async fn run_pr_compatible(
    app: AppHandle,
    state: State<'_, AppState>,
    input: String,
    output_directory: Option<String>,
) -> Result<Vec<RunResult>, String> {
    let (ffmpeg, _) =
        resolve_tool(&app, &ToolName::Ffmpeg).ok_or_else(|| "未找到 FFmpeg".to_string())?;
    let (ffprobe, _) =
        resolve_tool(&app, &ToolName::Ffprobe).ok_or_else(|| "未找到 ffprobe".to_string())?;
    let input_path = PathBuf::from(input);
    let inputs = if input_path.is_dir() {
        media_files_in(&input_path)?
    } else if input_path.is_file() {
        vec![input_path]
    } else {
        return Err("输入文件或目录不存在".into());
    };
    let mut jobs = Vec::new();
    for path in inputs {
        let (video, audio, subtitles) = probe_streams(&ffprobe, &path).await?;
        let audio_only = video.is_empty() && !audio.is_empty();
        let subtitle_only = video.is_empty() && audio.is_empty() && !subtitles.is_empty();
        if video.is_empty() && audio.is_empty() && subtitles.is_empty() {
            return Err(format!(
                "文件中没有可转换的媒体流：{}",
                path.to_string_lossy()
            ));
        }
        if subtitle_only
            && subtitles.iter().any(|codec| {
                ["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle", "xsub"]
                    .contains(&codec.as_str())
            })
        {
            return Err(format!(
                "{} 是图片字幕，需要 OCR 后才能转为 SRT",
                path.to_string_lossy()
            ));
        }
        let lossless_audio = audio_only && is_lossless_audio(&audio);
        let mov_video_copy = video.iter().all(|codec| {
            ["h264", "hevc", "prores", "dnxhd", "dvvideo", "mpeg2video"].contains(&codec.as_str())
        });
        let mov_audio_copy = audio.iter().all(|codec| {
            [
                "aac",
                "mp3",
                "pcm_s16le",
                "pcm_s24le",
                "pcm_s32le",
                "pcm_f32le",
            ]
            .contains(&codec.as_str())
        });
        let mp4_audio_copy = audio
            .iter()
            .all(|codec| ["aac", "mp3"].contains(&codec.as_str()));
        let container = if subtitle_only {
            "srt"
        } else if audio_only {
            pr_audio_container(&audio)
        } else {
            pr_container(&video, false)
        };
        let output = pr_output_path(&path, output_directory.as_deref(), container);
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut args = vec![
            "-n".into(),
            "-i".into(),
            path.to_string_lossy().into_owned(),
        ];
        if subtitle_only {
            args.extend(["-map".into(), "0:s:0".into(), "-c:s".into(), "srt".into()]);
        } else if audio_only {
            args.extend(["-map".into(), "0:a".into(), "-vn".into()]);
            if lossless_audio {
                args.extend(["-c:a".into(), "pcm_s24le".into()]);
            } else if container == "mp3" || audio.iter().all(|codec| codec == "aac") {
                args.extend(["-c:a".into(), "copy".into()]);
            } else {
                args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), "320k".into()]);
            }
        } else {
            args.extend([
                "-map".into(),
                "0:V:0?".into(),
                "-map".into(),
                "0:a?".into(),
                "-map_metadata".into(),
                "0".into(),
                "-map_chapters".into(),
                "0".into(),
            ]);
        }
        if !audio_only && !subtitle_only && container == "mp4" {
            args.extend(["-c:v".into(), "copy".into()]);
            if mp4_audio_copy {
                args.extend(["-c:a".into(), "copy".into()]);
            } else {
                args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), "320k".into()]);
            }
            if video.iter().any(|codec| codec == "hevc") {
                args.extend(["-tag:v".into(), "hvc1".into()]);
            }
            args.extend(["-movflags".into(), "+faststart".into()]);
        } else if !audio_only && !subtitle_only && mov_video_copy {
            args.extend(["-c:v".into(), "copy".into()]);
            args.extend([
                "-c:a".into(),
                if mov_audio_copy { "copy" } else { "pcm_s24le" }.into(),
            ]);
        } else if !audio_only && !subtitle_only {
            args.extend([
                "-c:v".into(),
                "prores_ks".into(),
                "-profile:v".into(),
                "2".into(),
                "-pix_fmt".into(),
                "yuv422p10le".into(),
                "-c:a".into(),
                "pcm_s24le".into(),
            ]);
        }
        args.push(output.to_string_lossy().into_owned());
        jobs.push(
            spawn_job(
                app.clone(),
                state.clone(),
                ToolName::Ffmpeg,
                ffmpeg.clone(),
                args,
                None,
                None,
            )
            .await?,
        );
    }
    Ok(jobs)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            app_settings,
            save_app_settings,
            dependency_status,
            export_job_log,
            export_job_diagnostics,
            ffmpeg_encoders,
            run_tool,
            musicdl_search,
            musicdl_download,
            musicdl_playlist,
            cancel_job,
            check_youtube_access,
            inspect_media,
            expand_media_inputs,
            run_pr_compatible
        ])
        .run(tauri::generate_context!())
        .expect("error while running MAD Toolbox");
}

#[cfg(test)]
mod tests {
    use super::{
        bbdown_qr_data_url, codecs_from_probe, cookie_header, has_required_bbdown_cookie,
        is_text_subtitle_file, media_info_summary, musicdl_launcher_python, parse_query_fields,
        poll_bbdown_qr_at, pr_audio_container, pr_container, redact_output_line,
        sanitize_diagnostic_text, streams_from_probe, strip_ansi_codes,
        yt_dlp_browser_cookie_fallback_requested,
    };
    use serde_json::json;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        path::Path,
        thread,
    };

    #[test]
    fn redacts_bilibili_credentials_from_process_output() {
        let output =
            redact_output_line("SESSDATA=secret; bili_jct=csrf access_token=another-secret");
        assert_eq!(output, "SESSDATA=***; bili_jct=*** access_token=***");
        assert!(!output.contains("secret"));
    }

    #[test]
    fn recognizes_ticket_only_and_complete_bbdown_data() {
        let ticket = parse_query_fields(
            "ticket=dummy;gourl=https%3A%2F%2Fwww.bilibili.com;first_domain=.bilibili.com",
            ';',
        );
        assert!(!has_required_bbdown_cookie(&ticket));
        let complete = parse_query_fields(
            "SESSDATA=session;bili_jct=csrf;DedeUserID=123;DedeUserID__ckMd5=hash;sid=sid",
            ';',
        );
        assert!(has_required_bbdown_cookie(&complete));
        assert_eq!(
            cookie_header(&complete),
            "SESSDATA=session;bili_jct=csrf;DedeUserID=123;DedeUserID__ckMd5=hash;sid=sid"
        );
        let comma = parse_query_fields("SESSDATA=session,part;bili_jct=csrf;DedeUserID=123", ';');
        assert_eq!(
            cookie_header(&comma),
            "SESSDATA=session%2Cpart;bili_jct=csrf;DedeUserID=123"
        );
    }

    #[tokio::test]
    async fn reads_complete_cookie_fields_from_qr_poll_set_cookie_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 8192];
            let length = stream.read(&mut request).unwrap();
            let request = String::from_utf8_lossy(&request[..length]);
            assert!(request.starts_with("GET /poll?qrcode_key=test-key&source=main-fe-header"));
            let body = r#"{"code":0,"data":{"code":0,"url":"https://passport.biligame.com/crossDomain?ticket=legacy-ticket"}}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nSet-Cookie: SESSDATA=session-value; Path=/; HttpOnly\r\nSet-Cookie: bili_jct=csrf-value; Path=/\r\nSet-Cookie: DedeUserID=123; Path=/\r\nSet-Cookie: DedeUserID__ckMd5=hash-value; Path=/\r\nSet-Cookie: sid=sid-value; Path=/\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let client = reqwest::Client::builder().build().unwrap();
        let (status, cookies, url) =
            poll_bbdown_qr_at(&client, &format!("http://{address}/poll"), "test-key")
                .await
                .unwrap();
        server.join().unwrap();
        assert_eq!(status, 0);
        assert!(has_required_bbdown_cookie(&cookies));
        assert_eq!(cookies.get("SESSDATA"), Some(&"session-value".to_string()));
        assert_eq!(cookies.get("bili_jct"), Some(&"csrf-value".to_string()));
        assert_eq!(cookies.get("DedeUserID"), Some(&"123".to_string()));
        assert_eq!(
            url.as_deref(),
            Some("https://passport.biligame.com/crossDomain?ticket=legacy-ticket")
        );
    }

    #[test]
    fn renders_bilibili_login_qr_as_data_url() {
        let data_url = bbdown_qr_data_url("https://passport.bilibili.com/qr/test").unwrap();
        assert!(data_url.starts_with("data:image/svg+xml;base64,"));
        assert!(data_url.len() > 500);
    }

    #[test]
    fn redacts_generic_json_and_header_credentials() {
        assert_eq!(
            redact_output_line(r#"request {"cookie":"private-cookie","password":"private-pass"}"#),
            r#"request {"cookie":"***","password":"***"}"#
        );
        assert_eq!(
            redact_output_line("Authorization: Bearer private-token"),
            "Authorization: ***"
        );
    }

    #[test]
    fn diagnostic_redaction_hides_home_urls_and_credentials() {
        let output = sanitize_diagnostic_text(
            "打开 /Users/demo/Videos/a.mp4 https://example.com/watch?v=1 SESSDATA=secret",
            true,
            Some("/Users/demo"),
        );
        assert_eq!(
            output,
            "打开 $HOME/Videos/a.mp4 <URL_REDACTED> SESSDATA=***"
        );
    }

    #[test]
    fn media_info_json_keeps_chinese_text_and_uses_localized_labels() {
        let document = json!({
            "media": {
                "track": [
                    {
                        "@type": "General",
                        "Format": "MPEG-4",
                        "Duration": "61.2",
                        "Title": "中文标题"
                    },
                    {
                        "@type": "Video",
                        "Format": "HEVC",
                        "Width": "1920",
                        "Height": "1080",
                        "FrameRate": "30.000"
                    }
                ]
            }
        });
        let summary = media_info_summary(&document, "/用户/视频/示例.mp4").unwrap();
        assert!(summary.contains("路径：/用户/视频/示例.mp4"));
        assert!(summary.contains("标题：中文标题"));
        assert!(summary.contains("视频轨道 1"));
        assert!(summary.contains("分辨率：1920 × 1080"));
    }

    #[test]
    fn finds_python_inside_pipx_polyglot_launcher() {
        let launcher = "#!/bin/sh\n'''exec' \"/Users/demo/pipx/venvs/musicdl/bin/python\" \"$0\" \"$@\"\n' '''\nimport sys\n";
        assert_eq!(
            musicdl_launcher_python(launcher),
            Some(Path::new("/Users/demo/pipx/venvs/musicdl/bin/python").to_path_buf())
        );
        assert_eq!(
            musicdl_launcher_python("#!/usr/bin/env python3\nimport sys\n"),
            Some(Path::new("python3").to_path_buf())
        );
    }

    #[test]
    fn removes_terminal_colors_before_gui_logging() {
        assert_eq!(
            strip_ansi_codes("Searching \u{1b}[93m稻香\u{1b}[0m From Migu"),
            "Searching 稻香 From Migu"
        );
    }

    #[test]
    fn recognizes_yt_dlp_browser_cookie_fallback_errors() {
        assert!(yt_dlp_browser_cookie_fallback_requested(
            "ERROR: Sign in to confirm you're not a bot."
        ));
        assert!(yt_dlp_browser_cookie_fallback_requested(
            "Use --cookies-from-browser or --cookies for the authentication."
        ));
        assert!(yt_dlp_browser_cookie_fallback_requested(
            "Please sign in to confirm you’re not a bot."
        ));
        assert!(!yt_dlp_browser_cookie_fallback_requested(
            "ERROR: Unable to download webpage: network timeout"
        ));
    }

    #[test]
    fn pr_workflow_prefers_mp4_for_h264_and_hevc() {
        assert_eq!(pr_container(&["h264".into()], false), "mp4");
        assert_eq!(pr_container(&["hevc".into()], false), "mp4");
        assert_eq!(pr_container(&["prores".into()], false), "mov");
        assert_eq!(pr_container(&[], true), "wav");
    }

    #[test]
    fn pr_workflow_selects_native_audio_outputs() {
        assert_eq!(pr_audio_container(&["flac".into()]), "wav");
        assert_eq!(pr_audio_container(&["pcm_s24le".into()]), "wav");
        assert_eq!(pr_audio_container(&["mp3".into()]), "mp3");
        assert_eq!(pr_audio_container(&["opus".into()]), "m4a");
    }

    #[test]
    fn pr_workflow_ignores_attached_cover_art() {
        let probe = json!({
            "streams": [
                {
                    "codec_name": "hevc",
                    "codec_type": "video",
                    "disposition": { "attached_pic": 0 }
                },
                {
                    "codec_name": "aac",
                    "codec_type": "audio",
                    "disposition": { "attached_pic": 0 }
                },
                {
                    "codec_name": "mjpeg",
                    "codec_type": "video",
                    "disposition": { "attached_pic": 1 }
                }
            ]
        });
        let (video, audio) = codecs_from_probe(&probe);
        assert_eq!(video, vec!["hevc"]);
        assert_eq!(audio, vec!["aac"]);
        assert_eq!(pr_container(&video, false), "mp4");
    }

    #[test]
    fn recognizes_text_subtitle_inputs_without_case_sensitivity() {
        assert!(is_text_subtitle_file(Path::new("subtitle.srt")));
        assert!(is_text_subtitle_file(Path::new("subtitle.ASS")));
        assert!(is_text_subtitle_file(Path::new("subtitle.vtt")));
        assert!(is_text_subtitle_file(Path::new("subtitle.sub")));
        assert!(!is_text_subtitle_file(Path::new("video.mp4")));
    }

    #[test]
    fn pr_workflow_detects_standalone_subtitle_streams() {
        let probe = json!({
            "streams": [{
                "codec_name": "webvtt",
                "codec_type": "subtitle",
                "disposition": { "attached_pic": 0 }
            }]
        });
        let (video, audio, subtitles) = streams_from_probe(&probe);
        assert!(video.is_empty());
        assert!(audio.is_empty());
        assert_eq!(subtitles, vec!["webvtt"]);
    }
}
