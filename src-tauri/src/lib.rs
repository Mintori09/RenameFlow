pub mod ai;
pub mod commands;
pub mod domain;
pub mod filesystem;
pub mod history;
pub mod models;
pub mod providers;
pub mod recent;
use commands::{CliState, ResolvedPath};
use filesystem::watcher::WatcherState;
use gtk::prelude::GtkWindowExt;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub struct CancellationState(pub Arc<AtomicBool>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(WatcherState::default());
            app.manage(CancellationState(Arc::new(AtomicBool::new(false))));

            let initial_path = std::env::args().nth(1).and_then(|raw| {
                let path = Path::new(&raw);
                std::fs::canonicalize(path).ok().and_then(|canonical| {
                    let name = canonical.file_name()?.to_string_lossy().to_string();
                    let is_dir = std::fs::metadata(&canonical).ok()?.is_dir();
                    Some(ResolvedPath {
                        path: canonical.to_string_lossy().to_string(),
                        name,
                        is_dir,
                    })
                })
            });
            app.manage(CliState(Mutex::new(initial_path)));

            #[cfg(any(
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            ))]
            {
                let window = app
                    .get_webview_window("main")
                    .ok_or("'main' WebviewWindow not found")?;

                let gtk_window = window.gtk_window()?;
                gtk_window.set_titlebar(Option::<&gtk::Widget>::None);
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_initial_path,
            commands::generate_rename_suggestions,
            commands::rename_files,
            commands::undo_last_rename,
            commands::undo_history_entry,
            commands::get_available_models,
            commands::load_rename_history,
            commands::list_directory,
            commands::collect_files,
            commands::start_watching,
            commands::stop_watching,
            commands::load_providers,
            commands::save_providers,
            commands::get_providers_path,
            commands::set_provider_api_key,
            commands::get_ollama_models,
            commands::add_recent_folder,
            commands::load_recent_folders,
            commands::remove_recent_folder,
            commands::load_workspace_profiles,
            commands::save_workspace_profile,
            commands::delete_workspace_profile,
            commands::cancel_generation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
