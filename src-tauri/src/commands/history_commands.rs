use crate::models::{ProviderConfig, ProviderConfigResponse, RenameHistory};

#[tauri::command]
pub fn load_rename_history(app_handle: tauri::AppHandle) -> Vec<RenameHistory> {
    crate::history::store::load_history(&app_handle)
}

#[tauri::command]
pub fn undo_history_entry(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<crate::models::UndoResult, String> {
    crate::history::undo::undo_by_id(&app_handle, &id)
}

#[tauri::command]
pub fn load_providers() -> ProviderConfigResponse {
    crate::providers::load_providers_for_frontend()
}

#[tauri::command]
pub fn save_providers(config: ProviderConfig) -> Result<(), String> {
    crate::providers::save_providers(&config)
}

#[tauri::command]
pub fn get_providers_path() -> String {
    crate::providers::get_providers_path()
}

#[tauri::command]
pub fn set_provider_api_key(provider_name: String, api_key: String) -> Result<(), String> {
    crate::providers::set_provider_key(&provider_name, &api_key)
}
