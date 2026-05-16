use std::collections::HashSet;
use uuid::Uuid;

const ILLEGAL_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
const MAX_BASENAME_LENGTH: usize = 100;

pub fn sanitize_name(name: &str, extension: &str, style: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !ILLEGAL_CHARS.contains(c))
        .collect();

    let trimmed = cleaned.trim().to_string();

    if trimmed.is_empty() {
        return format!("untitled-file{}", extension);
    }

    if trimmed == "." || trimmed == ".." {
        return format!("untitled-file{}", extension);
    }

    let mut basename = if trimmed.len() > MAX_BASENAME_LENGTH {
        trimmed[..MAX_BASENAME_LENGTH].to_string()
    } else {
        trimmed
    };

    basename = apply_style(&basename, style);

    let ext = if extension.starts_with('.') {
        extension.to_string()
    } else if extension.is_empty() {
        String::new()
    } else {
        format!(".{}", extension)
    };

    format!("{}{}", basename, ext)
}

pub fn apply_style(name: &str, style: &str) -> String {
    match style {
        "snake_case" => name
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("_"),
        "title-case" => name
            .split_whitespace()
            .map(|w| {
                let mut chars = w.chars();
                match chars.next() {
                    None => String::new(),
                    Some(c) => c.to_uppercase().chain(chars).collect(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
        "camelCase" => {
            let words: Vec<&str> = name.split_whitespace().collect();
            let mut result = String::new();
            for (i, word) in words.iter().enumerate() {
                if i == 0 {
                    result.push_str(&word.to_lowercase());
                } else {
                    let mut chars = word.chars();
                    if let Some(c) = chars.next() {
                        result.push(c.to_ascii_uppercase());
                        result.extend(chars.map(|c| c.to_ascii_lowercase()));
                    }
                }
            }
            result
        }
        _ => name
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-"),
    }
}

pub fn deduplicate_name(desired_path: &str, existing_names: &HashSet<String>) -> String {
    if !existing_names.contains(desired_path) {
        return desired_path.to_string();
    }

    let path = std::path::Path::new(desired_path);
    let parent = path.parent().unwrap_or(std::path::Path::new(""));
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    for i in 1..100 {
        let candidate = if ext.is_empty() {
            parent
                .join(format!("{}-{}", stem, i))
                .to_string_lossy()
                .to_string()
        } else {
            parent
                .join(format!("{}-{}{}", stem, i, ext))
                .to_string_lossy()
                .to_string()
        };
        if !existing_names.contains(&candidate) {
            return candidate;
        }
    }

    let suffix: String = Uuid::new_v4().to_string()[..8].to_string();
    if ext.is_empty() {
        parent
            .join(format!("{}-{}", stem, suffix))
            .to_string_lossy()
            .to_string()
    } else {
        parent
            .join(format!("{}-{}{}", stem, suffix, ext))
            .to_string_lossy()
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_removes_illegal_chars() {
        let result = sanitize_name("hello:world/test*.jpg", ".jpg", "kebab-case");
        assert!(!result.contains(':'));
        assert!(!result.contains('/'));
        assert!(!result.contains('*'));
    }

    #[test]
    fn test_empty_name_fallback() {
        let result = sanitize_name("", ".jpg", "kebab-case");
        assert!(result.starts_with("untitled-file"));
        assert!(result.ends_with(".jpg"));
    }

    #[test]
    fn test_truncates_long_names() {
        let long = "a".repeat(200);
        let result = sanitize_name(&long, ".txt", "kebab-case");
        assert!(result.len() <= MAX_BASENAME_LENGTH + 5);
    }

    #[test]
    fn test_deduplicate_adds_suffix() {
        let mut existing = HashSet::new();
        existing.insert("/path/to/sunset.jpg".to_string());
        let result = deduplicate_name("/path/to/sunset.jpg", &existing);
        assert_eq!(result, "/path/to/sunset-1.jpg");
    }

    #[test]
    fn test_deduplicate_returns_original_if_unique() {
        let existing = HashSet::new();
        let result = deduplicate_name("/path/to/sunset.jpg", &existing);
        assert_eq!(result, "/path/to/sunset.jpg");
    }

    #[test]
    fn test_apply_style_kebab_case() {
        let result = apply_style("Hello World Test", "kebab-case");
        assert_eq!(result, "hello-world-test");
    }

    #[test]
    fn test_apply_style_snake_case() {
        let result = apply_style("Hello World Test", "snake_case");
        assert_eq!(result, "hello_world_test");
    }

    #[test]
    fn test_apply_style_title_case() {
        let result = apply_style("hello world test", "title-case");
        assert_eq!(result, "Hello World Test");
    }

    #[test]
    fn test_apply_style_camel_case() {
        let result = apply_style("hello world test", "camelCase");
        assert_eq!(result, "helloWorldTest");
    }

    #[test]
    fn test_sanitize_name_with_style() {
        let result = sanitize_name("Hello World", ".jpg", "snake_case");
        assert_eq!(result, "hello_world.jpg");
    }
}
