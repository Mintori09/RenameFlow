mod ai;
mod commands;
mod history;
mod models;
mod rename;
mod sanitize;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::generate_rename_suggestions,
            commands::rename_files,
            commands::undo_last_rename,
            commands::get_available_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
