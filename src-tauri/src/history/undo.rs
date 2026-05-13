use crate::models::UndoResult;

pub fn undo_last(app_handle: &tauri::AppHandle) -> Result<UndoResult, String> {
    let mut history = crate::history::store::load_history(app_handle);
    if history.is_empty() {
        return Err("No rename history to undo.".to_string());
    }

    let last = history.remove(0);
    let mut restored = 0usize;
    let mut failed = 0usize;

    for op in &last.operations {
        let from = std::path::Path::new(&op.to_path);
        let to = std::path::Path::new(&op.from_path);
        if from.exists() {
            match std::fs::rename(from, to) {
                Ok(_) => restored += 1,
                Err(_) => failed += 1,
            }
        } else {
            failed += 1;
        }
    }

    crate::history::store::save_history(app_handle, &history)?;

    Ok(UndoResult { restored, failed })
}
