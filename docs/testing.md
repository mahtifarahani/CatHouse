# Testing

Status: unit, live-contract (opt-in) and e2e layers exist.

- `CATHOUSE_CONTRACT=1 pnpm test` runs `packages/extension/src/gateway/contract.test.ts` against the real catherd on the machine; `CATHOUSE_RECORD=1` also refreshes `packages/compat/fixtures/1.0.0/`.
- The spike harness (`packages/extension/scripts/spike.ts`, `node build.mjs --spike`) drives a real orchestrator session outside VS Code; see `docs/spikes/phase1.md`.

| Command | Runs |
|---|---|
| `pnpm test` | vitest: `packages/*/src/**/*.test.ts` (config `vitest.config.ts`) |
| `pnpm test:e2e` | `@vscode/test-cli` (config `packages/extension/.vscode-test.mjs`, mocha `tdd` UI, 60 s timeout, `--disable-workspace-trust`): esbuild bundles `src/test/e2e/*.e2e.ts` → `out-test/`, then runs them in an **installed** editor. Nothing is downloaded. Editor order: `$CATHOUSE_TEST_EDITOR`, `/Applications/Visual Studio Code.app/…`, `/Applications/Cursor.app/…` |

Rules: unit-testable host code must not import `vscode` (see `panel/router.ts`, `panel/webview-html.ts`). Files named `*.test.ts` are vitest; files named `*.e2e.ts` run inside VS Code.

E2E env switches: `CATHOUSE_EXPECT_READY=1` (prepared machine), `CATHOUSE_EXPECT_FRESH=1` (fresh HOME), `CATHOUSE_E2E_INSTALL=1` + `CATHOUSE_E2E_GREP=Setup` (run installers on a fresh HOME; slow, downloads Bun/catherd/plugin). See `docs/architecture/setup.md`.

`CATHOUSE_E2E_WORKSPACE=<git repo with catherd runs>` enables `pages.e2e.ts` (runs, profiles, catalog through the real router via the hidden `cathouse._request` command).

Current tests: 76 unit (protocol including workspace-mutation methods, router, CSP, compat, gateway including profile-copy command, event mapper, controller, setup readiness persistence, profile draft/rebase including role checkbox staging), 7 live contract, 5 e2e scenarios (Activity Bar activation; Setup on the real machine; pages: runs, workspace/repo selection, profiles/catalog). Adding/removing folders uses VS Code's native modal picker and changes the real workspace, so that mutation path is a manual VS Code check rather than an unattended e2e action.

**E2E status (2026-09-28): green in VS Code 1.139 (macOS).** The default command has 2 passing and 3 pending because page tests require `CATHOUSE_E2E_WORKSPACE`; the prepared-workspace run has all 5 scenarios.
- Activation verifies that the contributed `cathouse.sidebar.focus` command opens the one full Activity Bar view and that the removed `cathouse.openDashboard` command is absent.
- **Cursor cannot run the e2e tests:** Cursor 3.21.18 (VS Code 1.128 base) logs `Loading development extension …` in its test host but never registers the extension (`vscode.extensions.all` lacks it; extension-path mappings are empty). Workspace trust is not the cause. Its "glass mode" is suspected. The config therefore prefers VS Code.
- Nothing is downloaded: `@vscode/test-electron`'s ~300 MB download was dropped on the owner's request.


| Layer | Tool | What | Needs network / catherd |
|---|---|---|---|
| Unit | vitest | gateway adapters (raw → protocol) on recorded fixtures; stderr error parser; SDK message → event mapper; profile draft reducer and patch diff; allowlist of MCP tools (forbidden tools rejected) | no |
| Contract | vitest, tagged `contract` | real `catherd-cli@1.0.0` in an isolated env (`CATHERD_HOME`, `CLAUDE_CONFIG_DIR`, `CATHERD_CLAUDE_AGENTS_DIR` in temp dirs): `init --no-input` → `doctor --json` → MCP `profile_set` valid/invalid → `profile_validate` → `catalog_query` → `status`. Records fixtures to `packages/compat/fixtures/1.0.0/` | Bun + network on first run |
| E2E | `@vscode/test-electron` | fresh install (temp HOME) shows only Setup; old Bun / stale plugin / missing CLI / failed install each show a specific message and action; the full Activity Bar view opens directly | depends on scenario |
| Manual E2E | human + checklist | a 3-lane task on a scratch repo from the UI; live roles; answer a question and a permission card; reload mid-run → Continue the same run (verify no duplicate with `catherd runs list --json`); cancel a role; edit a profile, treat-like, refresh models, see a doctor failure | real accounts |
| Visual | manual screenshots | full Activity Bar view in Light, Dark, High Contrast | no |

Workspace-management manual check: while New Chat is idle, add two repository folders in one picker operation, confirm the first new folder is selected, switch between them, and remove the selected folder after the second-click confirmation. Confirm the folder disappears from the VS Code workspace but remains on disk, and confirm these controls are absent while a session is starting/running. VS Code may restart the extension host when the first folder changes or when crossing empty/single-root/multi-root workspace modes; the selected repo must be restored after that restart.

Fixtures are real catherd output, redacted. When catherd's version changes, re-record them under a new version folder and add an adapter entry to `compat.json`.
