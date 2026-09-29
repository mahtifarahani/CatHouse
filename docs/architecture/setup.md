# Setup (mandatory gate)

Status: **built in Phase 2.** Source: `packages/extension/src/setup/`; webview `packages/webview/src/setup/`; protocol `packages/protocol/src/setup.ts`.

## Rule (from the plan)

Until Bun, catherd, the Claude plugin and the bundled Claude binary are good, the dashboard shows **only Setup**. After that, a missing Claude login, a failing backend or an unchecked/failed readiness only **disables starting tasks** (`session.start` / `session.resume` refuse with `E_SETUP_REQUIRED`). Installers run **only when the user clicks**. Detectors have no side effects.

## Files

| File | What |
|---|---|
| `facts.ts` | `SetupFacts`: what the detectors learned |
| `binary.ts` | `bundledClaudePath()`: resolves `@anthropic-ai/claude-agent-sdk-<platform>-<arch>/claude` relative to the SDK package (pnpm doesn't hoist it); tries the `-musl` variant on Linux |
| `detect.ts` | `detect(deps)`: side-effect-free probes, run in parallel |
| `evaluate.ts` | `evaluate(facts, pin)` (pure): items + `gateOpen` + `canStart` + `canStartReason` |
| `actions.ts` | `stepsFor(action, ctx)`: installer steps; `GIT_HTTPS_ENV`; `REFRESH_AFTER` |
| `service.ts` | `SetupService`: `state()`, `check({readiness, refresh})`, `run(action)` (one at a time, output streamed), and persistence of the last user-triggered readiness result |

## Detectors (`detect.ts`)

| Fact | Probe | Why this probe |
|---|---|---|
| Bun | `bun --version` | ≥ `PINNED.bun` (1.4.0) |
| catherd | `bunx --no-install catherd-cli@1.2.0 --version` | `--no-install` never downloads; "Could not find an existing … binary" = not installed |
| catherd set up | `<catherd config dir>/config.json` has `activeProfile` | config dir resolved like upstream `paths.ts` (`CATHERD_CONFIG_DIR` → `CATHERD_HOME/config` → `XDG_CONFIG_HOME/catherd` → `~/.config/catherd`); read only |
| bundled Claude | `<bundled> --version` | ships with CatHouse (ADR 0008) |
| plugin | `$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json` → `catherd@catherd` version | must equal `PINNED.plugin` |
| Claude login | `<bundled> auth status --json` → `loggedIn`, `authMethod`, `email` | runs in `processEnv()` (host-session vars stripped; `docs/spikes/phase1.md` finding 3) |
| needs claude CLI | `catherd profile show --json` contains a `"claude-code:` rung in roles or failover | ADR 0001 |
| claude CLI | `claude --version` (only when needed) | ≥ `PINNED.claudeCode` (2.1.282) |
| readiness | `catherd doctor --json` (+ `catalog refresh --json` first after backend changes) | **has side effects**: runs only on "Check readiness", after installs, or via `cathouse.checkSetup` |

The last successful doctor report and its timestamp are stored under `cathouse.readiness.v1` in VS Code `workspaceState`. On a later extension activation, side-effect-free detection runs normally and the stored report is merged back into the facts, so Chat does not revert to “not checked yet”. Restoring this snapshot never runs doctor. A later user-triggered doctor failure clears the snapshot instead of leaving stale green readiness behind.

## Items and levels (`evaluate.ts`)

| Item id | Level | Actions |
|---|---|---|
| `bun` | gate | `install-bun` / `upgrade-bun` |
| `claude-bundled` | gate | none (fix: reinstall the platform VSIX) |
| `catherd` | gate | `init-catherd` (offered only once Bun is OK) |
| `plugin` | gate | `install-plugin` / `update-plugin` (needs the bundled binary) |
| `claude-login` | start | `login-claude` |
| `claude-cli` | start (only with claude-code rungs) | `install-claude-cli` |
| `doctor:<check id>` | fail → start; warn → optional; `info` rows (catherd 1.1+), `access:full`, `access:advisory`, `sandbox:codex` and skips → info. 1.2 adds `sources`, `push` (always `skip`/"no session" from CatHouse, whose env has no Claude session), `mcp` and `access:<backend>` rows | `backend:codex` → `install-codex` / `login-codex`; `backend:opencode` → `install-opencode`; others show doctor's `fix` with a Copy button |
| `readiness` | start | `check-readiness` |

Doctor rows `bun` and `plugin` are hidden (CatHouse has its own items for them).

## Installers (`actions.ts`)

| Action | Steps |
|---|---|
| `install-bun` | `bash -c "curl -fsSL https://bun.sh/install \| bash"` |
| `upgrade-bun` | `bun upgrade` |
| `init-catherd` | `bunx catherd-cli@1.2.0 init --no-input --plain`. 1.1+ also installs the global `catherd` at that version (the plugin's launcher prefers it) and 1.2 syncs the public model sources; an existing profile is kept |
| `install-plugin` | bundled `plugin marketplace add 47vigen/catherd` (or `marketplace update catherd` if `known_marketplaces.json` has it), then `plugin install catherd@catherd`. Both run with `GIT_HTTPS_ENV`. That was the 1.0 SSH workaround; 1.1+ marketplaces fetch over HTTPS, so it is now a harmless no-op kept for old marketplace clones |
| `update-plugin` | `plugin marketplace update catherd` + `plugin update catherd@catherd` |
| `login-claude` | terminal: `'<bundled>' auth login` |
| `install-claude-cli` | `npm i -g @anthropic-ai/claude-code@latest` |
| `install-codex` / `login-codex` | `npm i -g @openai/codex@latest` / terminal `codex login` |
| `install-opencode` | `bash -c "curl -fsSL https://opencode.ai/v2/install \| bash"` |
| `check-readiness` | none (just the readiness check) |

After an action, Setup re-detects. After `init-catherd`, `install-codex`, `install-opencode`, `install-claude-cli` and `login-codex`, it also refreshes the catalog and runs doctor (only if the gate is open). Terminal actions resolve when the user closes the terminal. A step with a non-zero exit fails the action with `E_SETUP_STEP`; the output stays visible. A second action while one runs → `E_SETUP_BUSY`.

## Protocol

Methods `setup.state`, `setup.check {readiness?}`, `setup.run {action}` (fire and forget). Topic `setup`: `state`, `output {action, chunk}`, `action_done {action, ok, message?}`. VS Code commands: `cathouse.checkSetup` (Command Palette "CatHouse: Check Setup"; runs readiness), plus the hidden `cathouse._runSetupAction` used by e2e tests.

Setup works without an open folder: catherd commands then run in the home directory (global active profile). This was a real bug caught by e2e.

## UI

`SetupPage` groups items by level ("Required to use CatHouse" / "Required to start tasks" / "Optional"), with a state glyph, detail, action button (disabled while busy), doctor fix with Copy, a Re-check button, the live output of the running (or last) action, and the result line. The Activity Bar view shows only Setup until `gateOpen`; then all tabs become available, and Chat's Start/Resume are disabled with `canStartReason` when readiness is incomplete.

## Verified (2026-09-28)

- Unit (`setup.test.ts`, 11 tests): the evaluator on fresh/ready/stale/login/backend/claude-code cases, the actions, detectors with a fake runner (no install, config and plugin files), the service (one action at a time, streamed output, recheck), and readiness restoration across service instances without a second doctor call.
- E2E on the prepared dev machine (`CATHOUSE_EXPECT_READY=1 npx vscode-test` in `packages/extension`): all gate items ok, login ok, readiness ok, `canStart: true`.
- E2E on a **fresh HOME** with a minimal PATH (`env -i HOME=<tmp> … CATHOUSE_EXPECT_FRESH=1`): Setup only, `install-bun` / `install-plugin` offered, bundled Claude ok.
- E2E **install flow** on a fresh HOME (`CATHOUSE_E2E_INSTALL=1 CATHOUSE_E2E_GREP=Setup`): pressing Install Bun → Install and set up catherd → Install plugin turned each item green and opened the gate in ~70 s. Only the Claude login remained, as expected in an isolated HOME.

```bash
# inside packages/extension, after `node build.mjs --e2e`
FRESH=$(mktemp -d)
env -i HOME=$FRESH USER=$USER TERM=dumb SHELL=/bin/zsh PATH=/usr/bin:/bin:/usr/sbin:/sbin:$(dirname $(which node)) CATHOUSE_E2E_INSTALL=1 CATHOUSE_E2E_GREP=Setup npx vscode-test
```

## Not covered yet

Windows (out of v1). Remote hosts (Phase 5). A Setup item for a Jev key (optional; doctor shows its row with the fix).
