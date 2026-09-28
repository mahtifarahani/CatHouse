# STATUS

Last updated: 2026-09-28. Update this file at the end of every section.

## Current phase

**Phase 3 (main pages): done.** Next: **Phase 4 (run control polish)**, then Phase 5 (release).

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ✅ done | `docs/architecture/{overview,protocol,webview}.md`, `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | ✅ done | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ✅ done | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ✅ done | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ⏭ next (core done in Phase 1) | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | ⬜ | `docs/runbook.md`, `docs/CHANGELOG.md` |

## Phase 0 outcome

Verified build, typecheck, lint, unit tests, VSIX (197 KB) and the e2e smoke test in VS Code 1.139. Details: `docs/testing.md`.

## Phase 1 outcome (so far)

- Machine prepared: Bun 1.4.2, `bunx catherd-cli@1.0.0 init --no-input` (default profile, 2 native agents linked), Codex upgraded 0.142.2 → 0.158.0, plugin catherd@catherd 1.0.0 installed through the SDK's bundled Claude binary with the HTTPS workaround. `doctor --json` → ready. The Claude CLI login already existed (claude.ai Pro); it was hidden by leaked env vars.
- Built: gateway (`docs/architecture/gateway.md`), orchestrator session + controller + event mapper (`docs/architecture/orchestrator.md`), protocol `session.*` / `catherd.status`, webview Session page with prompt cards.
- Spikes (`docs/spikes/phase1.md`): plugin load ✅, native agents ✅, 178 s `wait` in the foreground ✅, resume without a duplicate run ✅, runId capture ✅. Prompt cards: live test in VS Code done by the owner (spike c).
- Tests at end of Phase 1: 44 unit + 6 live contract + 1 e2e.

## Phase 2 outcome

Setup is built and verified end to end (`docs/architecture/setup.md`): detectors, evaluator, click-only installers, the gate, and the Setup page. E2E on the prepared machine (ready), on a fresh HOME (Setup only), and the full install flow on a fresh HOME (Bun → catherd → plugin opens the gate in ~70 s).

## Phase 3 outcome

Pages built (`docs/architecture/webview.md` §Pages) on a per-repo `CatherdGateway` (`docs/architecture/gateway.md`). ADR 0007 was revised: run files are read via MCP `read_run_file`, so there are no disk reads. The TUI parity checklist is ticked, with three documented gaps. Verified: 65 unit tests; e2e `pages.e2e.ts` against real catherd (runs list/detail/reply/debug, profiles, catalog, unchanged save), which caught two live contract details (object `treatLike`, `name: null`). **Visual check of the pages in VS Code by the owner: pending.**

## Exact next step (Phase 4)

1. Owner: open the dashboard in VS Code (reload the dev-host window, or F5 "Run CatHouse" on a repo with runs) and look through every tab in Light / Dark / High Contrast; report anything off.
2. Phase 4 polish (plan §مرحلهٔ ۴):
   - Start form: repo picker over workspace folders (multi-root: one gateway + one session per repo), permission-mode selector (`setPermissionMode`).
   - Notifications when a prompt card waits and the panel is hidden (`vscode.window.showInformationMessage` with an "Open" action; a badge on the view).
   - "Continue" on a run in the Runs list: resume its saved session (links store) or a fresh `/catherd:catherd`.
   - A `compact_boundary` marker in the transcript (the skill decays after compaction; known issue).
   - Filter `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` out of the OutputChannel.
   - Re-verify spike (c) details: question card, permission card, reload → Resume (owner).
3. Update `docs/architecture/orchestrator.md`, tick Phase 4 here.

## Environment facts (planning machine, 2026-09-28)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.168 on PATH (too old for `claude-code:` rungs), Bun 1.4.2 (installed 2026-09-28 into ~/.bun), catherd-cli 1.0.0 (bunx cache), Codex 0.158.0, plugin catherd@catherd 1.0.0, opencode not installed, no Jev key. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

## Open questions / risks

- Phase 1 spikes decide whether long `wait` calls survive in an SDK session (see `docs/research/claude-agent-sdk.md` §9).
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.
