# Runbook (dev machine from zero)

Status: Phase 0 build, run and package commands are real and verified.

## 1. Prerequisites (macOS or Linux)

```bash
# Node 22+ and pnpm
node --version
pnpm --version
```

```bash
# Bun >= 1.4 (catherd runs on Bun)
curl -fsSL https://bun.sh/install | bash
```

```bash
# catherd 1.0.0: first run is silent ~30 s while bunx resolves packages
bunx catherd-cli@1.0.0 init --no-input
```

```bash
# Claude plugin, with the HTTPS workaround for the SSH-only marketplace source
claude plugin marketplace add 47vigen/catherd
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com: claude plugin install catherd@catherd
```

```bash
# Default worker backend (Codex >= 0.157.0), then log in
npm i -g @openai/codex
codex login
```

```bash
# Verify: exit 3 means not ready; read each failing row's fix
bunx catherd-cli@1.0.0 doctor
```

Once CatHouse's Setup screen exists, it performs these steps from buttons. Use the manual commands above only to prepare a dev machine or to debug Setup.

## 2. Isolated catherd environment for tests

`CATHERD_HOME=$(mktemp -d)` puts catherd's config and data under that folder. The Claude side (`~/.claude/agents`, plugins) is still shared unless `CLAUDE_CONFIG_DIR` and `CATHERD_CLAUDE_AGENTS_DIR` also point to temp dirs. Use all three for contract tests.

## 3. Build, run, package

The repo pins `packageManager: pnpm@10.29.1`. If `pnpm` fails with "Failed to switch pnpm to vX", a `package.json` higher up (e.g. `~/package.json`) pins a broken pnpm. Running inside this repo uses the repo's pin.

```bash
pnpm install
```

```bash
# webview (Vite → packages/extension/dist/webview) then extension (esbuild → packages/extension/dist/extension.js)
pnpm build
```

| Command | What |
|---|---|
| `pnpm typecheck` | `tsc` in every package (TypeScript 7) |
| `pnpm lint` | Biome check (formatter + linter); `pnpm format` writes fixes. Note: the `rtk` shell wrapper can print "Linter process terminated abnormally"; run `rtk proxy pnpm exec biome check .` to see Biome's real output |
| `pnpm test` | vitest unit tests (`packages/*/src/**/*.test.ts`) |
| `pnpm test:e2e` | builds, then runs `packages/extension/src/test/e2e/*.e2e.ts` inside a downloaded VS Code (`@vscode/test-cli`, cache in `packages/extension/.vscode-test/`, ~300 MB on first run) |
| `pnpm watch:webview` / `pnpm watch:extension` | rebuild on change (run both, then reload the dev host window) |
| `pnpm package` | build + platform VSIX for this machine → `dist/cathouse-<target>-<version>.vsix` (~96–105 MB: includes the Agent SDK's Claude binary; ADR 0008) |
| `pnpm package:all` | VSIX for darwin-arm64, darwin-x64, linux-x64, linux-arm64 (other targets' binaries fetched with `npm pack`) |

**Run in a dev host:** open the repo in VS Code (or Cursor), press F5 and pick **Run CatHouse** (`.vscode/launch.json`; its preLaunchTask runs `pnpm build`). The activity bar shows the CatHouse icon. Its sidebar has "Open dashboard" and "Check connection" (an `app.ping` round-trip).

**Install the VSIX:** `code --install-extension dist/cathouse-<target>-<version>.vsix` (or Extensions → … → Install from VSIX). To test without touching your real extensions: `code --extensions-dir <tmp> --install-extension …`, then `CATHOUSE_E2E_EXT_PATH=<tmp>/cathouse.cathouse-<version> npx vscode-test` in `packages/extension`.

**Packaging notes:**
- Packaging stages a clean folder (`packages/extension/.pkg/<target>/`) instead of packing the source folder, so there is no `.vscodeignore` in the source tree; the staged one only drops `*.map` and `*.d.ts`.
- Everything except the Agent SDK is bundled by esbuild/Vite; the SDK ships as files in `node_modules` (ADR 0008).
- Publisher `cathouse` and license `UNLICENSED` are placeholders (`--skip-license`, `--allow-missing-repository`) until the owner picks real values.

## 4. Remote verification

`extensionKind: ["workspace"]` makes the extension host, Bun, catherd, the plugin and worker backends run on the SSH/Dev Container side. Open a remote git repository, install the matching Linux VSIX on the remote extension host, and repeat Setup plus one short run. Phase 5 could not execute this check because no SSH host or Dev Container runtime was available on the planning machine; linux-x64 is build-verified only.

## 5. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `ssh: connect to host github.com port 22` on plugin install | marketplace `git-subdir` source uses SSH | use the `GIT_CONFIG_*` HTTPS env above |
| `error E_RUNTIME_TOO_OLD` | Bun < 1.4 | `bun upgrade` |
| doctor `plugin` row "stale" | plugin version ≠ catherd version | `claude plugin marketplace update catherd && claude plugin update catherd@catherd`, then a new session |
| `Agent type … not found` in a run | profile agents changed after the session started | start a new orchestrator session |
| doctor `sandbox:codex` "not tested" | dead probe on Codex 0.157 (upstream bug) | ignore |
| `bunx` seems hung on first run | resolving ~108 packages | wait ~30 s |
