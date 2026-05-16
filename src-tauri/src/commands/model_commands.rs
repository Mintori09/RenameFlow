use crate::models::{ModelInfo, UndoResult};
use tauri::AppHandle;

#[tauri::command]
pub fn get_ollama_models() -> Result<Vec<String>, String> {
    let output = std::process::Command::new("ollama")
        .args(["list"])
        .output()
        .map_err(|e| format!("Failed to run 'ollama list': {}", e))?;

    if !output.status.success() {
        return Err(format!("ollama list exited with code: {:?}", output.status.code()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .skip(1)
        .filter_map(|line| line.split_whitespace().next())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .collect())
}

#[tauri::command]
pub async fn undo_last_rename(app_handle: AppHandle) -> Result<UndoResult, String> {
    crate::history::undo::undo_last(&app_handle)
}

#[tauri::command]
pub async fn get_available_models(
    provider: String,
    base_url: String,
    api_key: String,
) -> Result<Vec<ModelInfo>, String> {
    let api_key = if api_key.is_empty() {
        crate::providers::resolve_api_key(&provider, &base_url)
    } else {
        api_key
    };

    crate::ai::provider::validate_base_url(&base_url, &provider)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    match provider.to_lowercase().as_str() {
        "openai-compatible" | "openai_compatible" | "ollama" => {
            get_openai_compatible_models(&client, &base_url, &api_key).await
        }
        "anthropic" => get_anthropic_models(&client, &base_url, &api_key).await,
        "google" => get_google_models(&client, &base_url, &api_key).await,
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

async fn get_openai_compatible_models(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<ModelInfo>, String> {
    if base_url.is_empty() {
        return Err("Base URL is required.".to_string());
    }
    let mut req = client.get(format!("{}/v1/models", base_url.trim_end_matches('/')));
    if !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    } else if !base_url.contains("localhost:11434") && !base_url.contains("127.0.0.1:11434") {
        if let Ok(key) = std::env::var("OPENAI_API_KEY") {
            req = req.bearer_auth(key);
        }
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;
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

async fn get_anthropic_models(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<ModelInfo>, String> {
    if base_url.is_empty() {
        return Err("Base URL is required.".to_string());
    }
    let key = if !api_key.is_empty() {
        api_key.to_string()
    } else {
        std::env::var("ANTHROPIC_API_KEY").map_err(|_| {
            "Anthropic API key required. Set ANTHROPIC_API_KEY env var or enter in settings."
                .to_string()
        })?
    };
    let resp = client
        .get(format!("{}/v1/models", base_url.trim_end_matches('/')))
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Anthropic models: {}", e))?;
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

async fn get_google_models(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<ModelInfo>, String> {
    if base_url.is_empty() {
        return Err("Base URL is required.".to_string());
    }
    let key = if !api_key.is_empty() {
        api_key.to_string()
    } else {
        std::env::var("GOOGLE_API_KEY").map_err(|_| {
            "Google API key required. Set GOOGLE_API_KEY env var or enter in settings.".to_string()
        })?
    };
    let resp = client
        .get(format!(
            "{}/v1beta/models?key={}",
            base_url.trim_end_matches('/'),
            key
        ))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Google models: {}", e))?;
    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    let models = raw["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    m["name"].as_str().and_then(|n| {
                        n.strip_prefix("models/").map(|stripped| ModelInfo {
                            name: stripped.to_string(),
                            label: None,
                        })
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}

