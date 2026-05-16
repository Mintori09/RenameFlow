use crate::models::RenameHistory;
use std::path::PathBuf;

fn get_history_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = tauri::Manager::path(app_handle)
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    app_dir.join("history.json")
}

fn get_history_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = tauri::Manager::path(app_handle)
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    app_dir
}

pub fn load_history(app_handle: &tauri::AppHandle) -> Vec<RenameHistory> {
    let path = get_history_path(app_handle);
    if !path.exists() {
        return Vec::new();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_else(|_| "[]".to_string());
    serde_json::from_str(&content).unwrap_or_default()
}

const MAX_HISTORY_ENTRIES: usize = 100;

pub fn save_history(
    app_handle: &tauri::AppHandle,
    history: &[RenameHistory],
) -> Result<(), String> {
    let dir = get_history_dir(app_handle);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create history dir: {}", e))?;
    let path = get_history_path(app_handle);
    let capped: Vec<_> = history.iter().take(MAX_HISTORY_ENTRIES).cloned().collect();
    let content = serde_json::to_string_pretty(&capped)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, &content).map_err(|e| format!("Failed to write history: {}", e))?;
    std::fs::rename(&tmp_path, &path).map_err(|e| format!("Failed to finalize history: {}", e))?;

    Ok(())
}

pub fn add_entry(app_handle: &tauri::AppHandle, entry: RenameHistory) -> Result<(), String> {
    let mut history = load_history(app_handle);
    history.insert(0, entry);
    save_history(app_handle, &history)
}
