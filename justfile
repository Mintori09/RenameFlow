setup:
    pnpm install

build:
    pnpm build

precommit: setup
    npx husky

run: build
    pnpm tauri dev
