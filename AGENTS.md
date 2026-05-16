# RenameFlow

Tauri v2 + React 19 + TypeScript. AI-powered batch file renamer.

## Commands

| Command | What |
|---------|------|
| `pnpm dev` | Frontend-only on `:1420` |
| `pnpm tauri dev` | Full Tauri dev (also runs `pnpm dev`) |
| `pnpm build` | `tsc && vite build` |
| `pnpm test` | Vitest run (globals: true, env: node) |
| `just run` | Full dev entry (installs deps + tauri dev) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust check |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust unit tests |
| `cargo test --manifest-path src-tauri/Cargo.toml --test ollama_test -- --ignored --nocapture` | Ollama integration tests |

## Pre-commit

`.husky/pre-commit`: lint-staged → tsc --noEmit (if ts/tsx staged) → cargo check (if rs staged). lint-staged config has empty command arrays — tsc + cargo are the real gates.

## Architecture

- **5 Zustand stores**: `fileStore`, `historyStore`, `recentStore`, `settingsStore`, `workflowStore` — cross-reference each other directly via `useXStore.getState()`.
- **Services** are thin `invoke` wrappers. Use `tauriClient.ts` helper.
- **Rust commands** in `src-tauri/src/commands/` — register new ones in `lib.rs` `generate_handler!` macro.
- **AI providers**: OpenAI-compatible (default), Ollama, LM Studio → same API; Anthropic, Google have dedicated paths. API keys fallback to env vars (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`).
- **Conventions**: kebab-case CSS classes, single `App.css`, `crypto.randomUUID()` for file IDs. Button classes: `.btn`, `.btn-sm`, `.btn.primary`.

## Persistence

| File | Location |
|------|----------|
| Providers | `~/.config/renameflow/providers.json` |
| Recent folders | `~/.config/renameflow/recent_folders.json` |
| Workspace profiles | `~/.config/renameflow/workspace_profiles.json` |
| Rename history | `<app_data_dir>/history.json` (atomic write via `.json.tmp`) |

Provider model IDs use `${name}::${model}` format. Old provider JSON is auto-migrated on load.

## Source quirks

- `list_directory` skips dot-files (`.name.starts_with('.')`).
- Dev profile: `codegen-units=256`, `incremental=true`, `debug=0`, dep `opt-level=2`.
- `domain/rename.ts` `applyFilenameStyle` duplicates Rust `sanitize.rs` `apply_style` — frontend version may be stale.
- `src/types.ts` and `src/domain/files.ts` both define `FileStatus` — avoid drift.
- Tauri v2: `invoke` from `@tauri-apps/api/core`, not `@tauri-apps/api/tauri`.
- `VITE_TAURI_HOST` env var used for HMR config in vite.config.ts.
