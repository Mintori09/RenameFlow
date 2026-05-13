use crate::models::AiResponse;
use reqwest::Client;

pub enum AiProvider {
    Ollama,
    LmStudio,
}

impl AiProvider {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "lm-studio" | "lm_studio" => AiProvider::LmStudio,
            _ => AiProvider::Ollama,
        }
    }

    fn api_endpoint(&self, base_url: &str) -> String {
        match self {
            AiProvider::Ollama => format!("{}/api/generate", base_url.trim_end_matches('/')),
            AiProvider::LmStudio => format!("{}/chat/completions", base_url.trim_end_matches('/')),
        }
    }
}

pub async fn generate_name(
    provider: &str,
    base_url: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let p = AiProvider::from_str(provider);
    let endpoint = p.api_endpoint(base_url);

    match p {
        AiProvider::Ollama => call_ollama(&client, &endpoint, model, file_name, user_prompt).await,
        AiProvider::LmStudio => call_lm_studio(&client, &endpoint, model, file_name, user_prompt).await,
    }
}

async fn call_ollama(
    client: &Client,
    endpoint: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let system_prompt = "You are a file renaming assistant. Generate a short, clear, descriptive filename based on the file content. Return ONLY valid JSON with fields \"name\" (the filename without extension) and \"reason\" (why you chose it). No markdown, no explanation. Use lowercase, hyphens between words, maximum 8 words. Avoid generic names like image, file, document, screenshot.";

    let body = serde_json::json!({
        "model": model,
        "system": system_prompt,
        "prompt": format!("{}\n\nOriginal file name: {}", user_prompt, file_name),
        "stream": false,
        "format": "json"
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let response_text = raw["response"].as_str().unwrap_or("");
    parse_ai_json(response_text)
}

async fn call_lm_studio(
    client: &Client,
    endpoint: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let system_prompt = "You are a file renaming assistant. Generate a short, clear, descriptive filename based on the file content. Return ONLY valid JSON with fields \"name\" (the filename without extension) and \"reason\" (why you chose it). No markdown, no explanation. Use lowercase, hyphens between words, maximum 8 words. Avoid generic names like image, file, document, screenshot.";

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": format!("{}\n\nOriginal file name: {}", user_prompt, file_name)}
        ],
        "temperature": 0.1,
        "max_tokens": 100
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LM Studio request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse LM Studio response: {}", e))?;

    let response_text = raw["choices"][0]["message"]["content"]
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
