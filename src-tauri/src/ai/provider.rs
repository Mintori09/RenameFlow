use crate::models::AiResponse;
use reqwest::Client;
use url::Url;

pub async fn generate_name(
    provider: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
    options_system: &str,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let p = AiProvider::from_str(provider);

    match p {
        AiProvider::OpenAiCompatible | AiProvider::Ollama | AiProvider::LmStudio => {
            let endpoint = p.api_endpoint(base_url, model, api_key);
            crate::ai::openai::call(
                &client,
                &endpoint,
                api_key,
                model,
                file_name,
                user_prompt,
                options_system,
            )
            .await
        }
        AiProvider::Anthropic => {
            let endpoint = p.api_endpoint(base_url, model, api_key);
            let resolved_key = resolve_api_key(api_key, "ANTHROPIC_API_KEY").ok_or_else(|| {
                "Anthropic API key required. Set ANTHROPIC_API_KEY env var or enter in settings.".to_string()
            })?;
            crate::ai::anthropic::call(
                &client,
                &endpoint,
                &resolved_key,
                model,
                file_name,
                user_prompt,
                options_system,
            )
            .await
        }
        AiProvider::Google => {
            let resolved_key = resolve_api_key(api_key, "GOOGLE_API_KEY").ok_or_else(|| {
                "Google API key required. Set GOOGLE_API_KEY env var or enter in settings."
                    .to_string()
            })?;
            let endpoint = p.api_endpoint(base_url, model, &resolved_key);
            crate::ai::google::call(
                &client,
                &endpoint,
                &resolved_key,
                file_name,
                user_prompt,
                options_system,
            )
            .await
        }
    }
}

pub enum AiProvider {
    OpenAiCompatible,
    Ollama,
    LmStudio,
    Anthropic,
    Google,
}

impl AiProvider {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "anthropic" => AiProvider::Anthropic,
            "google" => AiProvider::Google,
            "ollama" => AiProvider::Ollama,
            "lm-studio" | "lm_studio" => AiProvider::LmStudio,
            _ => AiProvider::OpenAiCompatible,
        }
    }

    pub fn api_endpoint(&self, base_url: &str, model: &str, _api_key: &str) -> String {
        let base = base_url.trim_end_matches('/');
        match self {
            AiProvider::OpenAiCompatible | AiProvider::Ollama | AiProvider::LmStudio => {
                format!("{}/v1/chat/completions", base)
            }
            AiProvider::Anthropic => format!("{}/v1/messages", base),
            AiProvider::Google => format!(
                "{}/v1beta/models/{}:generateContent",
                base, model
            ),
        }
    }
}

fn resolve_api_key(api_key: &str, env_var: &str) -> Option<String> {
    if !api_key.is_empty() {
        Some(api_key.to_string())
    } else {
        std::env::var(env_var).ok()
    }
}

pub fn validate_base_url(base_url: &str, provider: &str) -> Result<(), String> {
    let parsed = Url::parse(base_url).map_err(|_| "Invalid URL format".to_string())?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Only http and https URLs are allowed".to_string());
    }

    let host = parsed.host_str().unwrap_or("");
    let is_local = matches!(provider.to_lowercase().as_str(), "ollama" | "lm-studio" | "lm_studio");

    if !is_local {
        if host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0"
            || host.starts_with("192.168.") || host.starts_with("10.")
            || host.starts_with("172.") {
            return Err("Local/private network URLs not allowed for this provider type".to_string());
        }
    }

    Ok(())
}
