# Setup (mandatory gate)

Status: **built in Phase 2.** Source: `packages/extension/src/setup/`; webview `packages/webview/src/setup/`; protocol `packages/protocol/src/setup.ts`.

## Selected orchestration host (2026-10-02)

Setup evaluates only the chosen host's gate: Claude Code uses the bundled Agent SDK binary, Claude catherd plugin and Claude login; Codex uses native CLI >= 0.159.2, the enabled `catherd@catherd` Codex plugin at 1.4.0, and `codex login status`. Bun, catherd-cli 1.4.0, config and user-triggered `doctor` remain common. Switching host in Profile clears the in-memory readiness verdict and rechecks with `CATHERD_ORCHESTRATION_HOST` set to the new host. Codex plugin installation, update, and daemon start or restart actions run only after a Setup click. Starting the daemon may install a managed app-server package. `init` passes `--host` so a terminal lacking session evidence chooses the correct host defaults. `codex app-server daemon version` reports whether the daemon is running and its server version without starting it. CLI/plugin checks have no installer side effects; `doctor` remains explicitly triggered. See ADR 0009 for the live gate still to verify.

## Rule (from the plan)

Until Bun, catherd and the selected host's binary/plugin are good, the dashboard shows **Profile and Setup** (Profile keeps the host switch reachable). After that, a missing selected-host login, a failing backend or an unchecked/failed readiness **disables starting tasks** (`session.start` / `session.resume` refuse with `E_SETUP_REQUIRED`). Installers run **only when the user clicks**. Detectors have no side effects.

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
| catherd | `bunx --no-install catherd-cli@1.4.0 --version` | `--no-install` never downloads; "Could not find an existing … binary" = not installed |
| catherd set up | `<catherd config dir>/config.json` has `activeProfile` | config dir resolved like upstream `paths.ts` (`CATHERD_CONFIG_DIR` → `CATHERD_HOME/config` → `XDG_CONFIG_HOME/catherd` → `~/.config/catherd`); read only |
| bundled Claude | `<bundled> --version` | ships with CatHouse (ADR 0008) |
| plugin | `$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json` → `catherd@catherd` version | must equal `PINNED.plugin` |
| Claude login | `<bundled> auth status --json` → `loggedIn`, `authMethod`, `email` | runs in `processEnv()` (host-session vars stripped; `docs/spikes/phase1.md` finding 3) |
| Codex CLI / account / plugin / daemon (Codex host only) | `codex --version`, `codex login status`, `codex plugin list --json`, `codex app-server daemon version` | selected-host gate; all probes are read-only and the daemon command reports an error when stopped |
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
| `codex-host` / `codex-plugin` / `codex-daemon` | gate on Codex | `install-codex`, `install-codex-plugin` / `update-codex-plugin`, `start-codex-daemon` / `restart-codex-daemon` |
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
| `init-catherd` | `bunx catherd-cli@1.4.0 init --no-input --plain`. 1.1+ also installs the global `catherd` at that version (the plugin's launcher prefers it) and 1.2 syncs the public model sources; an existing profile is kept |
| `install-plugin` | bundled `plugin marketplace add 47vigen/catherd` (or `marketplace update catherd` if `known_marketplaces.json` has it), then `plugin install catherd@catherd`. Both run with `GIT_HTTPS_ENV`. That was the 1.0 SSH workaround; 1.1+ marketplaces fetch over HTTPS, so it is now a harmless no-op kept for old marketplace clones |
| `update-plugin` | `plugin marketplace update catherd` + `plugin update catherd@catherd` |
| `login-claude` | terminal: `'<bundled>' auth login` |
| `install-claude-cli` | `npm i -g @anthropic-ai/claude-code@latest` |
| `start-codex-daemon` / `restart-codex-daemon` | `codex app-server daemon start`; restart first runs `codex app-server daemon stop` |
| `install-codex` / `login-codex` | `npm i -g @openai/codex@latest` / terminal `codex login` |
| `install-opencode` | `bash -c "curl -fsSL https://opencode.ai/v2/install \| bash"` |
| `check-readiness` | none (just the readiness check) |
| `save-api-keys` | Setup calls `CatherdCli.saveApiKeys` in the Gateway, which sends optional Jev and Artificial Analysis keys through stdin to pinned `bunx --no-install catherd-cli@1.4.0 init --no-global --plain --host <selected host>` from the home directory, with source sync disabled. catherd validates each new key and saves it in its own credentials file. Existing saved keys are kept. The action is click-only. |

After an action, Setup re-detects. After `init-catherd`, `install-codex`, `install-opencode`, `install-claude-cli` and `login-codex`, it also refreshes the catalog and runs doctor (only if the gate is open). Terminal actions resolve when the user closes the terminal. A step with a non-zero exit fails the action with `E_SETUP_STEP`; the output stays visible. A second action while one runs → `E_SETUP_BUSY`.

## Protocol

Methods `setup.state`, `setup.check {readiness?}`, `setup.run {action}` and `setup.saveKeys {jevKey?, aaKey?}` (fire and forget). Topic `setup`: `state`, `output {action, chunk}`, `action_done {action, ok, message?}`. VS Code commands: `cathouse.checkSetup` (Command Palette "CatHouse: Check Setup"; runs readiness), plus the hidden `cathouse._runSetupAction` used by e2e tests. `save-api-keys` is accepted only through `setup.saveKeys`, not the generic action method.

Setup works without an open folder: catherd commands then run in the home directory (global active profile). This was a real bug caught by e2e.

## UI

`SetupPage` groups items by level ("Required to use CatHouse" / "Required to start tasks" / "Optional"), with a state glyph, detail, action button (disabled while busy), doctor fix with Copy, a Re-check button, the live output of the running (or last) action, and the result line. When catherd is installed, Setup also shows two optional masked API-key fields and a Save keys button. The fields use component memory only; a successful action clears them. The Gateway sends the keys only on stdin, strips old API-key environment overrides for that invocation, and returns only an `ok` flag; the host publishes no raw `init` output or key-bearing error. It reports whether catherd confirmed saving or already had a saved key, then runs a user-triggered readiness check. Replacing an existing saved key is outside this UI because catherd 1.4.0 `init` deliberately keeps saved credentials; use catherd's own credential flow for replacement. The Activity Bar view shows Profile and Setup until `gateOpen`; then all tabs become available, and Chat's Start/Resume are disabled with `canStartReason` when readiness is incomplete.

Key entry command contract: `printf '%s\n%s\n\nn\n' "$JEV_KEY" "$AA_KEY" | bunx --no-install catherd-cli@1.4.0 init --no-global --plain --host claude-code` illustrates the four input lines (Jev, Artificial Analysis, profile default, do not replace profile). Do not put real keys in shell history. The extension supplies the lines directly to stdin. `TYPESAFE_API_KEY` and `ARTIFICIAL_ANALYSIS_API_KEY` are omitted only for that child process so `init` will prompt and save the input; `CATHERD_NO_SYNC=1` skips an unrelated catalog sync. The working directory is home so a repository binding is not changed by the credential action. The key must not appear in the command arguments, output topic, Output channel, or persisted webview state.

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

Windows (out of v1). Remote hosts (Phase 5). Replacing an already saved API key through a narrow upstream CLI operation remains unavailable in catherd 1.4.0.
