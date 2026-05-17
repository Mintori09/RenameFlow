use super::{ExtractedContext, FileHint};
use std::path::Path;

pub async fn extract(path: &Path, meta: &std::fs::Metadata, _ext: &str) -> ExtractedContext {
    let size = meta.len();
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| {
            let secs = t
                .duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|d| d.as_secs())?;
            let dt = chrono::DateTime::from_timestamp(secs as i64, 0)?;
            Some(dt.format("%Y-%m-%d").to_string())
        })
        .unwrap_or_default();

    let size_str = if size >= 1024 * 1024 {
        format!("{:.1}MB", size as f64 / (1024.0 * 1024.0))
    } else if size >= 1024 {
        format!("{}KB", size / 1024)
    } else {
        format!("{}B", size)
    };

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_uppercase();

    let type_hint = if !ext.is_empty() {
        format!(".{} file", ext)
    } else {
        "File".to_string()
    };

    let summary = format!(
        "{} \"{}\" ({}), last modified {}",
        type_hint, name, size_str, modified
    );

    ExtractedContext {
        hint: FileHint::Binary,
        summary,
        media: vec![],
    }
}
