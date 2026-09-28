# CatHouse

```text
 /\_/\   .  CatHouse
(=^.^=)/   catherd, at home in VS Code
 (")(")
```

**CatHouse brings [catherd](https://github.com/47vigen/catherd) into VS Code.** It turns catherd's agent orchestration, terminal dashboard, setup flow, and run controls into a complete graphical interface in the Activity Bar.

catherd still does the real work: Claude plans and verifies, Codex, opencode, or headless Claude Code workers write the code, and Jev can choose the model and effort for each job. CatHouse gives that workflow a home inside the editor—without reimplementing the orchestrator or taking ownership of its data.

> CatHouse is currently in pre-release development. The macOS arm64 build is verified; release identity and native testing for the remaining targets are still in progress. See [Project status](#project-status).

## What CatHouse adds

- **Guided Setup** — checks and installs Bun, `catherd-cli@1.0.0`, the catherd Claude plugin, login, and worker backends. Installers run only after you click.
- **Chat** — starts `/catherd:catherd <task>` directly from the Activity Bar and streams the orchestration session into VS Code.
- **Human-in-the-loop cards** — answers Claude questions and permission requests without leaving the editor, with notifications when a run needs attention.
- **Runs** — follows live roles, budget, climbs, routes, landed milestones, replies, state, and debug output; live roles can be cancelled from the UI.
- **Profiles** — edits roles, rungs, models, effort, access, isolation, budget, routing, and failover with staged changes, undo/redo, validation, and a diff before save.
- **Models** — searches and refreshes catherd's model catalog and supports `treat-like` mappings for unscored rungs.
- **Diagnostics** — presents `catherd doctor`, actionable fixes, logs, and catherd's machine-wide command lock.
- **Resume after reload** — reconnects a saved Claude session to the same catherd run instead of creating a duplicate.

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
      └── Claude Agent SDK ───► /catherd:catherd ──► coding agents
```

## Requirements

- VS Code 1.100 or newer
- macOS or Linux (Windows is not supported yet)
- A trusted workspace containing a Git repository
- A Claude account
- At least one logged-in worker backend:
  - [Codex CLI](https://github.com/openai/codex) 0.157.0 or newer (the default)
  - [opencode](https://opencode.ai/) v2.0.16 or newer
  - Claude Code CLI 2.1.282 or newer for `claude-code:` rungs

CatHouse ships its orchestration-time Claude Code runtime inside each platform-specific VSIX. A standalone `claude` installation is needed only when the active catherd profile uses `claude-code:` workers.

Bun, catherd, and the catherd Claude plugin are mandatory, but you do not need to prepare them manually: CatHouse's Setup page detects what is missing and offers each installation step explicitly.

## Getting started

CatHouse is not publicly released yet. To try a development build:

1. Clone this repository.
2. Install dependencies and build the VSIX for your machine:

   ```bash
   pnpm install
   pnpm package
   ```

3. In VS Code, open **Extensions → … → Install from VSIX** and select the artifact in `dist/`.
4. Open a Git repository and select the CatHouse icon in the Activity Bar.
5. Complete the guided Setup checklist.
6. Open **Chat**, describe the task, and select **Start task**.

CatHouse does not run installers in the background. Setup checks are side-effect-free, and every installation or upgrade starts only from a user action. `catherd doctor`, which can refresh catherd state, runs only when requested or after an explicit setup action.

## Development

CatHouse is a pnpm TypeScript monorepo:

| Package | Responsibility |
|---|---|
| `packages/protocol` | Versioned, zod-validated webview ↔ extension contracts |
| `packages/ui` | Shared components and VS Code theme tokens |
| `packages/webview` | React 19 dashboard |
| `packages/extension` | Setup, catherd gateway, Claude session, state, and VS Code host |
| `packages/compat` | Supported version matrix and catherd contract fixtures |

Common commands:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm package
```

Press `F5` in VS Code and choose **Run CatHouse** to launch an Extension Development Host. See the [runbook](docs/runbook.md) for machine setup, platform packaging, isolated test environments, and troubleshooting.

## Project status

The feature set is code-complete on macOS and includes the Setup flow, dashboards, in-editor run control, session recovery, accessibility work, and per-platform VSIX packaging.

Before a public release, the project still needs:

- the final publisher ID, SPDX license, and initial public version;
- one end-to-end run on a remote Linux extension host;
- native execution checks for the macOS x64 and Linux artifacts.

The exact current checkpoint and next steps live in [docs/STATUS.md](docs/STATUS.md). The technical design, decisions, research, and test evidence are indexed in [docs/README.md](docs/README.md).

## Relationship to catherd

CatHouse is an independent VS Code interface built around the public contracts of [47vigen/catherd](https://github.com/47vigen/catherd). If you prefer the terminal, need the canonical CLI reference, or want to understand how the orchestrator works, start with the [catherd README](https://github.com/47vigen/catherd#readme).

