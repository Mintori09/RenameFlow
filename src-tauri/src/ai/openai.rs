use crate::ai::parser::parse_ai_json;
use crate::models::AiResponse;
use reqwest::Client;

pub async fn call(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
    options_system: &str,
) -> Result<AiResponse, String> {
    let system_prompt = build_system_prompt();
    let user_prompt = format!(
        "{}\n\nOriginal file name: {}{}",
        user_prompt, file_name, options_system
    );

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 100
    });

    let mut req = client.post(endpoint).json(&body);
    if !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("OpenAI-compatible request failed: {}", e))?;

    let status = resp.status();
    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if !status.is_success() {
        let err_msg = raw["error"]["message"]
            .as_str()
            .unwrap_or("unknown error");
        return Err(format!("AI provider error ({}): {}", status, err_msg));
    }

    if let Some(err_msg) = raw["error"]["message"].as_str() {
        return Err(format!("AI provider error: {}", err_msg));
    }

    let response_text = raw["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    if response_text.is_empty() {
        return Err(format!(
            "AI returned empty content. Raw response: {}",
            raw
        ));
    }
    parse_ai_json(response_text)
}

fn build_system_prompt() -> &'static str {
    "You are a file renaming assistant. You MUST respond with ONLY a raw JSON object, no other text. Example: {\"name\": \"quarterly-report\", \"reason\": \"descriptive name reflecting content\"}. Fields: \"name\" (filename without extension, lowercase, hyphens, max 8 words), \"reason\" (short explanation). Avoid generic names like image, file, document. If you lack context, invent a reasonable name anyway. NEVER include markdown, backticks, or explanations."
}

