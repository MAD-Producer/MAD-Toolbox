use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::core::settings::app_data_dir;

pub(crate) fn adapter_path(app: &AppHandle) -> Result<PathBuf, String> {
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
        .ok_or_else(|| rust_i18n::t!("backend.music.adapterNotFound").to_string())
}

pub(crate) fn sessions_dir(app: &AppHandle) -> Result<PathBuf, String> {
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
