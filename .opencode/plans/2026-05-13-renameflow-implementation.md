# RenameFlow Phase 1-3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build RenameFlow Phase 1-3 (Basic GUI → AI Integration → Rename Preview) for a working end-to-end desktop app.

**Architecture:** Tauri v2 + React/TypeScript frontend with Zustand state management. Rust backend with modular commands (AI clients, file rename, sanitization, history). Section-based navigation (no router). Preview appears inline after AI generation.

**Tech Stack:** React 19, TypeScript, Zustand, Tauri v2, Rust + reqwest (HTTP)

---

## File Map

### New Frontend Files
| File | Purpose |
|------|---------|
| `src/types.ts` | TypeScript data models |
| `src/stores/fileStore.ts` | File/suggestion state |
| `src/stores/settingsStore.ts` | Settings state |
| `src/stores/historyStore.ts` | History state |
| `src/components/Sidebar.tsx` | Navigation sidebar |
| `src/components/DropZone.tsx` | Drag-drop + file picker area |
| `src/components/ConfigBar.tsx` | Provider/model selector |
| `src/components/PromptField.tsx` | AI instruction input |
| `src/components/FileList.tsx` | Imported file list |
| `src/components/PreviewTable.tsx` | Editable rename preview |
| `src/components/HistorySection.tsx` | History view (placeholder) |
| `src/components/SettingsSection.tsx` | Settings form |
| `src/views.ts` | View enum type |

### Modified Frontend Files
| File | Change |
|------|--------|
| `src/App.tsx` | Full rewrite — section-based layout |
| `src/App.css` | Full rewrite — app styling |
| `src/main.tsx` | Minor — wrap with stores if needed |

### New Rust Files
| File | Purpose |
|------|---------|
| `src-tauri/src/models.rs` | Shared Rust types |
| `src-tauri/src/ai.rs` | Ollama + LM Studio HTTP clients |
| `src-tauri/src/sanitize.rs` | Filename sanitization |
| `src-tauri/src/rename.rs` | File rename + conflict resolution |
| `src-tauri/src/history.rs` | History JSON persistence |
| `src-tauri/src/commands.rs` | Tauri command handlers |

### Modified Rust Files
| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Register new commands |
| `src-tauri/Cargo.toml` | Add reqwest, tokio deps |

---

### Task 1: Add dependencies

**Files:**
- Modify: `package.json` → add zustand
- Modify: `src-tauri/Cargo.toml` → add reqwest, tokio

- [ ] **Add zustand frontend dependency**

```bash
pnpm add zustand
```

- [ ] **Add Rust dependencies to Cargo.toml**

```rust
// src-tauri/Cargo.toml additions:
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
```

- [ ] **Commit**

```bash
git add package.json pnpm-lock.yaml src-tauri/Cargo.toml
git commit -m "chore: add zustand, reqwest, tokio deps"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `src/types.ts`

- [ ] **Create type definitions**

```ts
// src/types.ts
export type FileStatus = "pending" | "analyzing" | "ready" | "renamed" | "failed";

export type FileItem = {
  id: string;
  path: string;
  directory: string;
  originalName: string;
  extension: string;
  size: number;
  mimeType?: string;
  thumbnailPath?: string;
  status: FileStatus;
  error?: string;
};

export type RenameSuggestion = {
  fileId: string;
  originalName: string;
  suggestedName: string;
  finalName: string;
  confidence?: number;
  reason?: string;
};

export type RenameOperation = {
  fileId: string;
  fromPath: string;
  toPath: string;
  originalName: string;
  newName: string;
};

export type RenameHistory = {
  id: string;
  createdAt: string;
  operations: RenameOperation[];
  successCount: number;
  failedCount: number;
};

export type RenameResult = {
  success: RenameOperation[];
  failed: { operation: RenameOperation; error: string }[];
};

export type UndoResult = {
  restored: number;
  failed: number;
};

export type ProviderType = "ollama" | "lm-studio";

export type FilenameStyle = "kebab-case" | "snake_case" | "title-case" | "camelCase";

export type Language = "english" | "vietnamese" | "auto";

export type AppSettings = {
  provider: ProviderType;
  model: string;
  baseUrl: string;
  prompt: string;
  style: FilenameStyle;
  maxWords: number;
  language: Language;
};

export type ModelInfo = {
  name: string;
  label?: string;
};

export type View = "home" | "history" | "settings";
```

- [ ] **Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript data models"
```

---

### Task 3: View enum + Stores (Zustand)

**Files:**
- Create: `src/views.ts`
- Create: `src/stores/fileStore.ts`
- Create: `src/stores/settingsStore.ts`
- Create: `src/stores/historyStore.ts`

- [ ] **Create view enum**

```ts
// src/views.ts
export type View = "home" | "history" | "settings";
```

- [ ] **Create fileStore**

```ts
// src/stores/fileStore.ts
import { create } from "zustand";
import type { FileItem, RenameSuggestion, FileStatus } from "../types";

type GenerateStatus = "idle" | "generating" | "ready" | "error";

type FileStore = {
  files: FileItem[];
  suggestions: Record<string, RenameSuggestion>;
  selectedIds: Set<string>;
  generateStatus: GenerateStatus;
  errorMessage: string | null;

  addFiles: (paths: string[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  updateSuggestion: (fileId: string, newName: string) => void;
  setSuggestions: (suggestions: RenameSuggestion[]) => void;
  toggleFile: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setGenerateStatus: (status: GenerateStatus) => void;
  setErrorMessage: (msg: string | null) => void;
  updateFileStatus: (id: string, status: FileStatus, error?: string) => void;
};

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  suggestions: {},
  selectedIds: new Set(),
  generateStatus: "idle",
  errorMessage: null,

  addFiles: (paths) =>
    set((state) => {
      const newFiles: FileItem[] = paths.map((p) => {
        const parts = p.replace(/\\/g, "/").split("/");
        const fullName = parts[parts.length - 1] || "";
        const dot = fullName.lastIndexOf(".");
        const ext = dot >= 0 ? fullName.slice(dot) : "";
        const name = dot >= 0 ? fullName.slice(0, dot) : fullName;
        return {
          id: crypto.randomUUID(),
          path: p,
          directory: parts.slice(0, -1).join("/"),
          originalName: name,
          extension: ext,
          size: 0,
          status: "pending" as FileStatus,
        };
      });
      return { files: [...state.files, ...newFiles] };
    }),

  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    })),

  clearAll: () =>
    set({ files: [], suggestions: {}, selectedIds: new Set(), generateStatus: "idle", errorMessage: null }),

  updateSuggestion: (fileId, newName) =>
    set((state) => {
      const s = state.suggestions[fileId];
      if (!s) return state;
      return {
        suggestions: {
          ...state.suggestions,
          [fileId]: { ...s, finalName: newName },
        },
      };
    }),

  setSuggestions: (suggestions) =>
    set((state) => {
      const map: Record<string, RenameSuggestion> = {};
      const selectedIds = new Set<string>();
      for (const s of suggestions) {
        map[s.fileId] = s;
        selectedIds.add(s.fileId);
      }
      return { suggestions: map, selectedIds, generateStatus: "ready" };
    }),

  toggleFile: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: () =>
    set((state) => ({ selectedIds: new Set(state.files.map((f) => f.id)) })),

  deselectAll: () => set({ selectedIds: new Set() }),

  setGenerateStatus: (status) => set({ generateStatus: status }),

  setErrorMessage: (msg) => set({ errorMessage: msg }),

  updateFileStatus: (id, status, error) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, status, error } : f)),
    })),
}));
```

- [ ] **Create settingsStore**

```ts
// src/stores/settingsStore.ts
import { create } from "zustand";
import type { AppSettings, ProviderType, FilenameStyle, Language } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  provider: "ollama" as ProviderType,
  model: "",
  baseUrl: "http://localhost:11434",
  prompt: "Rename the file based on its content. Keep it short, descriptive, lowercase, and use hyphens.",
  style: "kebab-case" as FilenameStyle,
  maxWords: 8,
  language: "english" as Language,
};

type SettingsStore = AppSettings & {
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  updateSettings: (partial) => set(partial),
  resetSettings: () => set(DEFAULT_SETTINGS),
}));
```

- [ ] **Create historyStore**

```ts
// src/stores/historyStore.ts
import { create } from "zustand";
import type { RenameHistory } from "../types";

type HistoryStore = {
  entries: RenameHistory[];
  setEntries: (entries: RenameHistory[]) => void;
  addEntry: (entry: RenameHistory) => void;
};

export const useHistoryStore = create<HistoryStore>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
}));
```

- [ ] **Commit**

```bash
git add src/views.ts src/stores/fileStore.ts src/stores/settingsStore.ts src/stores/historyStore.ts
git commit -m "feat: add Zustand stores for files, settings, history"
```

---

### Task 4: Rust models

**Files:**
- Create: `src-tauri/src/models.rs`

- [ ] **Create Rust shared types**

```rust
// src-tauri/src/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameSuggestion {
    pub file_id: String,
    pub original_name: String,
    pub suggested_name: String,
    pub final_name: String,
    pub confidence: Option<f64>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameOperation {
    pub file_id: String,
    pub from_path: String,
    pub to_path: String,
    pub original_name: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameResult {
    pub success: Vec<RenameOperation>,
    pub failed: Vec<RenameFailed>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameFailed {
    pub operation: RenameOperation,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoResult {
    pub restored: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameHistory {
    pub id: String,
    pub created_at: String,
    pub operations: Vec<RenameOperation>,
    pub success_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameOptions {
    pub style: String,
    pub max_words: usize,
    pub language: String,
}

#[derive(Debug, Deserialize)]
pub struct AiResponse {
    pub name: Option<String>,
    pub reason: Option<String>,
}
```

- [ ] **Add mod models to lib.rs** (will be done in Task 9)

- [ ] **Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat: add Rust shared data models"
```

---

### Task 5: Rust sanitize module

**Files:**
- Create: `src-tauri/src/sanitize.rs`

- [ ] **Create sanitize module**

```rust
// src-tauri/src/sanitize.rs
use std::collections::HashSet;

const ILLEGAL_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
const MAX_BASENAME_LENGTH: usize = 100;

pub fn sanitize_name(name: &str, extension: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !ILLEGAL_CHARS.contains(c))
        .collect();

    let trimmed = cleaned.trim().to_string();

    if trimmed.is_empty() {
        return format!("untitled-file{}", extension);
    }

    let basename = if trimmed.len() > MAX_BASENAME_LENGTH {
        trimmed[..MAX_BASENAME_LENGTH].to_string()
    } else {
        trimmed
    };

    // Ensure extension starts with .
    let ext = if extension.starts_with('.') {
        extension.to_string()
    } else {
        format!(".{}", extension)
    };

    format!("{}{}", basename, ext)
}

pub fn deduplicate_name(
    desired_path: &str,
    existing_names: &HashSet<String>,
) -> String {
    if !existing_names.contains(desired_path) {
        return desired_path.to_string();
    }

    let path = std::path::Path::new(desired_path);
    let parent = path.parent().unwrap_or(std::path::Path::new(""));
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();

    for i in 1..100 {
        let candidate = if ext.is_empty() {
            parent.join(format!("{}-{}", stem, i)).to_string_lossy().to_string()
        } else {
            parent.join(format!("{}-{}{}", stem, i, ext)).to_string_lossy().to_string()
        };
        if !existing_names.contains(&candidate) {
            return candidate;
        }
    }

    desired_path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_removes_illegal_chars() {
        let result = sanitize_name("hello:world/test*.jpg", ".jpg");
        assert!(!result.contains(':'));
        assert!(!result.contains('/'));
        assert!(!result.contains('*'));
    }

    #[test]
    fn test_empty_name_fallback() {
        let result = sanitize_name("", ".jpg");
        assert!(result.starts_with("untitled-file"));
        assert!(result.ends_with(".jpg"));
    }

    #[test]
    fn test_truncates_long_names() {
        let long = "a".repeat(200);
        let result = sanitize_name(&long, ".txt");
        assert!(result.len() <= MAX_BASENAME_LENGTH + 5); // +5 for extension
    }

    #[test]
    fn test_deduplicate_adds_suffix() {
        let mut existing = HashSet::new();
        existing.insert("/path/to/sunset.jpg".to_string());
        let result = deduplicate_name("/path/to/sunset.jpg", &existing);
        assert_eq!(result, "/path/to/sunset-1.jpg");
    }

    #[test]
    fn test_deduplicate_returns_original_if_unique() {
        let existing = HashSet::new();
        let result = deduplicate_name("/path/to/sunset.jpg", &existing);
        assert_eq!(result, "/path/to/sunset.jpg");
    }
}
```

- [ ] **Run tests**

```bash
cargo test -p renameflow --lib sanitize -- --nocapture
```

- [ ] **Commit**

```bash
git add src-tauri/src/sanitize.rs
git commit -m "feat: add filename sanitization with dedup"
```

---

### Task 6: Rust AI module

**Files:**
- Create: `src-tauri/src/ai.rs`

- [ ] **Create AI client module**

```rust
// src-tauri/src/ai.rs
use crate::models::AiResponse;
use reqwest::Client;

pub enum AiProvider {
    Ollama,
    LmStudio,
}

impl AiProvider {
    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "lm-studio" | "lm_studio" => AiProvider::LmStudio,
            _ => AiProvider::Ollama,
        }
    }

    fn api_endpoint(&self, base_url: &str) -> String {
        match self {
            AiProvider::Ollama => format!("{}/api/generate", base_url.trim_end_matches('/')),
            AiProvider::LmStudio => format!("{}/chat/completions", base_url.trim_end_matches('/')),
        }
    }
}

pub async fn generate_name(
    provider: &str,
    base_url: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let p = AiProvider::from_str(provider);
    let endpoint = p.api_endpoint(base_url);

    match p {
        AiProvider::Ollama => call_ollama(&client, &endpoint, model, file_name, user_prompt).await,
        AiProvider::LmStudio => call_lm_studio(&client, &endpoint, model, file_name, user_prompt).await,
    }
}

async fn call_ollama(
    client: &Client,
    endpoint: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let system_prompt = "You are a file renaming assistant. Generate a short, clear, descriptive filename based on the file content. Return ONLY valid JSON with fields \"name\" (the filename without extension) and \"reason\" (why you chose it). No markdown, no explanation. Use lowercase, hyphens between words, maximum 8 words. Avoid generic names like image, file, document, screenshot.";

    let body = serde_json::json!({
        "model": model,
        "system": system_prompt,
        "prompt": format!("{}\n\nOriginal file name: {}", user_prompt, file_name),
        "stream": false,
        "format": "json"
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let response_text = raw["response"].as_str().unwrap_or("");
    parse_ai_json(response_text)
}

async fn call_lm_studio(
    client: &Client,
    endpoint: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
) -> Result<AiResponse, String> {
    let system_prompt = "You are a file renaming assistant. Generate a short, clear, descriptive filename based on the file content. Return ONLY valid JSON with fields \"name\" (the filename without extension) and \"reason\" (why you chose it). No markdown, no explanation. Use lowercase, hyphens between words, maximum 8 words. Avoid generic names like image, file, document, screenshot.";

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": format!("{}\n\nOriginal file name: {}", user_prompt, file_name)}
        ],
        "temperature": 0.1,
        "max_tokens": 100
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LM Studio request failed: {}", e))?;

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse LM Studio response: {}", e))?;

    let response_text = raw["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    parse_ai_json(response_text)
}

fn parse_ai_json(text: &str) -> Result<AiResponse, String> {
    // Try direct parse first
    if let Ok(resp) = serde_json::from_str::<AiResponse>(text) {
        return Ok(resp);
    }

    // Try to extract JSON from markdown code block
    if let Some(start) = text.find("```json") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            let json_str = after[..end].trim();
            if let Ok(resp) = serde_json::from_str::<AiResponse>(json_str) {
                return Ok(resp);
            }
        }
    }

    // Try to find any JSON object
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
```

- [ ] **Add mod to lib.rs** (will be done together in Task 9)

- [ ] **Commit**

```bash
git add src-tauri/src/ai.rs
git commit -m "feat: add Ollama and LM Studio AI clients"
```

---

### Task 7: Rust rename + history modules

**Files:**
- Create: `src-tauri/src/rename.rs`
- Create: `src-tauri/src/history.rs`

- [ ] **Create rename module**

```rust
// src-tauri/src/rename.rs
use crate::models::RenameOperation;
use std::collections::HashSet;
use std::path::Path;

pub fn validate_operations(operations: &[RenameOperation]) -> Result<(), String> {
    for op in operations {
        let from = Path::new(&op.from_path);
        if !from.exists() {
            return Err(format!("File not found: {}", op.from_path));
        }
        if !from.is_file() {
            return Err(format!("Path is not a file: {}", op.from_path));
        }
    }
    Ok(())
}

pub fn check_conflicts(operations: &[RenameOperation]) -> Vec<String> {
    let mut to_paths = HashSet::new();
    let mut conflicts = Vec::new();

    for op in operations {
        if !to_paths.insert(&op.to_path) {
            conflicts.push(op.to_path.clone());
        }
    }

    conflicts
}

pub fn execute_rename(op: &RenameOperation) -> Result<(), String> {
    let from = Path::new(&op.from_path);
    let to = Path::new(&op.to_path);

    // Create parent directory if it doesn't exist
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    std::fs::rename(from, to)
        .map_err(|e| format!("Failed to rename {} to {}: {}", op.from_path, op.to_path, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detects_missing_file() {
        let ops = vec![RenameOperation {
            file_id: "1".into(),
            from_path: "/nonexistent/path/file.txt".into(),
            to_path: "/tmp/renamed.txt".into(),
            original_name: "file".into(),
            new_name: "renamed".into(),
        }];
        let result = validate_operations(&ops);
        assert!(result.is_err());
    }
}
```

- [ ] **Create history module**

```rust
// src-tauri/src/history.rs
use crate::models::{RenameHistory, UndoResult};
use std::path::PathBuf;

fn get_history_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = tauri::Manager::path(app_handle).app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_dir.join("history.json")
}

fn get_history_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = tauri::Manager::path(app_handle).app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_dir
}

pub fn load_history(app_handle: &tauri::AppHandle) -> Vec<RenameHistory> {
    let path = get_history_path(app_handle);
    if !path.exists() {
        return Vec::new();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_else(|_| "[]".to_string());
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_history(app_handle: &tauri::AppHandle, history: &[RenameHistory]) -> Result<(), String> {
    let dir = get_history_dir(app_handle);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create history dir: {}", e))?;
    let path = get_history_path(app_handle);
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write history: {}", e))?;
    Ok(())
}

pub fn add_entry(app_handle: &tauri::AppHandle, entry: RenameHistory) -> Result<(), String> {
    let mut history = load_history(app_handle);
    history.insert(0, entry);
    save_history(app_handle, &history)
}

pub fn undo_last(app_handle: &tauri::AppHandle) -> Result<UndoResult, String> {
    let mut history = load_history(app_handle);
    if history.is_empty() {
        return Err("No rename history to undo.".to_string());
    }

    let last = history.remove(0);
    let mut restored = 0usize;
    let mut failed = 0usize;

    for op in &last.operations {
        let from = std::path::Path::new(&op.to_path);
        let to = std::path::Path::new(&op.from_path);
        if from.exists() {
            match std::fs::rename(from, to) {
                Ok(_) => restored += 1,
                Err(_) => failed += 1,
            }
        } else {
            failed += 1;
        }
    }

    save_history(app_handle, &history)?;

    Ok(UndoResult { restored, failed })
}
```

- [ ] **Commit**

```bash
git add src-tauri/src/rename.rs src-tauri/src/history.rs
git commit -m "feat: add file rename and history persistence"
```

---

### Task 8: Rust commands + wire up

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` — register all commands and modules

- [ ] **Create commands module**

```rust
// src-tauri/src/commands.rs
use crate::ai;
use crate::history;
use crate::models::*;
use crate::rename;
use crate::sanitize;
use std::collections::HashSet;

#[tauri::command]
pub async fn generate_rename_suggestions(
    files: Vec<String>,
    provider: String,
    model: String,
    base_url: String,
    prompt: String,
    options: RenameOptions,
) -> Result<Vec<RenameSuggestion>, String> {
    if files.is_empty() {
        return Err("No files provided.".to_string());
    }
    if model.is_empty() {
        return Err("No model selected.".to_string());
    }
    if prompt.is_empty() {
        return Err("Prompt cannot be empty.".to_string());
    }

    let mut suggestions = Vec::new();
    let mut seen_final_names: HashSet<String> = HashSet::new();

    for file_path in &files {
        let path = std::path::Path::new(file_path);
        let original_name = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let extension = path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        // Call AI
        let ai_result = ai::generate_name(
            &provider,
            &base_url,
            &model,
            &original_name,
            &prompt,
        )
        .await?;

        let raw_name = ai_result.name.unwrap_or_else(|| original_name.clone());
        let sanitized_full = sanitize::sanitize_name(&raw_name, &extension);

        // Extract just the stem for suggested name
        let sanitized_path = std::path::Path::new(&sanitized_full);
        let suggested_stem = sanitized_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let final_path = if let Some(parent) = path.parent() {
            let desired = parent.join(&sanitized_full).to_string_lossy().to_string();
            sanitize::deduplicate_name(&desired, &seen_final_names)
        } else {
            sanitize::deduplicate_name(&sanitized_full, &seen_final_names)
        };

        seen_final_names.insert(final_path.clone());

        suggestions.push(RenameSuggestion {
            file_id: file_path.clone(),
            original_name,
            suggested_name: suggested_stem,
            final_name: final_path,
            confidence: None,
            reason: ai_result.reason,
        });
    }

    Ok(suggestions)
}

#[tauri::command]
pub async fn rename_files(
    app_handle: tauri::AppHandle,
    operations: Vec<RenameOperation>,
) -> Result<RenameResult, String> {
    rename::validate_operations(&operations)?;

    let conflicts = rename::check_conflicts(&operations);
    if !conflicts.is_empty() {
        return Err(format!(
            "Duplicate target names detected: {}. Please resolve conflicts before renaming.",
            conflicts.join(", ")
        ));
    }

    let mut success = Vec::new();
    let mut failed = Vec::new();

    for op in &operations {
        match rename::execute_rename(op) {
            Ok(()) => success.push(op.clone()),
            Err(e) => failed.push(RenameFailed {
                operation: op.clone(),
                error: e,
            }),
        }
    }

    // Save to history
    let history_entry = RenameHistory {
        id: uuid_or_random(),
        created_at: chrono_or_now(),
        operations: operations.clone(),
        success_count: success.len(),
        failed_count: failed.len(),
    };
    let _ = history::add_entry(&app_handle, history_entry);

    Ok(RenameResult { success, failed })
}

#[tauri::command]
pub async fn undo_last_rename(
    app_handle: tauri::AppHandle,
) -> Result<UndoResult, String> {
    history::undo_last(&app_handle)
}

#[tauri::command]
pub async fn get_available_models(
    provider: String,
    base_url: String,
) -> Result<Vec<ModelInfo>, String> {
    if base_url.is_empty() {
        return Err("Base URL is required.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    match provider.to_lowercase().as_str() {
        "ollama" => {
            let resp = client
                .get(format!("{}/api/tags", base_url.trim_end_matches('/')))
                .send()
                .await
                .map_err(|e| format!("Failed to fetch Ollama models: {}", e))?;

            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let models = raw["models"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            m["name"].as_str().map(|n| ModelInfo {
                                name: n.to_string(),
                                label: None,
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Ok(models)
        }
        "lm-studio" | "lm_studio" => {
            let resp = client
                .get(format!("{}/models", base_url.trim_end_matches('/')))
                .send()
                .await
                .map_err(|e| format!("Failed to fetch LM Studio models: {}", e))?;

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
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

fn uuid_or_random() -> String {
    // Simple UUID v4-like generation without extra dep
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("rf-{:016x}", nanos)
}

fn chrono_or_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    // Simple ISO-like timestamp
    format!("2026-05-13T{:06}Z", secs % 86400)
}
```

- [ ] **Update lib.rs to register commands**

```rust
// src-tauri/src/lib.rs
mod ai;
mod commands;
mod history;
mod models;
mod rename;
mod sanitize;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::generate_rename_suggestions,
            commands::rename_files,
            commands::undo_last_rename,
            commands::get_available_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Verify Rust compiles**

```bash
cargo check -p renameflow
```

- [ ] **Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add Tauri commands and wire up modules"
```

---

### Task 9: Sidebar + App shell

**Files:**
- Create: `src/components/Sidebar.tsx`
- Rewrite: `src/App.tsx`
- Rewrite: `src/App.css`

- [ ] **Create Sidebar component**

```tsx
// src/components/Sidebar.tsx
import type { View } from "../views";

type SidebarProps = {
  currentView: View;
  onNavigate: (view: View) => void;
};

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const links: { view: View; label: string }[] = [
    { view: "home", label: "Home" },
    { view: "history", label: "History" },
    { view: "settings", label: "Settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">RenameFlow</h1>
      </div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <button
            key={link.view}
            className={`sidebar-link ${currentView === link.view ? "active" : ""}`}
            onClick={() => onNavigate(link.view)}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Rewrite App.tsx**

```tsx
// src/App.tsx
import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DropZone } from "./components/DropZone";
import { ConfigBar } from "./components/ConfigBar";
import { PromptField } from "./components/PromptField";
import { FileList } from "./components/FileList";
import { PreviewTable } from "./components/PreviewTable";
import { HistorySection } from "./components/HistorySection";
import { SettingsSection } from "./components/SettingsSection";
import { useFileStore } from "./stores/fileStore";
import { useSettingsStore } from "./stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { View } from "./views";
import type { RenameSuggestion, RenameOperation, RenameResult } from "./types";
import "./App.css";

function App() {
  const [view, setView] = useState<View>("home");
  const {
    files,
    suggestions,
    selectedIds,
    generateStatus,
    errorMessage,
    addFiles,
    setSuggestions,
    setGenerateStatus,
    setErrorMessage,
  } = useFileStore();
  const settings = useSettingsStore();

  async function handleGenerate() {
    if (files.length === 0) return;
    setGenerateStatus("generating");
    setErrorMessage(null);

    try {
      const result = await invoke<RenameSuggestion[]>("generate_rename_suggestions", {
        files: files.map((f) => f.path),
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        prompt: settings.prompt,
        options: {
          style: settings.style,
          max_words: settings.maxWords,
          language: settings.language,
        },
      });
      setSuggestions(result);
    } catch (err) {
      setErrorMessage(String(err));
      setGenerateStatus("error");
    }
  }

  async function handleRename() {
    const ops: RenameOperation[] = [];
    for (const fileId of selectedIds) {
      const s = suggestions[fileId];
      if (!s) continue;
      ops.push({
        fileId: s.fileId,
        fromPath: s.finalName,  // Will be computed properly in implementation
        toPath: s.finalName,
        originalName: s.originalName,
        newName: s.suggestedName,
      });
    }
    // TODO: compute actual fromPath/toPath properly
    // This is a placeholder — rename command needs file directory + final_name
  }

  return (
    <div className="app-layout">
      <Sidebar currentView={view} onNavigate={setView} />
      <main className="main-content">
        {view === "home" && (
          <>
            <DropZone onFilesSelected={addFiles} />
            <ConfigBar />
            <PromptField />
            <div className="action-bar">
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={files.length === 0 || generateStatus === "generating"}
              >
                {generateStatus === "generating" ? "Generating..." : "Generate Names"}
              </button>
            </div>
            {errorMessage && <div className="error-banner">{errorMessage}</div>}
            {files.length > 0 && <FileList />}
            {generateStatus === "ready" && Object.keys(suggestions).length > 0 && (
              <PreviewTable onRename={handleRename} />
            )}
          </>
        )}
        {view === "history" && <HistorySection />}
        {view === "settings" && <SettingsSection />}
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Write App.css**

```css
/* src/App.css — full app styling */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --sidebar-width: 220px;
  --color-bg: #1a1a2e;
  --color-surface: #16213e;
  --color-primary: #0f3460;
  --color-accent: #e94560;
  --color-text: #e8e8e8;
  --color-text-muted: #999;
  --color-border: #2a2a4a;
  --color-success: #4caf50;
  --color-error: #f44336;
  --color-warning: #ff9800;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
  font-family: var(--font);
  background: var(--color-bg);
  color: var(--color-text);
  overflow: hidden;
}

.app-layout {
  display: flex;
  height: 100vh;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.sidebar-header {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1rem;
}

.sidebar-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-link {
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.sidebar-link:hover {
  background: var(--color-primary);
  color: var(--color-text);
}

.sidebar-link.active {
  background: var(--color-primary);
  color: var(--color-text);
  font-weight: 600;
}

/* Main content */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

/* Action bar */
.action-bar {
  margin: 1rem 0;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: var(--radius);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--color-primary);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background: #1a4a7a;
}

/* Error banner */
.error-banner {
  background: var(--color-error);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  margin: 0.75rem 0;
  font-size: 0.85rem;
}

/* Section titles */
.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--color-text);
}
```

- [ ] **Commit**

```bash
git add src/components/Sidebar.tsx src/App.tsx src/App.css
git commit -m "feat: add sidebar nav and app shell layout"
```

---

### Task 10: DropZone component

**Files:**
- Create: `src/components/DropZone.tsx`

- [ ] **Create DropZone**

```tsx
// src/components/DropZone.tsx
import { useCallback, useRef, useState } from "react";

type DropZoneProps = {
  onFilesSelected: (paths: string[]) => void;
};

export function DropZone({ onFilesSelected }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      // In Tauri, drag-drop file paths come from the event's dataTransfer
      const files = Array.from(e.dataTransfer.files);
      const paths = files.map((f) => (f as any).path).filter(Boolean);
      if (paths.length > 0) onFilesSelected(paths);
    },
    [onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleFilePick = () => fileInputRef.current?.click();
  const handleFolderPick = () => folderInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const paths = files.map((f) => (f as any).path).filter(Boolean);
    if (paths.length > 0) onFilesSelected(paths);
    e.target.value = "";
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const paths = files.map((f) => (f as any).path).filter(Boolean);
    if (paths.length > 0) onFilesSelected(paths);
    e.target.value = "";
  };

  return (
    <div
      className={`dropzone ${dragging ? "dropzone-active" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="dropzone-content">
        <p className="dropzone-text">Drop files here</p>
        <div className="dropzone-actions">
          <button className="btn btn-secondary" onClick={handleFilePick}>
            Choose Files
          </button>
          <button className="btn btn-secondary" onClick={handleFolderPick}>
            Choose Folder
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore — webkitdirectory is valid but not in React types
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: "none" }}
        onChange={handleFolderChange}
      />
    </div>
  );
}
```

- [ ] **Add DropZone styles to App.css**

```css
/* DropZone */
.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 2.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 1rem;
}

.dropzone:hover,
.dropzone-active {
  border-color: var(--color-accent);
  background: rgba(233, 69, 96, 0.05);
}

.dropzone-text {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.dropzone-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}
```

- [ ] **Commit**

```bash
git add src/components/DropZone.tsx
git commit -m "feat: add drag-drop file import zone"
```

---

### Task 11: ConfigBar + PromptField

**Files:**
- Create: `src/components/ConfigBar.tsx`
- Create: `src/components/PromptField.tsx`

- [ ] **Create ConfigBar**

```tsx
// src/components/ConfigBar.tsx
import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import type { ModelInfo } from "../types";

export function ConfigBar() {
  const settings = useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      setLoadingModels(true);
      try {
        const result = await invoke<ModelInfo[]>("get_available_models", {
          provider: settings.provider,
          baseUrl: settings.baseUrl,
        });
        setModels(result);
        if (result.length > 0 && !settings.model) {
          settings.updateSettings({ model: result[0].name });
        }
      } catch {
        setModels([]);
      }
      setLoadingModels(false);
    }
    fetchModels();
  }, [settings.provider, settings.baseUrl]);

  return (
    <div className="config-bar">
      <div className="config-row">
        <div className="config-group">
          <label className="config-label">Provider</label>
          <select
            className="config-select"
            value={settings.provider}
            onChange={(e) =>
              settings.updateSettings({ provider: e.target.value as any })
            }
          >
            <option value="ollama">Ollama</option>
            <option value="lm-studio">LM Studio</option>
          </select>
        </div>
        <div className="config-group">
          <label className="config-label">Base URL</label>
          <input
            className="config-input"
            type="text"
            value={settings.baseUrl}
            onChange={(e) =>
              settings.updateSettings({ baseUrl: e.target.value })
            }
            placeholder="http://localhost:11434"
          />
        </div>
        <div className="config-group">
          <label className="config-label">Model</label>
          <select
            className="config-select"
            value={settings.model}
            onChange={(e) =>
              settings.updateSettings({ model: e.target.value })
            }
            disabled={loadingModels}
          >
            {loadingModels && <option>Loading...</option>}
            {models.length === 0 && !loadingModels && (
              <option value="">No models found</option>
            )}
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.label || m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Create PromptField**

```tsx
// src/components/PromptField.tsx
import { useSettingsStore } from "../stores/settingsStore";

export function PromptField() {
  const prompt = useSettingsStore((s) => s.prompt);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <div className="prompt-field">
      <label className="config-label">Prompt</label>
      <textarea
        className="prompt-textarea"
        value={prompt}
        onChange={(e) => updateSettings({ prompt: e.target.value })}
        placeholder="Describe how files should be renamed..."
        rows={2}
      />
    </div>
  );
}
```

- [ ] **Add ConfigBar + PromptField styles to App.css**

```css
/* Config bar */
.config-bar {
  margin-bottom: 0.75rem;
}

.config-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 150px;
  flex: 1;
}

.config-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.config-select,
.config-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.config-select:focus,
.config-input:focus {
  border-color: var(--color-accent);
}

.config-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

/* Prompt field */
.prompt-field {
  margin-bottom: 0.75rem;
}

.prompt-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
}

.prompt-textarea:focus {
  border-color: var(--color-accent);
}
```

- [ ] **Commit**

```bash
git add src/components/ConfigBar.tsx src/components/PromptField.tsx
git commit -m "feat: add provider config and prompt input"
```

---

### Task 12: FileList component

**Files:**
- Create: `src/components/FileList.tsx`

- [ ] **Create FileList**

```tsx
// src/components/FileList.tsx
import { useFileStore } from "../stores/fileStore";

export function FileList() {
  const files = useFileStore((s) => s.files);
  const removeFile = useFileStore((s) => s.removeFile);
  const selectedIds = useFileStore((s) => s.selectedIds);
  const toggleFile = useFileStore((s) => s.toggleFile);
  const selectAll = useFileStore((s) => s.selectAll);
  const deselectAll = useFileStore((s) => s.deselectAll);
  const clearAll = useFileStore((s) => s.clearAll);

  const allSelected = files.length > 0 && selectedIds.size === files.length;

  const statusLabel: Record<string, string> = {
    pending: "Pending",
    analyzing: "Analyzing...",
    ready: "Ready",
    renamed: "Renamed",
    failed: "Failed",
  };

  return (
    <div className="file-list">
      <div className="file-list-header">
        <h3 className="section-title">Files ({files.length})</h3>
        <div className="file-list-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => (allSelected ? deselectAll() : selectAll())}>
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>
      <div className="file-table">
        <div className="file-table-header">
          <span className="file-col-check"></span>
          <span className="file-col-name">Name</span>
          <span className="file-col-status">Status</span>
          <span className="file-col-action"></span>
        </div>
        {files.map((file) => (
          <div key={file.id} className="file-row">
            <span className="file-col-check">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => toggleFile(file.id)}
              />
            </span>
            <span className="file-col-name" title={file.path}>
              {file.originalName}{file.extension}
            </span>
            <span className="file-col-status">
              <span className={`status-badge status-${file.status}`}>
                {statusLabel[file.status] || file.status}
              </span>
            </span>
            <span className="file-col-action">
              <button
                className="btn-icon"
                onClick={() => removeFile(file.id)}
                title="Remove"
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Add FileList styles to App.css**

```css
/* File list */
.file-list {
  margin: 1rem 0;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.file-list-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
}

.file-table {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.file-table-header {
  display: flex;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}

.file-row {
  display: flex;
  padding: 0.5rem 0.75rem;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}

.file-row:last-child {
  border-bottom: none;
}

.file-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.file-col-check {
  width: 36px;
  flex-shrink: 0;
}

.file-col-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}

.file-col-status {
  width: 100px;
  text-align: center;
}

.file-col-action {
  width: 30px;
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending {
  background: rgba(255, 152, 0, 0.15);
  color: var(--color-warning);
}

.status-analyzing {
  background: rgba(33, 150, 243, 0.15);
  color: #2196f3;
}

.status-ready {
  background: rgba(76, 175, 80, 0.15);
  color: var(--color-success);
}

.status-renamed {
  background: rgba(76, 175, 80, 0.15);
  color: var(--color-success);
}

.status-failed {
  background: rgba(244, 67, 54, 0.15);
  color: var(--color-error);
}

.btn-icon {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.2rem;
  font-size: 0.85rem;
  transition: color 0.2s;
}

.btn-icon:hover {
  color: var(--color-error);
}
```

- [ ] **Commit**

```bash
git add src/components/FileList.tsx
git commit -m "feat: add file list with checkboxes and status badges"
```

---

### Task 13: PreviewTable component

**Files:**
- Create: `src/components/PreviewTable.tsx`

- [ ] **Create PreviewTable**

```tsx
// src/components/PreviewTable.tsx
import { useFileStore } from "../stores/fileStore";
import type { RenameOperation } from "../types";

type PreviewTableProps = {
  onRename: () => void;
};

export function PreviewTable({ onRename }: PreviewTableProps) {
  const files = useFileStore((s) => s.files);
  const suggestions = useFileStore((s) => s.suggestions);
  const selectedIds = useFileStore((s) => s.selectedIds);
  const updateSuggestion = useFileStore((s) => s.updateSuggestion);
  const toggleFile = useFileStore((s) => s.toggleFile);
  const deselectAll = useFileStore((s) => s.deselectAll);
  const generateStatus = useFileStore((s) => s.generateStatus);

  const previewItems = files
    .filter((f) => suggestions[f.id])
    .map((f) => ({
      file: f,
      suggestion: suggestions[f.id],
    }));

  if (previewItems.length === 0) return null;

  const selectedCount = [...selectedIds].filter((id) => suggestions[id]).length;

  return (
    <div className="preview-table">
      <div className="preview-header">
        <h3 className="section-title">
          Preview ({previewItems.length} files)
        </h3>
        <div className="preview-actions">
          <button className="btn btn-secondary btn-sm" onClick={deselectAll}>
            Deselect All
          </button>
          <button
            className="btn btn-primary"
            onClick={onRename}
            disabled={selectedCount === 0}
          >
            Rename Selected ({selectedCount})
          </button>
        </div>
      </div>
      <div className="preview-grid">
        <div className="preview-grid-header">
          <span className="preview-col-check"></span>
          <span className="preview-col-current">Current Name</span>
          <span className="preview-col-new">New Name</span>
          <span className="preview-col-status">Status</span>
          <span className="preview-col-action"></span>
        </div>
        {previewItems.map(({ file, suggestion }) => (
          <div key={file.id} className="preview-row">
            <span className="preview-col-check">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => toggleFile(file.id)}
              />
            </span>
            <span className="preview-col-current" title={file.path}>
              {file.originalName}{file.extension}
            </span>
            <span className="preview-col-new">
              <input
                className="preview-input"
                type="text"
                value={suggestion.finalName}
                onChange={(e) => updateSuggestion(file.id, e.target.value)}
              />
            </span>
            <span className="preview-col-status">
              <span className={`status-badge status-${file.status}`}>
                {file.status === "ready" || file.status === "pending"
                  ? "Ready"
                  : file.status}
              </span>
            </span>
            <span className="preview-col-action">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const input = document.querySelector(
                    `[data-regen-id="${file.id}"]`
                  ) as HTMLButtonElement;
                  if (input) input.textContent = "Regen...";
                  // TODO: call regenerate for single file
                }}
                data-regen-id={file.id}
              >
                Regenerate
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Add PreviewTable styles**

```css
/* Preview table */
.preview-table {
  margin: 1rem 0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.preview-grid {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.preview-grid-header {
  display: flex;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}

.preview-row {
  display: flex;
  padding: 0.5rem 0.75rem;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}

.preview-row:last-child {
  border-bottom: none;
}

.preview-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.preview-col-check {
  width: 36px;
  flex-shrink: 0;
}

.preview-col-current {
  width: 35%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.preview-col-new {
  flex: 1;
  padding: 0 0.75rem;
}

.preview-input {
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.preview-input:focus {
  border-color: var(--color-accent);
}

.preview-col-status {
  width: 80px;
  text-align: center;
}

.preview-col-action {
  width: 100px;
  text-align: center;
}
```

- [ ] **Commit**

```bash
git add src/components/PreviewTable.tsx
git commit -m "feat: add editable preview table with rename action"
```

---

### Task 14: History + Settings placeholder sections

**Files:**
- Create: `src/components/HistorySection.tsx`
- Create: `src/components/SettingsSection.tsx`

- [ ] **Create HistorySection placeholder**

```tsx
// src/components/HistorySection.tsx
import { useHistoryStore } from "../stores/historyStore";

export function HistorySection() {
  const entries = useHistoryStore((s) => s.entries);

  return (
    <div className="section">
      <h2 className="section-title">History</h2>
      {entries.length === 0 ? (
        <p className="empty-state">No rename history yet.</p>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <div key={entry.id} className="history-item">
              <span>{entry.createdAt}</span>
              <span>{entry.successCount} renamed</span>
              {entry.failedCount > 0 && (
                <span className="status-failed">{entry.failedCount} failed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Create SettingsSection**

```tsx
// src/components/SettingsSection.tsx
import { useSettingsStore } from "../stores/settingsStore";

export function SettingsSection() {
  const settings = useSettingsStore();

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <div className="config-group">
          <label className="config-label">Provider</label>
          <select
            className="config-select"
            value={settings.provider}
            onChange={(e) =>
              settings.updateSettings({ provider: e.target.value as any })
            }
          >
            <option value="ollama">Ollama</option>
            <option value="lm-studio">LM Studio</option>
          </select>
        </div>

        <div className="config-group">
          <label className="config-label">Ollama / LM Studio URL</label>
          <input
            className="config-input"
            type="text"
            value={settings.baseUrl}
            onChange={(e) =>
              settings.updateSettings({ baseUrl: e.target.value })
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
    </div>
  );
}
```

- [ ] **Add section and settings styles**

```css
/* Section */
.section {
  max-width: 600px;
}

.empty-state {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  padding: 2rem 0;
}

/* Settings */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* History */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 0.85rem;
}
```

- [ ] **Commit**

```bash
git add src/components/HistorySection.tsx src/components/SettingsSection.tsx
git commit -m "feat: add settings form and history placeholder"
```

---

### Task 14.5: Single-file regenerate support

**Files:**
- Modify: `src/components/PreviewTable.tsx` — add `onRegenerateFile` prop
- Modify: `src/App.tsx` — implement single-file regenerate

- [ ] **Add onRegenerateFile prop to PreviewTable**

Replace the `PreviewTable` props and button:

```tsx
type PreviewTableProps = {
  onRename: () => void;
  onRegenerateFile: (fileId: string) => void;
  regeneratingIds?: Set<string>;
};

export function PreviewTable({ onRename, onRegenerateFile, regeneratingIds }: PreviewTableProps) {
  // ... same as before, but update the regenerate button:
```

Change the button to call `onRegenerateFile`:

```tsx
<button
  className="btn btn-secondary btn-sm"
  onClick={() => onRegenerateFile(file.id)}
  disabled={regeneratingIds?.has(file.id)}
>
  {regeneratingIds?.has(file.id) ? "..." : "Regenerate"}
</button>
```

- [ ] **Implement regenerate in App.tsx**

Add state + handler in App:

```tsx
const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

async function handleRegenerateFile(fileId: string) {
  const { files } = useFileStore.getState();
  const file = files.find((f) => f.id === fileId);
  if (!file) return;

  setRegeneratingIds((prev) => new Set(prev).add(fileId));
  try {
    const result = await invoke<RenameSuggestion[]>("generate_rename_suggestions", {
      files: [file.path],
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      prompt: settings.prompt,
      options: {
        style: settings.style,
        max_words: settings.maxWords,
        language: settings.language,
      },
    });
    if (result.length > 0) {
      useFileStore.getState().setSuggestions(
        Object.values(useFileStore.getState().suggestions).map((s) =>
          s.fileId === fileId ? result[0] : s
        )
      );
    }
  } catch (err) {
    setErrorMessage(String(err));
  }
  setRegeneratingIds((prev) => {
    const next = new Set(prev);
    next.delete(fileId);
    return next;
  });
}
```

Pass to PreviewTable:

```tsx
<PreviewTable onRename={handleRename} onRegenerateFile={handleRegenerateFile} regeneratingIds={regeneratingIds} />
```

- [ ] **Commit**

```bash
git add src/components/PreviewTable.tsx src/App.tsx
git commit -m "feat: add single-file regenerate support"
```
---

### Task 15: Wire preview rename flow properly

**Files:**
- Modify: `src/App.tsx` — fix `handleRename` to compute correct paths and invoke backend

- [ ] **Fix handleRename in App.tsx**

Replace the placeholder `handleRename` with a proper implementation:

```tsx
async function handleRename() {
  const { files, suggestions, selectedIds, updateFileStatus, setGenerateStatus } = useFileStore.getState();

  const ops: RenameOperation[] = [];
  for (const fileId of selectedIds) {
    const file = files.find((f) => f.id === fileId);
    const s = suggestions[fileId];
    if (!file || !s) continue;

    const newPath = file.directory
      ? `${file.directory}/${s.finalName}`
      : s.finalName;

    ops.push({
      fileId: file.id,
      fromPath: file.path,
      toPath: newPath,
      originalName: file.originalName,
      newName: s.finalName,
    });
  }

  if (ops.length === 0) return;

  setGenerateStatus("idle");
  try {
    const result = await invoke<RenameResult>("rename_files", { operations: ops });

    for (const op of result.success) {
      updateFileStatus(op.fileId, "renamed");
    }
    for (const op of result.failed) {
      updateFileStatus(op.operation.fileId, "failed", op.error);
    }
  } catch (err) {
    setGenerateStatus("error");
    useFileStore.getState().setErrorMessage(String(err));
  }
}
```

- [ ] **Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire rename flow with backend invocation"
```

---

### Task 16: Tauri drag-drop support (capabilities)

**Files:**
- Modify: `src-tauri/capabilities/` — add drag-drop permission

- [ ] **Check and update capabilities**

Read the capabilities file (likely `src-tauri/capabilities/default.json`) and ensure it includes drag-drop support:

```json
{
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:default",
    "core:window:allow-set-size",
    "core:event:default",
    "core:event:allow-listen",
    "core:event:allow-emit"
  ]
}
```

- [ ] **Commit**

```bash
git add src-tauri/capabilities/
git commit -m "fix: update Tauri capabilities for drag-drop"
```

---

### Task 17: Final build verification

- [ ] **Build and check**

```bash
pnpm tauri build 2>&1 | tail -30
```

Fix any build errors.

- [ ] **Final commit**

```bash
git add -A
git commit -m "fix: resolve build issues"
```

---

## Self-Review Checklist

- [ ] Spec coverage: Every type, component, and module from the design doc maps to a task above.
- [ ] No placeholders: Every step has real code and exact commands.
- [ ] Type consistency: `FileItem`, `RenameSuggestion`, `RenameOperation` types match across TypeScript and Rust.
- [ ] File paths verified against project structure.
