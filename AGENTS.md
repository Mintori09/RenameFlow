# RenameFlow — Agent Notes

Tauri v2 desktop app (React 19 + TypeScript frontend, Rust backend). AI-powered file rename tool with undo history.

## Dev Commands

- `just run` — full dev (installs deps + `pnpm tauri dev`). This is the correct entry point.
- `pnpm dev` — Vite only (port 1420, fixed). Use only for frontend-only debugging; Tauri context will be missing.
- `pnpm build` — `tsc && vite build`. Used by Tauri before bundling.
- `just build` — shorthand for `pnpm build`.
- `cargo check --manifest-path src-tauri/Cargo.toml` — Rust validation.

## Package Manager

Use **pnpm**. Lockfile is `pnpm-lock.yaml`.

## Architecture

### Frontend (`src/`)

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **State**: Zustand stores in `src/stores/` (fileStore, workflowStore, settingsStore, historyStore)
- **Tauri bridge**: `src/services/tauriClient.ts` wraps `invoke()` calls. Other services build on this.
- **Views**: "home" | "history" | "settings" (`src/views.ts`)
- **Domain types**: `src/types.ts` mirrors Rust structs for rename operations, providers, settings

### Backend (`src-tauri/src/`)

- **Entry**: `src-tauri/src/main.rs` → `lib.rs::run()`
- **Commands** (`src-tauri/src/commands/`) are the only exposed API surface. Add new `invoke` handlers in `lib.rs`.
- **AI providers** (`src-tauri/src/ai/`): modular backends for OpenAI-compatible, Anthropic, Google, Ollama, LM Studio.
- **Filesystem** (`src-tauri/src/filesystem/`): directory listing, file collection, rename execution.
- **History** (`src-tauri/src/history/`): undo persistence and store.
- **Domain** (`src-tauri/src/domain/`): rename planning, conflict detection, sanitization.

### Frontend ↔ Backend Contract

Rust commands in `lib.rs` map to TypeScript calls via Tauri `invoke()`. When adding a command, update both sides: Rust handler + frontend service.

## Key Constraints

- **Vite port locked to 1420** (`vite.config.ts`). Tauri expects this.
- **Linux GTK titlebar removal**: `lib.rs` uses GTK to hide the native titlebar. Linux builds need GTK dev libs.
- **Bundle targets**: `deb`, `rpm` only (`tauri.conf.json`).
- **App identifier**: `com.mintori.renameflow`.

## Pre-commit

`.husky/pre-commit` runs:

1. `npx lint-staged` (`.lintstagedrc.json` — currently empty, no actual linters configured)
2. `npx tsc --noEmit` if TS files staged
3. `cargo check --manifest-path src-tauri/Cargo.toml` if Rust files staged

No ESLint or Prettier is currently configured. TypeScript strict mode is on (`tsconfig.json`).

## State & Data Flow

1. User selects files via `fileService` / `fileStore`
2. `workflowStore.generateAllSuggestions()` → calls `commands::generate_rename_suggestions` (Rust)
3. Rust AI provider generates names → returns suggestions
4. `workflowStore.renameSelectedFiles()` → calls `commands::rename_files` → Rust executes renames + persists history
5. Undo via `commands::undo_last_rename` → Rust restores original names from history store

## Adding Features

- **New Tauri command**: Add to `src-tauri/src/commands/`, re-export in `commands/mod.rs`, register in `lib.rs` invoke handler, add frontend wrapper in `src/services/tauriClient.ts` or relevant service.
- **New AI provider**: Implement trait in `src-tauri/src/ai/`, register in provider module.
- **New settings field**: Update `AppSettings` in `src/types.ts`, Rust settings domain, and both load/save commands.
