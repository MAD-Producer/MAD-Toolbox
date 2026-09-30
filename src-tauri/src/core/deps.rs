use std::{
    env,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use tauri::Emitter;
use tauri::{AppHandle, Manager};
use tokio::{
    process::Command,
    time::{timeout, Duration},
};

use super::settings::{load_app_settings, DependencyPreference};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub(crate) fn hide_async_command_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

pub(crate) fn hide_std_command_window(command: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

pub(crate) fn background_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    hide_async_command_window(&mut command);
    command
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
mod python_pin {
    pub(crate) const WINGET_INSTALL: &str = "winget install --id Python.Python.3.13 -e --scope user --accept-package-agreements --accept-source-agreements";
    pub(crate) const INSTALL_DIRECTORY: &str = "Python313";
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum ToolName {
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

    /// 一键安装命令（Windows 用 winget，macOS 用 Homebrew）；macOS 的 bbdown 仅认内置副本，ffprobe 随 FFmpeg 分发。
    fn install_command(&self) -> Option<&'static str> {
        if cfg!(target_os = "windows") {
            match self {
                Self::Bbdown => Some(
                    "winget install --id nilaoda.BBDown -e --accept-package-agreements --accept-source-agreements",
                ),
                Self::YtDlp => Some(
                    "winget install --id yt-dlp.yt-dlp -e --accept-package-agreements --accept-source-agreements",
                ),
                Self::Ffmpeg => Some(
                    "winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements",
                ),
                Self::Mediainfo => Some(
                    "winget install --id MediaArea.MediaInfo -e --accept-package-agreements --accept-source-agreements",
                ),
                Self::Deno => Some(
                    "winget install --id DenoLand.Deno -e --accept-package-agreements --accept-source-agreements",
                ),
                Self::Python => Some(python_pin::WINGET_INSTALL),
                Self::Musicdl => None,
                _ => None,
            }
        } else {
            match self {
                Self::YtDlp => Some("brew install yt-dlp"),
                Self::Ffmpeg => Some("brew install ffmpeg"),
                Self::Mediainfo => Some("brew install media-info"),
                Self::Deno => Some("brew install deno"),
                Self::Python => Some("brew install python@3.13"),
                Self::Musicdl => None,
                _ => None,
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DependencyStatus {
    tool: ToolName,
    label: String,
    available: bool,
    bundled: bool,
    bundled_available: bool,
    system_available: bool,
    source: Option<String>,
    path: Option<String>,
    version: Option<String>,
    health_check_failed: bool,
    health_check_error: Option<String>,
    install_command: Option<String>,
    install_shell: &'static str,
    required: bool,
    install_hint: Option<String>,
}

#[cfg(target_os = "windows")]
fn find_executable_directory(
    directory: &Path,
    executable: &str,
    remaining_depth: usize,
) -> Option<PathBuf> {
    if directory.join(executable).is_file() {
        return Some(directory.to_path_buf());
    }
    if remaining_depth == 0 {
        return None;
    }
    std::fs::read_dir(directory)
        .ok()?
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_dir()))
        .find_map(|entry| find_executable_directory(&entry.path(), executable, remaining_depth - 1))
}

#[cfg(target_os = "windows")]
fn winget_package_paths(packages_root: &Path) -> Vec<PathBuf> {
    // Portable packages do not always create WinGet Links. Rescan only the
    // packages this app installs so a completed install is visible immediately.
    const MAX_DEPTH: usize = 3;
    const PACKAGES: [(&str, &str); 5] = [
        ("nilaoda.BBDown_", "BBDown.exe"),
        ("Gyan.FFmpeg_", "ffmpeg.exe"),
        ("yt-dlp.yt-dlp_", "yt-dlp.exe"),
        ("MediaArea.MediaInfo_", "mediainfo.exe"),
        ("DenoLand.Deno_", "deno.exe"),
    ];

    let Ok(entries) = std::fs::read_dir(packages_root) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|file_type| file_type.is_dir()))
        .filter_map(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            PACKAGES
                .iter()
                .find(|(prefix, _)| {
                    name.get(..prefix.len())
                        .is_some_and(|name| name.eq_ignore_ascii_case(prefix))
                })
                .and_then(|(_, executable)| {
                    find_executable_directory(&entry.path(), executable, MAX_DEPTH)
                })
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn windows_local_paths(local: &Path) -> Vec<PathBuf> {
    let python = local
        .join("Programs")
        .join("Python")
        .join(python_pin::INSTALL_DIRECTORY);
    let winget = local.join("Microsoft").join("WinGet");
    let mut paths = vec![python.join("Scripts"), python, winget.join("Links")];
    paths.extend(winget_package_paths(&winget.join("Packages")));
    paths.extend([
        local.join("pipx").join("bin"),
        local.join("Microsoft").join("WindowsApps"),
    ]);
    paths
}

pub(crate) fn command_path() -> OsString {
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
        if let Some(scoop) = env::var_os("SCOOP") {
            paths.push(PathBuf::from(scoop).join("shims"));
        }
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            paths.extend(windows_local_paths(&local));
        }
        if let Some(program_data) = env::var_os("ProgramData") {
            paths.push(PathBuf::from(program_data).join("chocolatey").join("bin"));
        }
        if let Some(chocolatey) = env::var_os("ChocolateyInstall") {
            paths.push(PathBuf::from(chocolatey).join("bin"));
        }
        if let Some(program_files) = env::var_os("ProgramFiles") {
            let winget = PathBuf::from(program_files).join("WinGet");
            paths.push(winget.join("Links"));
            paths.extend(winget_package_paths(&winget.join("Packages")));
        }
        if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
            paths.extend(winget_package_paths(
                &PathBuf::from(program_files_x86)
                    .join("WinGet")
                    .join("Packages"),
            ));
        }
    }
    if let Some(pipx_bin) = env::var_os("PIPX_BIN_DIR") {
        paths.insert(0, PathBuf::from(pipx_bin));
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

// 通过内置依赖的路径来区分FULL和LITE，为自动更新下载版本做选择
pub(crate) fn bundled_binary(app: &AppHandle, name: &str) -> Option<PathBuf> {
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

    #[cfg(target_os = "windows")]
    if let Some(directory) = match name {
        "BBDown" => Some("BBDown"),
        "ffmpeg" | "ffprobe" => Some("FFmpeg"),
        "mediainfo" => Some("MediaInfo"),
        "yt-dlp" => Some("yt-dlp"),
        "deno" => Some("Deno"),
        _ => None,
    } {
        if let Ok(resources) = app.path().resource_dir() {
            candidates.push(
                resources
                    .join("dependencies")
                    .join(directory)
                    .join(&target_name),
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(current) = env::current_exe() {
            if let Some(parent) = current.parent() {
                candidates.push(parent.join(&target_name));
            }
        }
        if let Ok(resources) = app.path().resource_dir() {
            candidates.push(resources.join(&target_name));
            candidates.push(resources.join("binaries").join(&target_name));
        }
    }
    candidates.into_iter().find(|path| path.is_file())
}

pub(crate) fn resolve_tool(app: &AppHandle, tool: &ToolName) -> Option<(PathBuf, bool)> {
    let bundled = bundled_binary(app, tool.executable()).map(|path| (path, true));
    let system = find_distinct_system_binary(
        tool.executable(),
        bundled.as_ref().map(|(path, _)| path.as_path()),
    )
    .map(|path| (path, false));

    if matches!(tool, ToolName::Bbdown) {
        if cfg!(target_os = "windows") {
            bundled.or(system)
        } else {
            bundled
        }
    } else if matches!(
        load_app_settings(app).dependency_preference,
        DependencyPreference::System
    ) {
        system.or(bundled)
    } else {
        bundled.or(system)
    }
}

#[cfg(not(target_os = "windows"))]
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
pub(crate) fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
    let script = std::fs::read_to_string(executable).map_err(|error| {
        rust_i18n::t!("backend.deps.musicdlScriptReadFailed", error = error).to_string()
    })?;
    let hint = musicdl_launcher_python(&script)
        .ok_or_else(|| rust_i18n::t!("backend.deps.musicdlPythonUnrecognized").to_string())?;
    let interpreter =
        if hint.is_absolute() {
            hint
        } else {
            find_system_binary(hint.to_str().ok_or_else(|| {
                rust_i18n::t!("backend.deps.musicdlLauncherInfoInvalid").to_string()
            })?)
            .ok_or_else(|| rust_i18n::t!("backend.deps.musicdlInterpreterNotFound").to_string())?
        };
    interpreter
        .is_file()
        .then_some(interpreter)
        .ok_or_else(|| rust_i18n::t!("backend.deps.musicdlInterpreterMissing").to_string())
}

// distlib Windows launchers contain: PE launcher + UTF-8 shebang + ZIP payload.
#[cfg(target_os = "windows")]
fn musicdl_python_hint(executable: &Path) -> Result<PathBuf, String> {
    let bytes = std::fs::read(executable).map_err(|error| error.to_string())?;
    let interpreter = bytes
        .windows(2)
        .enumerate()
        .filter(|(_, pair)| *pair == b"#!")
        .find_map(|(offset, _)| {
            let tail = &bytes[offset + 2..];
            let end = tail.iter().position(|byte| *byte == b'\n')?;
            if !tail.get(end + 1..)?.starts_with(b"PK\x03\x04") {
                return None;
            }
            let value = std::str::from_utf8(&tail[..end]).ok()?.trim();
            let value = value
                .strip_prefix('"')
                .and_then(|quoted| quoted.split_once('"').map(|(path, _)| path))
                .unwrap_or(value);
            let path = PathBuf::from(value);
            (path.is_absolute()
                && path
                    .file_name()?
                    .to_str()?
                    .eq_ignore_ascii_case("python.exe"))
            .then_some(path)
        });
    interpreter.ok_or_else(|| rust_i18n::t!("backend.deps.musicdlPythonUnrecognized").to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
    let interpreter = musicdl_python_hint(executable)?;
    interpreter
        .is_file()
        .then_some(interpreter)
        .ok_or_else(|| rust_i18n::t!("backend.deps.musicdlInterpreterMissing").to_string())
}

#[cfg(not(target_os = "windows"))]
fn musicdl_python_hint(executable: &Path) -> Result<PathBuf, String> {
    let script = std::fs::read_to_string(executable).map_err(|error| error.to_string())?;
    musicdl_launcher_python(&script)
        .ok_or_else(|| rust_i18n::t!("backend.deps.musicdlPythonUnrecognized").to_string())
}

fn musicdl_pipx_environment(executable: &Path) -> Option<PathBuf> {
    let python = musicdl_python_hint(executable).ok()?;
    let root = python.parent()?.parent()?;
    let metadata: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("pipx_metadata.json")).ok()?).ok()?;
    (root.parent()?.file_name()? == "venvs"
        && metadata["main_package"]["package"].as_str() == Some("musicdl"))
    .then(|| root.to_path_buf())
}

async fn compatible_python(preferred: Option<PathBuf>) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    candidates.extend(preferred);
    #[cfg(target_os = "windows")]
    {
        let mut command = background_command("py");
        command.args(["-0p"]).kill_on_drop(true);
        if let Ok(Ok(output)) = timeout(Duration::from_secs(3), command.output()).await {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                if let Some(drive) = line.find(":\\") {
                    if let Some(path) = line.get(drive.saturating_sub(1)..) {
                        candidates.push(PathBuf::from(path.trim()));
                    }
                }
            }
        }
    }
    for directory in env::split_paths(&command_path()) {
        if directory
            .file_name()
            .is_some_and(|name| name == "WindowsApps")
        {
            continue;
        }
        for name in [
            "python",
            "python3",
            "python3.13",
            "python3.12",
            "python3.11",
            "python3.10",
        ] {
            let path = directory.join(executable_filename(name));
            if path.is_file() && !candidates.contains(&path) {
                candidates.push(path);
            }
        }
    }
    for candidate in candidates {
        let mut command = background_command(&candidate);
        command.args(["-c", "import sys, json, venv; assert sys.version_info >= (3, 10); print(json.dumps(getattr(sys, '_base_executable', sys.executable)))"])
            .env("PYTHONIOENCODING", "utf-8").kill_on_drop(true);
        if let Ok(Ok(output)) = timeout(Duration::from_secs(3), command.output()).await {
            if output.status.success() {
                if let Ok(path) = serde_json::from_slice::<String>(&output.stdout) {
                    let path = PathBuf::from(path);
                    if path.is_file() {
                        return Some(path);
                    }
                }
            }
        }
    }
    None
}

fn shell_quote(value: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("'{}'", value.replace('\'', "''"))
    } else {
        format!("'{}'", value.replace('\'', "'\"'\"'"))
    }
}

async fn dependency_install_command(
    tool: &ToolName,
    executable: Option<&Path>,
    health_check_failed: bool,
) -> Option<String> {
    if !matches!(tool, ToolName::Musicdl) {
        return tool.install_command().map(str::to_owned);
    }
    let repair = if health_check_failed {
        Some(musicdl_pipx_environment(executable?)?)
    } else {
        None
    };
    let python = compatible_python(executable.and_then(|path| musicdl_python(path).ok())).await;
    let pipx = find_system_binary("pipx");
    let operation = repair
        .as_ref()
        .and_then(|root| root.file_name())
        .map(|name| format!("reinstall {}", shell_quote(&name.to_string_lossy())))
        .unwrap_or_else(|| "install musicdl".into());
    let environment = repair
        .as_ref()
        .map(|root| {
            let home = shell_quote(&root.parent().unwrap().parent().unwrap().to_string_lossy());
            let bin = executable
                .and_then(Path::parent)
                .filter(|directory| !directory.starts_with(root))
                .map(|directory| shell_quote(&directory.to_string_lossy()));
            if cfg!(target_os = "windows") {
                format!(
                    "$env:PIPX_HOME = {home}\n{}",
                    bin.map(|bin| format!("$env:PIPX_BIN_DIR = {bin}\n"))
                        .unwrap_or_default()
                )
            } else {
                format!(
                    "export PIPX_HOME={home}\n{}",
                    bin.map(|bin| format!("export PIPX_BIN_DIR={bin}\n"))
                        .unwrap_or_default()
                )
            }
        })
        .unwrap_or_default();
    if cfg!(target_os = "windows") {
        let python_setup = if let Some(python) = python {
            format!("$python = {}", shell_quote(&python.to_string_lossy()))
        } else {
            format!(
                "{}\n$env:PATH = [Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + $env:PATH\nif (Get-Command py -ErrorAction SilentlyContinue) {{\n$python = & py -3.13 -c 'import sys; print(sys.executable)'\n}} else {{\n$python = Join-Path $env:LOCALAPPDATA 'Programs\\Python\\Python313\\python.exe'\n}}\nif (!$python -or !(Test-Path -LiteralPath $python)) {{ throw 'Python 3.13 was not found. Reopen the app after installing Python.' }}",
                python_pin::WINGET_INSTALL
            )
        };
        let pipx_setup = if let Some(pipx) = pipx {
            format!(
                "$pipx = {}\n$prefix = @()",
                shell_quote(&pipx.to_string_lossy())
            )
        } else {
            "$pipx = $python\n$prefix = @('-m', 'pipx')\n& $python -m pip install --user --upgrade pipx\nif ($LASTEXITCODE -ne 0) { throw 'Unable to install pipx' }".into()
        };
        Some(format!(
            "& {{\n$ErrorActionPreference = 'Stop'\n{python_setup}\n{pipx_setup}\n{environment}& $pipx @prefix {operation} --python $python\nif ($LASTEXITCODE -ne 0) {{ throw 'musicdl installation failed' }}\n& $pipx @prefix ensurepath\nif ($LASTEXITCODE -ne 0) {{ throw 'Unable to update PATH' }}\n}}"
        ))
    } else {
        let python_setup = if let Some(python) = python {
            format!("python={}", shell_quote(&python.to_string_lossy()))
        } else {
            "brew install python@3.13\npython=\"$(brew --prefix python@3.13)/bin/python3.13\""
                .into()
        };
        let pipx_setup = if let Some(pipx) = pipx {
            format!("pipx={}", shell_quote(&pipx.to_string_lossy()))
        } else {
            "brew install pipx\npipx=\"$(brew --prefix)/bin/pipx\"".into()
        };
        Some(format!(
            "(\nset -e\n{python_setup}\n{pipx_setup}\n{environment}\"$pipx\" {operation} --python \"$python\"\n\"$pipx\" ensurepath\n)"
        ))
    }
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

async fn musicdl_health(executable: &Path) -> Result<(), String> {
    let python = musicdl_python(executable)?;
    let mut command = background_command(python);
    command
        .env("PATH", command_path())
        .env("PYTHONIOENCODING", "utf-8")
        .kill_on_drop(true)
        .args(["-c", "from musicdl import musicdl"]);
    let output = timeout(Duration::from_secs(10), command.output())
        .await
        .map_err(|_| rust_i18n::t!("backend.deps.healthTimeout").to_string())?
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if error.is_empty() {
            output.status.to_string()
        } else {
            error
        })
    }
}

#[tauri::command]
pub(crate) async fn dependency_status(app: AppHandle) -> Vec<DependencyStatus> {
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
        if matches!(tool, ToolName::Python) {
            system_path = resolve_tool(&app, &ToolName::Musicdl)
                .and_then(|(musicdl, _)| musicdl_python(&musicdl).ok());
            if system_path.is_none() {
                system_path = compatible_python(None).await;
            }
        }
        let resolved = if matches!(tool, ToolName::Python) {
            system_path.clone().map(|path| (path, false))
        } else {
            resolve_tool(&app, &tool)
        };
        let health_check_error = if matches!(tool, ToolName::Musicdl) {
            if let Some((path, _)) = &resolved {
                musicdl_health(path).await.err()
            } else {
                None
            }
        } else {
            None
        };
        let health_check_failed = health_check_error.is_some();
        let available = resolved.is_some() && !health_check_failed;
        let install_command = if available {
            None
        } else {
            dependency_install_command(
                &tool,
                resolved.as_ref().map(|(path, _)| path.as_path()),
                health_check_failed,
            )
            .await
        };
        let version = if available {
            let (path, _) = resolved.as_ref().unwrap();
            tool_version(path, &tool).await
        } else {
            None
        };
        statuses.push(DependencyStatus {
            label: tool.label().into(),
            available,
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
            health_check_failed,
            required: tool.required(),
            install_hint: if health_check_failed && install_command.is_none() {
                Some(rust_i18n::t!("backend.deps.manualRepair").to_string())
            } else {
                None
            },
            install_command,
            install_shell: if cfg!(target_os = "windows") {
                "PowerShell"
            } else {
                "sh"
            },
            health_check_error,
            tool,
        });
    }
    statuses
}

/// Windows 安装命令与页面复制命令均使用 PowerShell 5.1 语法。
#[cfg(target_os = "windows")]
fn launch_install(command: &str) -> Result<tokio::process::Child, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
    use base64::Engine;
    let script = format!(
        "$ErrorActionPreference = 'Stop'\ntry {{\n{command}\nif ($LASTEXITCODE -ne 0) {{ throw \"Exit code: $LASTEXITCODE\" }}\n}} catch {{ Write-Host $_ -ForegroundColor Red }}\nRead-Host {}",
        shell_quote(&rust_i18n::t!("backend.deps.installDone"))
    );
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut builder = Command::new("powershell.exe");
    builder.args([
        "-NoProfile",
        "-EncodedCommand",
        &base64::engine::general_purpose::STANDARD.encode(bytes),
    ]);
    builder.env("PATH", command_path());
    builder.as_std_mut().creation_flags(CREATE_NEW_CONSOLE);
    builder.spawn().map_err(|error| {
        rust_i18n::t!("backend.deps.terminalOpenFailed", error = error).to_string()
    })
}

#[cfg(target_os = "macos")]
fn launch_install(command: &str) -> Result<(), String> {
    let command = format!("sh -c {}; exit", shell_quote(command));
    let escaped = command.replace('\\', "\\\\").replace('"', "\\\"");
    let script =
        format!("tell application \"Terminal\"\nactivate\ndo script \"{escaped}\"\nend tell");
    let status = std::process::Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|error| {
            rust_i18n::t!("backend.deps.terminalOpenFailed", error = error).to_string()
        })?;
    if status.success() {
        Ok(())
    } else {
        Err(rust_i18n::t!("backend.deps.terminalScriptFailed").to_string())
    }
}

/// 打开终端执行安装；Windows 窗口关闭或 macOS 检测到工具后刷新依赖。
#[tauri::command]
pub(crate) async fn dependency_install(app: AppHandle, tool: ToolName) -> Result<(), String> {
    let resolved = resolve_tool(&app, &tool);
    let health_check_failed = if matches!(tool, ToolName::Musicdl) {
        if let Some((path, _)) = &resolved {
            musicdl_health(path).await.is_err()
        } else {
            false
        }
    } else {
        false
    };
    let command = dependency_install_command(
        &tool,
        resolved.as_ref().map(|(path, _)| path.as_path()),
        health_check_failed,
    )
    .await
    .ok_or_else(|| rust_i18n::t!("backend.deps.installNotSupported").to_string())?;
    let handle = app.clone();
    #[cfg(target_os = "windows")]
    {
        let mut child = launch_install(&command)?;
        tauri::async_runtime::spawn(async move {
            if child.wait().await.is_ok() {
                let _ = handle.emit("dependency-install-finished", tool);
            }
        });
    }
    #[cfg(target_os = "macos")]
    {
        launch_install(&command)?;
        let executable = tool.executable().to_string();
        tauri::async_runtime::spawn(async move {
            // Terminal 的 do script 拿不到完成事件，改为轮询系统 PATH；安装完成后
            // 二进制会出现在 command_path 覆盖的 brew/pipx 目录中
            let deadline = tokio::time::Instant::now() + Duration::from_secs(30 * 60);
            while tokio::time::Instant::now() < deadline {
                tokio::time::sleep(Duration::from_secs(3)).await;
                if let Some(path) = find_system_binary(&executable) {
                    if matches!(tool, ToolName::Musicdl) && musicdl_health(&path).await.is_err() {
                        continue;
                    }
                    let _ = handle.emit("dependency-install-finished", tool);
                    break;
                }
            }
        });
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (handle, command);
        return Err(rust_i18n::t!("backend.deps.installUnsupportedPlatform").to_string());
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn ffmpeg_encoders(app: AppHandle) -> Result<Vec<String>, String> {
    let (ffmpeg, _) = resolve_tool(&app, &ToolName::Ffmpeg)
        .ok_or_else(|| rust_i18n::t!("backend.deps.ffmpegNotFound").to_string())?;
    let output = background_command(ffmpeg)
        .args(["-hide_banner", "-encoders"])
        .env("PATH", command_path())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(rust_i18n::t!("backend.deps.ffmpegEncodersReadFailed").to_string());
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

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use std::os::windows::ffi::OsStringExt;

    use super::*;

    fn launcher_fixture(python: &Path) -> (PathBuf, PathBuf) {
        let directory = env::temp_dir().join(format!("mad-deps-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        let launcher = directory.join("musicdl.exe");
        let mut bytes = b"MZ\0\xffnot-a-shebang#!invalid\n".to_vec();
        bytes.extend(format!("#!\"{}\"\n", python.display()).as_bytes());
        bytes.extend(b"PK\x03\x04");
        std::fs::write(&launcher, bytes).unwrap();
        (directory, launcher)
    }

    #[test]
    fn launcher_uses_embedded_interpreter_even_when_it_is_missing() {
        let expected = PathBuf::from(r"C:\Missing 环境\O'Brien\Scripts\python.exe");
        let (directory, launcher) = launcher_fixture(&expected);
        assert_eq!(musicdl_python_hint(&launcher).unwrap(), expected);
        assert!(musicdl_python(&launcher).is_err());
        assert!(musicdl_pipx_environment(&launcher).is_none());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[tokio::test]
    async fn unmanaged_broken_environment_does_not_offer_pipx_reinstall() {
        let (directory, launcher) = launcher_fixture(Path::new(r"C:\Custom\Scripts\python.exe"));
        assert!(
            dependency_install_command(&ToolName::Musicdl, Some(&launcher), true)
                .await
                .is_none()
        );
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[tokio::test]
    async fn pipx_repair_preserves_custom_home_and_parses_in_powershell() {
        let directory = env::temp_dir().join(format!("mad-deps-test-{}", uuid::Uuid::new_v4()));
        let environment = directory.join("O'Brien 环境").join("venvs").join("musicdl");
        std::fs::create_dir_all(&environment).unwrap();
        std::fs::write(
            environment.join("pipx_metadata.json"),
            r#"{"main_package":{"package":"musicdl"}}"#,
        )
        .unwrap();
        let (launcher_directory, launcher) =
            launcher_fixture(&environment.join("Scripts").join("python.exe"));
        assert_eq!(musicdl_pipx_environment(&launcher).unwrap(), environment);
        let script = dependency_install_command(&ToolName::Musicdl, Some(&launcher), true)
            .await
            .unwrap();
        assert!(script.contains("reinstall 'musicdl' --python $python"));
        assert!(script.contains(&format!(
            "$env:PIPX_HOME = {}",
            shell_quote(
                &environment
                    .parent()
                    .unwrap()
                    .parent()
                    .unwrap()
                    .to_string_lossy()
            )
        )));
        assert!(script.contains("$env:PIPX_BIN_DIR = "));
        let output = background_command("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command",
                "$tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseInput($env:MAD_TEST_SCRIPT, [ref]$tokens, [ref]$errors) > $null; if ($errors.Count) { $errors | Out-String | Write-Output; exit 1 }"])
            .env("MAD_TEST_SCRIPT", script)
            .output().await.unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stdout)
        );
        std::fs::remove_dir_all(launcher_directory).unwrap();
        std::fs::remove_dir_all(directory).unwrap();
    }

    fn command_processor() -> PathBuf {
        env::var_os("ComSpec")
            .map(PathBuf::from)
            .or_else(|| {
                env::var_os("SystemRoot")
                    .map(|root| PathBuf::from(root).join("System32").join("cmd.exe"))
            })
            .expect("无法定位 cmd.exe")
    }

    #[test]
    fn embedded_nul_path_reproduces_spawn_failure() {
        let mut buffer = r"C:\Tools".encode_utf16().collect::<Vec<_>>();
        buffer.push(0);
        buffer.extend(r"ignored-after-terminator".encode_utf16());
        let invalid_path = OsString::from_wide(&buffer);

        let error = std::process::Command::new(command_processor())
            .args(["/D", "/C", "exit 0"])
            .env("PATH", invalid_path)
            .status()
            .expect_err("含嵌入式 NUL 的 PATH 不应成功启动进程");
        eprintln!("reproduced spawn error: {:?}: {error}", error.kind());
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
        assert_eq!(error.to_string(), "nul byte found in provided data");
    }
}
