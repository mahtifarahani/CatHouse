# STATUS

Last updated: 2026-09-28. Update this file at the end of every section.

## Current phase

**Phase 2 (mandatory Setup): done.** Next: **Phase 3 (main pages: Overview, Runs, Profiles, Models, Diagnostics)**.

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ✅ done | `docs/architecture/{overview,protocol,webview}.md`, `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | ✅ done | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ✅ done | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ⏭ next | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ⬜ | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | ⬜ | `docs/runbook.md`, `docs/CHANGELOG.md` |

## Phase 0 outcome

Verified build, typecheck, lint, unit tests, VSIX (197 KB) and the e2e smoke test in VS Code 1.139. Details: `docs/testing.md`.

## Phase 1 outcome (so far)

- Machine prepared: Bun 1.4.2, `bunx catherd-cli@1.0.0 init --no-input` (default profile, 2 native agents linked), Codex upgraded 0.142.2 → 0.158.0, plugin catherd@catherd 1.0.0 installed through the SDK's bundled Claude binary with the HTTPS workaround. `doctor --json` → ready. The Claude CLI login already existed (claude.ai Pro); it was hidden by leaked env vars.
- Built: gateway (`docs/architecture/gateway.md`), orchestrator session + controller + event mapper (`docs/architecture/orchestrator.md`), protocol `session.*` / `catherd.status`, webview Session page with prompt cards.
- Spikes (`docs/spikes/phase1.md`): plugin load ✅, native agents ✅, 178 s `wait` in the foreground ✅, resume without a duplicate run ✅, runId capture ✅. Prompt cards: live test in VS Code done by the owner (spike c).
- Tests: 44 unit tests + 6 opt-in live contract tests (6/6 on this machine) + 1 e2e.

## Phase 2 outcome

Setup is built and verified end to end (`docs/architecture/setup.md`): detectors, evaluator, click-only installers, the gate, and the Setup page. E2E on the prepared machine (ready), on a fresh HOME (Setup only), and the full install flow on a fresh HOME (Bun → catherd → plugin opens the gate in ~70 s).

## Exact next step (Phase 3)

Use `docs/research/catherd-tui-parity.md` as the checklist, and tick items as they ship.
1. Gateway additions: `RunFilesReader` for `routes.jsonl` (ADR 0007); MCP-backed reads `result`, `runs_summary`, `read_run_file`, `profile_get`, `catalog_query`; CLI `profile use/new/copy/rm`, `catalog refresh`, `catalog treat-like`, `runs cancel` (or MCP `cancel` + a note to the live session). Record fixtures for a run with records (the spike runs exist on this machine: `20260928-101130-spike-long-wait` and the owner's run).
2. Protocol models + methods per page (`runs.list`, `runs.get`, `runs.cancelRole`, `profiles.*`, `catalog.*`, `diagnostics.*`), mapped from raw catherd shapes in the gateway.
3. Pages: Overview, Runs list + detail (budget bar, LIVE/CLIMBS/ROUTES/LANDED/STATE, records, debug, reply), Profiles (tree, staged draft with undo/redo, diff-then-save via `profile_set`, Save & make active, new/copy/rm), Models (filter, refresh, treat-like), Diagnostics (doctor rows, logs folder, `lock`, `capture-fixtures`). Polling: runs 2 s, open run 1 s, pausable.
4. Write `docs/architecture/pages.md` (or extend `webview.md`) and tick the parity checklist.

## Environment facts (planning machine, 2026-09-28)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.168 on PATH (too old for `claude-code:` rungs), Bun 1.4.2 (installed 2026-09-28 into ~/.bun), catherd-cli 1.0.0 (bunx cache), Codex 0.158.0, plugin catherd@catherd 1.0.0, opencode not installed, no Jev key. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

## Open questions / risks

- Phase 1 spikes decide whether long `wait` calls survive in an SDK session (see `docs/research/claude-agent-sdk.md` §9).
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.
