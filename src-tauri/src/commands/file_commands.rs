use crate::filesystem::watcher::WatcherState;
use crate::models::DirEntry;
use std::path::PathBuf;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn start_watching(
    app: AppHandle,
    state: State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    crate::filesystem::watcher::start_watching(&app, &state, path_buf)
}

#[tauri::command]
pub fn stop_watching(state: State<'_, WatcherState>) -> Result<(), String> {
    crate::filesystem::watcher::stop_watching(&state);
    Ok(())
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let entries =
        std::fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        result.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(result)
}

#[tauri::command]
pub fn collect_files(path: String, max_depth: Option<usize>) -> Result<Vec<DirEntry>, String> {
    collect_files_recursive(&path, max_depth.unwrap_or(10), 0)
}

fn collect_files_recursive(
    path: &str,
    max_depth: usize,
    current_depth: usize,
) -> Result<Vec<DirEntry>, String> {
    if current_depth >= max_depth {
        return Ok(Vec::new());
    }
    let entries =
        std::fs::read_dir(path).map_err(|e| format!("Failed to read directory {}: {}", path, e))?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let path_str = entry.path().to_string_lossy().to_string();
        let is_dir = metadata.is_dir();
        result.push(DirEntry {
            name,
            path: path_str.clone(),
            is_dir,
            size: metadata.len(),
        });
        if is_dir {
            let sub_entries = collect_files_recursive(&path_str, max_depth, current_depth + 1)?;
            result.extend(sub_entries);
        }
    }
    Ok(result)
}
