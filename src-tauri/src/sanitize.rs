use std::collections::HashSet;

const ILLEGAL_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
const MAX_BASENAME_LENGTH: usize = 100;

pub fn sanitize_name(name: &str, extension: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !ILLEGAL_CHARS.contains(c))
        .collect();

    let trimmed = cleaned.trim().to_string();

    if trimmed.is_empty() {
        return format!("untitled-file{}", extension);
    }

    let basename = if trimmed.len() > MAX_BASENAME_LENGTH {
        trimmed[..MAX_BASENAME_LENGTH].to_string()
    } else {
        trimmed
    };

    let ext = if extension.starts_with('.') {
        extension.to_string()
    } else {
        format!(".{}", extension)
    };

    format!("{}{}", basename, ext)
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

    desired_path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_removes_illegal_chars() {
        let result = sanitize_name("hello:world/test*.jpg", ".jpg");
        assert!(!result.contains(':'));
        assert!(!result.contains('/'));
        assert!(!result.contains('*'));
    }

    #[test]
    fn test_empty_name_fallback() {
        let result = sanitize_name("", ".jpg");
        assert!(result.starts_with("untitled-file"));
        assert!(result.ends_with(".jpg"));
    }

    #[test]
    fn test_truncates_long_names() {
        let long = "a".repeat(200);
        let result = sanitize_name(&long, ".txt");
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
}
