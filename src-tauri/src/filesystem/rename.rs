use crate::models::RenameOperation;
use std::path::Path;

pub fn validate_operations(operations: &[RenameOperation]) -> Result<(), String> {
    for op in operations {
        let from = Path::new(&op.from_path);
        if !from.exists() {
            return Err(format!("File not found: {}", op.from_path));
        }
        if !from.is_file() {
            return Err(format!("Path is not a file: {}", op.from_path));
        }
    }
    Ok(())
}

pub fn execute_rename(op: &RenameOperation) -> Result<(), String> {
    let from = Path::new(&op.from_path);
    let to = Path::new(&op.to_path);

    if from == to {
        return Ok(());
    }

    // Canonicalize source to resolve symlinks and relative paths
    let from_canonical = std::fs::canonicalize(from)
        .map_err(|e| format!("Cannot resolve source path '{}': {}", op.from_path, e))?;

    if !from_canonical.is_file() {
        return Err(format!("Not a file: {}", from_canonical.display()));
    }

    let from_parent = from_canonical
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;

    // Prevent path traversal in the basename
    if let Some(file_name) = to.file_name() {
        let name_str = file_name.to_string_lossy();
        if name_str == "." || name_str == ".." || name_str.contains('/') || name_str.contains('\\')
        {
            return Err("Invalid file name: path traversal detected".to_string());
        }
    } else {
        return Err("Target path has no file name".to_string());
    }

    let file_name = to.file_name().unwrap();
    let safe_to = from_parent.join(file_name);

    // Use rename which atomically replaces on Unix; on Windows we check existence
    if safe_to.exists() {
        return Err(format!(
            "Target already exists: {}. Refusing to overwrite.",
            safe_to.display()
        ));
    }

    std::fs::rename(&from_canonical, &safe_to).map_err(|e| format!("Failed to rename: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detects_missing_file() {
        let ops = vec![RenameOperation {
            file_id: "1".into(),
            from_path: "/nonexistent/path/file.txt".into(),
            to_path: "/tmp/renamed.txt".into(),
            original_name: "file".into(),
            new_name: "renamed".into(),
        }];
        let result = validate_operations(&ops);
        assert!(result.is_err());
    }
}
