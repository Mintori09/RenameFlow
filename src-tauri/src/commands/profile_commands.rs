use crate::models::RecentFolder;

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
