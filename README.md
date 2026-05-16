# RenameFlow

AI-powered batch file renaming for your desktop. Select files, generate intelligent names with local or cloud LLMs, preview changes, and rename — with full undo history.

Built with **Tauri v2** (Rust backend) + **React 19 + TypeScript** frontend.

## Features

- **Smart Rename Suggestions** — Uses AI providers (OpenAI, Anthropic, Google, Ollama, LM Studio) to generate meaningful file names from content.
- **Batch Operations** — Rename hundreds of files at once with a single click.
- **Undo History** — Full persistent undo. Made a mistake? Revert any rename session.
- **Local & Private** — Works entirely offline with local models via Ollama or LM Studio.
- **Multiple Formats** — kebab-case, snake_case, Title Case, camelCase.
- **Folder Browser** — Native file tree with checkbox selection. Click a folder row to expand and select all children. Drag across files to multi-select, Shift+click for range, Ctrl+click for individual toggle.
- **AI Providers** — OpenAI-compatible, Anthropic, Google, Ollama, LM Studio. API key field available for any provider. Fetch available models from the provider API.
- **Drag & Drop** — Drop folders directly into the app.

## Development

- `just run` — Start the full dev environment (installs deps + `pnpm tauri dev`).
- `pnpm dev` — Frontend only on port `1420`.
- `pnpm build` — Production Vite build.
- `cargo check --manifest-path src-tauri/Cargo.toml` — Rust validation.

## Build

- `just build` — Shorthand for `pnpm build`.
- `cargo tauri build` — Build the native application bundle (`.deb`, `.rpm` on Linux).

## License

MIT
