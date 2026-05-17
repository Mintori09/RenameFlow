use super::{ExtractedContext, FileHint, MediaInput};
use base64::Engine;
use image::GenericImageView;
use std::path::Path;

const MAX_DIM: u32 = 1024;
const JPEG_QUALITY: u8 = 70;
const MAX_FILE_SIZE: u64 = 20 * 1024 * 1024;

pub async fn extract(path: &Path, meta: &std::fs::Metadata) -> ExtractedContext {
    if meta.len() > MAX_FILE_SIZE || meta.len() == 0 {
        return fallback(meta);
    }

    let path_buf = path.to_path_buf();
    let result = tokio::task::spawn_blocking(move || -> Result<ExtractedContext, String> {
        let img = image::open(&path_buf)
            .map_err(|e| format!("Cannot open image: {}", e))?;

        let (w, h) = img.dimensions();

        let resized = if w > MAX_DIM || h > MAX_DIM {
            let ratio = MAX_DIM as f64 / w.max(h) as f64;
            img.resize_exact(
                (w as f64 * ratio) as u32,
                (h as f64 * ratio) as u32,
                image::imageops::FilterType::Lanczos3,
            )
        } else {
            img
        };

        let (rw, rh) = resized.dimensions();

        let rgb = resized.to_rgb8();
        let (encode_w, encode_h) = rgb.dimensions();
        let raw_data = rgb.into_raw();

        let mut buf = Vec::new();
        {
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, JPEG_QUALITY);
            encoder
                .encode(&raw_data, encode_w, encode_h, image::ColorType::Rgb8)
                .map_err(|e| format!("Cannot encode JPEG: {}", e))?;
        }

        let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);

        Ok(ExtractedContext {
            hint: FileHint::Image,
            summary: format!("Image: {}x{} (resized from {}x{})", rw, rh, w, h),
            media: vec![MediaInput {
                mime_type: "image/jpeg".into(),
                base64_data: b64,
            }],
        })
    })
    .await;

    match result {
        Ok(Ok(ctx)) => ctx,
        _ => fallback(meta),
    }
}

fn fallback(meta: &std::fs::Metadata) -> ExtractedContext {
    let size_kb = meta.len() / 1024;
    ExtractedContext {
        hint: FileHint::Image,
        summary: format!("Image ({}KB, could not decode)", size_kb),
        media: vec![],
    }
}
