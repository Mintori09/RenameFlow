use crate::ai::parser::parse_ai_json;
use crate::extractors::MediaInput;
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
    media: &[MediaInput],
) -> Result<AiResponse, String> {
    let system_prompt = build_system_prompt();
    let user_text = format!(
        "{}\n\nOriginal file name: {}{}",
        user_prompt, file_name, options_system
    );

    let content = if media.is_empty() {
        serde_json::json!(user_text)
    } else {
        let mut parts: Vec<serde_json::Value> = vec![
            serde_json::json!({"type": "text", "text": user_text}),
        ];
        for m in media {
            parts.push(serde_json::json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": m.mime_type,
                    "data": m.base64_data
                }
            }));
        }
        serde_json::json!(parts)
    };

    let body = serde_json::json!({
        "model": model,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": content}
        ],
        "max_tokens": 1024,
        "temperature": 0.1
    });

    let resp = client
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    let status = resp.status();
    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    if !status.is_success() {
        let err_msg = raw["error"]["message"]
            .as_str()
            .unwrap_or("unknown error");
        return Err(format!("Anthropic error ({}): {}", status, err_msg));
    }

    let response_text = raw["content"][0]["text"].as_str().unwrap_or("");
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
