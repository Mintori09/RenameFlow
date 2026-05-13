# Multi-Model Provider Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each provider to store multiple models, add Ollama as a distinct provider type, and merge provider+model selection into a single dropdown on the Home page.

**Architecture:** Extend the existing `Provider` model to hold a `Vec<String> models` + `activeModel` instead of a single `model` string. Add Ollama as a separate `ProviderType`. Migration logic converts old `providers.json` on load. Frontend stores `activeModelId` (`"providerName::modelName"`) in settingsStore, and the ControlBar uses a single grouped `<select>` instead of separate provider+model controls.

**Tech Stack:** Rust (Tauri), TypeScript (React 19), Zustand

---

### Task 1: Update Rust data models (`models.rs` & `provider.rs`)

**Files:**
- Modify: `src-tauri/src/models.rs` — `Provider`, `ProviderConfig` structs
- Modify: `src-tauri/src/ai/provider.rs` — add `AiProvider::Ollama`

- [ ] **Step 1: Update `Provider` and `ProviderConfig` in models.rs**

Change `Provider.model: String` to:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub active_model: String,
}
```

Add `active_model_id` to `ProviderConfig`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub active_provider: String,
    pub providers: Vec<Provider>,
    pub active_model_id: String,
}
```

- [ ] **Step 2: Add `AiProvider::Ollama` in provider.rs**

```rust
pub enum AiProvider {
    OpenAiCompatible,
    Ollama,
    LmStudio,
    Anthropic,
    Google,
}

impl AiProvider {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "anthropic" => AiProvider::Anthropic,
            "google" => AiProvider::Google,
            "ollama" => AiProvider::Ollama,
            "lm-studio" | "lm_studio" => AiProvider::LmStudio,
            _ => AiProvider::OpenAiCompatible,
        }
    }
```

Also update `api_endpoint` to route `Ollama` same as `OpenAiCompatible`:
```rust
pub fn api_endpoint(&self, base_url: &str, model: &str, api_key: &str) -> String {
    let base = base_url.trim_end_matches('/');
    match self {
        AiProvider::OpenAiCompatible | AiProvider::Ollama | AiProvider::LmStudio => {
            format!("{}/chat/completions", base)
        }
        // ... rest unchanged
    }
}
```

- [ ] **Step 3: Verify with `cargo check`**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compilation succeeds.

---

### Task 2: Migration logic in `providers.rs`

**Files:**
- Modify: `src-tauri/src/providers.rs`

- [ ] **Step 4: Add migration in `load_providers()`**

```rust
use serde_json::Value;

pub fn load_providers() -> ProviderConfig {
    let path = get_providers_file_path();
    if !path.exists() {
        let default = ProviderConfig {
            active_provider: "default".to_string(),
            providers: vec![Provider {
                name: "default".to_string(),
                provider_type: "ollama".to_string(),
                base_url: "http://localhost:11434".to_string(),
                api_key: String::new(),
                models: vec![],
                active_model: String::new(),
            }],
            active_model_id: String::new(),
        };
        let _ = save_providers_inner(&default);
        return default;
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    // Try new format first
    if let Ok(config) = serde_json::from_str::<ProviderConfig>(&content) {
        return config;
    }
    // Try old format and migrate
    migrate_from_old(&content)
}

fn migrate_from_old(content: &str) -> ProviderConfig {
    let old: Value = serde_json::from_str(content).unwrap_or_default();
    let old_providers = old["providers"].as_array().cloned().unwrap_or_default();
    let old_active = old["activeProvider"].as_str().unwrap_or("").to_string();
    let mut providers = Vec::new();
    let mut active_model_id = String::new();

    for p in &old_providers {
        let name = p["name"].as_str().unwrap_or("").to_string();
        let provider_type = p["providerType"].as_str().unwrap_or("openai-compatible").to_string();
        let base_url = p["base_url"].as_str().unwrap_or("").to_string();
        let api_key = p["api_key"].as_str().unwrap_or("").to_string();
        let model = p["model"].as_str().unwrap_or("").to_string();

        // Heuristic: if type is openai-compatible and URL points to Ollama, migrate type
        let final_type = if provider_type == "openai-compatible" && base_url.contains("localhost:11434") {
            "ollama".to_string()
        } else {
            provider_type
        };

        let models = if model.is_empty() {
            vec![]
        } else {
            vec![model.clone()]
        };

        if name == old_active {
            active_model_id = if model.is_empty() {
                String::new()
            } else {
                format!("{}::{}", name, model)
            };
        }

        providers.push(Provider {
            name,
            provider_type: final_type,
            base_url,
            api_key,
            models: models.clone(),
            active_model: model.clone(),
        });
    }

    let config = ProviderConfig {
        active_provider: old_active.clone(),
        providers,
        active_model_id,
    };
    let _ = save_providers_inner(&config);
    config
}
```

Also fix the `base_url` / `baseUrl` camelCase mismatch. The JSON uses `baseUrl` but Rust deserializes `base_url`. The old struct also had `pub base_url: String` so `serde(rename_all = "camelCase")` should work. Let me check: The Provider struct has `#[serde(rename_all = "camelCase")]`. In the old format, the fields would be `baseUrl`, `apiKey`, `providerType`, etc. When reading via `Value`, we need to use the JSON keys: `p["baseUrl"]` etc.

Fix: use JSON field names in migration:
```rust
let base_url = p["baseUrl"].as_str().unwrap_or("http://localhost:11434").to_string();
let api_key = p["apiKey"].as_str().unwrap_or("").to_string();
```

- [ ] **Step 5: Verify with `cargo check`**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compilation succeeds.

---

### Task 3: Add `get_ollama_models` command

**Files:**
- Modify: `src-tauri/src/commands/model_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 6: Add command in model_commands.rs**

```rust
#[tauri::command]
pub fn get_ollama_models() -> Result<Vec<String>, String> {
    let output = std::process::Command::new("ollama")
        .args(["list"])
        .output()
        .map_err(|e| format!("Failed to run 'ollama list': {}", e))?;

    if !output.status.success() {
        return Err(format!("ollama list exited with code: {:?}", output.status.code()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .skip(1)
        .filter_map(|line| line.split_whitespace().next())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .collect())
}
```

- [ ] **Step 7: Register in lib.rs**

Add `commands::get_ollama_models` to the `invoke_handler` list:
```rust
.invoke_handler(tauri::generate_handler![
    commands::generate_rename_suggestions,
    commands::rename_files,
    commands::undo_last_rename,
    commands::get_available_models,
    commands::load_rename_history,
    commands::list_directory,
    commands::collect_files,
    commands::load_providers,
    commands::save_providers,
    commands::get_providers_path,
    commands::get_ollama_models,  // ADD THIS
])
```

- [ ] **Step 8: Verify with `cargo check`**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compilation succeeds.

---

### Task 4: Update TypeScript types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 9: Update types**

```typescript
export type ProviderType = "openai-compatible" | "anthropic" | "google" | "ollama";

export type AppSettings = {
  provider: ProviderType;
  model: string;
  baseUrl: string;
  apiKey: string;
  prompt: string;
  style: FilenameStyle;
  maxWords: number;
  language: Language;
};

export type Provider = {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string;
};

export type ProviderConfig = {
  activeProvider: string;
  providers: Provider[];
  activeModelId: string;
};

// Keep ModelInfo for get_available_models (future use)
export type ModelInfo = {
  name: string;
  label?: string;
};
```

---

### Task 5: Refactor settingsStore

**Files:**
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 10: Rewrite settingsStore**

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
  provider: "ollama" as ProviderType,
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
  activeModelId: string;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadProviders: (config: ProviderConfig) => void;
  addProvider: (provider: Provider) => void;
  removeProvider: (name: string) => void;
  addModelToProvider: (providerName: string, modelName: string) => void;
  removeModelFromProvider: (providerName: string, modelName: string) => void;
  setActiveModel: (modelId: string) => void;
  persistProviders: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  providers: [],
  activeModelId: "",

  updateSettings: (partial) => set(partial),

  resetSettings: () => set(DEFAULT_SETTINGS),

  loadProviders: (config: ProviderConfig) => {
    set({
      providers: config.providers,
      activeModelId: config.activeModelId,
    });
    // Apply active model to backward-compat fields
    if (config.activeModelId) {
      const [providerName, modelName] = config.activeModelId.split("::");
      const provider = config.providers.find(
        (p) => p.name === providerName
      );
      if (provider && modelName) {
        set({
          provider: provider.providerType,
          model: modelName,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        });
      }
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
    let newId = state.activeModelId;
    // If removed provider was active, clear activeModelId
    if (state.activeModelId.startsWith(name + "::")) {
      newId = "";
    }
    set({ providers: remaining, activeModelId: newId });
  },

  addModelToProvider: (providerName: string, modelName: string) => {
    set((state) => ({
      providers: state.providers.map((p) =>
        p.name === providerName && !p.models.includes(modelName)
          ? { ...p, models: [...p.models, modelName] }
          : p
      ),
    }));
  },

  removeModelFromProvider: (providerName: string, modelName: string) => {
    const state = get();
    const provider = state.providers.find((p) => p.name === providerName);
    if (!provider) return;

    const remaining = provider.models.filter((m) => m !== modelName);
    let newProviders = state.providers.map((p) =>
      p.name === providerName ? { ...p, models: remaining } : p
    );

    // If removed model was active, reset
    let newModelId = state.activeModelId;
    if (state.activeModelId === `${providerName}::${modelName}`) {
      if (remaining.length > 0) {
        newModelId = `${providerName}::${remaining[0]}`;
      } else {
        newModelId = "";
      }
    }

    set({ providers: newProviders, activeModelId: newModelId });
  },

  setActiveModel: (modelId: string) => {
    const [providerName, modelName] = modelId.split("::");
    const provider = get().providers.find((p) => p.name === providerName);
    if (!provider || !modelName) return;

    set({
      activeModelId: modelId,
      provider: provider.providerType,
      model: modelName,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    });
  },

  persistProviders: async () => {
    const state = get();
    const config: ProviderConfig = {
      activeProvider: state.activeModelId.split("::")[0] || "",
      providers: state.providers,
      activeModelId: state.activeModelId,
    };
    try {
      await invoke("save_providers", { config });
    } catch (err) {
      console.error("Failed to save providers:", err);
    }
  },
}));
```

- [ ] **Step 11: Verify with `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: TypeScript compiles without errors.

---

### Task 6: Update AddProviderModal

**Files:**
- Modify: `src/components/AddProviderModal.tsx`

- [ ] **Step 12: Update AddProviderModal**

Update the model field and handle `models` + `activeModel`:

```typescript
import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { Provider, ProviderType } from "../types";

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  "openai-compatible": "http://localhost:11434",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  ollama: "http://localhost:11434",
};

const AUTH_REQUIRED: Record<ProviderType, boolean> = {
  "openai-compatible": false,
  anthropic: true,
  google: true,
  ollama: false,
};

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

export function AddProviderModal({ onClose, onAdded }: Props) {
  const { addProvider, persistProviders, setActiveModel } =
    useSettingsStore();
  const [name, setName] = useState("");
  const [providerType, setProviderType] =
    useState<ProviderType>("ollama");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URLS["ollama"]);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");

  function handleTypeChange(type: string) {
    const t = type as ProviderType;
    setProviderType(t);
    setBaseUrl(DEFAULT_BASE_URLS[t]);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    const modelList = models
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const firstModel = modelList[0] || "";
    const provider: Provider = {
      name: name.trim(),
      providerType,
      baseUrl: baseUrl.trim(),
      apiKey,
      models: modelList,
      activeModel: firstModel,
    };
    addProvider(provider);
    if (firstModel) {
      setActiveModel(`${provider.name}::${firstModel}`);
    }
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
            <option value="ollama">Ollama</option>
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
          <label className="config-label">Models</label>
          <input
            className="config-input"
            type="text"
            value={models}
            onChange={(e) => setModels(e.target.value)}
            placeholder="llama3.2, mistral, codellama (comma-separated)"
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

- [ ] **Step 13: Verify with `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: TypeScript compiles without errors.

---

### Task 7: Update SettingsSection with model management UI

**Files:**
- Modify: `src/components/SettingsSection.tsx`

- [ ] **Step 14: Update SettingsSection**

Remove the "Active Provider" dropdown. Update provider cards to show model list with add/remove, and "Fetch from Ollama" button for ollama type.

```typescript
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
        const [config] = await Promise.all([
          invoke<ProviderConfig>("load_providers"),
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

  async function handleAddModel(providerName: string) {
    const modelName = prompt(`Add model to "${providerName}":`);
    if (!modelName?.trim()) return;
    settings.addModelToProvider(providerName, modelName.trim());
    await settings.persistProviders();
  }

  async function handleRemoveModel(providerName: string, modelName: string) {
    if (!confirm(`Remove model "${modelName}" from "${providerName}"?`)) return;
    settings.removeModelFromProvider(providerName, modelName);
    await settings.persistProviders();
  }

  async function handleFetchOllamaModels(providerName: string) {
    try {
      const models = await invoke<string[]>("get_ollama_models");
      for (const m of models) {
        settings.addModelToProvider(providerName, m);
      }
      await settings.persistProviders();
    } catch (err) {
      alert(`Failed to fetch Ollama models: ${err}`);
    }
  }

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <div className="config-group">
          <label className="config-label">Providers</label>
          <div className="provider-list">
            {settings.providers.map((p) => (
              <div key={p.name} className="provider-item provider-card">
                <div className="provider-item-info">
                  <span className="provider-item-name">{p.name}</span>
                  <span className="provider-item-type">{p.providerType}</span>
                </div>
                <button
                  className="provider-item-remove"
                  onClick={() => handleRemove(p.name)}
                  title="Remove provider"
                >
                  &minus;
                </button>
                <div className="provider-models">
                  {p.models.length === 0 && (
                    <span className="no-models">No models configured.</span>
                  )}
                  {p.models.map((m) => (
                    <div key={m} className="model-chip">
                      <span
                        className={
                          settings.activeModelId === `${p.name}::${m}`
                            ? "model-chip-active"
                            : ""
                        }
                      >
                        {m}
                      </span>
                      <button
                        className="model-chip-remove"
                        onClick={() => handleRemoveModel(p.name, m)}
                        title="Remove model"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <div className="provider-actions">
                  <button
                    className="provider-add-model-btn"
                    onClick={() => handleAddModel(p.name)}
                  >
                    + Add Model
                  </button>
                  {p.providerType === "ollama" && (
                    <button
                      className="provider-fetch-btn"
                      onClick={() => handleFetchOllamaModels(p.name)}
                    >
                      Fetch from Ollama
                    </button>
                  )}
                </div>
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

- [ ] **Step 15: Verify with `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: TypeScript compiles without errors.

---

### Task 8: Update ControlBar (Home) with merged ModelSelector

**Files:**
- Modify: `src/components/ControlBar.tsx`

- [ ] **Step 16: Rewrite ControlBar**

Remove provider display and model fetch. Replace with merged model selector grouped by provider.

```typescript
import { useSettingsStore } from "../stores/settingsStore";

type ControlBarProps = {
  onOpenSettings: () => void;
};

export function ControlBar({ onOpenSettings }: ControlBarProps) {
  const settings = useSettingsStore();
  const charCount = settings.prompt.length;

  const modelOptions = settings.providers
    .filter((p) => p.models.length > 0)
    .flatMap((p) =>
      p.models.map((m) => ({
        id: `${p.name}::${m}`,
        label: `${m} — ${p.name}`,
        providerName: p.name,
        modelName: m,
      }))
    );

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    settings.setActiveModel(e.target.value);
    settings.persistProviders();
  }

  return (
    <div className="control-bar">
      <div>
        <div className="field-title">Model</div>
        <select
          className="control-select"
          value={settings.activeModelId}
          onChange={handleModelChange}
        >
          {modelOptions.length === 0 && (
            <option value="">No models available</option>
          )}
          {settings.providers
            .filter((p) => p.models.length > 0)
            .map((p) =>
              p.models.map((m) => {
                const id = `${p.name}::${m}`;
                return (
                  <option key={id} value={id}>
                    {m} — {p.name}
                  </option>
                );
              })
            )}
        </select>
      </div>
      <div>
        <div className="field-title">Prompt / Rule</div>
        <div className="prompt-box">
          <textarea
            className="prompt-textarea-inline"
            value={settings.prompt}
            onChange={(e) =>
              settings.updateSettings({ prompt: e.target.value })
            }
            placeholder="Describe how files should be renamed..."
            maxLength={500}
          />
          <div className="prompt-meta">
            <span>{charCount} / 500</span>
            <button className="settings-btn" onClick={onOpenSettings}>
              ⚙ Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 17: Verify with `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: TypeScript compiles without errors.

---

### Task 9: Clean up unused code & final verification

**Files:**
- Verify: `src/services/modelService.ts` (may be unused now but keep for future)

- [ ] **Step 18: Full verification**

Run: `cargo check --manifest-path src-tauri/Cargo.toml` — expected: success.
Run: `npx tsc --noEmit` — expected: success.

- [ ] **Step 19: Commit**

```bash
git add -A
git commit -m "feat: support multiple models per provider with merged home selector"
```
