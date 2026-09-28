# STATUS

Last updated: 2026-09-28. Update this file at the end of every section.

## Current phase

**Phase 1 (proof of execution): code done, spikes 0/a/b/d green; spike (c) awaits a live test in VS Code by the owner.** Next up after that is **Phase 2 (mandatory Setup)**.

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ✅ done | `docs/architecture/{overview,protocol,webview}.md`, `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | 🟡 spike (c) live test pending | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ⬜ | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ⬜ | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ⬜ | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | ⬜ | `docs/runbook.md`, `docs/CHANGELOG.md` |

## Phase 0 outcome

Verified build, typecheck, lint, unit tests, VSIX (197 KB) and the e2e smoke test in VS Code 1.139. Details: `docs/testing.md`.

## Phase 1 outcome (so far)

- Machine prepared: Bun 1.4.2, `bunx catherd-cli@1.0.0 init --no-input` (default profile, 2 native agents linked), Codex upgraded 0.142.2 → 0.158.0, plugin catherd@catherd 1.0.0 installed through the SDK's bundled Claude binary with the HTTPS workaround. `doctor --json` → ready. The Claude CLI login already existed (claude.ai Pro); it was hidden by leaked env vars.
- Built: gateway (`docs/architecture/gateway.md`), orchestrator session + controller + event mapper (`docs/architecture/orchestrator.md`), protocol `session.*` / `catherd.status`, webview Session page with prompt cards, a browser preview with a VS Code API mock.
- Spikes (`docs/spikes/phase1.md`): plugin load ✅, native agents ✅, 178 s `wait` in the foreground ✅, resume without a duplicate run ✅, runId capture ✅. Prompt cards were verified in the browser preview; **the live test in VS Code is pending (spike c).**
- Tests: 44 unit tests + 6 opt-in live contract tests (6/6 on this machine) + 1 e2e.

## Exact next step

1. **Owner (spike c, live):** in the VS Code window CatHouse opened on the scratch repo (`<scratchpad>/spike-repo`; any throwaway git repo works): trust the folder, open the CatHouse activity-bar icon → **Open dashboard**, enter a small task (e.g. "Add a slugify(s: string) util in src/slugify.ts with a bun test"), **Start task**. Answer the orchestrator's questions and permission cards in the panel. Then reload the window (Developer: Reload Window) mid-run → dashboard → **Resume saved run**. Check that `bunx catherd-cli@1.0.0 runs list --json` shows no duplicate run. Record the result in `docs/spikes/phase1.md` (row c).
2. Then **Phase 2 (Setup)**: `packages/extension/src/setup/` with side-effect-free detectors (Bun, catherd via `bunx catherd-cli@1.0.0 --version`, plugin via `installed_plugins.json`, Claude login via the bundled binary `auth status --json` in a clean env, the standalone claude only for `claude-code:` rungs, backends from `doctor --json`) and click-only installers (the commands in `docs/runbook.md` §1, plugin install with the HTTPS env, `catalog refresh --json` before `doctor --json` after any backend change). Add the gate (Setup-only until the blockers are green) and the Setup page. Write `docs/architecture/setup.md`.

## Environment facts (planning machine, 2026-09-28)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.168 on PATH (too old for `claude-code:` rungs), Bun 1.4.2 (installed 2026-09-28 into ~/.bun), catherd-cli 1.0.0 (bunx cache), Codex 0.158.0, plugin catherd@catherd 1.0.0, opencode not installed, no Jev key. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

## Open questions / risks

- Phase 1 spikes decide whether long `wait` calls survive in an SDK session (see `docs/research/claude-agent-sdk.md` §9).
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.
