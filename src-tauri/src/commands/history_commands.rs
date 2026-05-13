use crate::models::{ProviderConfig, RenameHistory};

#[tauri::command]
pub fn load_rename_history(app_handle: tauri::AppHandle) -> Vec<RenameHistory> {
    crate::history::store::load_history(&app_handle)
}

#[tauri::command]
pub fn load_providers() -> ProviderConfig {
    crate::providers::load_providers()
}

#[tauri::command]
pub fn save_providers(config: ProviderConfig) -> Result<(), String> {
    crate::providers::save_providers(&config)
}

#[tauri::command]
pub fn get_providers_path() -> String {
    crate::providers::get_providers_path()
}
