use crate::ai;
use crate::domain::rename_plan::build_options_system_prompt;
use crate::models::{
    GenerateRenameFileInput, RenameFailed, RenameHistory, RenameOperation, RenameOptions,
    RenameProgressPayload, RenameResult, RenameSuggestion,
};
use crate::CancellationState;
use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

#[tauri::command]
pub fn cancel_generation(state: tauri::State<'_, CancellationState>) -> Result<(), String> {
    state.0.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn generate_rename_suggestions(
    app_handle: AppHandle,
    files: Vec<GenerateRenameFileInput>,
    provider: String,
    model: String,
    base_url: String,
    api_key: String,
    prompt: String,
    options: RenameOptions,
) -> Result<Vec<RenameSuggestion>, String> {
    if files.is_empty() {
        return Err("No files provided.".to_string());
    }
    if model.is_empty() {
        return Err("No model selected.".to_string());
    }
    if prompt.is_empty() {
        return Err("Prompt cannot be empty.".to_string());
    }

    let api_key = if api_key.is_empty() {
        crate::providers::resolve_api_key(&provider, &base_url)
    } else {
        api_key
    };

    let mut suggestions = Vec::new();
    let mut seen_final_names: HashSet<String> = HashSet::new();
    let options_system = build_options_system_prompt(&options);
    let cancelled = app_handle.state::<CancellationState>().0.clone();
    cancelled.store(false, Ordering::SeqCst);

    for file_input in &files {
        if cancelled.load(Ordering::SeqCst) {
            break;
        }
        let path = Path::new(&file_input.path);
        let original_name = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let extension = path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        // Cap file reads: skip files > 1MB, read only first 64KB
        let file_content = {
            let max_size: u64 = 1_048_576;
            let read_limit: u64 = 65_536;
            match tokio::fs::metadata(&file_input.path).await {
                Ok(meta) if meta.len() <= max_size => {
                    use tokio::io::AsyncReadExt;
                    let mut buf = vec![0u8; read_limit as usize];
                    if let Ok(mut f) = tokio::fs::File::open(&file_input.path).await {
                        let n = f.read(&mut buf).await.unwrap_or(0);
                        String::from_utf8_lossy(&buf[..n]).to_string()
                    } else {
                        String::new()
                    }
                }
                _ => String::new(),
            }
        };

        let ai_result = ai::generate_name(
            &provider,
            &base_url,
            &api_key,
            &model,
            &original_name,
            &format!("{}\n{}", prompt, file_content.to_string()),
            &options_system,
        )
        .await?;

        if cancelled.load(Ordering::SeqCst) {
            break;
        }

        let raw_name = ai_result.name.unwrap_or_else(|| original_name.clone());
        let sanitized_full =
            crate::domain::sanitize::sanitize_name(&raw_name, &extension, &options.style);

        let sanitized_path = Path::new(&sanitized_full);
        let suggested_stem = sanitized_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let final_path = if let Some(parent) = path.parent() {
            let desired = parent.join(&sanitized_full).to_string_lossy().to_string();
            crate::domain::sanitize::deduplicate_name(&desired, &seen_final_names)
        } else {
            crate::domain::sanitize::deduplicate_name(&sanitized_full, &seen_final_names)
        };

        seen_final_names.insert(final_path.clone());

        let final_basename = Path::new(&final_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let suggestion = RenameSuggestion {
            file_id: file_input.id.clone(),
            original_name,
            suggested_name: suggested_stem,
            final_name: final_basename,
            confidence: None,
            reason: ai_result.reason,
        };

        let _ = app_handle.emit("rename-progress", suggestion.clone());

        suggestions.push(suggestion);
    }

    Ok(suggestions)
}

#[tauri::command]
pub async fn rename_files(
    app_handle: tauri::AppHandle,
    operations: Vec<RenameOperation>,
) -> Result<RenameResult, String> {
    crate::filesystem::rename::validate_operations(&operations)?;

    let conflicts = crate::domain::conflicts::check_conflicts(&operations);
    if !conflicts.is_empty() {
        return Err(format!(
            "Duplicate target names detected: {}. Please resolve conflicts before renaming.",
            conflicts.join(", ")
        ));
    }

    let mut success = Vec::new();
    let mut failed = Vec::new();

    for op in &operations {
        let _ = app_handle.emit(
            "rename-exec-status",
            RenameProgressPayload {
                file_id: op.file_id.clone(),
                status: "renaming".into(),
                error: None,
            },
        );

        match crate::filesystem::rename::execute_rename(op) {
            Ok(()) => {
                let _ = app_handle.emit(
                    "rename-exec-status",
                    RenameProgressPayload {
                        file_id: op.file_id.clone(),
                        status: "renamed".into(),
                        error: None,
                    },
                );
                success.push(op.clone());
            }
            Err(e) => {
                let _ = app_handle.emit(
                    "rename-exec-status",
                    RenameProgressPayload {
                        file_id: op.file_id.clone(),
                        status: "failed".into(),
                        error: Some(e.clone()),
                    },
                );
                failed.push(RenameFailed {
                    operation: op.clone(),
                    error: e,
                });
            }
        }
    }

    let history_entry = RenameHistory {
        id: uuid_or_random(),
        created_at: chrono::Utc::now().to_rfc3339(),
        operations: operations.clone(),
        success_count: success.len(),
        failed_count: failed.len(),
    };
    if let Err(e) = crate::history::store::add_entry(&app_handle, history_entry) {
        eprintln!("[renameflow] Warning: failed to save rename history: {}", e);
    }

    Ok(RenameResult { success, failed })
}

fn uuid_or_random() -> String {
    Uuid::new_v4().to_string()
}
