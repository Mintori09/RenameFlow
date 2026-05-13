# Multi-Model Provider Support

**Date:** 2026-05-13
**Project:** RenameFlow
**Status:** Design (Pending Implementation)

## 1. Problem

Each Provider in RenameFlow stores only **1 model**. Using multiple models
from the same provider (e.g. OpenAI gpt-4o + gpt-4o-mini) requires creating
duplicate providers with identical baseUrl/apiKey — inconvenient and redundant.

## 2. Goal

- A single provider can have **many models**.
- Ollama providers can **fetch model list** via `ollama list`.
- All other providers: user **enters model names manually**.
- Active model is chosen via a **single dropdown on the Home page**,
  merging provider + model selection into one control.

## 3. Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Ollama detection | **Add `"ollama"` as a separate `ProviderType`.** |
| 2 | `ollama list` binary location | **Try `ollama` in PATH only.** Report error if not found. |
| 3 | Provider with no models in Home selector | **Hide from Home selector** until user adds models in Settings. |

## 4. Data Model

### Rust — `src-tauri/src/models.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub active_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub active_provider: String,
    pub providers: Vec<Provider>,
    pub active_model_id: String,
}
```

### TypeScript — `src/types.ts`

```typescript
export type ProviderType = "openai-compatible" | "anthropic" | "google" | "ollama";

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
```

### JSON Config (`providers.json`)

```json
{
  "activeProvider": "My Ollama",
  "providers": [
    {
      "name": "My Ollama",
      "providerType": "ollama",
      "baseUrl": "http://localhost:11434",
      "apiKey": "",
      "models": ["llama3.2", "mistral", "codellama"],
      "activeModel": "llama3.2"
    }
  ],
  "activeModelId": "My Ollama::llama3.2"
}
```

## 5. Migration

When `load_providers()` reads `providers.json`:

1. Attempt direct deserialization as new `ProviderConfig`.
2. If that fails, try old format (with `model: String` on each provider).
   - `model` → `models: [model]`, `activeModel: model`.
   - `activeModelId` = `"{providerName}::{model}"`.
3. Save in new format immediately after migration.

Additionally, migrate `"openai-compatible"` entries whose `baseUrl` contains
`"localhost:11434"` to `"ollama"` type (heuristic best-effort).

## 6. Backend Changes

### `src-tauri/src/providers.rs`
- Add migration logic (Section 5).
- `save_providers()` writes new format.

### `src-tauri/src/ai/provider.rs`
- Add `AiProvider::Ollama` variant (currently it falls through to
  `OpenAiCompatible` which works, but this makes it explicit).

### New command — `get_ollama_models`
```rust
#[tauri::command]
pub fn get_ollama_models() -> Result<Vec<String>, String> {
    let output = std::process::Command::new("ollama")
        .args(["list"])
        .output()
        .map_err(|e| format!("Failed to run 'ollama list': {}", e))?;

    if !output.status.success() {
        return Err("ollama list failed".to_string());
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

### `src-tauri/src/lib.rs`
- Register `get_ollama_models` in `invoke_handler`.

## 7. Frontend Changes

### `src/stores/settingsStore.ts`

**Remove:**
- `activeProviderName`.

**Add:**
- `activeModelId: string` — format `"providerName::modelName"`.

**Methods:**

| Method | Description |
|--------|-------------|
| `setActiveModel(modelId)` | Set active model, derive provider info |
| `addModelToProvider(name, model)` | Add model to provider's list |
| `removeModelFromProvider(name, model)` | Remove model, handle if it was active |
| `getActiveProvider()` | Return provider matching `activeModelId` |

### `src/components/SettingsSection.tsx`
- Remove "Active Provider" dropdown.
- Provider card shows model list with add/remove.
- "Fetch from Ollama" button only for `"ollama"` type.

### `src/components/AddProviderModal.tsx`
- Update to match new `Provider` type.
- Optional initial model input.

### Home — `ModelSelector` (new/refactored)

One dropdown, grouped by provider:

```tsx
<select value={activeModelId} onChange={handleChange}>
  {providers.filter(p => p.models.length > 0).map(p => (
    <optgroup key={p.name} label={p.name}>
      {p.models.map(m => (
        <option key={m} value={`${p.name}::${m}`}>{m}</option>
      ))}
    </optgroup>
  ))}
</select>
```

### `src/stores/workflowStore.ts`
- No changes needed — `settings.model` stays populated by `setActiveModel`.

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| `ollama` not in PATH | Toast error, user can still add models manually |
| Active model deleted | Select first remaining model; clear if none left |
| `activeModelId` broken | Reset to first model of first provider |
| No models in provider | Hidden from Home selector |
| Network error at rename time | Already handled by existing workflowStore |

## 9. Files to Modify

| File | Action |
|------|--------|
| `src-tauri/src/models.rs` | Update `Provider`, `ProviderConfig` |
| `src-tauri/src/providers.rs` | Migration logic |
| `src-tauri/src/ai/provider.rs` | Add `AiProvider::Ollama` |
| `src-tauri/src/commands/model_commands.rs` | Add `get_ollama_models` |
| `src-tauri/src/lib.rs` | Register command |
| `src/types.ts` | Update types |
| `src/stores/settingsStore.ts` | Refactor for `activeModelId` |
| `src/components/SettingsSection.tsx` | Updated provider cards |
| `src/components/AddProviderModal.tsx` | Updated form |
| Home / main rename component | Add ModelSelector |

## 10. Out of Scope

- Fetching models from OpenAI, Anthropic, or Google APIs.
- Search/filter in model dropdown (plain `<select>`).
- Model validation against remote server.
