use std::time::Duration;

/// Helper: check if Ollama is reachable at the given base URL.
async fn ollama_available(base_url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .ok();
    let client = match client {
        Some(c) => c,
        None => return false,
    };
    client
        .get(format!("{}/api/tags", base_url.trim_end_matches('/')))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// Check if a model is available in Ollama.
async fn ollama_model_available(base_url: &str, model: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .ok();
    let client = match client {
        Some(c) => c,
        None => return false,
    };
    let resp = client
        .get(format!("{}/api/tags", base_url.trim_end_matches('/')))
        .send()
        .await;
    match resp {
        Ok(r) => {
            let body: serde_json::Value = r.json().await.unwrap_or_default();
            body["models"]
                .as_array()
                .map(|models| models.iter().any(|m| m["name"].as_str() == Some(model)))
                .unwrap_or(false)
        }
        Err(_) => false,
    }
}

/// Integration test: rename a single file via Ollama.
///
/// Requires:
///   - Ollama running at http://localhost:11434
///   - Model `devstral-2:123b-cloud` pulled
///
/// Run with: cargo test --manifest-path src-tauri/Cargo.toml --test ollama_test -- --ignored --nocapture
#[tokio::test]
#[ignore]
async fn test_ollama_rename_single_file() {
    let base_url = "http://localhost:11434";
    let model = "devstral-2:123b-cloud";

    if !ollama_available(base_url).await {
        eprintln!("SKIP: Ollama not reachable at {}", base_url);
        return;
    }
    if !ollama_model_available(base_url, model).await {
        eprintln!("SKIP: Model '{}' not found in Ollama", model);
        return;
    }

    let result = renameflow_lib::ai::generate_name(
        "ollama",
        base_url,
        "",
        model,
        "DSC_1234",
        "Rename this photo to something descriptive",
        "",
    )
    .await;

    match result {
        Ok(resp) => {
            let name = resp.name.unwrap_or_default();
            let reason = resp.reason.unwrap_or_default();
            eprintln!("OK  name={:?}  reason={:?}", name, reason);
            assert!(!name.is_empty(), "AI returned empty name");
            assert!(!reason.is_empty(), "AI returned empty reason");
        }
        Err(e) => {
            panic!("Ollama rename failed: {}", e);
        }
    }
}

/// Integration test: rename with language and max-words constraints.
#[tokio::test]
#[ignore]
async fn test_ollama_rename_with_options() {
    let base_url = "http://localhost:11434";
    let model = "devstral-2:123b-cloud";

    if !ollama_available(base_url).await {
        eprintln!("SKIP: Ollama not reachable at {}", base_url);
        return;
    }
    if !ollama_model_available(base_url, model).await {
        eprintln!("SKIP: Model '{}' not found in Ollama", model);
        return;
    }

    let options_system = "[Language: vietnamese, Maximum 3 words]";

    let result = renameflow_lib::ai::generate_name(
        "ollama",
        base_url,
        "",
        model,
        "IMG_2024_Summer_Vacation_001",
        "Đặt tên tiếng Việt cho file này",
        options_system,
    )
    .await;

    match result {
        Ok(resp) => {
            let name = resp.name.unwrap_or_default();
            let reason = resp.reason.unwrap_or_default();
            eprintln!("OK  name={:?}  reason={:?}", name, reason);
            assert!(!name.is_empty(), "AI returned empty name");
        }
        Err(e) => {
            panic!("Ollama rename with options failed: {}", e);
        }
    }
}

/// Integration test: stress the json parser with a multi-line prompt
/// to make sure the AI always returns parseable JSON.
#[tokio::test]
#[ignore]
async fn test_ollama_json_parsing() {
    let base_url = "http://localhost:11434";
    let model = "devstral-2:123b-cloud";

    if !ollama_available(base_url).await {
        eprintln!("SKIP: Ollama not reachable at {}", base_url);
        return;
    }
    if !ollama_model_available(base_url, model).await {
        eprintln!("SKIP: Model '{}' not found in Ollama", model);
        return;
    }

    let names = ["main.rs", "budget_2024_final_v3.xlsx", "Screen Shot 2024-01-15 at 14.30.22.png"];

    for file_name in names {
        let prompt = format!(
            "Original file name: {}\n\nSuggest a better name.",
            file_name
        );
        let result = renameflow_lib::ai::generate_name(
            "ollama",
            base_url,
            "",
            model,
            file_name,
            &prompt,
            "",
        )
        .await;

        match result {
            Ok(resp) => {
                let name = resp.name.unwrap_or_default();
                let reason = resp.reason.unwrap_or_default();
                eprintln!("OK  {} -> name={:?}  reason={:?}", file_name, name, reason);
                assert!(!name.is_empty(), "Empty name for {}", file_name);
            }
            Err(e) => {
                panic!("Failed for '{}': {}", file_name, e);
            }
        }
    }
}
