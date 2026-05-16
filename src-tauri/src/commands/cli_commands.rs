use serde::Serialize;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPath {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

pub struct CliState(pub Mutex<Option<ResolvedPath>>);

#[tauri::command]
pub fn get_initial_path(state: tauri::State<'_, CliState>) -> Option<ResolvedPath> {
    state.0.lock().ok()?.clone()
}
