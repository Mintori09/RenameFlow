use super::{ExtractedContext, FileHint};
use id3::TagLike;
use std::path::Path;

const MAX_MEDIA_SIZE: u64 = 500 * 1024 * 1024;

pub async fn extract(path: &Path, meta: &std::fs::Metadata, ext: &str) -> ExtractedContext {
    if meta.len() > MAX_MEDIA_SIZE || meta.len() == 0 {
        return fallback(meta, ext);
    }

    let path = path.to_path_buf();
    let ext = ext.to_string();

    let ext_clone = ext.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<ExtractedContext, String> {
        match ext_clone.as_str() {
            "mp3" => extract_mp3(&path),
            "mp4" | "m4a" | "m4v" => extract_mp4(&path),
            _ => Err("No extractor for this format".into()),
        }
    })
    .await;

    match result {
        Ok(Ok(ctx)) => ctx,
        _ => fallback(meta, &ext),
    }
}

fn extract_mp3(path: &Path) -> Result<ExtractedContext, String> {
    let tag = id3::Tag::read_from_path(path)
        .map_err(|e| format!("Cannot read MP3 tags: {}", e))?;

    let mut parts = Vec::new();

    if let Some(title) = tag.title() {
        parts.push(format!("Title: {}", title));
    }
    if let Some(artist) = tag.artist() {
        parts.push(format!("Artist: {}", artist));
    }
    if let Some(album) = tag.album() {
        parts.push(format!("Album: {}", album));
    }
    if let Some(year) = tag.year() {
        parts.push(format!("Year: {}", year));
    }

    let summary = if parts.is_empty() {
        "MP3 audio (no metadata)".to_string()
    } else {
        parts.join(", ")
    };

    Ok(ExtractedContext {
        hint: FileHint::Media,
        summary,
        media: vec![],
    })
}

fn extract_mp4(path: &Path) -> Result<ExtractedContext, String> {
    let tag = mp4ameta::Tag::read_from_path(path)
        .map_err(|e| format!("Cannot read MP4 metadata: {}", e))?;

    let mut parts = Vec::new();

    if let Some(title) = tag.title() {
        parts.push(format!("Title: {}", title));
    }
    if let Some(artist) = tag.artist() {
        parts.push(format!("Artist: {}", artist));
    }
    if let Some(album) = tag.album() {
        parts.push(format!("Album: {}", album));
    }
    let duration = tag.duration();
    let secs = duration.as_secs();
    if secs > 0 {
        let mins = secs / 60;
        let s = secs % 60;
        parts.push(format!("Duration: {}:{:02}", mins, s));
    }

    let summary = if parts.is_empty() {
        "Media file (no metadata)".to_string()
    } else {
        parts.join(", ")
    };

    Ok(ExtractedContext {
        hint: FileHint::Media,
        summary,
        media: vec![],
    })
}

fn fallback(meta: &std::fs::Metadata, ext: &str) -> ExtractedContext {
    let size_mb = meta.len() / (1024 * 1024);
    let type_name = match ext {
        "mp3" => "MP3 audio",
        "mp4" => "MP4 video",
        "m4a" => "AAC audio",
        "m4v" => "MP4 video",
        "flac" => "FLAC audio",
        "ogg" => "OGG audio",
        "wav" => "WAV audio",
        "aac" => "AAC audio",
        "wma" => "WMA audio",
        "mkv" | "mka" => "Matroska media",
        "webm" => "WebM media",
        "avi" => "AVI video",
        _ => "Media file",
    };
    ExtractedContext {
        hint: FileHint::Media,
        summary: format!("{} ({}MB)", type_name, size_mb),
        media: vec![],
    }
}
