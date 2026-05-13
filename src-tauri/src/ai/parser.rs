use crate::models::AiResponse;

fn strip_code_fence(text: &str) -> &str {
    for prefix in &["```json\n", "```json ", "```\n", "``` "] {
        if let Some(rest) = text.strip_prefix(prefix) {
            if let Some(end) = rest.rfind("```") {
                return rest[..end].trim();
            }
            return rest.trim();
        }
    }
    if let Some(start) = text.find("```json") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            return after[..end].trim();
        }
        return after.trim();
    }
    if text.starts_with("```") {
        let rest = &text[3..];
        if let Some(end) = rest.rfind("```") {
            return rest[..end].trim();
        }
        return rest.trim();
    }
    text
}

fn extract_json_braces(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let tail = &text[start..];
    let mut depth = 0;
    for (i, ch) in tail.char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&tail[..=i]);
                }
            }
            _ => {}
        }
    }
    None
}

fn sanitize_to_filename(text: &str) -> String {
    let first_line = text.lines().next().unwrap_or(text);
    let first_sentence = first_line
        .split(|c| c == '.' || c == '!' || c == '?')
        .next()
        .unwrap_or(first_line);
    let slug: String = first_sentence
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-')
        .collect::<String>()
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .to_lowercase();
    if slug.is_empty() {
        "unnamed".to_string()
    } else {
        slug
    }
}

pub fn parse_ai_json(text: &str) -> Result<AiResponse, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("AI returned an empty response.".to_string());
    }

    let cleaned = strip_code_fence(text);

    if let Ok(resp) = serde_json::from_str::<AiResponse>(cleaned) {
        return Ok(resp);
    }

    if let Some(json_str) = extract_json_braces(cleaned) {
        if let Ok(resp) = serde_json::from_str::<AiResponse>(json_str) {
            return Ok(resp);
        }
    }

    let fallback_name = sanitize_to_filename(cleaned);
    let reason = format!("AI did not return JSON; used first line as filename");
    Ok(AiResponse {
        name: Some(fallback_name),
        reason: Some(reason),
    })
}
