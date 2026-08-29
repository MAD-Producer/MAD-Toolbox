mod core;
mod features;

rust_i18n::i18n!("locales", fallback = "en");

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = core::settings::app_data_dir(&handle).map_err(std::io::Error::other)?;
            core::language::apply_language(core::settings::load_app_settings(&handle).language);
            let _ = core::settings::unified_output_directory(&handle);
            let _ = features::music::sessions::cleanup_orphaned_sessions(&handle);
            let store = core::task::store::TaskStore::open(&data_dir.join("tasks.db"))?;
            let _ = core::task::logfile::cleanup_expired(
                &store,
                chrono::Utc::now(),
                core::task::logfile::default_retention(),
            );
            let caps = core::task::scheduler::PoolCaps {
                download: 3,
                local: std::thread::available_parallelism()
                    .map(|n| n.get())
                    .unwrap_or(4),
            };
            let sink = std::sync::Arc::new(core::task::sink::TauriSink::new(handle.clone()));
            let logs_dir = data_dir.join("logs");
            let hub = tauri::async_runtime::block_on(async move {
                core::task::TaskHub::new(store, sink, caps, logs_dir, handle)
            });
            app.manage(hub);
            app.manage(caps);
            app.manage(features::music::sessions::MusicSearchRegistry::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core::settings::app_settings,
            core::settings::save_app_settings,
            core::settings::set_language,
            core::update::check_for_update,
            core::update::install_update,
            core::deps::dependency_status,
            core::deps::dependency_install,
            core::task::commands::task_export_diagnostics,
            core::deps::ffmpeg_encoders,
            features::music::commands::musicdl_preview,
            features::music::commands::musicdl_search,
            features::music::commands::musicdl_search_cancel,
            features::music::commands::musicdl_session_release,
            features::music::commands::musicdl_download,
            features::music::commands::musicdl_playlist,
            features::media::query::inspect_media,
            core::task::commands::task_cancel,
            core::task::commands::task_promote,
            core::task::commands::task_delete,
            core::task::commands::tasks_snapshot,
            core::task::commands::pool_definitions,
            features::bilibili::commands::bilibili_submit,
            features::bilibili::commands::bilibili_preview,
            features::bilibili::commands::bilibili_login_start,
            features::bilibili::commands::bilibili_login_status,
            features::network::commands::network_submit,
            features::network::commands::network_preview,
            features::network::commands::network_probe,
            features::media::commands::media_submit,
            features::media::commands::media_preview,
            features::media::commands::media_pr_submit,
            features::media::commands::media_scan_inputs
        ])
        .run(tauri::generate_context!())
        .expect("error while running MAD Toolbox");
}
