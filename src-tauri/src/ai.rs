use crate::models::AiResponse;
use reqwest::Client;

pub enum AiProvider {
    OpenAiCompatible,
    Anthropic,
    Google,
}

impl AiProvider {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "anthropic" => AiProvider::Anthropic,
            "google" => AiProvider::Google,
            _ => AiProvider::OpenAiCompatible,
        }
    }

    fn api_endpoint(&self, base_url: &str, model: &str, api_key: &str) -> String {
        let base = base_url.trim_end_matches('/');
        match self {
            AiProvider::OpenAiCompatible => format!("{}/chat/completions", base),
            AiProvider::Anthropic => format!("{}/v1/messages", base),
            AiProvider::Google => format!(
                "{}/v1beta/models/{}:generateContent?key={}",
                base, model, api_key
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

pub async fn generate_name(
    provider: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let p = AiProvider::from_str(provider);

    match p {
        AiProvider::OpenAiCompatible => {
            let endpoint = p.api_endpoint(base_url, model, api_key);
            call_openai_compatible(&client, &endpoint, api_key, model, file_name, user_prompt)
                .await
        }
        AiProvider::Anthropic => {
            let endpoint = p.api_endpoint(base_url, model, api_key);
            call_anthropic(&client, &endpoint, api_key, model, file_name, user_prompt).await
        }
        AiProvider::Google => {
            let resolved_key = resolve_api_key(api_key, "GOOGLE_API_KEY")
                .ok_or_else(|| "Google API key required. Set GOOGLE_API_KEY env var or enter in settings.".to_string())?;
            let endpoint = p.api_endpoint(base_url, model, &resolved_key);
            call_google(&client, &endpoint, file_name, user_prompt).await
        }
    }
}

fn system_prompt_from(user_prompt: &str, file_name: &str) -> String {
    format!("{}\n\nOriginal file name: {}", user_prompt, file_name)
}

fn build_system_prompt() -> &'static str {
    "You are a file renaming assistant. Generate a short, clear, descriptive filename based on the file content. Return ONLY valid JSON with fields \"name\" (the filename without extension) and \"reason\" (why you chose it). No markdown, no explanation. Use lowercase, hyphens between words, maximum 8 words. Avoid generic names like image, file, document, screenshot."
}

async fn call_openai_compatible(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": system_prompt_from(user_prompt, file_name)}
        ],
        "temperature": 0.1,
        "max_tokens": 100
    });

    let mut req = client.post(endpoint).json(&body);
    if let Some(key) = resolve_api_key(api_key, "OPENAI_API_KEY") {
        req = req.bearer_auth(key);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("OpenAI-compatible request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let response_text = raw["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    parse_ai_json(response_text)
}

async fn call_anthropic(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let key = resolve_api_key(api_key, "ANTHROPIC_API_KEY").ok_or_else(|| {
        "Anthropic API key required. Set ANTHROPIC_API_KEY env var or enter in settings."
            .to_string()
    })?;

    let body = serde_json::json!({
        "model": model,
        "system": build_system_prompt(),
        "messages": [
            {"role": "user", "content": system_prompt_from(user_prompt, file_name)}
        ],
        "max_tokens": 100,
        "temperature": 0.1
    });

    let resp = client
        .post(endpoint)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    let response_text = raw["content"][0]["text"].as_str().unwrap_or("");
    parse_ai_json(response_text)
}

async fn call_google(
    client: &Client,
    endpoint: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let body = serde_json::json!({
        "system_instruction": {
            "parts": [{"text": build_system_prompt()}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": system_prompt_from(user_prompt, file_name)}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 100
        }
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Google AI request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google AI response: {}", e))?;

    let response_text = raw["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("");
    parse_ai_json(response_text)
}

fn parse_ai_json(text: &str) -> Result<AiResponse, String> {
    if let Ok(resp) = serde_json::from_str::<AiResponse>(text) {
        return Ok(resp);
    }

    if let Some(start) = text.find("```json") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            let json_str = after[..end].trim();
            if let Ok(resp) = serde_json::from_str::<AiResponse>(json_str) {
                return Ok(resp);
            }
        }
    }

    if let Some(start) = text.find('{') {
        if let Some(end) = text[start..].rfind('}') {
            let json_str = &text[start..start + end + 1];
            if let Ok(resp) = serde_json::from_str::<AiResponse>(json_str) {
                return Ok(resp);
            }
        }
    }

    Err(format!("Could not parse AI response as JSON: {}", text))
}
