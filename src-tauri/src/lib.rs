pub mod ai;
pub mod commands;
pub mod domain;
pub mod filesystem;
pub mod history;
pub mod models;
pub mod providers;
use gtk::prelude::GtkWindowExt;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
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
            commands::generate_rename_suggestions,
            commands::rename_files,
            commands::undo_last_rename,
            commands::get_available_models,
            commands::load_rename_history,
            commands::list_directory,
            commands::collect_files,
            commands::load_providers,
            commands::save_providers,
            commands::get_providers_path,
            commands::get_ollama_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

