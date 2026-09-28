# STATUS

Last updated: 2026-09-28. Update this file at the end of every section.

## Current phase

**Phase 5 (release prep): code-complete on macOS; external/owner gates remain.** Platform VSIX, extension README, the eight open parity items, accessibility and Light/Dark/High Contrast checks are done. A remote runtime was not available. Waiting on publisher/license/version decisions and native execution of non-arm64 artifacts.

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ✅ done | `docs/architecture/{overview,protocol,webview}.md`, `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | ✅ done | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ✅ done | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ✅ done | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ✅ done | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | 🚧 external gates | `docs/release/phase5.md`, `docs/runbook.md`, `docs/CHANGELOG.md` |

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

Pages built (`docs/architecture/webview.md` §Pages) on a per-repo `CatherdGateway` (`docs/architecture/gateway.md`). ADR 0007 was revised: run files are read via MCP `read_run_file`, so there are no disk reads. At the end of Phase 3, 8 public-surface parity items were still open; Phase 5 closed them. Verified then: 65 unit tests; e2e `pages.e2e.ts` against real catherd (runs list/detail/reply/debug, profiles, catalog, unchanged save), which caught two live contract details (object `treatLike`, `name: null`).

## Phase 4 outcome

Repo picker, permission modes, prompt badge + notification, cancel note, Continue from a run, compaction marker, Discard confirm (`docs/architecture/orchestrator.md` §Phase 4). 67 unit + 5 e2e green. The parity items left at this checkpoint were completed in Phase 5.

## Phase 5 outcome

All eight remaining public-surface parity items are ticked. The dashboard has a live status line and ARIA tab navigation; Profiles has help, `/` filtering, accessible activation/revert/switch dialogs, dirty-close guarding, and a tested three-way rebase for edits made during Save. Toasts use an accessible live region and model usability is not colour-only. Light Modern, Dark Modern and Dark High Contrast were inspected in the real Extension Development Host; Arrow-key tab navigation was verified through the accessibility tree. A stale-webview bug found during the pass was fixed with per-attach cache keys. Verification: lint, 68 unit tests, typecheck, build, and default e2e (2 passed, 3 workspace-dependent pending). Full report: `docs/release/phase5.md`.

Post-checkpoint UX correction: the status-only sidebar, Open Dashboard button and separate editor panel were removed. The entire app now renders directly in the CatHouse Activity Bar view, notifications reveal that view, and New Chat is the default tab for each fresh webview load. This exact layout and default selection were verified in the real Extension Development Host.

## Exact next step (Phase 5)

1. Owner chooses the publisher id, SPDX license, and whether to publish as `0.1.0`; update the manifest and generate the license file.
2. On an available SSH host or Dev Container, install the linux-x64 VSIX on the remote extension host and run Setup plus one short task. Docker is installed on this Mac but its daemon was not running; no SSH/Dev Container target was available, so remote remains explicitly untested.
3. Execute the darwin-x64 and Linux VSIX artifacts on native target machines. They are build-verified only.
4. After these gates, set Phase 5 to done and start the owner's bug/improvement backlog.

## Environment facts (planning machine, 2026-09-28)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.168 on PATH (too old for `claude-code:` rungs), Bun 1.4.2 (installed 2026-09-28 into ~/.bun), catherd-cli 1.0.0 (bunx cache), Codex 0.158.0, plugin catherd@catherd 1.0.0, opencode not installed, no Jev key. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

## Open questions / risks

- Phase 1 spikes decide whether long `wait` calls survive in an SDK session (see `docs/research/claude-agent-sdk.md` §9).
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.
