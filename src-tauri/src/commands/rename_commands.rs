use crate::ai;
use crate::domain::rename_plan::build_options_system_prompt;
use crate::models::{
    GenerateRenameFileInput, RenameHistory, RenameOperation, RenameOptions, RenameResult,
    RenameSuggestion, UndoResult,
};
use std::collections::HashSet;
use std::path::Path;

#[tauri::command]
pub async fn generate_rename_suggestions(
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

    let mut suggestions = Vec::new();
    let mut seen_final_names: HashSet<String> = HashSet::new();
    let options_system = build_options_system_prompt(&options);

    for file_input in &files {
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

        let ai_result = ai::generate_name(
            &provider,
            &base_url,
            &api_key,
            &model,
            &original_name,
            &prompt,
            &options_system,
        )
        .await?;

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

        suggestions.push(RenameSuggestion {
            file_id: file_input.id.clone(),
            original_name,
            suggested_name: suggested_stem,
            final_name: final_basename,
            confidence: None,
            reason: ai_result.reason,
        });
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
        match crate::filesystem::rename::execute_rename(op) {
            Ok(()) => success.push(op.clone()),
            Err(e) => failed.push(crate::models::RenameFailed {
                operation: op.clone(),
                error: e,
            }),
        }
    }

    let history_entry = RenameHistory {
        id: uuid_or_random(),
        created_at: chrono::Utc::now().to_rfc3339(),
        operations: operations.clone(),
        success_count: success.len(),
        failed_count: failed.len(),
    };
    let _ = crate::history::store::add_entry(&app_handle, history_entry);

    Ok(RenameResult { success, failed })
}

fn uuid_or_random() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("rf-{:016x}", nanos)
}

