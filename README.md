# CatHouse

```text
 /\_/\   .  CatHouse
(=^.^=)/   catherd, at home in VS Code
 (")(")
```

**CatHouse brings [catherd](https://github.com/47vigen/catherd) into VS Code.** It turns catherd's agent orchestration, terminal dashboard, setup flow, and run controls into a complete graphical interface in the Activity Bar.

catherd still does the real work: the selected Claude Code or Codex host orchestrates the task, while Codex, opencode, headless Claude Code, Cursor, Grok Build, or Antigravity workers can write the code. Jev can choose the model and effort for each job. CatHouse gives that workflow a home inside the editor—without reimplementing the orchestrator or taking ownership of its data.

> Install CatHouse from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse) or, in Cursor, from [Open VSX](https://open-vsx.org/extension/cathouse/cathouse). Platform VSIX files remain available on [GitHub Releases](https://github.com/mahtifarahani/CatHouse/releases) for manual or offline installation.

## What CatHouse adds

- **Guided Setup** — checks Bun, `catherd-cli@1.4.0`, the selected host's plugin and login, and worker backends. For Codex hosting it also checks the app-server daemon. Installers and daemon startup run only after you click.
- **Chat** — starts a catherd task through the selected Claude Code or Codex host in the Activity Bar. If Claude hits its session limit, the transcript offers a switch to Codex for new tasks. Role completion notices return to the active host's chat.
- **Human-in-the-loop cards** — answers orchestrator questions and permission requests without leaving the editor, with notifications when a run needs attention.
- **Runs** — follows live roles, budget, climbs, routes, landed milestones, replies, state, and debug output; live roles can be cancelled from the UI.
- **Profile** — switch the chat orchestrator between Claude Code and Codex, pick the active catherd profile, and edit roles, model ladders, access, isolation, budget, routing and failover. catherd validates and saves profile edits, with Undo.
- **Models** — searches and refreshes catherd's model catalog and supports `treat-like` mappings for unscored rungs.
- **Setup** also holds diagnostics: `catherd doctor` results with their fixes, catherd's logs, and its machine-wide command lock.
- **Languages** — fully translated into English, Chinese (中文), Hindi (हिन्दी), Spanish (Español), French (Français), and Persian (فارسی). Persian natively supports RTL layout. You can change the language dynamically from the app's Settings menu.
- **Resume after reload** — reconnects a saved session to the same catherd run. Claude and Codex keep separate saved chat links for each repository.

Everything lives in one VS Code Activity Bar view and follows the active Light, Dark, or High Contrast theme.

## catherd remains the source of truth

CatHouse is a UI for catherd, not a fork of it.

- It talks to catherd only through its public CLI and MCP server.
- It never writes catherd's config, profiles, or run files directly.
- It never recreates catherd's routing, dispatch, budgeting, failover, or lifecycle logic.
- The same profiles and runs remain available from catherd's CLI and TUI.

```text
CatHouse webview
      │
      ▼
VS Code extension host
      ├── catherd CLI / MCP ──► profiles, models, diagnostics, and runs
      └── selected host ──────► Claude Agent SDK or Codex app-server ──► catherd task
```

## Requirements

- VS Code 1.100 or newer, or Cursor
- macOS or Linux (Windows is not supported yet)
- A trusted workspace containing a Git repository
- A Claude or Codex account for the selected orchestration host
- At least one logged-in worker backend:
  - [Codex CLI](https://github.com/openai/codex) 0.157.0 or newer (the default)
  - [opencode](https://opencode.ai/) v2.0.16 or newer
  - Claude Code CLI 2.1.282 or newer for `claude-code:` rungs
  - Cursor's `cursor-agent` 2026.09.28 or newer for `cursor:` rungs
  - xAI's `grok` CLI (Grok Build) for `grok:` rungs
  - Google's `agy` (Antigravity) 1.2.13 or newer for `antigravity:` rungs

CatHouse ships its orchestration-time Claude Code runtime inside each platform-specific extension build. A standalone `claude` installation is needed only when the active catherd profile uses `claude-code:` workers.

Bun, catherd, and the selected host's catherd plugin are mandatory, but you do not need to prepare them manually: CatHouse's Setup page detects what is missing and offers each installation step explicitly. Codex as the orchestration host needs Codex CLI 0.159.2 or newer and its managed app-server daemon. The worker-only Codex minimum is 0.157.0.

## Install

### VS Code

Install [CatHouse from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse), or search for `CatHouse` in Extensions (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Linux).

```bash
code --install-extension cathouse.cathouse
```

### Cursor

Install [CatHouse from Open VSX](https://open-vsx.org/extension/cathouse/cathouse), or search for `CatHouse` in Cursor's Extensions view.

If the `cursor` command is on your PATH (Command Palette → **Shell Command: Install 'cursor' command in PATH**):

```bash
cursor --install-extension cathouse.cathouse
```

### Manual or offline install

GitHub Releases also provides a platform-specific VSIX and `SHA256SUMS`. Download the file that matches your machine; `<version>` is the release number, for example `0.4.3` when that release is published.

| Machine                                         | File                                   |
| ----------------------------------------------- | -------------------------------------- |
| macOS Apple Silicon (`uname -m` prints `arm64`) | `cathouse-darwin-arm64-<version>.vsix` |
| macOS Intel (`uname -m` prints `x86_64`)        | `cathouse-darwin-x64-<version>.vsix`   |
| Linux x64                                       | `cathouse-linux-x64-<version>.vsix`    |
| Linux ARM64                                     | `cathouse-linux-arm64-<version>.vsix`  |

Check the download, then use **Extensions → … → Install from VSIX...** in either editor:

```bash
shasum -a 256 -c SHA256SUMS # macOS
sha256sum -c SHA256SUMS     # Linux
code --install-extension ~/Downloads/cathouse-darwin-arm64-<version>.vsix
cursor --install-extension ~/Downloads/cathouse-darwin-arm64-<version>.vsix
```

Windows builds are not published. The extension id is `cathouse.cathouse`.

### First run

1. Open a trusted workspace that contains a Git repository.
2. Select the CatHouse icon in the Activity Bar.
3. Complete the guided Setup checklist. Nothing is installed until you click.
4. Open **Chat**, describe the task, and select **Start task**.

CatHouse does not run installers in the background. Setup checks are side-effect-free, and every installation or upgrade starts only from a user action. `catherd doctor`, which can refresh catherd state, runs only when requested or after an explicit setup action.

## Versioning

CatHouse uses semantic versioning. The number in `packages/extension/package.json` is the extension version. The Git tag `vX.Y.Z` must be that same number with a `v` prefix. Release notes are the matching `## [X.Y.Z] - YYYY-MM-DD` section of [docs/CHANGELOG.md](docs/CHANGELOG.md). Pushing the tag runs the release workflow, which attaches the four VSIX files and those notes to the GitHub Release. A tag with a hyphen, such as `v0.1.0-rc.1`, is published as a pre-release.

The checklist for cutting a release is in [docs/release/github.md](docs/release/github.md).

## Development

CatHouse is a pnpm TypeScript monorepo:

| Package              | Responsibility                                                  |
| -------------------- | --------------------------------------------------------------- |
| `packages/protocol`  | Versioned, zod-validated webview ↔ extension contracts          |
| `packages/ui`        | Shared components and VS Code theme tokens                      |
| `packages/webview`   | React 19 dashboard                                              |
| `packages/extension` | Setup, catherd gateway, Claude session, state, and VS Code host |
| `packages/compat`    | Supported version matrix and catherd contract fixtures          |

Common commands:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm package
```

`pnpm package` writes `dist/cathouse-<target>-<version>.vsix` for this machine. Install that file the same way as a GitHub Release asset. `pnpm package:all` builds darwin-arm64, darwin-x64, linux-x64, and linux-arm64.

Press `F5` in VS Code and choose **Run CatHouse** to launch an Extension Development Host. See the [runbook](docs/runbook.md) for machine setup, platform packaging, isolated test environments, and troubleshooting.

## Project status

The feature set is code-complete on macOS and includes the Setup flow, dashboards, in-editor run control, session recovery, accessibility work, and per-platform VSIX packaging.

CatHouse is published on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse) and [Open VSX](https://open-vsx.org/extension/cathouse/cathouse). GitHub Releases continue to carry the platform VSIX artifacts and checksums for manual installation; the first public release is `0.1.0`.

Remaining release validation includes:

- replacing the current `UNLICENSED` manifest value with the final SPDX license;
- one end-to-end run on a remote Linux extension host;
- native execution checks for the macOS x64 and Linux artifacts.

The exact current checkpoint and next steps live in [docs/STATUS.md](docs/STATUS.md). The technical design, decisions, research, and test evidence are indexed in [docs/README.md](docs/README.md).

## Relationship to catherd

CatHouse is an independent VS Code interface built around the public contracts of [47vigen/catherd](https://github.com/47vigen/catherd). If you prefer the terminal, need the canonical CLI reference, or want to understand how the orchestrator works, start with the [catherd README](https://github.com/47vigen/catherd#readme).
