# Dynamic Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded 5-provider dropdown with user-managed providers persisted to a JSON config file.

**Architecture:** Rust backend stores providers in `{app_data_dir}/providers.json` with load/save Tauri commands. Frontend Settings page shows a list of providers with +/- buttons, modal for adding, and an active provider dropdown. `ai.rs` simplified from 5 provider types to 3 (`openai-compatible`, `anthropic`, `google`).

**Tech Stack:** Rust/Tauri v2, React 19/TypeScript, Zustand

---

### Task 1: Add Provider/ProviderConfig to models.rs

**Files:**

- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Add Provider and ProviderConfig structs**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub active_provider: String,
    pub providers: Vec<Provider>,
}
```

Add after the last existing struct (`DirEntry`) before end of file.

- [ ] **Step 2: Build check**

Run: `cargo check` in `src-tauri/`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat: add Provider and ProviderConfig structs"
```

---

### Task 2: Create providers.rs module

**Files:**

- Create: `src-tauri/src/providers.rs`

- [ ] **Step 1: Write providers.rs**

```rust
use crate::models::{Provider, ProviderConfig};

fn get_providers_file_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    path.push("providers.json");
    path
}

pub fn load_providers(app_handle: &tauri::AppHandle) -> ProviderConfig {
    let path = get_providers_file_path(app_handle);
    if !path.exists() {
        let default = ProviderConfig {
            active_provider: "default".to_string(),
            providers: vec![Provider {
                name: "default".to_string(),
                provider_type: "openai-compatible".to_string(),
                base_url: "http://localhost:11434".to_string(),
                api_key: String::new(),
                model: String::new(),
            }],
        };
        let _ = save_providers_inner(app_handle, &default);
        return default;
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_else(|_| ProviderConfig {
        active_provider: "default".to_string(),
        providers: vec![],
    })
}

fn save_providers_inner(
    app_handle: &tauri::AppHandle,
    config: &ProviderConfig,
) -> Result<(), String> {
    let path = get_providers_file_path(app_handle);
    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("Serialize error: {}", e))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    std::fs::write(&path, content).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

pub fn save_providers(
    app_handle: &tauri::AppHandle,
    config: &ProviderConfig,
) -> Result<(), String> {
    save_providers_inner(app_handle, config)
}

pub fn get_providers_path(app_handle: &tauri::AppHandle) -> String {
    get_providers_file_path(app_handle).to_string_lossy().to_string()
}
```

- [ ] **Step 2: Build check**

Run: `cargo check`
Expected: Compiles (may fail since not registered in lib.rs yet — that's fine)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/providers.rs
git commit -m "feat: add providers.rs load/save module"
```

---

### Task 3: Simplify ai.rs to 3 provider types

**Files:**

- Modify: `src-tauri/src/ai.rs`

- [ ] **Step 1: Replace AiProvider enum and update dispatch**

Change the entire file content:

````rust
use crate::models::AiResponse;
use reqwest::Client;

pub enum AiProvider {
    OpenAiCompatible,
    Anthropic,
    Google,
}

impl AiProvider {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "anthropic" => AiProvider::Anthropic,
            "google" => AiProvider::Google,
            _ => AiProvider::OpenAiCompatible,
        }
    }

    fn api_endpoint(&self, base_url: &str, model: &str, api_key: &str) -> String {
        let base = base_url.trim_end_matches('/');
        match self {
            AiProvider::OpenAiCompatible => format!("{}/chat/completions", base),
            AiProvider::Anthropic => format!("{}/v1/messages", base),
            AiProvider::Google => format!(
                "{}/v1beta/models/{}:generateContent?key={}",
                base, model, api_key
            ),
        }
    }
}

fn resolve_api_key(api_key: &str, env_var: &str) -> Option<String> {
    if !api_key.is_empty() {
        Some(api_key.to_string())
    } else {
        std::env::var(env_var).ok()
    }
}

pub async fn generate_name(
    provider: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let p = AiProvider::from_str(provider);

    match p {
        AiProvider::OpenAiCompatible => {
            let endpoint = p.api_endpoint(base_url, model, api_key);
            call_openai_compatible(&client, &endpoint, api_key, model, file_name, user_prompt)
                .await
        }
        AiProvider::Anthropic => {
            let endpoint = p.api_endpoint(base_url, model, api_key);
            call_anthropic(&client, &endpoint, api_key, model, file_name, user_prompt).await
        }
        AiProvider::Google => {
            let resolved_key = resolve_api_key(api_key, "GOOGLE_API_KEY")
                .ok_or_else(|| "Google API key required. Set GOOGLE_API_KEY env var or enter in settings.".to_string())?;
            let endpoint = p.api_endpoint(base_url, model, &resolved_key);
            call_google(&client, &endpoint, file_name, user_prompt).await
        }
    }
}

fn system_prompt_from(user_prompt: &str, file_name: &str) -> String {
    format!("{}\n\nOriginal file name: {}", user_prompt, file_name)
}

fn build_system_prompt() -> &'static str {
    "You are a file renaming assistant. Generate a short, clear, descriptive filename based on the file content. Return ONLY valid JSON with fields \"name\" (the filename without extension) and \"reason\" (why you chose it). No markdown, no explanation. Use lowercase, hyphens between words, maximum 8 words. Avoid generic names like image, file, document, screenshot."
}

async fn call_openai_compatible(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": system_prompt_from(user_prompt, file_name)}
        ],
        "temperature": 0.1,
        "max_tokens": 100
    });

    let mut req = client.post(endpoint).json(&body);
    if let Some(key) = resolve_api_key(api_key, "OPENAI_API_KEY") {
        req = req.bearer_auth(key);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("OpenAI-compatible request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let response_text = raw["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    parse_ai_json(response_text)
}

async fn call_anthropic(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let key = resolve_api_key(api_key, "ANTHROPIC_API_KEY").ok_or_else(|| {
        "Anthropic API key required. Set ANTHROPIC_API_KEY env var or enter in settings."
            .to_string()
    })?;

    let body = serde_json::json!({
        "model": model,
        "system": build_system_prompt(),
        "messages": [
            {"role": "user", "content": system_prompt_from(user_prompt, file_name)}
        ],
        "max_tokens": 100,
        "temperature": 0.1
    });

    let resp = client
        .post(endpoint)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    let response_text = raw["content"][0]["text"].as_str().unwrap_or("");
    parse_ai_json(response_text)
}

async fn call_google(
    client: &Client,
    endpoint: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let body = serde_json::json!({
        "system_instruction": {
            "parts": [{"text": build_system_prompt()}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": system_prompt_from(user_prompt, file_name)}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 100
        }
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Google AI request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Google AI response: {}", e))?;

    let response_text = raw["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("");
    parse_ai_json(response_text)
}

fn parse_ai_json(text: &str) -> Result<AiResponse, String> {
    if let Ok(resp) = serde_json::from_str::<AiResponse>(text) {
        return Ok(resp);
    }

    if let Some(start) = text.find("```json") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            let json_str = after[..end].trim();
            if let Ok(resp) = serde_json::from_str::<AiResponse>(json_str) {
                return Ok(resp);
            }
        }
    }

    if let Some(start) = text.find('{') {
        if let Some(end) = text[start..].rfind('}') {
            let json_str = &text[start..start + end + 1];
            if let Ok(resp) = serde_json::from_str::<AiResponse>(json_str) {
                return Ok(resp);
            }
        }
    }

    Err(format!("Could not parse AI response as JSON: {}", text))
}
````

Key changes:

- `AiProvider` enum: 3 variants instead of 5
- `from_str`: "openai-compatible" and everything else → `OpenAiCompatible`
- `api_endpoint`: takes (base_url, model, api_key) now since Google needs api_key in URL; `OpenAiCompatible` → `{base}/chat/completions`; `Anthropic` → `{base}/v1/messages`; `Google` → `{base}/v1beta/models/{model}:generateContent?key={api_key}`
- Removed: `call_ollama`, `call_lm_studio`, `call_openai`
- New: `call_openai_compatible` (merges LM Studio body format + OpenAI auth)
- `build_system_prompt()` extracted as shared helper

- [ ] **Step 2: Build check**

Run: `cargo check`
Expected: Compiles (may still fail since commands.rs references old structure — that's fine)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/ai.rs
git commit -m "refactor: simplify ai.rs to 3 provider types"
```

---

### Task 4: Update commands.rs — add provider commands + simplify get_available_models

**Files:**

- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Add `use crate::providers;`**

```rust
use crate::ai;
use crate::history;
use crate::models::*;
use crate::providers;
use crate::rename;
use crate::sanitize;
use std::collections::HashSet;
```

- [ ] **Step 2: Add 3 provider commands after `list_directory`**

```rust
#[tauri::command]
pub fn load_providers(app_handle: tauri::AppHandle) -> ProviderConfig {
    providers::load_providers(&app_handle)
}

#[tauri::command]
pub fn save_providers(
    app_handle: tauri::AppHandle,
    config: ProviderConfig,
) -> Result<(), String> {
    providers::save_providers(&app_handle, &config)
}

#[tauri::command]
pub fn get_providers_path(app_handle: tauri::AppHandle) -> String {
    providers::get_providers_path(&app_handle)
}
```

- [ ] **Step 3: Simplify `get_available_models` to 3 branches**

Replace the match statement body of `get_available_models` (lines 149-332):

```rust
    match provider.to_lowercase().as_str() {
        "openai-compatible" | "openai_compatible" => {
            if base_url.is_empty() {
                return Err("Base URL is required.".to_string());
            }
            let mut req = client.get(format!("{}/models", base_url.trim_end_matches('/')));
            if !api_key.is_empty() {
                req = req.bearer_auth(&api_key);
            } else if let Ok(key) = std::env::var("OPENAI_API_KEY") {
                req = req.bearer_auth(key);
            }

            let resp = req
                .send()
                .await
                .map_err(|e| format!("Failed to fetch models: {}", e))?;

            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let models = raw["data"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            m["id"].as_str().map(|n| ModelInfo {
                                name: n.to_string(),
                                label: None,
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Ok(models)
        }
        "anthropic" => {
            if base_url.is_empty() {
                return Err("Base URL is required.".to_string());
            }
            let key = if !api_key.is_empty() {
                api_key
            } else {
                std::env::var("ANTHROPIC_API_KEY").map_err(|_| {
                    "Anthropic API key required. Set ANTHROPIC_API_KEY env var or enter in settings."
                        .to_string()
                })?
            };

            let resp = client
                .get(format!("{}/v1/models", base_url.trim_end_matches('/')))
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Failed to fetch Anthropic models: {}", e))?;

            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let models = raw["data"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            m["id"].as_str().map(|n| ModelInfo {
                                name: n.to_string(),
                                label: None,
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Ok(models)
        }
        "google" => {
            if base_url.is_empty() {
                return Err("Base URL is required.".to_string());
            }
            let key = if !api_key.is_empty() {
                api_key
            } else {
                std::env::var("GOOGLE_API_KEY").map_err(|_| {
                    "Google API key required. Set GOOGLE_API_KEY env var or enter in settings."
                        .to_string()
                })?
            };

            let resp = client
                .get(format!(
                    "{}/v1beta/models?key={}",
                    base_url.trim_end_matches('/'),
                    key
                ))
                .send()
                .await
                .map_err(|e| format!("Failed to fetch Google models: {}", e))?;

            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let models = raw["models"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            m["name"].as_str().and_then(|n| {
                                n.strip_prefix("models/").map(|stripped| ModelInfo {
                                    name: stripped.to_string(),
                                    label: None,
                                })
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Ok(models)
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
```

- [ ] **Step 4: Build check**

Run: `cargo check`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: add provider commands, simplify get_available_models"
```

---

### Task 5: Update lib.rs

**Files:**

- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `mod providers;` and register 3 commands**

```rust
mod ai;
mod commands;
mod history;
mod models;
mod providers;
mod rename;
mod sanitize;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::generate_rename_suggestions,
            commands::rename_files,
            commands::undo_last_rename,
            commands::get_available_models,
            commands::load_rename_history,
            commands::list_directory,
            commands::load_providers,
            commands::save_providers,
            commands::get_providers_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Build check + run tests**

Run: `cargo check && cargo test`
Expected: Compiles, all 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register providers module and commands"
```

---

### Task 6: Update frontend types.ts

**Files:**

- Modify: `src/types.ts`

- [ ] **Step 1: Change ProviderType and add Provider/ProviderConfig**

Replace `ProviderType` line and add new types after `DirEntry`:

Change:

```typescript
export type ProviderType =
  | "ollama"
  | "lm-studio"
  | "openai"
  | "anthropic"
  | "google";
```

To:

```typescript
export type ProviderType = "openai-compatible" | "anthropic" | "google";
```

Also update `AppSettings` to remove the flat `provider` field (it will be derived from the active provider config). Wait — actually, looking at the current AppSettings and how it's used, the `provider` field is referenced in the store and in ConfigBar/App.tsx. The spec says "copy the provider's model/baseUrl/apiKey into the flat store state so existing consumers work unchanged." So `provider` should stay as a flat field — it gets set when `switchProvider()` copies the active provider's `providerType` value into it.

So actually, `AppSettings.provider` stays, we just change the `ProviderType` union. And add `Provider`/`ProviderConfig` at the bottom.

```typescript
export type Provider = {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ProviderConfig = {
  activeProvider: string;
  providers: Provider[];
};
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: TypeScript compiles (might have errors from SettingsSection.tsx depending on its current state — that's fine)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: update types for dynamic providers"
```

---

### Task 7: Rewrite settingsStore.ts with provider management

**Files:**

- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: Write new store with providers state and actions**

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  ProviderType,
  FilenameStyle,
  Language,
  Provider,
  ProviderConfig,
} from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai-compatible" as ProviderType,
  model: "",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  prompt:
    "Rename the file based on its content. Keep it short, descriptive, lowercase, and use hyphens.",
  style: "kebab-case" as FilenameStyle,
  maxWords: 8,
  language: "english" as Language,
};

type SettingsStore = AppSettings & {
  providers: Provider[];
  activeProviderName: string;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadProviders: (config: ProviderConfig) => void;
  addProvider: (provider: Provider) => void;
  removeProvider: (name: string) => void;
  switchProvider: (name: string) => void;
  persistProviders: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  providers: [],
  activeProviderName: "",

  updateSettings: (partial) => set(partial),

  resetSettings: () => set(DEFAULT_SETTINGS),

  loadProviders: (config: ProviderConfig) => {
    set({
      providers: config.providers,
      activeProviderName: config.activeProvider,
    });
    const active = config.providers.find(
      (p) => p.name === config.activeProvider,
    );
    if (active) {
      set({
        provider: active.providerType,
        model: active.model,
        baseUrl: active.baseUrl,
        apiKey: active.apiKey,
      });
    }
  },

  addProvider: (provider: Provider) => {
    set((state) => ({
      providers: [...state.providers, provider],
    }));
  },

  removeProvider: (name: string) => {
    const state = get();
    const remaining = state.providers.filter((p) => p.name !== name);
    let newActive = state.activeProviderName;
    if (name === state.activeProviderName) {
      const first = remaining[0];
      if (first) {
        newActive = first.name;
        set({
          provider: first.providerType,
          model: first.model,
          baseUrl: first.baseUrl,
          apiKey: first.apiKey,
        });
      } else {
        newActive = "";
      }
    }
    set({ providers: remaining, activeProviderName: newActive });
  },

  switchProvider: (name: string) => {
    const state = get();
    const provider = state.providers.find((p) => p.name === name);
    if (provider) {
      set({
        activeProviderName: name,
        provider: provider.providerType,
        model: provider.model,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
      });
    }
  },

  persistProviders: async () => {
    const state = get();
    const config: ProviderConfig = {
      activeProvider: state.activeProviderName,
      providers: state.providers,
    };
    try {
      await invoke("save_providers", { config });
    } catch (err) {
      console.error("Failed to save providers:", err);
    }
  },
}));
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: TypeScript compiles

- [ ] **Step 3: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat: add provider management to settings store"
```

---

### Task 8: Rewrite SettingsSection.tsx

**Files:**

- Modify: `src/components/SettingsSection.tsx`

- [ ] **Step 1: Write new SettingsSection with provider list**

```tsx
import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { ProviderConfig } from "../types";
import { AddProviderModal } from "./AddProviderModal";

export function SettingsSection() {
  const settings = useSettingsStore();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const [config, _path] = await Promise.all([
          invoke<ProviderConfig>("load_providers"),
          invoke<string>("get_providers_path"),
        ]);
        settings.loadProviders(config);
      } catch {
        // defaults apply
      }
    }
    init();
  }, []);

  async function handleRemove(name: string) {
    settings.removeProvider(name);
    await settings.persistProviders();
  }

  async function handleSwitch(name: string) {
    settings.switchProvider(name);
    await settings.persistProviders();
  }

  const PROVIDER_DEFAULTS: Record<string, string> = {
    "openai-compatible": "http://localhost:11434",
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com",
  };

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <div className="config-group">
          <label className="config-label">Active Provider</label>
          <select
            className="config-select"
            value={settings.activeProviderName}
            onChange={(e) => handleSwitch(e.target.value)}
          >
            {settings.providers.length === 0 && (
              <option value="">No providers</option>
            )}
            {settings.providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="config-group">
          <label className="config-label">Providers</label>
          <div className="provider-list">
            {settings.providers.map((p) => (
              <div key={p.name} className="provider-item">
                <div className="provider-item-info">
                  <span className="provider-item-name">{p.name}</span>
                  <span className="provider-item-type">{p.providerType}</span>
                  <span className="provider-item-model">
                    {p.model || "no model"}
                  </span>
                </div>
                <button
                  className="provider-item-remove"
                  onClick={() => handleRemove(p.name)}
                  title="Remove provider"
                >
                  &minus;
                </button>
              </div>
            ))}
          </div>
          <button
            className="provider-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add Provider
          </button>
        </div>

        <hr className="settings-divider" />

        <div className="config-group">
          <label className="config-label">Prompt</label>
          <textarea
            className="config-textarea"
            rows={3}
            value={settings.prompt}
            onChange={(e) =>
              settings.updateSettings({ prompt: e.target.value })
            }
          />
        </div>

        <div className="config-group">
          <label className="config-label">Filename Style</label>
          <select
            className="config-select"
            value={settings.style}
            onChange={(e) =>
              settings.updateSettings({ style: e.target.value as any })
            }
          >
            <option value="kebab-case">kebab-case</option>
            <option value="snake_case">snake_case</option>
            <option value="title-case">Title Case</option>
            <option value="camelCase">camelCase</option>
          </select>
        </div>

        <div className="config-group">
          <label className="config-label">Max Words</label>
          <input
            className="config-input"
            type="number"
            value={settings.maxWords}
            onChange={(e) =>
              settings.updateSettings({
                maxWords: parseInt(e.target.value) || 8,
              })
            }
            min={1}
            max={20}
          />
        </div>

        <div className="config-group">
          <label className="config-label">Language</label>
          <select
            className="config-select"
            value={settings.language}
            onChange={(e) =>
              settings.updateSettings({ language: e.target.value as any })
            }
          >
            <option value="english">English</option>
            <option value="vietnamese">Vietnamese</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>

      {showAddModal && (
        <AddProviderModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
```

Note: I removed the old `handleProviderChange`/`PROVIDER_DEFAULTS`/`AUTH_REQUIRED` patterns since provider fields are now per-provider in the config. The global settings section only shows prompt, style, maxWords, language.

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: TypeScript compiles (AddProviderModal not yet created, but SettingsSection imports it — will error)

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsSection.tsx
git commit -m "feat: rewrite SettingsSection with dynamic provider list"
```

---

### Task 9: Create AddProviderModal component

**Files:**

- Create: `src/components/AddProviderModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { Provider, ProviderType } from "../types";

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  "openai-compatible": "http://localhost:11434",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
};

const AUTH_REQUIRED: Record<ProviderType, boolean> = {
  "openai-compatible": false,
  anthropic: true,
  google: true,
};

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

export function AddProviderModal({ onClose, onAdded }: Props) {
  const { providers, addProvider, persistProviders, switchProvider } =
    useSettingsStore();
  const [name, setName] = useState("");
  const [providerType, setProviderType] =
    useState<ProviderType>("openai-compatible");
  const [baseUrl, setBaseUrl] = useState(
    DEFAULT_BASE_URLS["openai-compatible"],
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  function handleTypeChange(type: string) {
    const t = type as ProviderType;
    setProviderType(t);
    if (!baseUrl || baseUrl === DEFAULT_BASE_URLS[providerType]) {
      setBaseUrl(DEFAULT_BASE_URLS[t]);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    const provider: Provider = {
      name: name.trim(),
      providerType,
      baseUrl: baseUrl.trim(),
      apiKey,
      model: model.trim(),
    };
    addProvider(provider);
    switchProvider(provider.name);
    await persistProviders();
    onAdded();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add Provider</h3>

        <div className="modal-field">
          <label className="config-label">Name</label>
          <input
            className="config-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Ollama"
          />
        </div>

        <div className="modal-field">
          <label className="config-label">Type</label>
          <select
            className="config-select"
            value={providerType}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
          </select>
        </div>

        <div className="modal-field">
          <label className="config-label">Base URL</label>
          <input
            className="config-input"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        {AUTH_REQUIRED[providerType] && (
          <div className="modal-field">
            <label className="config-label">API Key</label>
            <input
              className="config-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to use env var"
            />
          </div>
        )}

        <div className="modal-field">
          <label className="config-label">Model</label>
          <input
            className="config-input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. llama3.2, gpt-4o"
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-add"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: TypeScript compiles

- [ ] **Step 3: Commit**

```bash
git add src/components/AddProviderModal.tsx
git commit -m "feat: add AddProviderModal component"
```

---

### Task 10: Add CSS for provider list, modal, and settings divider

**Files:**

- Modify: `src/App.css`

- [ ] **Step 1: Add styles before the History section**

Find `/* ===== History ===== */` and add before it:

```css
/* ===== Provider List ===== */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.provider-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
}

.provider-item-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.85rem;
}

.provider-item-name {
  font-weight: 600;
}

.provider-item-type {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.provider-item-model {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-family: monospace;
}

.provider-item-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-danger, #e53e3e);
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0 0.25rem;
  line-height: 1;
}

.provider-item-remove:hover {
  opacity: 0.7;
}

.provider-add-btn {
  width: 100%;
  padding: 0.4rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--color-text-muted);
}

.provider-add-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* ===== Settings Divider ===== */
.settings-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 1rem 0;
}

/* ===== Modal ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: white;
  border-radius: var(--radius-md);
  padding: 1.5rem;
  min-width: 360px;
  max-width: 480px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.modal-btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-strong);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  background: white;
  color: var(--color-text);
}

.modal-btn-add {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.modal-btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Also add a `--color-bg-subtle` CSS variable if not already defined. Check the `:root` block — if `--color-bg-subtle` doesn't exist, add it alongside the other color variables:

```css
--color-bg-subtle: #f7f8fa;
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: Vite builds successfully

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "style: add provider list, modal, and settings divider CSS"
```

---

### Implementation order

| Task | Description          | Depends on |
| ---- | -------------------- | ---------- |
| 1    | models.rs structs    | —          |
| 2    | providers.rs module  | 1          |
| 3    | ai.rs simplification | —          |
| 4    | commands.rs updates  | 1, 2, 3    |
| 5    | lib.rs registration  | 2, 4       |
| 6    | types.ts updates     | —          |
| 7    | settingsStore.ts     | 6          |
| 8    | SettingsSection.tsx  | 7          |
| 9    | AddProviderModal.tsx | 7          |
| 10   | CSS styles           | —          |
