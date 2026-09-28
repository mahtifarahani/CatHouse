# Testing

Status: unit, live-contract (opt-in) and e2e layers exist.

- `CATHOUSE_CONTRACT=1 pnpm test` runs `packages/extension/src/gateway/contract.test.ts` against the real catherd on the machine; `CATHOUSE_RECORD=1` also refreshes `packages/compat/fixtures/1.0.0/`.
- The spike harness (`packages/extension/scripts/spike.ts`, `node build.mjs --spike`) drives a real orchestrator session outside VS Code; see `docs/spikes/phase1.md`.

| Command | Runs |
|---|---|
| `pnpm test` | vitest: `packages/*/src/**/*.test.ts` (config `vitest.config.ts`) |
| `pnpm test:e2e` | `@vscode/test-cli` (config `packages/extension/.vscode-test.mjs`, mocha `tdd` UI, 60 s timeout, `--disable-workspace-trust`): esbuild bundles `src/test/e2e/*.e2e.ts` → `out-test/`, then runs them in an **installed** editor. Nothing is downloaded. Editor order: `$CATHOUSE_TEST_EDITOR`, `/Applications/Visual Studio Code.app/…`, `/Applications/Cursor.app/…` |

Rules: unit-testable host code must not import `vscode` (see `panel/router.ts`, `panel/webview-html.ts`). Files named `*.test.ts` are vitest; files named `*.e2e.ts` run inside VS Code.

Current tests: 44 unit (protocol, router, CSP, compat, gateway, event mapper, controller), 6 live contract, 1 e2e (activation + command + dashboard tab).

**E2E status (2026-09-28): green in VS Code 1.139 (macOS), 1 passing.**
- The dashboard tab appears asynchronously after `executeCommand` resolves, so the test polls (`waitFor`, 5 s).
- **Cursor cannot run the e2e tests:** Cursor 3.21.18 (VS Code 1.128 base) logs `Loading development extension …` in its test host but never registers the extension (`vscode.extensions.all` lacks it; extension-path mappings are empty). Workspace trust is not the cause. Its "glass mode" is suspected. The config therefore prefers VS Code.
- Nothing is downloaded: `@vscode/test-electron`'s ~300 MB download was dropped on the owner's request.


| Layer | Tool | What | Needs network / catherd |
|---|---|---|---|
| Unit | vitest | gateway adapters (raw → protocol) on recorded fixtures; stderr error parser; SDK message → event mapper; profile draft reducer and patch diff; allowlist of MCP tools (forbidden tools rejected) | no |
| Contract | vitest, tagged `contract` | real `catherd-cli@1.0.0` in an isolated env (`CATHERD_HOME`, `CLAUDE_CONFIG_DIR`, `CATHERD_CLAUDE_AGENTS_DIR` in temp dirs): `init --no-input` → `doctor --json` → MCP `profile_set` valid/invalid → `profile_validate` → `catalog_query` → `status`. Records fixtures to `packages/compat/fixtures/1.0.0/` | Bun + network on first run |
| E2E | `@vscode/test-electron` | fresh install (temp HOME) shows only Setup; old Bun / stale plugin / missing CLI / failed install each show a specific message and action; the dashboard opens after Setup passes | depends on scenario |
| Manual E2E | human + checklist | a 3-lane task on a scratch repo from the UI; live roles; answer a question and a permission card; reload mid-run → Continue the same run (verify no duplicate with `catherd runs list --json`); cancel a role; edit a profile, treat-like, refresh models, see a doctor failure | real accounts |
| Visual | manual screenshots | sidebar and panel in Light, Dark, High Contrast | no |

Fixtures are real catherd output, redacted. When catherd's version changes, re-record them under a new version folder and add an adapter entry to `compat.json`.
