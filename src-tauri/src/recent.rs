use crate::models::{RecentFolder, WorkspaceProfile};

fn get_recent_dir() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("renameflow")
}

fn get_recent_file_path() -> std::path::PathBuf {
    get_recent_dir().join("recent_folders.json")
}

fn get_profiles_file_path() -> std::path::PathBuf {
    get_recent_dir().join("workspace_profiles.json")
}

fn save_json<T: serde::Serialize>(path: &std::path::Path, data: &T) -> Result<(), String> {
    let content =
        serde_json::to_string_pretty(data).map_err(|e| format!("Serialize error: {}", e))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    std::fs::write(path, content).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

fn load_json<T: serde::de::DeserializeOwned>(path: &std::path::Path) -> Option<T> {
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn load_recent_folders() -> Vec<RecentFolder> {
    load_json(&get_recent_file_path()).unwrap_or_default()
}

pub fn add_recent_folder(path: &str) -> Result<(), String> {
    let mut folders = load_recent_folders();
    let label = std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());
    let now = chrono::Utc::now().to_rfc3339();

    folders.retain(|f| f.path != path);
    folders.push(RecentFolder {
        path: path.to_string(),
        last_opened: now,
        label,
    });

    folders.sort_by(|a, b| b.last_opened.cmp(&a.last_opened));

    const MAX_RECENT: usize = 10;
    folders.truncate(MAX_RECENT);

    save_json(&get_recent_file_path(), &folders)
}

pub fn remove_recent_folder(path: &str) -> Result<(), String> {
    let mut folders = load_recent_folders();
    folders.retain(|f| f.path != path);
    save_json(&get_recent_file_path(), &folders)
}

pub fn load_profiles() -> Vec<WorkspaceProfile> {
    load_json(&get_profiles_file_path()).unwrap_or_default()
}

pub fn save_profile(profile: &WorkspaceProfile) -> Result<(), String> {
    let mut profiles = load_profiles();
    profiles.retain(|p| p.name != profile.name);
    profiles.push(profile.clone());
    save_json(&get_profiles_file_path(), &profiles)
}

pub fn delete_profile(name: &str) -> Result<(), String> {
    let mut profiles = load_profiles();
    profiles.retain(|p| p.name != name);
    save_json(&get_profiles_file_path(), &profiles)
}
