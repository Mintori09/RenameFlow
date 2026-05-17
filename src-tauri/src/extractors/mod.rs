pub mod binary;
pub mod image;
pub mod media;
pub mod office;
pub mod text;

use std::path::Path;

#[derive(Debug, Clone)]
pub enum FileHint {
    Text,
    Image,
    Document,
    Media,
    Binary,
}

#[derive(Debug, Clone)]
pub struct MediaInput {
    pub mime_type: String,
    pub base64_data: String,
}

#[derive(Debug, Clone)]
pub struct ExtractedContext {
    pub hint: FileHint,
    pub summary: String,
    pub media: Vec<MediaInput>,
}

pub async fn extract(path: &Path) -> ExtractedContext {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let meta = match tokio::fs::metadata(path).await {
        Ok(m) => m,
        Err(_) => {
            return ExtractedContext {
                hint: FileHint::Binary,
                summary: String::new(),
                media: vec![],
            }
        }
    };

    let is_text_ext = matches!(
        ext.as_str(),
        "txt"
            | "md"
            | "rst"
            | "rtf"
            | "log"
            | "csv"
            | "tsv"
            | "json"
            | "xml"
            | "yaml"
            | "yml"
            | "toml"
            | "ini"
            | "cfg"
            | "conf"
            | "env"
            | "rs"
            | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "py"
            | "rb"
            | "go"
            | "java"
            | "c"
            | "cpp"
            | "h"
            | "hpp"
            | "cs"
            | "swift"
            | "kt"
            | "scala"
            | "php"
            | "pl"
            | "lua"
            | "sh"
            | "bash"
            | "zsh"
            | "fish"
            | "ps1"
            | "bat"
            | "cmd"
            | "sql"
            | "r"
            | "m"
            | "dart"
            | "zig"
            | "nim"
            | "clj"
            | "cljs"
            | "edn"
            | "ex"
            | "exs"
            | "erl"
            | "hs"
            | "lhs"
            | "sml"
            | "ml"
            | "mli"
            | "vue"
            | "svelte"
            | "astro"
            | "sass"
            | "scss"
            | "less"
            | "styl"
            | "css"
            | "makefile"
            | "dockerfile"
            | "cmake"
            | "gradle"
    );

    if is_text_ext {
        return text::extract(path, &meta).await;
    }

    let is_image_ext = matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "tiff" | "tif" | "ico" | "heic" | "heif" | "avif"
    );

    if is_image_ext {
        return image::extract(path, &meta).await;
    }

    let is_document_ext = matches!(ext.as_str(), "docx" | "xlsx" | "pptx");

    if is_document_ext {
        return office::extract(path, &meta, &ext).await;
    }

    let is_media_ext = matches!(
        ext.as_str(),
        "mp4" | "m4a" | "m4v" | "mp3" | "flac" | "ogg" | "wav" | "aac" | "wma" | "mka" | "mkv" | "webm" | "avi"
    );

    if is_media_ext {
        return media::extract(path, &meta, &ext).await;
    }

    binary::extract(path, &meta, &ext).await
}
