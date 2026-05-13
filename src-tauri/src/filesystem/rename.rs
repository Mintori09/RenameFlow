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

    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    std::fs::rename(from, to)
        .map_err(|e| format!("Failed to rename {} to {}: {}", op.from_path, op.to_path, e))
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
