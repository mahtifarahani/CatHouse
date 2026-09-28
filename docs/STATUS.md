# STATUS

Last updated: 2026-09-28. Update this file at the end of every section.

## Current phase

**Phase −1 (record R&D knowledge): done.** Next up is **Phase 0 (skeleton)**.

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ⏭ next | `docs/architecture/overview.md` (update), `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | ⬜ | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ⬜ | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ⬜ | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ⬜ | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | ⬜ | `docs/runbook.md`, `docs/CHANGELOG.md` |

## Exact next step (Phase 0)

1. Root: `package.json` (private, `packageManager: pnpm@<installed>`), `pnpm-workspace.yaml` (`packages/*`), `tsconfig.base.json` (strict, ES2022, `moduleResolution: bundler`), `biome.json`, `.gitignore`, `.vscodeignore`.
2. `packages/protocol`: zod message envelope `{v:1,id,kind,method,params}` / response / event (plan §قرارداد).
3. `packages/extension`: manifest with the view container, `WebviewView` (`cathouse.sidebar`) and `WebviewPanel` command (`cathouse.openDashboard`), `extensionKind: ["workspace"]`, `capabilities.untrustedWorkspaces.supported: false`; `src/extension.ts`; esbuild script; a strict-CSP webview host that loads the Vite build.
4. `packages/webview` + `packages/ui`: a Vite React app with Tailwind v4 and `--vscode-*` tokens; one placeholder page that round-trips a `ping` request through the protocol.
5. `.vscode/launch.json` (Extension Development Host) and tasks; `pnpm build`, `pnpm test`, `pnpm package` scripts.
6. Write `docs/architecture/overview.md` (as built), `docs/runbook.md` and `docs/testing.md` with the real commands, then tick Phase 0 here.

## Environment facts (planning machine, 2026-09-28)

macOS (Darwin 27), Node 22.13.1 via nvm, pnpm present, `claude` 2.1.168 on PATH (too old for `claude-code:` rungs), **Bun not installed**, catherd not installed. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

## Open questions / risks

- Phase 1 spikes decide whether long `wait` calls survive in an SDK session (see `docs/research/claude-agent-sdk.md` §9).
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.
