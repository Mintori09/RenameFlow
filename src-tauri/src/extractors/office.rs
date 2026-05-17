use super::{ExtractedContext, FileHint};
use std::io::BufReader;
use std::path::Path;

const MAX_EXTRACT_SIZE: u64 = 10 * 1024 * 1024;

pub async fn extract(path: &Path, meta: &std::fs::Metadata, ext: &str) -> ExtractedContext {
    if meta.len() > MAX_EXTRACT_SIZE || meta.len() == 0 {
        return fallback(meta, ext);
    }

    let path = path.to_path_buf();
    let ext = ext.to_string();

    let ext_clone = ext.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        match ext_clone.as_str() {
            "docx" => extract_docx_text(&path),
            "xlsx" => extract_xlsx_info(&path),
            "pptx" => extract_pptx_info(&path),
            _ => Err("Unsupported format".into()),
        }
    })
    .await;

    match result {
        Ok(Ok(text)) => {
            let trimmed = text.trim();
            let summary = if trimmed.len() > 2000 {
                format!("{}... ({} chars total)", &trimmed[..2000], trimmed.len())
            } else {
                trimmed.to_string()
            };
            ExtractedContext {
                hint: FileHint::Document,
                summary,
                media: vec![],
            }
        }
        _ => fallback(meta, &ext),
    }
}

fn extract_docx_text(path: &Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Cannot open docx: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Cannot read docx archive: {}", e))?;

    let doc_xml = archive
        .by_name("word/document.xml")
        .map_err(|_| "No word/document.xml in docx".to_string())?;

    let mut reader =
        quick_xml::Reader::from_reader(BufReader::new(doc_xml));
    let mut text = String::new();
    let mut in_t = false;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                if e.name().as_ref() == b"w:t" {
                    in_t = true;
                }
            }
            Ok(quick_xml::events::Event::Text(ref e)) if in_t => {
                if let Ok(s) = e.unescape() {
                    text.push_str(&s);
                    text.push(' ');
                }
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                if e.name().as_ref() == b"w:t" {
                    in_t = false;
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(format!("XML parse error: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    if text.trim().is_empty() {
        Err("No text content found in docx".to_string())
    } else {
        Ok(text)
    }
}

fn extract_xlsx_info(path: &Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Cannot open xlsx: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Cannot read xlsx archive: {}", e))?;

    let mut sheet_names = Vec::new();

    let workbook = archive.by_name("xl/workbook.xml");
    if let Ok(workbook) = workbook {
        let mut reader =
            quick_xml::Reader::from_reader(BufReader::new(workbook));
        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(quick_xml::events::Event::Start(ref e))
                | Ok(quick_xml::events::Event::Empty(ref e)) => {
                    if e.name().as_ref() == b"sheet" {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"name" {
                                if let Ok(v) = attr.unescape_value() {
                                    sheet_names.push(v.to_string());
                                }
                            }
                        }
                    }
                }
                Ok(quick_xml::events::Event::Eof) => break,
                Err(e) => return Err(format!("XML parse error: {}", e)),
                _ => {}
            }
            buf.clear();
        }
    }

    if sheet_names.is_empty() {
        Ok("Excel spreadsheet (no sheet names found)".to_string())
    } else {
        Ok(format!(
            "Excel spreadsheet with {} sheet(s): {}",
            sheet_names.len(),
            sheet_names.join(", ")
        ))
    }
}

fn extract_pptx_info(path: &Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Cannot open pptx: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Cannot read pptx archive: {}", e))?;

    let mut slide_count = 0;
    let mut titles = Vec::new();

    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|_| "Cannot read entry")?;
        let name = entry.name().to_string();
        if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
            slide_count += 1;
        }
    }

    if slide_count == 0 {
        return Ok("PowerPoint presentation (no slides found)".to_string());
    }

    for i in 1..=slide_count.min(5) {
        let path = format!("ppt/slides/slide{}.xml", i);
        if let Ok(slide) = archive.by_name(&path) {
            let mut reader =
                quick_xml::Reader::from_reader(BufReader::new(slide));
            let mut in_t = false;
            let mut slide_text = String::new();
            let mut buf = Vec::new();

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(quick_xml::events::Event::Start(ref e)) => {
                        if e.name().as_ref() == b"a:t" {
                            in_t = true;
                        }
                    }
                    Ok(quick_xml::events::Event::Text(ref e)) if in_t => {
                        if let Ok(s) = e.unescape() {
                            slide_text.push_str(&s);
                            slide_text.push(' ');
                        }
                    }
                    Ok(quick_xml::events::Event::End(ref e)) => {
                        if e.name().as_ref() == b"a:t" {
                            in_t = false;
                        }
                    }
                    Ok(quick_xml::events::Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }

            let title = slide_text.trim();
            if !title.is_empty() {
                titles.push(title.to_string());
            }
        }
    }

    let summary = if titles.is_empty() {
        format!("PowerPoint presentation with {} slide(s)", slide_count)
    } else {
        format!(
            "PowerPoint presentation with {} slide(s). Titles: {}",
            slide_count,
            titles.join(" | ")
        )
    };

    Ok(summary)
}

fn fallback(meta: &std::fs::Metadata, ext: &str) -> ExtractedContext {
    let size_kb = meta.len() / 1024;
    let type_name = match ext {
        "docx" => "Word document",
        "xlsx" => "Excel spreadsheet",
        "pptx" => "PowerPoint presentation",
        _ => "Office document",
    };
    ExtractedContext {
        hint: FileHint::Document,
        summary: format!("{} ({}KB)", type_name, size_kb),
        media: vec![],
    }
}
