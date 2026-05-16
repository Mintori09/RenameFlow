use crate::models::{Provider, ProviderConfig, ProviderConfigResponse, ProviderResponse};
use serde_json::Value;

fn get_providers_dir() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| {
            eprintln!(
                "[renameflow] Warning: could not determine config directory, using current dir"
            );
            std::path::PathBuf::from(".")
        })
        .join("renameflow")
}

fn get_providers_file_path() -> std::path::PathBuf {
    get_providers_dir().join("providers.json")
}

pub fn load_providers() -> ProviderConfig {
    let path = get_providers_file_path();
    if !path.exists() {
        let default = ProviderConfig {
            active_provider: "default".to_string(),
            providers: vec![Provider {
                name: "default".to_string(),
                provider_type: "ollama".to_string(),
                base_url: "http://localhost:11434".to_string(),
                api_key: String::new(),
                models: vec![],
                active_model: String::new(),
            }],
            active_model_id: String::new(),
        };
        let _ = save_providers_inner(&default);
        return default;
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    if let Ok(config) = serde_json::from_str::<ProviderConfig>(&content) {
        return config;
    }
    migrate_from_old(&content)
}

fn migrate_from_old(content: &str) -> ProviderConfig {
    let old: Value = serde_json::from_str(content).unwrap_or_default();
    let old_providers = old["providers"].as_array().cloned().unwrap_or_default();
    let old_active = old["activeProvider"].as_str().unwrap_or("").to_string();
    let mut providers = Vec::new();
    let mut active_model_id = String::new();

    for p in &old_providers {
        let name = p["name"].as_str().unwrap_or("").to_string();
        let provider_type = p["providerType"]
            .as_str()
            .unwrap_or("openai-compatible")
            .to_string();
        let base_url = p["baseUrl"].as_str().unwrap_or("").to_string();
        let api_key = p["apiKey"].as_str().unwrap_or("").to_string();
        let model = p["model"].as_str().unwrap_or("").to_string();

        let final_type =
            if provider_type == "openai-compatible" && base_url.contains("localhost:11434") {
                "ollama".to_string()
            } else {
                provider_type
            };

        let models = if model.is_empty() {
            vec![]
        } else {
            vec![model.clone()]
        };

        if name == old_active && !model.is_empty() {
            active_model_id = format!("{}::{}", name, model);
        }

        providers.push(Provider {
            name,
            provider_type: final_type,
            base_url,
            api_key,
            models: models.clone(),
            active_model: model,
        });
    }

    let config = ProviderConfig {
        active_provider: old_active,
        providers,
        active_model_id,
    };
    let _ = save_providers_inner(&config);
    config
}

fn save_providers_inner(config: &ProviderConfig) -> Result<(), String> {
    let path = get_providers_file_path();
    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("Serialize error: {}", e))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, &content).map_err(|e| format!("Write error: {}", e))?;
    std::fs::rename(&tmp_path, &path).map_err(|e| format!("Rename error: {}", e))?;
    Ok(())
}

pub fn save_providers(config: &ProviderConfig) -> Result<(), String> {
    let existing = load_providers();
    let merged_providers: Vec<Provider> = config
        .providers
        .iter()
        .map(|p| {
            if p.api_key.is_empty() {
                if let Some(ep) = existing.providers.iter().find(|ep| ep.name == p.name) {
                    if !ep.api_key.is_empty() {
                        let mut merged = p.clone();
                        merged.api_key = ep.api_key.clone();
                        return merged;
                    }
                }
            }
            p.clone()
        })
        .collect();
    let merged = ProviderConfig {
        providers: merged_providers,
        ..config.clone()
    };
    save_providers_inner(&merged)
}

pub fn get_providers_path() -> String {
    get_providers_file_path().to_string_lossy().to_string()
}

pub fn load_providers_for_frontend() -> ProviderConfigResponse {
    let config = load_providers();
    ProviderConfigResponse {
        active_provider: config.active_provider,
        providers: config
            .providers
            .into_iter()
            .map(|p| ProviderResponse {
                name: p.name,
                provider_type: p.provider_type,
                base_url: p.base_url,
                has_api_key: !p.api_key.is_empty(),
                api_key: p.api_key,
                models: p.models,
                active_model: p.active_model,
            })
            .collect(),
        active_model_id: config.active_model_id,
    }
}

pub fn set_provider_key(provider_name: &str, api_key: &str) -> Result<(), String> {
    let mut config = load_providers();
    for provider in &mut config.providers {
        if provider.name == provider_name {
            provider.api_key = api_key.to_string();
            return save_providers(&config);
        }
    }
    Err(format!("Provider '{}' not found", provider_name))
}

/// Look up a provider's API key from stored config by matching provider type + base URL.
/// Returns the key if found, or empty string if not.
pub fn resolve_api_key(provider_type: &str, base_url: &str) -> String {
    let config = load_providers();
    for p in &config.providers {
        if p.provider_type == provider_type && p.base_url == base_url && !p.api_key.is_empty() {
            return p.api_key.clone();
        }
    }
    String::new()
}
