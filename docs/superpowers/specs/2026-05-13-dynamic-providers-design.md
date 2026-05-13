# Dynamic Providers for RenameFlow

## Goal

Replace the hardcoded 5-provider dropdown (ollama, lm-studio, openai, anthropic, google) with a dynamic list of user-managed providers persisted to a JSON config file. Providers can be added, removed, and selected in Settings.

## Data Model

### Rust (`models.rs`) / TypeScript (`types.ts`)

```rust
struct Provider {
    name: String,
    provider_type: String,  // "openai-compatible" | "anthropic" | "google"
    base_url: String,
    api_key: String,
    model: String,
}

struct ProviderConfig {
    active_provider: String,
    providers: Vec<Provider>,
}
```

Providers only hold connection settings (type, baseUrl, apiKey, model). The global settings (prompt, style, maxWords, language) remain in-memory via zustand as they are today.

## Persistence

- File: `{app_data_dir}/providers.json`
- Module: `src-tauri/src/providers.rs` (follows same pattern as `history.rs`)
- Tauri commands: `load_providers`, `save_providers`, `get_providers_path`
- Auto-creates a single `default` provider (openai-compatible, `http://localhost:11434`) on first run

## Backend Changes

### `ai.rs`
- Replace 5-variant `AiProvider` enum with 3:
  - `OpenAiCompatible` — endpoints: `POST {base}/chat/completions` for rename, `GET {base}/models` for listing. Auth: optional Bearer via `OPENAI_API_KEY` env var or `api_key` field.
  - `Anthropic` — same as current. Auth: `x-api-key` header, `ANTHROPIC_API_KEY` env var fallback.
  - `Google` — same as current. Auth: query param `key`, `GOOGLE_API_KEY` env var fallback.
- Remove `LmStudio` and `Ollama` variants — `openai-compatible` covers both.

### `commands.rs`
- `get_available_models`: collapse 5 branches → 3. `"openai-compatible"` hits `GET {base_url}/models`. Anthropic/Google unchanged.
- `Provider` and `ProviderConfig` used as command params/returns.

### `lib.rs`
- Add `mod providers`
- Register `load_providers`, `save_providers`, `get_providers_path` in invoke handler

## Frontend Changes

### `types.ts`
- Change `ProviderType` from `"ollama" | "lm-studio" | "openai" | "anthropic" | "google"` to `"openai-compatible" | "anthropic" | "google"`
- Add `Provider { name, providerType, baseUrl, apiKey, model }`
- Add `ProviderConfig { activeProvider, providers: Provider[] }`

### `stores/settingsStore.ts`
- Add: `providers: Provider[]`, `activeProviderName: string`
- Add actions: `loadProviders(ProviderConfig)`, `addProvider(Provider)`, `removeProvider(name)`, `switchProvider(name)`, `saveProviders(ProviderConfig)` (invoke call)
- When `switchProvider(name)` is called, copy the provider's `model`, `baseUrl`, `apiKey` into the flat store state so existing consumers (ConfigBar, App.tsx) work unchanged.

### `components/SettingsSection.tsx`
- Top: **Active Provider** dropdown (lists all provider names). On change calls `switchProvider()`.
- Below: list of all providers showing `name — type — model` with a delete (—) button on each.
- **+ button** at the top of the list opens the AddProviderModal.
- Every mutation (add, remove, switch) auto-saves via `invoke("save_providers")`. No explicit Save button.

### `components/AddProviderModal.tsx` (new)
- Fields: Name (text), Type (select: openai-compatible/anthropic/google), Base URL (text, auto-fills default on type change), API Key (password, shown only if type requires auth), Model (text).
- Default base URLs per type:
  - openai-compatible: `http://localhost:11434`
  - anthropic: `https://api.anthropic.com`
  - google: `https://generativelanguage.googleapis.com`
- Submit calls `addProvider()` + `saveProviders()`.
- Cancel closes modal.

### `App.css`
- Add styles for modal overlay, modal content, provider list items.

## Data Flow

1. **App start**: `SettingsSection` useEffect calls `load_providers` → populates store. Active provider's fields copied into flat store.
2. **Switch**: dropdown → `switchProvider(name)` → copies model/baseUrl/apiKey into flat store → auto-saves to persist `active_provider`.
3. **Add**: + button → modal → form → "Add" → `addProvider()` + auto-saves.
4. **Remove**: — button → `removeProvider(name)` + auto-saves. If removing the active provider, switch to first remaining or create default → auto-saves again with new active provider.
5. **Generate suggestions / list models**: `App.tsx`/`ConfigBar.tsx` already pass `settings.model/baseUrl/apiKey` — no call-site changes needed.
6. **Global settings**: prompt, style, maxWords, language stay in-memory in zustand — not persisted (for now).

## Files Changed

| File | Change |
|---|---|
| `src-tauri/src/models.rs` | Add `Provider`, `ProviderConfig` structs |
| `src-tauri/src/providers.rs` | New — load/save/path (follows history.rs) |
| `src-tauri/src/commands.rs` | Add 3 commands, simplify get_available_models |
| `src-tauri/src/ai.rs` | 3 provider types, remove Ollama/LmStudio |
| `src-tauri/src/lib.rs` | Register `mod providers` + 3 commands |
| `src/types.ts` | Change `ProviderType`, add `Provider`/`ProviderConfig` |
| `src/stores/settingsStore.ts` | Add providers array + actions |
| `src/components/SettingsSection.tsx` | Rewrite with provider list |
| `src/components/AddProviderModal.tsx` | New modal component |
| `src/App.css` | Modal + provider list styles |
