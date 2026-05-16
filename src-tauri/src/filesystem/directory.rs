use crate::models::DirEntry;

pub fn list_dir(path: &str) -> Result<Vec<DirEntry>, String> {
    let entries =
        std::fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;
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
        if a.is_dir != b.is_dir {
            std::cmp::Ordering::Less
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    Ok(result)
}

pub fn collect_all(path: &str, max_depth: usize) -> Result<Vec<DirEntry>, String> {
    collect_recursive(path, max_depth, 0)
}

fn collect_recursive(
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
            let sub_entries = collect_recursive(&path_str, max_depth, current_depth + 1)?;
            result.extend(sub_entries);
        }
    }
    Ok(result)
}
