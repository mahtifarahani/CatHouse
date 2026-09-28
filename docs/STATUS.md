# STATUS

Last updated: 2026-09-28. Update this file at the end of every section.

## Current phase

**Phase 0 (skeleton): done** (e2e green in VS Code). Next up is **Phase 1 (proof of execution + spikes)**.

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ✅ done | `docs/architecture/{overview,protocol,webview}.md`, `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | ⏭ next | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ⬜ | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ⬜ | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ⬜ | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | ⬜ | `docs/runbook.md`, `docs/CHANGELOG.md` |

## Phase 0 outcome

- Verified: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (13 tests), `pnpm package` → `dist/cathouse-0.0.1.vsix` (10 files, 197 KB, no source maps).
- `pnpm test:e2e`: 1 passing in VS Code 1.139 (Cursor cannot host the tests; see `docs/testing.md`).
- Deviations from the plan: none in scope. Webview strings use a local `t()` table for now (`packages/webview/src/lib/strings.ts`), to become `@vscode/l10n` when a second locale arrives.

## Exact next step

2. **Phase 1** needs Bun ≥ 1.4, `catherd-cli@1.0.0` (`init --no-input`), the catherd plugin (HTTPS workaround) and a Claude login on this machine. Ask the owner before installing them.
3. Phase 1 code:
   - `packages/extension/src/gateway/`: `cli.ts` (spawn `bunx catherd-cli@1.0.0`, parse `--json` and stderr errors into `CatherdError`), `mcp-client.ts` (long-lived stdio MCP client, tool allowlist per ADR 0005), a version handshake, and `packages/compat/compat.json`.
   - `packages/extension/src/orchestrator/`: an Agent SDK `query()` session per the plan; `runId` capture from `run_start`.
   - Protocol methods: `catherd.status`, `catherd.doctor`, `session.start`, session events.
4. Run the four spikes in `docs/research/claude-agent-sdk.md` §9; write `docs/spikes/phase1.md`, `docs/architecture/gateway.md` and `docs/architecture/orchestrator.md`.

## Environment facts (planning machine, 2026-09-28)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.168 on PATH (too old for `claude-code:` rungs), **Bun not installed**, catherd not installed. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

## Open questions / risks

- Phase 1 spikes decide whether long `wait` calls survive in an SDK session (see `docs/research/claude-agent-sdk.md` §9).
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.
