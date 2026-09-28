# 0003: pnpm workspaces toolchain

- Status: accepted (2026-09-28, user decision)

## Decision
Monorepo with pnpm workspaces. Packages: `protocol` (zod contract), `ui` (shadcn + VS Code tokens), `webview` (React 19 + Vite + Tailwind v4), `extension` (extension host, bundled with esbuild), `compat` (version matrix + fixtures). Lint/format with Biome. Tests: vitest (unit/contract), `@vscode/test-electron` (e2e). Packaging: `@vscode/vsce`.

## Rejected
Bun workspaces: matches catherd, but Bun is not needed to develop CatHouse, and VS Code tooling is Node-first. (Bun is still a *runtime* requirement for users, because catherd runs on it.)
