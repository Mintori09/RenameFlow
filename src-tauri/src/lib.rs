mod ai;
mod commands;
mod history;
mod models;
mod providers;
mod rename;
mod sanitize;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::generate_rename_suggestions,
            commands::rename_files,
            commands::undo_last_rename,
            commands::get_available_models,
            commands::load_rename_history,
            commands::list_directory,
            commands::load_providers,
            commands::save_providers,
            commands::get_providers_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
