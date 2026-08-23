//! musicdl 搜索进程与临时目录的会话所有权。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use tauri::AppHandle;
use uuid::Uuid;

use super::runtime;
use crate::core::process::TreeKiller;

#[derive(Clone)]
struct SearchProcess {
    killer: TreeKiller,
    canceled: Arc<AtomicBool>,
}

/// 活跃搜索不进入 TaskHub，但仍需具备按 job id 取消整个进程树的能力。
#[derive(Clone, Default)]
pub(crate) struct MusicSearchRegistry {
    processes: Arc<Mutex<HashMap<String, SearchProcess>>>,
}

impl MusicSearchRegistry {
    pub(crate) fn register(&self, job_id: String, killer: TreeKiller) -> Arc<AtomicBool> {
        let canceled = Arc::new(AtomicBool::new(false));
        let process = SearchProcess {
            killer,
            canceled: canceled.clone(),
        };
        let mut processes = self
            .processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let previous = processes.insert(job_id, process);
        debug_assert!(previous.is_none(), "musicdl search job id must be unique");
        canceled
    }

    pub(crate) fn cancel(&self, job_id: &str) -> bool {
        let killer = {
            let processes = self
                .processes
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let Some(process) = processes.get(job_id) else {
                return false;
            };
            process.canceled.store(true, Ordering::Release);
            process.killer.clone()
        };
        killer.kill_tree();
        true
    }

    pub(crate) fn finish(&self, job_id: &str) -> bool {
        self.processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(job_id)
            .is_some_and(|process| process.canceled.load(Ordering::Acquire))
    }

    pub(crate) fn is_active(&self, job_id: &str) -> bool {
        self.processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .contains_key(job_id)
    }
}

/// command 准备阶段的目录守卫；只有把目录所有权交给搜索会话或 TaskHub 后才解除。
pub(crate) struct PreparedSessionDir {
    path: Option<PathBuf>,
}

impl PreparedSessionDir {
    pub(crate) fn search(app: &AppHandle, session_id: &str) -> Result<Self, String> {
        let session_id = canonical_session_id(session_id)?;
        Self::create(runtime::sessions_dir(app)?.join(session_id))
    }

    pub(crate) fn task(app: &AppHandle) -> Result<Self, String> {
        Self::create(runtime::sessions_dir(app)?.join(format!("task-{}", Uuid::new_v4())))
    }

    fn create(path: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))
                .map_err(|error| error.to_string())?;
        }
        Ok(Self { path: Some(path) })
    }

    pub(crate) fn path(&self) -> &Path {
        self.path
            .as_deref()
            .expect("prepared session path is owned")
    }

    pub(crate) fn into_path(mut self) -> PathBuf {
        self.path.take().expect("prepared session path is owned")
    }
}

impl Drop for PreparedSessionDir {
    fn drop(&mut self) {
        if let Some(path) = self.path.take() {
            let _ = remove_owned_path(&path);
        }
    }
}

pub(crate) fn canonical_session_id(session_id: &str) -> Result<String, String> {
    Uuid::parse_str(session_id)
        .map(|value| value.to_string())
        .map_err(|_| rust_i18n::t!("backend.music.invalidSession").to_string())
}

pub(crate) fn search_session_path(app: &AppHandle, session_id: &str) -> Result<PathBuf, String> {
    Ok(runtime::sessions_dir(app)?.join(canonical_session_id(session_id)?))
}

pub(crate) fn release_search_session(app: &AppHandle, session_id: &str) -> Result<(), String> {
    remove_owned_path(&search_session_path(app, session_id)?).map_err(|error| error.to_string())
}

/// TaskHub 不恢复上次进程；启动时可安全清除上次异常退出遗留的搜索与任务目录。
pub(crate) fn cleanup_orphaned_sessions(app: &AppHandle) -> Result<(), String> {
    let root = runtime::sessions_dir(app)?;
    for entry in std::fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let owned = Uuid::parse_str(&name).is_ok()
            || name
                .strip_prefix("task-")
                .is_some_and(|value| Uuid::parse_str(value).is_ok());
        if owned {
            remove_owned_path(&entry.path()).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn remove_owned_path(path: &Path) -> std::io::Result<()> {
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };
    if metadata.file_type().is_symlink() || metadata.is_file() {
        std::fs::remove_file(path)
    } else {
        std::fs::remove_dir_all(path)
    }
}
