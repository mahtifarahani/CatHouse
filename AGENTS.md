# AGENTS.md: start here

**CatHouse** is a VS Code extension that turns [catherd](https://github.com/47vigen/catherd) (npm `catherd-cli@1.2.0`, a Bun-based orchestrator that runs coding agents from a Claude Code session) into a full UI. It has four jobs:
- a mandatory **Setup** (Bun, catherd, the Claude plugin, login, backends);
- running **`/catherd:catherd <task>`** inside the panel through the Claude Agent SDK, with permission and question cards;
- dashboards: **Runs, Profiles, Models, Diagnostics** (parity with catherd's TUI);
- **resume** after reload.

catherd stays the source of truth. CatHouse never re-implements orchestration and never writes catherd's files.

## Read in this order

1. [`docs/STATUS.md`](docs/STATUS.md): where the project is now and the **exact next step**.
2. [`docs/plan.md`](docs/plan.md): the approved plan (Persian, with English identifiers).
3. [`docs/README.md`](docs/README.md): the map of every document.
4. The research doc for the area you touch (`docs/research/`) and the ADRs (`docs/decisions/`). The catherd research docs describe the 1.0.0 baseline; `docs/research/catherd-1.2-upgrade.md` lists what 1.1/1.2 changed and wins where they differ.

## Hard rules

1. **Document every completed section.** Before moving to the next section (phase, spike, subsystem), write or update its report in `docs/` (architecture doc, spike notes, research corrections), update `docs/STATUS.md` and, if needed, this file. Commit the docs with the code. A section without its report is not done. Reports must be self-contained: no references to chats, exact versions, `path:line` citations (catherd citations at commit `3cee546` (tag `v1.2.0`; the 1.0.0 baseline docs cite `b257da7`)), copy-pasteable commands, invariants and traps, remaining work, next step.
2. **The gateway is the only boundary to catherd** (ADR 0005). Never call `result`, `cancel`, `peek`, `park`, `answer`, `gate_check`, `gate_pass`, `dispatch`, `run_start`, `route`, `preflight`, `climb`, `ask`, `land`, `set_next`, `record_agent_run` or `write_run_file` from CatHouse. Those belong to the orchestrator session. Since catherd 1.1, `result`/`cancel` mark a record read and `peek` claims the run, which would stop catherd from pushing that role to the orchestrator: read replies with `read_run_file` and cancel with the CLI `catherd runs cancel`.
3. **Never write catherd's files.** Profiles change only through MCP `profile_set` or the CLI. Run files are read through MCP `read_run_file` (ADR 0007); Setup only reads `config.json` and Claude's plugin lists.
4. **Pin versions:** `catherd-cli@1.2.0`, plugin `catherd@1.2.0`, `@anthropic-ai/claude-agent-sdk@0.3.283` (≥ 0.3.282). A version outside `packages/compat/compat.json` shows the Upgrade screen and runs nothing.
5. **Installers run only after a user click.** Detectors have no side effects. `catherd doctor` has side effects, so it never runs on a timer.
6. **Secrets never reach logs.** This covers the Jev key, tokens and env values.
7. Commit messages: conventional commits.
8. **Deliver only the VS Code extension.** No websites, standalone web apps or browser previews. (A dev-only browser preview of the webview was deleted on the owner's request on 2026-09-28.) Test tools that exercise the extension's own code (unit/contract/e2e tests, `packages/extension/scripts/spike.ts`) are fine.

## Stack (ADR 0003)

pnpm workspaces · TypeScript · extension host bundled with esbuild · webview in React 19 + Vite + Tailwind v4 + shadcn/ui (colours from `--vscode-*` variables) · zod contracts · vitest · `@vscode/test-electron` · `@vscode/vsce` (one VSIX per platform, ADR 0008). UI in English, i18n-ready (ADR 0004).

## Layout (target; see `docs/architecture/overview.md`)

```
packages/protocol   webview⇄host contract (zod) + stable models
packages/ui         shared components/tokens
packages/webview    React app
packages/extension  extension host: setup/, gateway/, orchestrator/, panel/, state/
packages/compat     compat.json + contract fixtures per catherd version
docs/               knowledge base (this is where you write reports)
```

## Commands

`pnpm install` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:e2e` (runs in the installed VS Code; Cursor can't host it) · `pnpm package`. F5 → "Run CatHouse". A Git tag `vX.Y.Z` publishes the platform VSIX files (`docs/release/github.md`). Details: `docs/runbook.md`, `docs/testing.md`. Keep them in sync.

## Machine prerequisites to run CatHouse against real catherd

Node ≥ 22, pnpm, Bun ≥ 1.4, `bunx catherd-cli@1.2.0 init --no-input --plain` (also installs the global `catherd`), the catherd plugin 1.2.0 (`claude plugin marketplace add 47vigen/catherd && claude plugin install catherd@catherd`; HTTPS since 1.1), a Claude login, and at least one worker backend (Codex ≥ 0.157.0 by default). Details are in `docs/runbook.md`.
