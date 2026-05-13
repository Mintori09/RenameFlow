use crate::models::RenameOptions;

pub fn build_options_system_prompt(options: &RenameOptions) -> String {
    let mut parts = Vec::new();
    if !options.language.is_empty() && options.language != "auto" {
        parts.push(format!("Language: {}", options.language));
    }
    if options.max_words > 0 {
        parts.push(format!("Maximum {} words", options.max_words));
    }
    if !parts.is_empty() {
        format!("[{}]", parts.join(", "))
    } else {
        String::new()
    }
}
