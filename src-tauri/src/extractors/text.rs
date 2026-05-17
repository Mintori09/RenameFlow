use super::{ExtractedContext, FileHint};
use std::path::Path;
use tokio::io::AsyncReadExt;

const MAX_SIZE: u64 = 1_048_576;
const READ_LIMIT: u64 = 65_536;

pub async fn extract(path: &Path, _meta: &std::fs::Metadata) -> ExtractedContext {
    let content = match tokio::fs::metadata(path).await {
        Ok(meta) if meta.len() <= MAX_SIZE => {
            let mut buf = vec![0u8; READ_LIMIT as usize];
            if let Ok(mut f) = tokio::fs::File::open(path).await {
                let n = f.read(&mut buf).await.unwrap_or(0);
                String::from_utf8_lossy(&buf[..n]).to_string()
            } else {
                String::new()
            }
        }
        _ => String::new(),
    };

    ExtractedContext {
        hint: FileHint::Text,
        summary: content,
        media: vec![],
    }
}
