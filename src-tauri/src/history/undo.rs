use crate::models::UndoResult;

pub fn undo_last(app_handle: &tauri::AppHandle) -> Result<UndoResult, String> {
    undo_by_index(app_handle, 0)
}

pub fn undo_by_id(app_handle: &tauri::AppHandle, id: &str) -> Result<UndoResult, String> {
    let history = crate::history::store::load_history(app_handle);
    let index = history.iter().position(|e| e.id == id);
    match index {
        Some(i) => undo_by_index(app_handle, i),
        None => Err(format!("History entry '{}' not found", id)),
    }
}

fn undo_by_index(app_handle: &tauri::AppHandle, index: usize) -> Result<UndoResult, String> {
    let history = crate::history::store::load_history(app_handle);
    if index >= history.len() {
        return Err("Invalid history index".to_string());
    }

    let entry = &history[index];
    let mut restored = 0usize;
    let mut failed = 0usize;

    for op in &entry.operations {
        let from = std::path::Path::new(&op.to_path);
        let to = std::path::Path::new(&op.from_path);
        if from.exists() {
            if to.exists() {
                failed += 1;
            } else {
                match std::fs::rename(from, to) {
                    Ok(_) => restored += 1,
                    Err(_) => failed += 1,
                }
            }
        } else {
            failed += 1;
        }
    }

    // Only remove history entry AFTER rename operations complete
    let mut new_history = history;
    new_history.remove(index);
    crate::history::store::save_history(app_handle, &new_history)?;

    Ok(UndoResult { restored, failed })
}
