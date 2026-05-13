use crate::models::{Provider, ProviderConfig};
use serde_json::Value;

fn get_providers_dir() -> std::path::PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
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
    std::fs::write(&path, content).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

pub fn save_providers(config: &ProviderConfig) -> Result<(), String> {
    save_providers_inner(config)
}

pub fn get_providers_path() -> String {
    get_providers_file_path().to_string_lossy().to_string()
}
