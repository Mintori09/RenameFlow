use crate::ai::parser::parse_ai_json;
use crate::extractors::MediaInput;
use crate::models::AiResponse;
use reqwest::Client;

pub async fn call(
    client: &Client,
    endpoint: &str,
    _api_key: &str,
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

    let parts = if media.is_empty() {
        serde_json::json!([{"text": user_text}])
    } else {
        let mut parts: Vec<serde_json::Value> = vec![
            serde_json::json!({"text": user_text}),
        ];
        for m in media {
            parts.push(serde_json::json!({
                "inlineData": {
                    "mimeType": m.mime_type,
                    "data": m.base64_data
                }
            }));
        }
        serde_json::json!(parts)
    };

    let body = serde_json::json!({
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": parts
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 1024
        }
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Google AI request failed: {}", e))?;

    let status = resp.status();
    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google AI response: {}", e))?;

    if !status.is_success() {
        let err_msg = raw["error"]["message"]
            .as_str()
            .unwrap_or("unknown error");
        return Err(format!("Google AI error ({}): {}", status, err_msg));
    }

    let response_text = raw["candidates"][0]["content"]["parts"][0]["text"]
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
