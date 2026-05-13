use crate::models::RenameOperation;
use std::collections::HashSet;

pub fn check_conflicts(operations: &[RenameOperation]) -> Vec<String> {
    let mut to_paths = HashSet::new();
    let mut conflicts = Vec::new();

    for op in operations {
        if !to_paths.insert(&op.to_path) {
            conflicts.push(op.to_path.clone());
        }
    }

    conflicts
}
