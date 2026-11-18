//! aria2 的 tauri command 薄壳。下载经 core/task（一次性任务语义）；
//! tracker 列表查询走独立命令（带缓存与回退链，见 trackers.rs）。

use std::{io::Read, sync::Arc};

use tauri::{AppHandle, State};

use super::adapter::{self, Aria2Ctx};
use super::trackers::{self, TrackerListResult};
use super::types::Aria2Intent;
use crate::core::adapter::{preview_result, PreviewResult, SubmitResult};
use crate::core::deps::{execution_path, resolve_tool, ToolName};
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};

fn torrent_private(bytes: &[u8]) -> Result<bool, bendy::decoding::Error> {
    use bendy::decoding::{Decoder, Error};

    let mut decoder = Decoder::new(bytes).with_max_depth(64);
    let mut root = decoder
        .next_object()?
        .ok_or_else(|| Error::missing_field("info"))?
        .try_into_dictionary()?;
    let mut private = None;
    while let Some((key, value)) = root.next_pair()? {
        if key == b"info" {
            let mut info = value.try_into_dictionary()?;
            private = Some(false);
            while let Some((key, value)) = info.next_pair()? {
                if key == b"private" {
                    private = Some(match value.try_into_integer()? {
                        "0" => false,
                        "1" => true,
                        other => return Err(Error::unexpected_token("0 or 1", other)),
                    });
                }
            }
        }
    }
    drop(root);
    if decoder.next_object()?.is_some() {
        return Err(Error::unexpected_token("end of torrent", "trailing data"));
    }
    private.ok_or_else(|| Error::missing_field("info"))
}

fn read_public_torrent(path: &std::path::Path) -> Result<Vec<u8>, String> {
    const MAX_TORRENT_BYTES: u64 = 64 * 1024 * 1024;
    let invalid = || rust_i18n::t!("backend.aria2.commands.invalid_torrent").to_string();
    let file = std::fs::File::open(path).map_err(|_| invalid())?;
    if !file.metadata().map_err(|_| invalid())?.is_file() {
        return Err(invalid());
    }
    let mut bytes = Vec::new();
    file.take(MAX_TORRENT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| invalid())?;
    if bytes.len() as u64 > MAX_TORRENT_BYTES {
        return Err(invalid());
    }
    if torrent_private(&bytes).map_err(|_| invalid())? {
        return Err(adapter::AdapterError::PrivateTorrentRejected.to_string());
    }
    Ok(bytes)
}

async fn prepare_torrent(
    proxy: Option<&str>,
    tool_path: &std::path::Path,
    form: &Aria2Intent,
    argv: &mut [String],
    log: Arc<dyn Fn(String) + Send + Sync>,
) -> Result<Option<tempfile::TempDir>, String> {
    let magnet = form.torrent_file.trim().is_empty()
        && form.uri.trim().to_ascii_lowercase().starts_with("magnet:");
    if !magnet && form.torrent_file.trim().is_empty() {
        return Ok(None);
    }
    // build_argv 契约：argv 以 `-- <source>` 结尾
    let source_index = argv
        .len()
        .checked_sub(1)
        .filter(|&index| index > 0 && argv[index - 1] == "--")
        .ok_or_else(|| "aria2 argv must end with `-- <source>`".to_string())?;
    let directory = tempfile::tempdir().map_err(|e| e.to_string())?;
    let source = if magnet {
        let mut metadata_argv = argv[..source_index - 1].to_vec();
        metadata_argv.extend([
            "--bt-metadata-only=true".into(),
            "--bt-save-metadata=true".into(),
            "--dir".into(),
            directory.path().to_string_lossy().into_owned(),
            "--".into(),
            form.uri.trim().into(),
        ]);
        let mut child = crate::core::process::spawn_tree(
            tool_path,
            &metadata_argv,
            Some(directory.path()),
            None,
            proxy,
        )
        .map_err(|e| e.to_string())?;
        let stdout = child.take_stdout();
        let stderr = child.take_stderr();
        let failure = || rust_i18n::t!("backend.aria2.commands.metadata_failed").to_string();
        let result = tokio::time::timeout(std::time::Duration::from_secs(120), async {
            let (status, _, _) = tokio::join!(
                child.wait(),
                async {
                    if let Some(out) = stdout {
                        crate::core::process::stream_lines(out, |line| log(line)).await;
                    }
                },
                async {
                    if let Some(err) = stderr {
                        crate::core::process::stream_lines(err, |line| log(line)).await;
                    }
                },
            );
            status
        })
        .await;
        let status = match result {
            Ok(status) => status.map_err(|e| e.to_string())?,
            Err(_) => {
                child.killer().kill_tree();
                let _ = child.wait().await;
                return Err(failure());
            }
        };
        if !status.success() {
            return Err(failure());
        }
        std::fs::read_dir(directory.path())
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .find(|p| p.extension().is_some_and(|e| e == "torrent"))
            .ok_or_else(failure)?
    } else {
        std::path::PathBuf::from(form.torrent_file.trim())
    };
    let bytes = read_public_torrent(&source)?;
    let snapshot = directory.path().join("validated.torrent");
    std::fs::write(&snapshot, bytes).map_err(|e| e.to_string())?;
    // 执行已校验的快照，防止排队期间原种子被替换；intent 保留用户原始输入供复用。
    argv[source_index] = snapshot.to_string_lossy().into_owned();
    Ok(Some(directory))
}

#[tauri::command]
pub fn aria2_preview(app: AppHandle, intent: TaskIntent) -> Result<PreviewResult, String> {
    // 预览只读本地缓存，不发起网络请求——所见 tracker 可能与提交时新鲜拉取的不同
    let ctx = Aria2Ctx {
        trackers: trackers::cached_trackers(&app),
        private_torrent: None,
    };
    let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

#[tauri::command]
pub async fn aria2_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    intent: TaskIntent,
) -> Result<SubmitResult, String> {
    let plan = adapter::plan(&intent, &Aria2Ctx::default()).map_err(|e| e.to_string())?;
    let (tool_path, _) = resolve_tool(&app, &ToolName::Aria2)
        .ok_or_else(|| rust_i18n::t!("backend.aria2.commands.aria2_not_found").to_string())?;
    let TaskIntent::Form(data) = &intent else {
        return Err(adapter::AdapterError::ManualUnsupported.to_string());
    };
    let form: Aria2Intent = serde_json::from_value(data.clone()).map_err(|e| e.to_string())?;
    let prepare_tool = tool_path.clone();
    let prepare_intent = intent.clone();
    let prepare_app = app.clone();
    let prepare: crate::core::task::Preparation = Box::new(move |log| {
        Box::pin(async move {
            let mut ctx = Aria2Ctx::default();
            if adapter::needs_trackers(&prepare_intent, &ctx) {
                ctx.trackers = trackers::for_submit(&prepare_app).await;
            }
            let mut plan = adapter::plan(&prepare_intent, &ctx).map_err(|e| e.to_string())?;
            let directory = prepare_torrent(
                crate::core::settings::load_app_settings(&prepare_app)
                    .proxy
                    .as_deref(),
                &prepare_tool,
                &form,
                &mut plan.argv,
                log,
            )
            .await?;
            Ok((plan.argv, plan.argv_redacted, directory))
        })
    });
    let cwd = match plan.cwd {
        CwdPolicy::Inherit => None,
        CwdPolicy::ExeDir => tool_path.parent().map(|p| p.to_path_buf()),
        CwdPolicy::Explicit(dir) => Some(std::path::PathBuf::from(dir)),
    };
    // 进度行解析出百分比时发进度信号驱动任务卡进度条
    let parser =
        Some(Arc::new(|line: &str| adapter::parse_progress(line).into_iter().collect()) as _);

    let spec = TaskSpec {
        feature: Feature::Aria2,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None,
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        output_paths: plan.output_paths,
        env_path: Some(execution_path(&app)),
        intent: adapter::sanitize_intent(&intent),
        parser,
        prepare: Some(prepare),
        cleanup_dir: None,
    };
    Ok(SubmitResult {
        task_id: hub.submit(spec),
    })
}

#[tauri::command]
pub async fn aria2_tracker_list(
    app: AppHandle,
    refresh: bool,
) -> Result<TrackerListResult, String> {
    trackers::tracker_list(&app, refresh).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn execution_uses_validated_snapshot_and_rejects_private_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("source.torrent");
        let public = b"d4:infodee";
        std::fs::write(&path, public).unwrap();
        let form = Aria2Intent {
            torrent_file: path.to_string_lossy().into_owned(),
            ..Default::default()
        };
        let mut argv = vec!["--".into(), form.torrent_file.clone()];
        let snapshot = prepare_torrent(
            None,
            std::path::Path::new("unused"),
            &form,
            &mut argv,
            Arc::new(|_| {}),
        )
        .await
        .unwrap()
        .unwrap();
        std::fs::write(&path, b"d4:infod7:privatei1eee").unwrap();
        assert_eq!(std::fs::read(argv.last().unwrap()).unwrap(), public);
        assert!(std::path::Path::new(argv.last().unwrap()).starts_with(snapshot.path()));
        assert!(prepare_torrent(
            None,
            std::path::Path::new("unused"),
            &form,
            &mut argv,
            Arc::new(|_| {})
        )
        .await
        .is_err());
    }

    #[test]
    fn public_torrent_validation_rejects_private_and_malformed_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.torrent");
        std::fs::write(&path, b"d4:infod7:privatei1eee").unwrap();
        assert_eq!(
            read_public_torrent(&path).unwrap_err(),
            adapter::AdapterError::PrivateTorrentRejected.to_string()
        );
        std::fs::write(&path, b"d4:infodee").unwrap();
        assert_eq!(read_public_torrent(&path).unwrap(), b"d4:infodee");
        std::fs::write(&path, b"invalid").unwrap();
        assert!(read_public_torrent(&path).is_err());
    }

    #[test]
    fn privacy_is_read_only_from_the_info_dictionary() {
        assert!(torrent_private(b"d4:infod7:privatei1eee").unwrap());
        assert!(!torrent_private(b"d4:infod7:privatei0eee").unwrap());
        assert!(!torrent_private(b"d4:infode7:privatei1ee").unwrap());
        assert!(!torrent_private(b"d7:comment12:7:privatei1e4:infodee").unwrap());
    }

    #[test]
    fn ambiguous_or_incomplete_metadata_is_rejected() {
        for bytes in [
            b"de".as_slice(),
            b"d4:infoi1ee",
            b"d4:infod7:private1:1ee",
            b"d4:infod7:privatei2eee",
            b"d4:infod7:privatei0e7:privatei1eee",
            b"d4:infod7:privatei1ee",
            b"d4:infodeeextra",
        ] {
            assert!(torrent_private(bytes).is_err(), "{bytes:?}");
        }
    }
}
