# RenameFlow — Phase 1-3 Design

## Scope

Build Phase 1 (Basic GUI) through Phase 3 (Rename Preview) of the product spec in a single implementation pass. End-to-end flow: import files → configure AI → generate names → preview/edit → rename on disk.

## Architecture

**Frontend:** React + TypeScript, Zustand for state, section-based views (no router)
**Backend:** Rust Tauri commands, modular structure
**AI:** Ollama + LM Studio HTTP clients

## Frontend

### Component Tree

```
App
├── Sidebar — Home / History / Settings nav
├── HomeSection
│   ├── DropZone — drag-drop area + file/folder buttons
│   ├── ConfigBar — provider dropdown, model dropdown, base URL
│   ├── PromptField — AI instruction input
│   ├── FileList (collapsible)
│   │   └── FileRow — checkbox, thumbnail, name, status
│   ├── GenerateButton
│   └── PreviewTable (inline, appears after generation)
│       └── PreviewRow — checkbox, thumbnail, current name, editable suggested name, status, regen action
├── HistorySection (placeholder, not implemented in Phase 1-3)
│   └── HistoryList → HistoryItem
└── SettingsSection
    └── SettingsForm
```

### Zustand Stores

**fileStore:**
```ts
files: FileItem[]
suggestions: Map<fileId, RenameSuggestion>
selectedIds: Set<string>
status: 'idle' | 'generating' | 'ready' | 'renaming'
addFiles(paths: string[]) => void
removeFile(id: string) => void
updateSuggestion(fileId, newName) => void
toggleFile(id) => void
selectAll() / deselectAll() => void
clearAll() => void
setGenerating() / setReady() / setError(msg) => void
```

**settingsStore** (persisted to disk):
```ts
provider: 'ollama' | 'lm-studio'
model: string
baseUrl: string
prompt: string
style: 'kebab-case' | 'snake_case' | 'title-case' | 'camelCase'
maxWords: number
language: 'english' | 'vietnamese' | 'auto'
updateSettings(partial) => void
```

**historyStore:**
```ts
entries: RenameHistory[]
addEntry(record) => void
undoLast() => Promise<UndoResult>
```

### Data Model (matching spec)

```ts
type FileItem = {
  id: string
  path: string
  directory: string
  originalName: string
  extension: string
  size: number
  mimeType?: string
  thumbnailPath?: string
  status: 'pending' | 'analyzing' | 'ready' | 'renamed' | 'failed'
  error?: string
}

type RenameSuggestion = {
  fileId: string
  originalName: string
  suggestedName: string
  finalName: string
  confidence?: number
  reason?: string
}

type RenameOperation = {
  fileId: string
  fromPath: string
  toPath: string
  originalName: string
  newName: string
}

type RenameHistory = {
  id: string
  createdAt: string
  operations: RenameOperation[]
  successCount: number
  failedCount: number
}
```

## Rust Backend

### Module Structure

```
src-tauri/src/
├── main.rs            — entry point
├── lib.rs             — Tauri builder, register commands
├── models.rs          — shared types (FileItem, RenameSuggestion, etc.)
├── commands.rs        — Tauri command handlers
├── ai.rs              — Ollama + LM Studio clients
├── rename.rs          — file rename + conflict resolution
├── history.rs         — history read/write to JSON file
└── sanitize.rs        — filename sanitization rules
```

### Tauri Commands

```rust
#[tauri::command]
async fn generate_rename_suggestions(
    files: Vec<String>,
    provider: String,
    model: String,
    prompt: String,
    options: RenameOptions,
) -> Result<Vec<RenameSuggestion>, String>;

#[tauri::command]
async fn rename_files(
    operations: Vec<RenameOperation>,
) -> Result<RenameResult, String>;

#[tauri::command]
async fn undo_last_rename() -> Result<UndoResult, String>;

#[tauri::command]
async fn get_available_models(
    provider: String,
    base_url: String,
) -> Result<Vec<ModelInfo>, String>;
```

### AI Integration Strategy

- **Ollama:** POST to `{base_url}/api/generate` with prompt + file content. Parse JSON response for `{name, reason}`.
- **LM Studio:** POST to `{base_url}/chat/completions` with OpenAI-compatible format. Parse JSON from assistant message.
- Both return JSON `{name, reason}` after sanitization.
- Timeout: 60s per file.

### Sanitization Rules

1. Preserve original extension (never change `.jpg` → `.png`)
2. Remove illegal chars: `/\:*?"<>|`
3. Fallback: `untitled-file-{n}.ext` if AI returns empty
4. Deduplicate with `-1`, `-2` suffix on conflict
5. Max basename: 100 chars

### History Storage

- JSON file at `{app_data_dir}/renameflow/history.json`
- Append-only log of `RenameHistory` entries
- Undo reads latest entry, restores `fromPath` for each operation

## Data Flow

1. Drop files → `fileStore.addFiles()` → FileList renders
2. Configure provider/model/prompt → settingsStore
3. Click "Generate Names" → invoke `generate_rename_suggestions` → Rust calls AI → sanitizes → returns suggestions
4. PreviewTable renders inline with editable rows
5. User edits/toggles → fileStore updates
6. Click "Rename Selected" → invoke `rename_files` → Rust renames + writes history
7. Status badges update (success/failed per file)
8. Click "Undo" → invoke `undo_last_rename` → restores original names

## Dependencies to Add

**Frontend:** zustand
**Rust:** reqwest (HTTP), tokio (async runtime, already included via Tauri)

## Out of Scope

- Phase 4 (History screen) — deferred (but RenameHistory is written to disk during rename so undo is available later)
- Phase 5 (Thumbnails, folder import, settings persistence, packaging)
- Non-MVP features (presets, watch folder, EXIF, multi-provider beyond Ollama/LM Studio)
