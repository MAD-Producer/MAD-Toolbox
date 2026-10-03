use std::{
    collections::BTreeMap,
    env,
    ffi::{OsStr, OsString},
    io::Read,
    path::{Component, Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State, Url};
use tokio::{
    process::Command,
    time::{timeout, Duration},
};

use super::settings::{app_data_dir, load_app_settings, DependencyPreference};
use super::task::{types::Feature, TaskHub};

const MIRROR_DOWNLOAD_BASE: &str = "https://openlist.frameneo.com/sd/mt_dependencies/";
const MIRROR_MANIFEST_URL: &str = "https://openlist.frameneo.com/sd/mt_dependencies/version.json";
static MIRROR_INSTALL_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
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
                Self::Bbdown => Some("dotnet tool install --global BBDown"),
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
    managed_available: bool,
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

/// Toolbox 本地安装记录，不是远端 version.json 的格式。
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ManagedDependency {
    pub(crate) version: String,
    pub(crate) file_name: String,
    pub(crate) sha256: String,
    pub(crate) executables: BTreeMap<ToolName, PathBuf>,
}

#[derive(Clone, Serialize, Deserialize)]
struct MirrorPackage {
    #[serde(flatten)]
    installation: ManagedDependency,
    size: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MirrorManifest {
    schema_version: u32,
    platforms: BTreeMap<String, BTreeMap<ToolName, MirrorPackage>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MirrorDependencyStatus {
    tool: ToolName,
    #[serde(flatten)]
    package: MirrorPackage,
    installed_version: Option<String>,
    update_available: bool,
}

fn mirror_platform() -> Result<&'static str, String> {
    match (env::consts::OS, env::consts::ARCH) {
        ("windows", "x86_64") => Ok("windows-x64"),
        ("macos", "aarch64") => Ok("macos-arm64"),
        _ => Err(rust_i18n::t!("backend.deps.mirrorUnsupported").to_string()),
    }
}

fn parse_mirror_manifest(
    bytes: &[u8],
    platform: &str,
) -> Result<BTreeMap<ToolName, MirrorPackage>, String> {
    let manifest: MirrorManifest = serde_json::from_slice(bytes)
        .map_err(|error| rust_i18n::t!("backend.deps.manifestFailed", error = error).to_string())?;
    if manifest.schema_version != 1 {
        return Err(rust_i18n::t!("backend.deps.manifestSchemaUnsupported").to_string());
    }
    let packages = manifest
        .platforms
        .get(platform)
        .ok_or_else(|| rust_i18n::t!("backend.deps.mirrorUnsupported").to_string())?;
    let mut selected = BTreeMap::new();
    for tool in [
        ToolName::Deno,
        ToolName::Mediainfo,
        ToolName::Ffmpeg,
        ToolName::Bbdown,
        ToolName::YtDlp,
    ] {
        let package = packages.get(&tool).ok_or_else(|| {
            rust_i18n::t!("backend.deps.manifestPackageMissing", tool = tool.label()).to_string()
        })?;
        validate_mirror_package(&tool, &package.installation)?;
        selected.insert(tool, package.clone());
    }
    Ok(selected)
}

fn mirror_client(app: &AppHandle, timeout: Duration) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("MAD-Toolbox/{}", app.package_info().version))
        .timeout(timeout);
    if let Some(proxy) = load_app_settings(app).proxy {
        builder = builder.proxy(reqwest::Proxy::all(proxy).map_err(|error| error.to_string())?);
    }
    builder.build().map_err(|error| error.to_string())
}

async fn fetch_mirror_packages(
    app: &AppHandle,
) -> Result<BTreeMap<ToolName, MirrorPackage>, String> {
    let platform = mirror_platform()?;
    let bytes = mirror_client(app, Duration::from_secs(20))?
        .get(MIRROR_MANIFEST_URL)
        .header(reqwest::header::CACHE_CONTROL, "no-cache")
        .send()
        .await
        .map_err(|error| rust_i18n::t!("backend.deps.manifestFailed", error = error).to_string())?
        .error_for_status()
        .map_err(|error| rust_i18n::t!("backend.deps.manifestFailed", error = error).to_string())?
        .bytes()
        .await
        .map_err(|error| rust_i18n::t!("backend.deps.manifestFailed", error = error).to_string())?;
    parse_mirror_manifest(&bytes, platform)
}

fn mirror_update_available(
    installed: Option<&ManagedDependency>,
    latest: &ManagedDependency,
) -> bool {
    installed.is_some_and(|installed| {
        installed.file_name != latest.file_name
            || !installed.sha256.eq_ignore_ascii_case(&latest.sha256)
    })
}

#[tauri::command]
pub(crate) async fn dependency_mirror_status(
    app: AppHandle,
) -> Result<Vec<MirrorDependencyStatus>, String> {
    let packages = fetch_mirror_packages(&app).await?;
    Ok(packages
        .into_iter()
        .map(|(tool, package)| {
            let installed = managed_directory(&app, &tool)
                .and_then(|directory| installed_dependency(&directory));
            MirrorDependencyStatus {
                update_available: mirror_update_available(
                    installed.as_ref(),
                    &package.installation,
                ),
                installed_version: installed.map(|installation| installation.version),
                tool,
                package,
            }
        })
        .collect())
}

impl ToolName {
    pub(crate) fn package_name(&self) -> Option<&'static str> {
        match self {
            Self::Bbdown => Some("bbdown"),
            Self::YtDlp => Some("yt-dlp"),
            Self::Ffmpeg | Self::Ffprobe => Some("ffmpeg"),
            Self::Mediainfo => Some("mediainfo"),
            Self::Deno => Some("deno"),
            Self::Musicdl | Self::Python => None,
        }
    }
}

pub(crate) fn managed_directory(app: &AppHandle, tool: &ToolName) -> Option<PathBuf> {
    Some(
        app_data_dir(app)
            .ok()?
            .join("dependencies")
            .join(tool.package_name()?),
    )
}

fn installed_dependency(directory: &Path) -> Option<ManagedDependency> {
    serde_json::from_slice(&std::fs::read(directory.join("installation.json")).ok()?).ok()
}

fn installed_binary(directory: &Path, tool: &ToolName) -> Option<PathBuf> {
    let installation = installed_dependency(directory)?;
    let relative = installation.executables.get(tool)?;
    if !relative
        .components()
        .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
    {
        return None;
    }
    let executable = directory.join(relative);
    executable.is_file().then_some(executable)
}

pub(crate) fn managed_binary(app: &AppHandle, tool: &ToolName) -> Option<PathBuf> {
    installed_binary(&managed_directory(app, tool)?, tool)
}

fn mirror_download_url(file_name: &str) -> Result<Url, String> {
    let mut components = Path::new(file_name).components();
    if !matches!(components.next(), Some(Component::Normal(_)))
        || components.next().is_some()
        || file_name.contains(['/', '\\', ':'])
        || !file_name.to_ascii_lowercase().ends_with(".zip")
    {
        return Err(rust_i18n::t!("backend.deps.invalidPackageFile").to_string());
    }
    let mut url = Url::parse(MIRROR_DOWNLOAD_BASE).map_err(|error| error.to_string())?;
    url.path_segments_mut()
        .map_err(|_| rust_i18n::t!("backend.deps.invalidPackageFile").to_string())?
        .pop_if_empty()
        .push(file_name);
    Ok(url)
}

fn validate_mirror_package(tool: &ToolName, package: &ManagedDependency) -> Result<(), String> {
    let group = tool
        .package_name()
        .ok_or_else(|| rust_i18n::t!("backend.deps.mirrorUnsupported").to_string())?;
    mirror_download_url(&package.file_name)?;
    if package.sha256.len() != 64 || !package.sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(rust_i18n::t!("backend.deps.invalidPackageHash").to_string());
    }
    let required = if group == "ffmpeg" {
        vec![ToolName::Ffmpeg, ToolName::Ffprobe]
    } else {
        vec![tool.clone()]
    };
    if required
        .iter()
        .any(|tool| !package.executables.contains_key(tool))
        || package
            .executables
            .keys()
            .any(|tool| tool.package_name() != Some(group))
        || package.executables.values().any(|path| {
            path.as_os_str().is_empty()
                || !path
                    .components()
                    .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
        })
    {
        return Err(rust_i18n::t!("backend.deps.invalidPackageExecutables").to_string());
    }
    Ok(())
}

fn enclosed_link(path: &Path) -> bool {
    let mut depth = 0;
    for component in path.components() {
        match component {
            Component::Normal(_) => depth += 1,
            Component::CurDir => {}
            Component::ParentDir if depth > 0 => depth -= 1,
            _ => return false,
        }
    }
    true
}

fn unpack_mirror_package(archive: &Path, destination: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let path = entry
            .enclosed_name()
            .ok_or_else(|| rust_i18n::t!("backend.deps.unsafePackagePath").to_string())?;
        if entry.is_symlink() {
            let mut target = String::new();
            entry
                .read_to_string(&mut target)
                .map_err(|error| error.to_string())?;
            let parent = path.parent().unwrap_or_else(|| Path::new(""));
            if !enclosed_link(&parent.join(target)) {
                return Err(rust_i18n::t!("backend.deps.unsafePackagePath").to_string());
            }
        }
    }
    archive
        .extract(destination)
        .map_err(|error| error.to_string())
}

fn prepare_mirror_installation(
    archive: &Path,
    destination: &Path,
    package: &ManagedDependency,
) -> Result<(), String> {
    use std::io::Write;

    unpack_mirror_package(archive, destination)?;
    let root = destination
        .canonicalize()
        .map_err(|error| error.to_string())?;
    for relative in package.executables.values() {
        let executable = destination.join(relative);
        let resolved = executable
            .canonicalize()
            .map_err(|error| error.to_string())?;
        if !resolved.starts_with(&root) || !resolved.is_file() {
            return Err(rust_i18n::t!("backend.deps.invalidPackageExecutables").to_string());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755))
                .map_err(|error| error.to_string())?;
        }
    }
    let record = serde_json::to_vec_pretty(package).map_err(|error| error.to_string())?;
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination.join("installation.json"))
        .map_err(|error| error.to_string())?
        .write_all(&record)
        .map_err(|error| error.to_string())
}

fn replace_mirror_installation(
    prepared: &Path,
    current: &Path,
    previous: &Path,
) -> Result<(), String> {
    if let (Some(old), Some(new)) = (
        installed_binary(current, &ToolName::Bbdown),
        installed_binary(prepared, &ToolName::Bbdown),
    ) {
        let old_state = old.parent().unwrap().join("BBDown.data");
        if old_state.is_file() {
            let new_state = new.parent().unwrap().join("BBDown.data");
            if std::fs::symlink_metadata(&new_state).is_ok() {
                std::fs::remove_file(&new_state).map_err(|error| error.to_string())?;
            }
            std::fs::copy(old_state, new_state).map_err(|error| error.to_string())?;
        }
    }
    let replacing = current.exists();
    if replacing {
        std::fs::rename(current, previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = std::fs::rename(prepared, current) {
        if replacing {
            std::fs::rename(previous, current).map_err(|restore| {
                rust_i18n::t!(
                    "backend.deps.restoreFailed",
                    error = error,
                    restore = restore,
                    path = previous.display()
                )
                .to_string()
            })?;
        }
        return Err(error.to_string());
    }
    Ok(())
}

async fn ensure_mirror_not_in_use(hub: &TaskHub, tool: &ToolName) -> Result<(), String> {
    let group = tool.package_name();
    let busy = hub.snapshot().await.iter().any(|task| {
        !task.status.is_terminal()
            && match group {
                Some("ffmpeg") => true,
                Some("bbdown") => task.feature == Feature::Bilibili,
                Some("yt-dlp" | "deno") => task.feature == Feature::Network,
                _ => false,
            }
    });
    if busy {
        return Err(rust_i18n::t!("backend.deps.mirrorInUse").to_string());
    }
    Ok(())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DependencyDownloadProgress {
    tool: ToolName,
    received: u64,
    total: Option<u64>,
}

async fn download_mirror_package(
    client: &reqwest::Client,
    url: Url,
    destination: &Path,
    expected_hash: &str,
    mut progress: impl FnMut(u64, Option<u64>),
) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;

    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let total = response.content_length();
    progress(0, total);
    let mut file = tokio::fs::File::create(destination)
        .await
        .map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut received = 0;
    let mut emitted = std::time::Instant::now();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        file.write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;
        digest.update(&chunk);
        received += chunk.len() as u64;
        if emitted.elapsed() >= Duration::from_millis(500) {
            progress(received, total);
            emitted = std::time::Instant::now();
        }
    }
    file.flush().await.map_err(|error| error.to_string())?;
    drop(file);
    if !format!("{:x}", digest.finalize()).eq_ignore_ascii_case(expected_hash) {
        return Err(rust_i18n::t!("backend.deps.packageHashMismatch").to_string());
    }
    progress(received, total);
    Ok(())
}

#[tauri::command]
pub(crate) async fn dependency_install_mirror(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    tool: ToolName,
) -> Result<(), String> {
    let group = tool
        .package_name()
        .ok_or_else(|| rust_i18n::t!("backend.deps.mirrorUnsupported").to_string())?;
    let _guard = MIRROR_INSTALL_LOCK
        .try_lock()
        .map_err(|_| rust_i18n::t!("backend.deps.mirrorInstalling").to_string())?;
    let packages = fetch_mirror_packages(&app).await?;
    let remote = packages
        .values()
        .find(|package| package.installation.executables.contains_key(&tool))
        .ok_or_else(|| {
            rust_i18n::t!("backend.deps.manifestPackageMissing", tool = group).to_string()
        })?;
    let mut package = remote.installation.clone();
    let current = managed_directory(&app, &tool)
        .ok_or_else(|| rust_i18n::t!("backend.deps.mirrorUnsupported").to_string())?;
    if current.exists() {
        ensure_mirror_not_in_use(&hub, &tool).await?;
    }
    let parent = current.parent().unwrap();
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = tempfile::Builder::new()
        .prefix(".install-")
        .tempdir_in(parent)
        .map_err(|error| error.to_string())?;
    let archive = temporary.path().join("download.zip");
    let client = mirror_client(&app, Duration::from_secs(3600))?;
    download_mirror_package(
        &client,
        mirror_download_url(&package.file_name)?,
        &archive,
        &package.sha256,
        |received, total| {
            let _ = app.emit(
                "dependency-download-progress",
                DependencyDownloadProgress {
                    tool: tool.clone(),
                    received,
                    total: total.or(Some(remote.size)),
                },
            );
        },
    )
    .await?;
    package.sha256 = package.sha256.to_ascii_lowercase();
    let prepared = temporary.path().join("payload");
    let preparation_package = package.clone();
    let preparation_path = prepared.clone();
    let temporary = tauri::async_runtime::spawn_blocking(move || {
        prepare_mirror_installation(&archive, &preparation_path, &preparation_package)?;
        Ok::<_, String>(temporary)
    })
    .await
    .map_err(|error| error.to_string())??;
    if current.exists() {
        ensure_mirror_not_in_use(&hub, &tool).await?;
    }
    let previous = temporary.path().join("previous");
    let result = replace_mirror_installation(&prepared, &current, &previous);
    if result.is_err() && previous.exists() {
        let _ = temporary.keep();
    }
    result?;
    let _ = app.emit("dependency-install-finished", tool);
    Ok(())
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
        let home = PathBuf::from(home);
        paths.push(home.join(".local").join("bin"));
        paths.push(home.join(".dotnet").join("tools"));
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
    find_distinct_system_binary(name, None)
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

fn find_distinct_system_binary(name: &str, managed: Option<&Path>) -> Option<PathBuf> {
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
            && !managed
                .map(|managed| same_binary(&candidate, managed))
                .unwrap_or(false)
        {
            return Some(candidate);
        }
    }
    None
}

pub(crate) fn resolve_tool(app: &AppHandle, tool: &ToolName) -> Option<(PathBuf, bool)> {
    let managed = managed_binary(app, tool).map(|path| (path, true));
    let system = find_distinct_system_binary(
        tool.executable(),
        managed.as_ref().map(|(path, _)| path.as_path()),
    )
    .map(|path| (path, false));

    if matches!(
        load_app_settings(app).dependency_preference,
        DependencyPreference::System
    ) {
        system.or(managed)
    } else {
        managed.or(system)
    }
}

pub(crate) fn execution_path(app: &AppHandle) -> OsString {
    let mut directories = Vec::new();
    for tool in [
        ToolName::Bbdown,
        ToolName::YtDlp,
        ToolName::Ffmpeg,
        ToolName::Ffprobe,
        ToolName::Mediainfo,
        ToolName::Deno,
    ] {
        if let Some((path, _)) = resolve_tool(app, &tool) {
            if let Some(parent) = path.parent() {
                let directory = parent.to_path_buf();
                if !directories.contains(&directory) {
                    directories.push(directory);
                }
            }
        }
    }
    let system = command_path();
    directories.extend(env::split_paths(&system));
    env::join_paths(directories).unwrap_or(system)
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
        let managed_path = managed_binary(&app, &tool);
        let mut system_path =
            find_distinct_system_binary(tool.executable(), managed_path.as_deref());
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
        let install_command = if system_path.is_some() && available {
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
            tool_version(path, &tool).await.or_else(|| {
                resolved
                    .as_ref()
                    .filter(|(_, managed)| *managed)
                    .and_then(|_| managed_directory(&app, &tool))
                    .and_then(|directory| installed_dependency(&directory))
                    .map(|installation| installation.version)
            })
        } else {
            None
        };
        statuses.push(DependencyStatus {
            label: tool.label().into(),
            available,
            managed_available: managed_path.is_some(),
            system_available: system_path.is_some(),
            source: resolved.as_ref().map(|(_, managed)| {
                if *managed {
                    "managed".into()
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
            } else if matches!(tool, ToolName::Bbdown) && cfg!(target_os = "macos") && !available {
                Some(rust_i18n::t!("backend.deps.bbdownDotnetHint").to_string())
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

#[cfg(test)]
mod mirror_tests {
    use std::{io::Write, net::TcpListener, thread};
    use zip::write::SimpleFileOptions;

    use super::*;

    fn manifest_fixture() -> serde_json::Value {
        let mut packages = serde_json::Map::new();
        for (tool, path) in [
            ("deno", "deno"),
            ("mediainfo", "usr/local/bin/mediainfo"),
            ("ffmpeg", "ffmpeg"),
            ("bbdown", "BBDown"),
            ("yt-dlp", "yt-dlp_macos"),
        ] {
            let mut executables =
                serde_json::Map::from_iter([(tool.to_string(), serde_json::json!(path))]);
            if tool == "ffmpeg" {
                executables.insert("ffprobe".into(), serde_json::json!("ffprobe"));
            }
            packages.insert(
                tool.into(),
                serde_json::json!({
                    "version": "v1.0+repack",
                    "fileName": format!("{tool}-r1-macos-arm64.zip"),
                    "sha256": "a".repeat(64),
                    "size": 42,
                    "executables": executables,
                    "upstreamFingerprint": "publisher-only",
                    "upstream": {"url": "https://example.com/upstream"}
                }),
            );
        }
        serde_json::json!({
            "schemaVersion": 1,
            "generatedAt": "2026-10-02T23:13:46Z",
            "platforms": {"macos-arm64": packages}
        })
    }

    #[test]
    fn manifest_preserves_selected_platform_package_layout() {
        let bytes = serde_json::to_vec(&manifest_fixture()).unwrap();
        let selected = parse_mirror_manifest(&bytes, "macos-arm64").unwrap();
        assert_eq!(selected.len(), 5);
        assert_eq!(
            selected[&ToolName::Mediainfo].installation.executables[&ToolName::Mediainfo],
            PathBuf::from("usr/local/bin/mediainfo")
        );
        assert!(selected[&ToolName::Ffmpeg]
            .installation
            .executables
            .contains_key(&ToolName::Ffprobe));
        assert_eq!(selected[&ToolName::YtDlp].size, 42);
    }

    #[test]
    fn manifest_rejects_unavailable_platform() {
        let bytes = serde_json::to_vec(&manifest_fixture()).unwrap();
        assert!(parse_mirror_manifest(&bytes, "windows-x64").is_err());
    }

    #[test]
    fn manifest_rejects_non_json_response() {
        assert!(parse_mirror_manifest(b"<html>server error</html>", "macos-arm64").is_err());
    }

    #[test]
    fn manifest_rejects_missing_required_package() {
        let mut missing = manifest_fixture();
        missing["platforms"]["macos-arm64"]
            .as_object_mut()
            .unwrap()
            .remove("deno");
        assert!(
            parse_mirror_manifest(&serde_json::to_vec(&missing).unwrap(), "macos-arm64").is_err()
        );
    }

    #[test]
    fn manifest_rejects_unsupported_schema() {
        let mut invalid = manifest_fixture();
        invalid["schemaVersion"] = serde_json::json!(2);
        assert!(
            parse_mirror_manifest(&serde_json::to_vec(&invalid).unwrap(), "macos-arm64").is_err()
        );
    }

    #[test]
    fn updates_compare_package_identity_without_semver_or_system_version_checks() {
        let mut installed = package(ToolName::Deno, "deno");
        let mut latest = installed.clone();
        assert!(!mirror_update_available(None, &latest));
        assert!(!mirror_update_available(Some(&installed), &latest));
        latest.sha256 = "b".repeat(64);
        assert!(mirror_update_available(Some(&installed), &latest));
        installed.sha256 = latest.sha256.to_ascii_uppercase();
        assert!(!mirror_update_available(Some(&installed), &latest));
        latest.file_name = "same-version-repack.zip".into();
        assert!(mirror_update_available(Some(&installed), &latest));
    }

    #[tokio::test]
    #[ignore = "downloads the current small MediaInfo package from the live CDN"]
    async fn live_cdn_manifest_download_and_installation() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap();
        let bytes = client
            .get(MIRROR_MANIFEST_URL)
            .send()
            .await
            .unwrap()
            .error_for_status()
            .unwrap()
            .bytes()
            .await
            .unwrap();
        let packages = parse_mirror_manifest(&bytes, mirror_platform().unwrap()).unwrap();
        let remote = &packages[&ToolName::Mediainfo];
        let directory = tempfile::tempdir().unwrap();
        let archive = directory.path().join("download.zip");
        let mut received = 0;
        download_mirror_package(
            &client,
            mirror_download_url(&remote.installation.file_name).unwrap(),
            &archive,
            &remote.installation.sha256,
            |bytes, _| received = bytes,
        )
        .await
        .unwrap();
        assert_eq!(received, remote.size);
        let prepared = directory.path().join("prepared");
        prepare_mirror_installation(&archive, &prepared, &remote.installation).unwrap();
        let current = directory.path().join("mediainfo");
        replace_mirror_installation(&prepared, &current, &directory.path().join("previous"))
            .unwrap();
        assert!(installed_binary(&current, &ToolName::Mediainfo)
            .unwrap()
            .is_file());
        assert!(!mirror_update_available(
            installed_dependency(&current).as_ref(),
            &remote.installation
        ));
    }

    fn package(tool: ToolName, path: &str) -> ManagedDependency {
        ManagedDependency {
            version: "release+packaging-fix".into(),
            file_name: "fixture.zip".into(),
            sha256: "a".repeat(64),
            executables: BTreeMap::from([(tool, PathBuf::from(path))]),
        }
    }

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let mut archive = zip::ZipWriter::new(std::fs::File::create(path).unwrap());
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o755);
        for (name, content) in entries {
            archive.start_file(*name, options).unwrap();
            archive.write_all(content).unwrap();
        }
        archive.finish().unwrap();
    }

    fn response(body: &[u8], status: &str, length: usize) -> (Url, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = Url::parse(&format!(
            "http://{}/package.zip",
            listener.local_addr().unwrap()
        ))
        .unwrap();
        let body = body.to_vec();
        let status = status.to_owned();
        let server = thread::spawn(move || {
            let (mut connection, _) = listener.accept().unwrap();
            connection
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = [0; 4096];
            connection.read(&mut request).unwrap();
            write!(
                connection,
                "HTTP/1.1 {status}\r\nContent-Length: {length}\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
            connection.write_all(&body).unwrap();
        });
        (url, server)
    }

    #[test]
    fn mirror_url_accepts_only_asset_filenames_and_encodes_them() {
        let url = mirror_download_url("deno 空格#1.zip").unwrap();
        assert!(url.as_str().starts_with(MIRROR_DOWNLOAD_BASE));
        assert!(url.as_str().contains("%20"));
        assert!(url.as_str().contains("%23"));
        assert!(url.query().is_none());
        assert!(url.fragment().is_none());
        for name in [
            "",
            "../deno.zip",
            "/deno.zip",
            "bin/deno.zip",
            "bin\\deno.zip",
            "C:deno.zip",
            "https://other.invalid/deno.zip",
            "deno.exe",
        ] {
            assert!(mirror_download_url(name).is_err(), "{name}");
        }
    }

    #[test]
    fn mirror_metadata_keeps_python_system_only_and_requires_shared_ffmpeg_executables() {
        for tool in [ToolName::Python, ToolName::Musicdl] {
            assert!(validate_mirror_package(&tool, &package(tool.clone(), "program")).is_err());
        }
        let mut metadata = package(ToolName::Ffmpeg, "bin/ffmpeg");
        assert!(validate_mirror_package(&ToolName::Ffmpeg, &metadata).is_err());
        metadata
            .executables
            .insert(ToolName::Ffprobe, "bin/ffprobe".into());
        assert!(validate_mirror_package(&ToolName::Ffmpeg, &metadata).is_ok());
        assert!(validate_mirror_package(&ToolName::Ffprobe, &metadata).is_ok());
        metadata.executables.insert(ToolName::Deno, "deno".into());
        assert!(validate_mirror_package(&ToolName::Ffmpeg, &metadata).is_err());
        for path in ["", "../deno", "/deno"] {
            assert!(
                validate_mirror_package(&ToolName::Deno, &package(ToolName::Deno, path)).is_err()
            );
        }
        let mut metadata = package(ToolName::Deno, "bin/deno");
        metadata.sha256 = "not-a-sha256".into();
        assert!(validate_mirror_package(&ToolName::Deno, &metadata).is_err());
    }

    #[test]
    fn zip_preparation_preserves_layout_and_records_without_executing_programs() {
        let directory = tempfile::tempdir().unwrap();
        let archive = directory.path().join("fixture.zip");
        let prepared = directory.path().join("prepared");
        let current = directory.path().join("current");
        write_zip(
            &archive,
            &[
                ("bin/ffmpeg", b"not an executable"),
                ("bin/ffprobe", b"fixture"),
                ("bin/library.dll", b"required library"),
            ],
        );
        let mut metadata = package(ToolName::Ffmpeg, "bin/ffmpeg");
        metadata
            .executables
            .insert(ToolName::Ffprobe, "bin/ffprobe".into());
        validate_mirror_package(&ToolName::Ffmpeg, &metadata).unwrap();
        prepare_mirror_installation(&archive, &prepared, &metadata).unwrap();
        assert_eq!(
            std::fs::read(prepared.join("bin/library.dll")).unwrap(),
            b"required library"
        );
        assert_eq!(
            installed_dependency(&prepared).unwrap().version,
            metadata.version
        );
        replace_mirror_installation(&prepared, &current, &directory.path().join("previous"))
            .unwrap();
        assert_eq!(
            installed_binary(&current, &ToolName::Ffmpeg),
            Some(current.join("bin/ffmpeg"))
        );
        assert_eq!(
            installed_binary(&current, &ToolName::Ffprobe),
            Some(current.join("bin/ffprobe"))
        );
        assert!(!prepared.exists());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_ne!(
                std::fs::metadata(current.join("bin/ffmpeg"))
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o111,
                0
            );
        }
    }

    #[test]
    fn incomplete_zip_does_not_replace_the_existing_installation() {
        let directory = tempfile::tempdir().unwrap();
        let current = directory.path().join("current");
        std::fs::create_dir(&current).unwrap();
        std::fs::write(current.join("deno"), b"existing program").unwrap();
        let archive = directory.path().join("fixture.zip");
        write_zip(&archive, &[("README.txt", b"missing executable")]);
        assert!(prepare_mirror_installation(
            &archive,
            &directory.path().join("prepared"),
            &package(ToolName::Deno, "deno")
        )
        .is_err());
        assert_eq!(
            std::fs::read(current.join("deno")).unwrap(),
            b"existing program"
        );
        assert!(!directory.path().join("prepared/installation.json").exists());
    }

    #[test]
    fn invalid_archives_and_external_links_cannot_write_outside_staging() {
        let directory = tempfile::tempdir().unwrap();
        let archive = directory.path().join("fixture.zip");
        std::fs::write(&archive, b"error page instead of ZIP").unwrap();
        assert!(unpack_mirror_package(&archive, &directory.path().join("corrupt")).is_err());
        for (index, path) in ["../outside", "/outside"].into_iter().enumerate() {
            write_zip(&archive, &[(path, b"fixture")]);
            assert!(unpack_mirror_package(
                &archive,
                &directory.path().join(format!("traversal-{index}"))
            )
            .is_err());
        }
        for (index, target) in ["../outside", "/outside"].into_iter().enumerate() {
            let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive).unwrap());
            zip.add_symlink("program", target, SimpleFileOptions::default())
                .unwrap();
            zip.finish().unwrap();
            assert!(unpack_mirror_package(
                &archive,
                &directory.path().join(format!("link-{index}"))
            )
            .is_err());
        }
        assert!(!directory.path().join("outside").exists());
    }

    #[test]
    fn bbdown_update_preserves_login_data_with_a_new_executable_layout() {
        let directory = tempfile::tempdir().unwrap();
        let current = directory.path().join("current");
        std::fs::create_dir_all(current.join("bin")).unwrap();
        std::fs::write(current.join("bin/BBDown.exe"), b"old program").unwrap();
        std::fs::write(current.join("bin/BBDown.data"), b"existing login data").unwrap();
        std::fs::write(
            current.join("installation.json"),
            serde_json::to_vec(&package(ToolName::Bbdown, "bin/BBDown.exe")).unwrap(),
        )
        .unwrap();
        let archive = directory.path().join("fixture.zip");
        write_zip(
            &archive,
            &[
                ("tools/BBDown.exe", b"new program"),
                ("tools/BBDown.data", b"upstream placeholder"),
            ],
        );
        let prepared = directory.path().join("prepared");
        let metadata = package(ToolName::Bbdown, "tools/BBDown.exe");
        prepare_mirror_installation(&archive, &prepared, &metadata).unwrap();
        std::fs::write(current.join("bin/BBDown.data"), b"latest login data").unwrap();
        replace_mirror_installation(&prepared, &current, &directory.path().join("previous"))
            .unwrap();
        assert_eq!(
            std::fs::read(current.join("tools/BBDown.data")).unwrap(),
            b"latest login data"
        );
        assert_eq!(
            std::fs::read(current.join("tools/BBDown.exe")).unwrap(),
            b"new program"
        );
        assert!(!current.join("bin").exists());
    }

    #[test]
    fn failed_directory_switch_restores_the_previous_installation() {
        let directory = tempfile::tempdir().unwrap();
        let current = directory.path().join("current");
        let previous = directory.path().join("previous");
        std::fs::create_dir(&current).unwrap();
        std::fs::write(current.join("program"), b"existing program").unwrap();
        assert!(replace_mirror_installation(
            &directory.path().join("missing-payload"),
            &current,
            &previous
        )
        .is_err());
        assert_eq!(
            std::fs::read(current.join("program")).unwrap(),
            b"existing program"
        );
        assert!(!previous.exists());
    }

    #[test]
    fn archive_cannot_supply_or_replace_the_local_installation_record() {
        let directory = tempfile::tempdir().unwrap();
        let archive = directory.path().join("fixture.zip");
        let prepared = directory.path().join("prepared");
        write_zip(
            &archive,
            &[
                ("deno", b"fixture program"),
                ("installation.json", b"upstream record"),
            ],
        );
        assert!(
            prepare_mirror_installation(&archive, &prepared, &package(ToolName::Deno, "deno"))
                .is_err()
        );
        assert_eq!(
            std::fs::read(prepared.join("deno")).unwrap(),
            b"fixture program"
        );
        assert_eq!(
            std::fs::read(prepared.join("installation.json")).unwrap(),
            b"upstream record"
        );
    }

    #[cfg(unix)]
    #[test]
    fn bbdown_state_symlink_is_replaced_without_overwriting_the_program() {
        let directory = tempfile::tempdir().unwrap();
        let current = directory.path().join("current");
        std::fs::create_dir(&current).unwrap();
        std::fs::write(current.join("BBDown"), b"old program").unwrap();
        std::fs::write(current.join("BBDown.data"), b"login data").unwrap();
        let metadata = package(ToolName::Bbdown, "BBDown");
        std::fs::write(
            current.join("installation.json"),
            serde_json::to_vec(&metadata).unwrap(),
        )
        .unwrap();
        let archive = directory.path().join("fixture.zip");
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive).unwrap());
        zip.start_file("BBDown", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"new program").unwrap();
        zip.add_symlink("BBDown.data", "BBDown", SimpleFileOptions::default())
            .unwrap();
        zip.finish().unwrap();
        let prepared = directory.path().join("prepared");
        prepare_mirror_installation(&archive, &prepared, &metadata).unwrap();
        replace_mirror_installation(&prepared, &current, &directory.path().join("previous"))
            .unwrap();
        assert_eq!(
            std::fs::read(current.join("BBDown")).unwrap(),
            b"new program"
        );
        assert_eq!(
            std::fs::read(current.join("BBDown.data")).unwrap(),
            b"login data"
        );
        assert!(!std::fs::symlink_metadata(current.join("BBDown.data"))
            .unwrap()
            .is_symlink());
    }

    #[tokio::test]
    async fn download_verifies_content_and_reports_progress_before_installation() {
        let directory = tempfile::tempdir().unwrap();
        let upstream = directory.path().join("upstream.zip");
        write_zip(&upstream, &[("bin/deno", b"fixture program")]);
        let body = std::fs::read(upstream).unwrap();
        let expected = format!("{:x}", Sha256::digest(&body)).to_uppercase();
        let (url, server) = response(&body, "200 OK", body.len());
        let client = reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();
        let download = directory.path().join("download.zip");
        let mut progress = Vec::new();
        download_mirror_package(&client, url, &download, &expected, |received, total| {
            progress.push((received, total))
        })
        .await
        .unwrap();
        server.join().unwrap();
        assert_eq!(std::fs::read(&download).unwrap(), body);
        assert_eq!(progress.first(), Some(&(0, Some(body.len() as u64))));
        assert_eq!(
            progress.last(),
            Some(&(body.len() as u64, Some(body.len() as u64)))
        );
        let current = directory.path().join("current");
        let prepared = directory.path().join("prepared");
        let mut metadata = package(ToolName::Deno, "bin/deno");
        metadata.sha256 = expected.to_ascii_lowercase();
        prepare_mirror_installation(&download, &prepared, &metadata).unwrap();
        replace_mirror_installation(&prepared, &current, &directory.path().join("previous"))
            .unwrap();
        assert_eq!(
            std::fs::read(current.join("bin/deno")).unwrap(),
            b"fixture program"
        );
        assert_eq!(
            installed_dependency(&current).unwrap().sha256,
            metadata.sha256
        );
    }

    #[tokio::test]
    async fn checksum_mismatch_keeps_the_installed_tool_unchanged() {
        let directory = tempfile::tempdir().unwrap();
        let current = directory.path().join("current");
        std::fs::create_dir(&current).unwrap();
        std::fs::write(current.join("deno"), b"existing program").unwrap();
        let body = b"changed content";
        let (url, server) = response(body, "200 OK", body.len());
        let client = reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();
        let mut progress = Vec::new();
        assert!(download_mirror_package(
            &client,
            url,
            &directory.path().join("download.zip"),
            &"0".repeat(64),
            |received, total| progress.push((received, total))
        )
        .await
        .is_err());
        server.join().unwrap();
        assert_eq!(
            std::fs::read(current.join("deno")).unwrap(),
            b"existing program"
        );
        assert_eq!(progress.len(), 1);
    }

    #[tokio::test]
    async fn http_errors_and_truncated_downloads_do_not_report_completion() {
        let directory = tempfile::tempdir().unwrap();
        let body = b"fixture";
        let expected = format!("{:x}", Sha256::digest(body));
        let client = reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();
        for (index, status, length) in [
            (0, "404 Not Found", body.len()),
            (1, "200 OK", body.len() + 1),
        ] {
            let (url, server) = response(body, status, length);
            let mut progress = Vec::new();
            let path = directory.path().join(format!("download-{index}.zip"));
            assert!(
                download_mirror_package(&client, url, &path, &expected, |received, total| progress
                    .push((received, total)))
                .await
                .is_err()
            );
            server.join().unwrap();
            if index == 0 {
                assert!(!path.exists());
                assert!(progress.is_empty());
            } else {
                assert_eq!(progress.len(), 1);
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn internal_symlinks_are_supported_and_chained_escapes_are_rejected() {
        let directory = tempfile::tempdir().unwrap();
        let archive = directory.path().join("fixture.zip");
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive).unwrap());
        zip.start_file("bin/deno", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"fixture program").unwrap();
        zip.add_symlink("deno", "bin/deno", SimpleFileOptions::default())
            .unwrap();
        zip.finish().unwrap();
        let prepared = directory.path().join("prepared");
        prepare_mirror_installation(&archive, &prepared, &package(ToolName::Deno, "deno")).unwrap();
        assert_eq!(
            std::fs::read(prepared.join("deno")).unwrap(),
            b"fixture program"
        );
        assert!(std::fs::symlink_metadata(prepared.join("deno"))
            .unwrap()
            .is_symlink());
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive).unwrap());
        zip.add_symlink("alias", ".", SimpleFileOptions::default())
            .unwrap();
        zip.add_symlink("alias/escape", "../outside", SimpleFileOptions::default())
            .unwrap();
        zip.start_file("alias/escape/program", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"fixture").unwrap();
        zip.finish().unwrap();
        assert!(unpack_mirror_package(&archive, &directory.path().join("chain")).is_err());
        assert!(!directory.path().join("outside").exists());
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use std::os::windows::ffi::OsStringExt;

    use super::*;

    #[test]
    fn managed_installation_resolves_recorded_paths_and_shared_ffmpeg_package() {
        let directory = env::temp_dir().join(format!("mad-managed-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(directory.join("bin")).unwrap();
        let ffmpeg = PathBuf::from("bin").join("ffmpeg.exe");
        let ffprobe = PathBuf::from("bin").join("ffprobe.exe");
        std::fs::write(directory.join(&ffmpeg), b"fixture").unwrap();
        std::fs::write(directory.join(&ffprobe), b"fixture").unwrap();
        let installation = ManagedDependency {
            version: "fixture-version".into(),
            file_name: "fixture.zip".into(),
            sha256: "fixture-hash".into(),
            executables: BTreeMap::from([
                (ToolName::Ffmpeg, ffmpeg.clone()),
                (ToolName::Ffprobe, ffprobe.clone()),
            ]),
        };
        std::fs::write(
            directory.join("installation.json"),
            serde_json::to_vec(&installation).unwrap(),
        )
        .unwrap();
        assert_eq!(
            installed_binary(&directory, &ToolName::Ffmpeg),
            Some(directory.join(ffmpeg))
        );
        assert_eq!(
            installed_binary(&directory, &ToolName::Ffprobe),
            Some(directory.join(ffprobe))
        );
        assert_eq!(
            ToolName::Ffprobe.package_name(),
            ToolName::Ffmpeg.package_name()
        );
        assert!(ToolName::Musicdl.package_name().is_none());
        assert!(ToolName::Python.package_name().is_none());
        assert!(installed_binary(&directory, &ToolName::Bbdown).is_none());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn managed_installation_rejects_paths_outside_its_directory() {
        let directory = env::temp_dir().join(format!("mad-managed-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(directory.join("package")).unwrap();
        let outside = directory.join("outside.exe");
        std::fs::write(&outside, b"fixture").unwrap();
        for path in [PathBuf::from("../outside.exe"), outside] {
            let installation = ManagedDependency {
                version: "fixture-version".into(),
                file_name: "fixture.zip".into(),
                sha256: "fixture-hash".into(),
                executables: BTreeMap::from([(ToolName::Deno, path)]),
            };
            std::fs::write(
                directory.join("package").join("installation.json"),
                serde_json::to_vec(&installation).unwrap(),
            )
            .unwrap();
            assert!(installed_binary(&directory.join("package"), &ToolName::Deno).is_none());
        }
        std::fs::remove_dir_all(directory).unwrap();
    }

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
