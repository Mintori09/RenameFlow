use crate::ai::parser::parse_ai_json;
use crate::models::AiResponse;
use reqwest::Client;

pub async fn call(
    client: &Client,
    endpoint: &str,
    _api_key: &str,
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
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
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

