use crate::models::{RenameHistory, UndoResult};
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

pub fn save_history(
    app_handle: &tauri::AppHandle,
    history: &[RenameHistory],
) -> Result<(), String> {
    let dir = get_history_dir(app_handle);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create history dir: {}", e))?;
    let path = get_history_path(app_handle);
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write history: {}", e))?;
    Ok(())
}

pub fn add_entry(app_handle: &tauri::AppHandle, entry: RenameHistory) -> Result<(), String> {
    let mut history = load_history(app_handle);
    history.insert(0, entry);
    save_history(app_handle, &history)
}

pub fn undo_last(app_handle: &tauri::AppHandle) -> Result<UndoResult, String> {
    let mut history = load_history(app_handle);
    if history.is_empty() {
        return Err("No rename history to undo.".to_string());
    }

    let last = history.remove(0);
    let mut restored = 0usize;
    let mut failed = 0usize;

    for op in &last.operations {
        let from = std::path::Path::new(&op.to_path);
        let to = std::path::Path::new(&op.from_path);
        if from.exists() {
            match std::fs::rename(from, to) {
                Ok(_) => restored += 1,
                Err(_) => failed += 1,
            }
        } else {
            failed += 1;
        }
    }

    save_history(app_handle, &history)?;

    Ok(UndoResult { restored, failed })
}
