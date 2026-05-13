use crate::models::{Provider, ProviderConfig};
use tauri::Manager;

fn get_providers_file_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    path.push("providers.json");
    path
}

pub fn load_providers(app_handle: &tauri::AppHandle) -> ProviderConfig {
    let path = get_providers_file_path(app_handle);
    if !path.exists() {
        let default = ProviderConfig {
            active_provider: "default".to_string(),
            providers: vec![Provider {
                name: "default".to_string(),
                provider_type: "openai-compatible".to_string(),
                base_url: "http://localhost:11434".to_string(),
                api_key: String::new(),
                model: String::new(),
            }],
        };
        let _ = save_providers_inner(app_handle, &default);
        return default;
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_else(|_| ProviderConfig {
        active_provider: "default".to_string(),
        providers: vec![],
    })
}

fn save_providers_inner(
    app_handle: &tauri::AppHandle,
    config: &ProviderConfig,
) -> Result<(), String> {
    let path = get_providers_file_path(app_handle);
    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("Serialize error: {}", e))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    std::fs::write(&path, content).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

pub fn save_providers(
    app_handle: &tauri::AppHandle,
    config: &ProviderConfig,
) -> Result<(), String> {
    save_providers_inner(app_handle, config)
}

pub fn get_providers_path(app_handle: &tauri::AppHandle) -> String {
    get_providers_file_path(app_handle)
        .to_string_lossy()
        .to_string()
}
