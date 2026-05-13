use crate::ai;
use crate::history;
use crate::models::*;
use crate::rename;
use crate::sanitize;
use std::collections::HashSet;

#[tauri::command]
pub async fn generate_rename_suggestions(
    files: Vec<String>,
    provider: String,
    model: String,
    base_url: String,
    prompt: String,
    _options: RenameOptions,
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

    for file_path in &files {
        let path = std::path::Path::new(file_path);
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
            &model,
            &original_name,
            &prompt,
        )
        .await?;

        let raw_name = ai_result.name.unwrap_or_else(|| original_name.clone());
        let sanitized_full = sanitize::sanitize_name(&raw_name, &extension);

        let sanitized_path = std::path::Path::new(&sanitized_full);
        let suggested_stem = sanitized_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let final_path = if let Some(parent) = path.parent() {
            let desired = parent.join(&sanitized_full).to_string_lossy().to_string();
            sanitize::deduplicate_name(&desired, &seen_final_names)
        } else {
            sanitize::deduplicate_name(&sanitized_full, &seen_final_names)
        };

        seen_final_names.insert(final_path.clone());

        suggestions.push(RenameSuggestion {
            file_id: file_path.clone(),
            original_name,
            suggested_name: suggested_stem,
            final_name: final_path,
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
    rename::validate_operations(&operations)?;

    let conflicts = rename::check_conflicts(&operations);
    if !conflicts.is_empty() {
        return Err(format!(
            "Duplicate target names detected: {}. Please resolve conflicts before renaming.",
            conflicts.join(", ")
        ));
    }

    let mut success = Vec::new();
    let mut failed = Vec::new();

    for op in &operations {
        match rename::execute_rename(op) {
            Ok(()) => success.push(op.clone()),
            Err(e) => failed.push(RenameFailed {
                operation: op.clone(),
                error: e,
            }),
        }
    }

    let history_entry = RenameHistory {
        id: uuid_or_random(),
        created_at: chrono_or_now(),
        operations: operations.clone(),
        success_count: success.len(),
        failed_count: failed.len(),
    };
    let _ = history::add_entry(&app_handle, history_entry);

    Ok(RenameResult { success, failed })
}

#[tauri::command]
pub async fn undo_last_rename(
    app_handle: tauri::AppHandle,
) -> Result<UndoResult, String> {
    history::undo_last(&app_handle)
}

#[tauri::command]
pub async fn get_available_models(
    provider: String,
    base_url: String,
) -> Result<Vec<ModelInfo>, String> {
    if base_url.is_empty() {
        return Err("Base URL is required.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    match provider.to_lowercase().as_str() {
        "ollama" => {
            let resp = client
                .get(format!("{}/api/tags", base_url.trim_end_matches('/')))
                .send()
                .await
                .map_err(|e| format!("Failed to fetch Ollama models: {}", e))?;

            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let models = raw["models"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            m["name"].as_str().map(|n| ModelInfo {
                                name: n.to_string(),
                                label: None,
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Ok(models)
        }
        "lm-studio" | "lm_studio" => {
            let resp = client
                .get(format!("{}/models", base_url.trim_end_matches('/')))
                .send()
                .await
                .map_err(|e| format!("Failed to fetch LM Studio models: {}", e))?;

            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let models = raw["data"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            m["id"].as_str().map(|n| ModelInfo {
                                name: n.to_string(),
                                label: None,
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Ok(models)
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

fn uuid_or_random() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("rf-{:016x}", nanos)
}

fn chrono_or_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    format!("2026-05-13T{:06}Z", secs % 86400)
}
