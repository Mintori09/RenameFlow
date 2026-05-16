use crate::models::{RecentFolder, WorkspaceProfile};

#[tauri::command]
pub fn add_recent_folder(path: String) -> Result<(), String> {
    crate::recent::add_recent_folder(&path)
}

#[tauri::command]
pub fn load_recent_folders() -> Vec<RecentFolder> {
    crate::recent::load_recent_folders()
}

#[tauri::command]
pub fn remove_recent_folder(path: String) -> Result<(), String> {
    crate::recent::remove_recent_folder(&path)
}

#[tauri::command]
pub fn load_workspace_profiles() -> Vec<WorkspaceProfile> {
    crate::recent::load_profiles()
}

#[tauri::command]
pub fn save_workspace_profile(profile: WorkspaceProfile) -> Result<(), String> {
    crate::recent::save_profile(&profile)
}

#[tauri::command]
pub fn delete_workspace_profile(name: String) -> Result<(), String> {
    crate::recent::delete_profile(&name)
}
