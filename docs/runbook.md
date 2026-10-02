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
# catherd 1.4.0: installs the global `catherd` too, syncs the public model sources,
# and keeps an existing profile. The first bunx resolve is silent ~30 s.
bunx catherd-cli@1.4.0 init --no-input --plain </dev/null
```

```bash
# Claude plugin (1.1+ fetches over HTTPS; no SSH key needed)
claude plugin marketplace add 47vigen/catherd
claude plugin install catherd@catherd
```

```bash
# Default worker backend (Codex >= 0.157.0), then log in
npm i -g @openai/codex
codex login
```

```bash
# Verify: exit 3 means not ready; read each failing row's fix
bunx catherd-cli@1.4.0 doctor
```

```bash
# Upgrading a machine from catherd 1.0.0 (then start a new orchestrator session)
claude plugin marketplace update catherd && claude plugin update catherd@catherd
```

Run `init` from a clean shell. A shell inside a Claude Code session carries `CLAUDE_CODE_*` variables, and `catherd doctor` would then probe that session's inbox (`push` row). CatHouse's own processes never see those variables.

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
| `pnpm release:notes --tag vX.Y.Z` | print the GitHub Release body for that tag; fails if the manifest version or changelog section does not match |

**Run in a dev host:** open the repo in VS Code (or Cursor), press F5 and pick **Run CatHouse** (`.vscode/launch.json`; its preLaunchTask runs `pnpm build`). The Activity Bar shows the CatHouse icon; selecting it opens the complete application directly, with Chat as the default tab after Setup is complete.

**Install the VSIX:** `code --install-extension dist/cathouse-<target>-<version>.vsix` (or Extensions → … → Install from VSIX). To test without touching your real extensions: `code --extensions-dir <tmp> --install-extension …`, then `CATHOUSE_E2E_EXT_PATH=<tmp>/cathouse.cathouse-<version> npx vscode-test` in `packages/extension`.

**Packaging notes:**
- Packaging stages a clean folder (`packages/extension/.pkg/<target>/`) instead of packing the source folder, so there is no `.vscodeignore` in the source tree; the staged one only drops `*.map` and `*.d.ts`.
- Everything except the Agent SDK is bundled by esbuild/Vite; the SDK ships as files in `node_modules` (ADR 0008).
- Publisher `cathouse` and license `UNLICENSED` are placeholders (`--skip-license`) until the owner picks real values. The manifest `repository` field points at `https://github.com/mahtifarahani/CatHouse.git`.

## 4. Remote verification

`extensionKind: ["workspace"]` makes the extension host, Bun, catherd, the plugin and worker backends run on the SSH/Dev Container side. Open a remote git repository, install the matching Linux VSIX on the remote extension host, and repeat Setup plus one short run. Phase 5 could not execute this check because no SSH host or Dev Container runtime was available on the planning machine; linux-x64 is build-verified only.

## 5. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `ssh: connect to host github.com port 22` on plugin install | a catherd 1.0 marketplace clone (`git-subdir` over SSH) | `claude plugin marketplace update catherd` (1.1+ uses HTTPS), or pass the `GIT_CONFIG_*` HTTPS env (`url.https://github.com/.insteadOf git@github.com:`) |
| Setup: catherd "found 1.3.0, CatHouse needs 1.4.0" / plugin "outdated" | machine still on an older catherd | click **Install and set up catherd**, then **Update plugin**; start a new chat |
| the chat goes idle right after a role is dispatched | expected since catherd 1.1: roles report back by push | wait for the "catherd reported back" divider; you can chat meanwhile |
| doctor `push` row "no session" | doctor ran outside a Claude Code session (always the case from CatHouse) | nothing to fix; run `catherd doctor` from a Claude Code session's Bash tool to test push |
| `error E_RUNTIME_TOO_OLD` | Bun < 1.4 | `bun upgrade` |
| doctor `plugin` row "stale" | plugin version ≠ catherd version | `claude plugin marketplace update catherd && claude plugin update catherd@catherd`, then a new session |
| `Agent type … not found` in a run | profile agents changed after the session started | start a new orchestrator session |
| doctor `sandbox:codex` "not tested" | dead probe on Codex 0.157 (upstream bug) | ignore |
| `bunx` seems hung on first run | resolving ~108 packages | wait ~30 s |
| release workflow fails before packaging | tag, `packages/extension/package.json` `version`, or `docs/CHANGELOG.md` heading disagree | set all three to the same `X.Y.Z` and push a new tag; tags are immutable |
| release finishes on GitHub but Open VSX publishing fails immediately | `OVSX_PAT` is absent/expired | replace the GitHub Actions repository secret, then manually dispatch `Release` with the existing tag; uploads use `--skip-duplicate` |
| Open VSX says a version is already published but inactive and invisible | the publisher account has not signed the Open VSX Publisher Agreement | in the Open VSX profile, connect the matching Eclipse account, open **Show Publisher Agreement**, read it, and select **Agree**; the uploaded version activates automatically, so do not move the tag or upload it again |

## 6. Distribution and GitHub Release

Normal user installation is [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse) for VS Code and [Open VSX](https://open-vsx.org/extension/cathouse/cathouse) for Cursor. GitHub Releases remain the manual/offline source for platform VSIX files; artifacts never come from `dist/` in git (`dist/` is gitignored, and a Linux VSIX is over GitHub's 100 MB file limit). The release workflow is `.github/workflows/release.yml`; stable tags publish the same four VSIX files to GitHub Releases and Open VSX. It requires the GitHub Actions repository secret `OVSX_PAT`. VS Code Marketplace publishing is intentionally manual. Full rules, credential setup, traps, and install text: `docs/release/github.md`.

```bash
# version in packages/extension/package.json is already X.Y.Z
# docs/CHANGELOG.md has ## [X.Y.Z] - YYYY-MM-DD with the notes
pnpm release:notes --tag vX.Y.Z
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag push builds `cathouse-<target>-<version>.vsix` for darwin-arm64, darwin-x64, linux-x64, and linux-arm64, writes `SHA256SUMS`, publishes the GitHub Release, then publishes all four packages to Open VSX. A tag containing `-` is marked pre-release and is not sent to Open VSX. To retry an existing stable tag, manually dispatch the `Release` workflow with that tag.
