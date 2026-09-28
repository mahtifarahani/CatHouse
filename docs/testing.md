# Testing

Status: unit and e2e layers exist (Phase 0). Contract tests arrive with the gateway (Phase 1).

| Command | Runs |
|---|---|
| `pnpm test` | vitest: `packages/*/src/**/*.test.ts` (config `vitest.config.ts`) |
| `pnpm test:e2e` | `@vscode/test-cli` (config `packages/extension/.vscode-test.mjs`, mocha `tdd` UI, 60 s timeout, `--disable-workspace-trust`): esbuild bundles `src/test/e2e/*.e2e.ts` → `out-test/`, then runs them in an **installed** editor. Nothing is downloaded. Editor order: `$CATHOUSE_TEST_EDITOR`, `/Applications/Visual Studio Code.app/…`, `/Applications/Cursor.app/…` |

Rules: unit-testable host code must not import `vscode` (see `panel/router.ts`, `panel/webview-html.ts`). Files named `*.test.ts` are vitest; files named `*.e2e.ts` run inside VS Code.

Current tests: protocol envelope (4), router error paths (7), webview CSP/HTML (2), e2e activation + command + dashboard tab (1).

**E2E status (2026-09-28): not yet green; needs VS Code installed.**
- On the dev machine only Cursor 3.21.18 (VS Code 1.128 base) is installed. In Cursor the test host logs `Loading development extension at …/packages/extension`, yet `vscode.extensions.all` never contains it: the extension-path mappings are empty, so `cathouse.cathouse` is "not installed". This is not the trust setting (tested with `untrustedWorkspaces.supported: true`: same result). Cursor logs "Extension isolation is disabled (forced disabled in glass mode)"; its agent-first "glass" mode is the suspected cause.
- Downloading VS Code through `@vscode/test-electron` (~300 MB) was abandoned on the owner's request. Install VS Code instead and the config picks it up automatically.
- Manual F5 in Cursor (normal, non-test window) has not been tried yet.


| Layer | Tool | What | Needs network / catherd |
|---|---|---|---|
| Unit | vitest | gateway adapters (raw → protocol) on recorded fixtures; stderr error parser; SDK message → event mapper; profile draft reducer and patch diff; allowlist of MCP tools (forbidden tools rejected) | no |
| Contract | vitest, tagged `contract` | real `catherd-cli@1.0.0` in an isolated env (`CATHERD_HOME`, `CLAUDE_CONFIG_DIR`, `CATHERD_CLAUDE_AGENTS_DIR` in temp dirs): `init --no-input` → `doctor --json` → MCP `profile_set` valid/invalid → `profile_validate` → `catalog_query` → `status`. Records fixtures to `packages/compat/fixtures/1.0.0/` | Bun + network on first run |
| E2E | `@vscode/test-electron` | fresh install (temp HOME) shows only Setup; old Bun / stale plugin / missing CLI / failed install each show a specific message and action; the dashboard opens after Setup passes | depends on scenario |
| Manual E2E | human + checklist | a 3-lane task on a scratch repo from the UI; live roles; answer a question and a permission card; reload mid-run → Continue the same run (verify no duplicate with `catherd runs list --json`); cancel a role; edit a profile, treat-like, refresh models, see a doctor failure | real accounts |
| Visual | manual screenshots | sidebar and panel in Light, Dark, High Contrast | no |

Fixtures are real catherd output, redacted. When catherd's version changes, re-record them under a new version folder and add an adapter entry to `compat.json`.
