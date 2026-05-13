# Refactor Spec: RenameFlow

Source reviewed: uploaded project code for a Tauri + React file renaming app. 

## 1. Goals

Refactor the project to improve maintainability, correctness, and feature reliability without changing core user-facing behavior.

Primary goals:

1. Separate UI, state, Tauri command calls, and domain logic.
2. Fix inconsistent file identity handling between frontend and backend.
3. Centralize AI provider logic and settings validation.
4. Make rename generation, execution, history, and undo flows safer and easier to test.
5. Reduce duplicated settings/provider UI logic.
6. Prepare the codebase for adding thumbnails, API-key providers, batch status, and richer history.

Non-goals for this refactor:

1. Redesigning the visual UI.
2. Replacing Zustand.
3. Replacing Tauri.
4. Adding new AI providers beyond the existing provider list.
5. Implementing full file-content analysis unless already supported by backend later.

---

## 2. Current Problems

### 2.1 Frontend and backend use incompatible file IDs

Frontend `FileItem.id` is generated using `crypto.randomUUID()` in `fileStore.addFiles`, but backend `generate_rename_suggestions` returns `file_id: file_path.clone()`. The frontend stores suggestions by `fileId`, then looks them up by `file.id`, so generated suggestions may not match selected files correctly.

**Impact:** suggestions can fail to display, regenerate, or rename correctly.

---

### 2.2 `App.tsx` owns too much workflow logic

`App.tsx` handles:

* loading history
* generating suggestions
* renaming files
* regenerating a single file
* computing selected counts
* routing between views
* UI layout

This makes the main component hard to test and easy to break.

---

### 2.3 Tauri invoke calls are scattered through UI components

Examples:

* `App.tsx` invokes `generate_rename_suggestions`, `rename_files`, and `load_rename_history`.
* `ControlBar.tsx` invokes `get_available_models`.
* `FileBrowser.tsx` invokes `list_directory`.

**Impact:** UI components are coupled to backend command names and payload shapes.

---

### 2.4 Settings are duplicated across UI

Provider/style/max words are edited in multiple places:

* `ControlBar`
* `SettingsSection`
* `Sidebar`

Provider defaults and auth requirements live only in `SettingsSection`, while `ControlBar` and `Sidebar` use partial assumptions.

---

### 2.5 API key is not actually sent during generation

`App.tsx` calls `generate_rename_suggestions` with:

```ts
api_key: "",
```

even though `settings.apiKey` exists. This prevents configured API keys from being used for rename generation.

---

### 2.6 Rename options are accepted but ignored

Backend command receives `_options: RenameOptions`, but does not apply `style`, `max_words`, or `language`.

**Impact:** UI settings appear functional but may not affect generated names.

---

### 2.7 History timestamp implementation is incorrect

`chrono_or_now()` hardcodes the date prefix:

```rust
format!("2026-05-13T{:06}Z", secs % 86400)
```

This creates invalid or misleading history dates.

---

### 2.8 Undo exists in backend but is not wired in frontend

`undo_last_rename` exists in Rust, and the sidebar shows an `Undo` button, but the button has no handler.

---

### 2.9 Directory loading can be inefficient and unsafe for large trees

`collectAllFiles` recursively invokes `list_directory` one folder at a time from the frontend. For large folders this can be slow, deep, and hard to cancel.

---

## 3. Target Architecture

### 3.1 Frontend folder structure

Proposed structure:

```txt
src/
  app/
    App.tsx
    routes.ts
  components/
    layout/
      Sidebar.tsx
      MainLayout.tsx
    files/
      FileBrowser.tsx
      FileTree.tsx
      FolderCheckbox.tsx
      PreviewTable.tsx
    controls/
      ControlBar.tsx
      ProviderSelect.tsx
      ModelSelect.tsx
      PromptInput.tsx
    settings/
      SettingsSection.tsx
      ProviderSettings.tsx
      RenameSettings.tsx
    history/
      HistorySection.tsx
      HistoryList.tsx
  domain/
    files.ts
    rename.ts
    settings.ts
    history.ts
  services/
    tauriClient.ts
    fileService.ts
    renameService.ts
    modelService.ts
    historyService.ts
  stores/
    fileStore.ts
    settingsStore.ts
    historyStore.ts
    workflowStore.ts
  types/
    file.ts
    rename.ts
    settings.ts
    history.ts
    tauri.ts
```

---

## 4. Frontend Refactor Requirements

### 4.1 Introduce service layer for Tauri commands

Create `src/services/tauriClient.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";

export function tauriInvoke<T>(command: string, args?: Record<string, unknown>) {
  return invoke<T>(command, args);
}
```

Create specific services:

```ts
// src/services/renameService.ts
export async function generateRenameSuggestions(input: GenerateRenameInput) {}
export async function renameFiles(operations: RenameOperation[]) {}
export async function undoLastRename() {}
```

```ts
// src/services/modelService.ts
export async function getAvailableModels(input: GetModelsInput) {}
```

```ts
// src/services/fileService.ts
export async function listDirectory(path: string) {}
export async function collectFiles(path: string) {}
```

UI components must not call `invoke` directly.

---

### 4.2 Fix file identity model

Use file path as the stable backend identity, or send frontend IDs to backend. Preferred approach:

```ts
type FileItem = {
  id: string;          // frontend stable ID
  path: string;
  directory: string;
  originalName: string;
  extension: string;
  size: number;
  status: FileStatus;
};
```

Backend request should include both `id` and `path`:

```ts
type GenerateRenameFileInput = {
  id: string;
  path: string;
};
```

Frontend should call:

```ts
files: files.map((file) => ({
  id: file.id,
  path: file.path,
}))
```

Backend should return:

```rust
pub struct RenameSuggestion {
    pub file_id: String,
    pub original_name: String,
    pub suggested_name: String,
    pub final_name: String,
    pub confidence: Option<f64>,
    pub reason: Option<String>,
}
```

where `file_id` is the frontend ID, not the path.

Acceptance criteria:

* Suggestions display immediately after generation.
* Single-file regeneration updates the correct row.
* Rename selected uses selected frontend IDs reliably.
* Removing a file removes its suggestions and selection state.

---

### 4.3 Move workflow actions out of `App.tsx`

Create `src/stores/workflowStore.ts` or `src/domain/renameWorkflow.ts` with actions:

```ts
generateAllSuggestions()
regenerateSuggestion(fileId: string)
renameSelectedFiles()
loadHistory()
undoLastRename()
```

`App.tsx` should mostly render:

```tsx
<Sidebar />
<MainContent />
```

Acceptance criteria:

* `App.tsx` has no direct `invoke` calls.
* `App.tsx` does not build rename operations manually.
* Rename flow can be unit-tested outside React components.

---

### 4.4 Normalize settings constants

Move provider defaults and auth requirements into `src/domain/settings.ts`:

```ts
export const PROVIDER_DEFAULTS = {
  ollama: "http://localhost:11434",
  "lm-studio": "http://localhost:1234",
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
} satisfies Record<ProviderType, string>;

export const AUTH_REQUIRED = {
  ollama: false,
  "lm-studio": false,
  openai: true,
  anthropic: true,
  google: true,
} satisfies Record<ProviderType, boolean>;
```

Use these in `ControlBar`, `SettingsSection`, and `Sidebar`.

Acceptance criteria:

* Provider list is defined once.
* Provider display labels are defined once.
* Changing provider defaults does not require editing multiple components.

---

### 4.5 Send API key correctly

Change generation payload from:

```ts
api_key: "",
```

to:

```ts
api_key: settings.apiKey,
```

Acceptance criteria:

* OpenAI, Anthropic, and Google generation use the configured API key.
* Empty API key still falls back to env vars on backend.

---

### 4.6 Improve model loading behavior

Move model-fetching into a hook:

```ts
useAvailableModels(provider, baseUrl, apiKey)
```

Requirements:

* Cancel stale requests when provider/base URL changes.
* Expose `models`, `loading`, and `error`.
* Include `apiKey` for authenticated providers.
* Do not overwrite `settings.model` if the current model still exists.

Acceptance criteria:

* Switching providers does not flash stale model options.
* OpenAI/Anthropic/Google model fetching can use entered API key.
* Model error can be surfaced in settings or control bar.

---

### 4.7 Split large UI components

Refactor `FileBrowser.tsx` into:

```txt
FileBrowser.tsx
FileTree.tsx
FileTreeRow.tsx
FolderCheckbox.tsx
useDirectoryTree.ts
```

Refactor `PreviewTable.tsx` into:

```txt
PreviewTable.tsx
PreviewRow.tsx
FileThumbnail.tsx
formatBytes.ts
```

Acceptance criteria:

* No component exceeds roughly 150–200 lines unless justified.
* Tree loading logic is separated from rendering.
* Formatting helpers have unit tests.

---

## 5. Backend Refactor Requirements

### 5.1 Split command handlers from domain logic

Current `commands.rs` mixes validation, AI calls, deduplication, rename execution, model fetching, and history.

Proposed Rust structure:

```txt
src-tauri/src/
  commands/
    mod.rs
    rename_commands.rs
    model_commands.rs
    file_commands.rs
    history_commands.rs
  ai/
    mod.rs
    provider.rs
    ollama.rs
    lm_studio.rs
    openai.rs
    anthropic.rs
    google.rs
    parser.rs
  domain/
    rename_plan.rs
    sanitize.rs
    conflicts.rs
  history/
    mod.rs
    store.rs
    undo.rs
  filesystem/
    directory.rs
    rename.rs
  models.rs
```

Acceptance criteria:

* `commands` functions are thin adapters.
* AI provider implementations are isolated.
* Rename validation and conflict checks are unit-tested independently.

---

### 5.2 Apply rename options on backend

Currently `_options` is ignored. Rename options should influence prompt and/or sanitization.

Required behavior:

```rust
RenameOptions {
  style,
  max_words,
  language,
}
```

must affect generated result.

Implementation options:

1. Include options in the system prompt.
2. Enforce options post-generation in `sanitize`.
3. Prefer both.

Acceptance criteria:

* `max_words` is enforced even if the model ignores it.
* `style` transforms final basename.
* `language` is included in the prompt.
* Tests cover all filename styles.

---

### 5.3 Fix timestamp generation

Replace `chrono_or_now()` with a real timestamp.

Preferred:

```rust
chrono::Utc::now().to_rfc3339()
```

Add `chrono` dependency if not already present.

Acceptance criteria:

* History entries contain valid RFC3339 timestamps.
* Frontend can parse `createdAt` reliably.
* No hardcoded date exists.

---

### 5.4 Improve rename conflict detection

Current conflict detection only catches duplicate targets inside the operation batch.

Add validation for:

* target path already exists on disk
* source and target are identical
* target points to another source in same batch
* case-insensitive conflicts on Windows/macOS
* invalid empty final names

Acceptance criteria:

* Rename cannot overwrite unrelated files silently.
* Batch swaps are either supported explicitly or rejected clearly.
* Error messages identify the conflicting file.

---

### 5.5 Make history only record actual outcomes

Current history stores all requested operations even if some failed.

Update `RenameHistory` to distinguish:

```rust
successful_operations: Vec<RenameOperation>
failed_operations: Vec<RenameFailed>
```

Undo should only attempt successful operations.

Acceptance criteria:

* Failed rename attempts are visible in history.
* Undo does not try to undo operations that never succeeded.
* History schema migration is handled or old history is safely ignored.

---

### 5.6 Move recursive file collection to backend

Add a command:

```rust
#[tauri::command]
pub fn collect_files(path: String) -> Result<Vec<DirEntry>, String>
```

or:

```rust
pub fn collect_file_paths(path: String) -> Result<Vec<String>, String>
```

Requirements:

* Skip hidden files by default.
* Avoid following symlink loops.
* Return partial errors if possible.
* Consider max depth or max file count guardrails.

Acceptance criteria:

* Folder checkbox selection is fast for large folders.
* Frontend no longer recursively calls `list_directory` one directory at a time.
* Errors are actionable.

---

## 6. State Management Spec

### 6.1 File store

Responsibilities:

* selected files
* selected IDs
* suggestions
* per-file status
* file add/remove/clear

Must not:

* call Tauri
* generate suggestions
* rename files
* load history

Add cleanup behavior:

```ts
removeFile(id) should also remove suggestion[id]
removeFilesByPaths(paths) should also remove related suggestions
```

---

### 6.2 Settings store

Responsibilities:

* provider
* model
* base URL
* API key
* prompt
* style
* max words
* language

Add validation selectors:

```ts
selectIsProviderConfigured()
selectEffectiveBaseUrl()
selectRequiresAuth()
```

Optional persistence:

* Persist settings locally, except API key unless explicitly supported securely.
* Do not store API keys in plain local storage.

---

### 6.3 Workflow store

Responsibilities:

* async operations
* loading states
* user-facing errors
* orchestration between services and stores

Suggested state:

```ts
type WorkflowState = {
  generateStatus: "idle" | "generating" | "ready" | "error";
  renaming: boolean;
  regeneratingIds: Set<string>;
  errorMessage: string | null;
};
```

Move `generateStatus` and `errorMessage` out of `fileStore`.

---

## 7. Type Contract Alignment

Create explicit shared command payload types.

Frontend:

```ts
export type GenerateRenameSuggestionsRequest = {
  files: Array<{ id: string; path: string }>;
  provider: ProviderType;
  model: string;
  baseUrl: string;
  apiKey: string;
  prompt: string;
  options: RenameOptions;
};
```

Backend:

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct GenerateRenameFileInput {
    pub id: String,
    pub path: String,
}
```

Command should become:

```rust
pub async fn generate_rename_suggestions(
    files: Vec<GenerateRenameFileInput>,
    provider: String,
    model: String,
    base_url: String,
    api_key: String,
    prompt: String,
    options: RenameOptions,
) -> Result<Vec<RenameSuggestion>, String>
```

---

## 8. Testing Plan

### 8.1 Frontend unit tests

Add tests for:

* `formatBytes`
* filename style conversion
* file store add/remove/clear
* suggestion cleanup when file removed
* selected count with suggestions
* operation building from selected files

Recommended tooling:

* Vitest
* React Testing Library for components

---

### 8.2 Backend unit tests

Add tests for:

* `sanitize_name`
* filename style conversion
* `deduplicate_name`
* conflict detection
* rename validation
* history save/load
* undo only successful operations
* AI JSON parser with plain JSON, fenced JSON, and malformed text

---

### 8.3 Integration tests

Manual or automated test scenarios:

1. Select folder with nested files.
2. Generate suggestions.
3. Edit suggested names.
4. Rename selected files.
5. Confirm history entry appears.
6. Undo last rename.
7. Confirm files restored.
8. Test local provider with no API key.
9. Test cloud provider with API key.
10. Test duplicate suggestions and existing target conflicts.

---

## 9. Migration Plan

### Phase 1: Correctness fixes

1. Fix file ID mismatch.
2. Send `settings.apiKey` during generation.
3. Fix timestamp generation.
4. Remove unused or misleading UI behavior.
5. Wire Undo button or hide it until implemented.

### Phase 2: Service and workflow extraction

1. Add frontend service layer.
2. Move Tauri calls out of components.
3. Extract workflow actions.
4. Split `App.tsx`.

### Phase 3: Backend modularization

1. Split `commands.rs`.
2. Split `ai.rs` by provider.
3. Move rename conflict logic into domain module.
4. Move directory recursion to backend.

### Phase 4: Settings and provider cleanup

1. Centralize provider constants.
2. Add model-loading hook.
3. Apply rename options on backend.
4. Add settings validation.

### Phase 5: Tests and hardening

1. Add frontend unit tests.
2. Add Rust unit tests.
3. Add integration checklist.
4. Add large-folder safeguards.

---

## 10. Acceptance Criteria

The refactor is complete when:

* Generating suggestions works consistently for all selected files.
* Suggestions map to frontend file IDs, not paths.
* Rename selected only renames checked files with valid suggestions.
* Rename options affect generated final names.
* API-key providers work from settings.
* History timestamps are valid.
* Undo works from the UI or the UI does not show Undo.
* No UI component directly calls `invoke`.
* `App.tsx` contains minimal orchestration logic.
* Backend command files are organized by responsibility.
* Unit tests cover filename sanitization, conflict detection, store behavior, and AI response parsing.

