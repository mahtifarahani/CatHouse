# CatHouse

CatHouse brings [catherd](https://github.com/47vigen/catherd) into VS Code, with a full graphical UI in place of catherd's terminal setup and TUI.

## What catherd does for you

catherd runs autopilot builds from your selected Claude Code or Codex orchestration session. You describe a task in CatHouse Chat, and it splits the work between models:

- **The selected host plans and verifies.** An architect role breaks the task into milestones and lanes. An independent verifier runs each milestone and gives it PASS or FAIL, so "done" means tested, not just written.
- **Workers write the code.** Codex, opencode, headless Claude Code, Cursor, Grok Build or Antigravity workers take one lane each. The orchestration session stays on planning and review instead of spending tokens on every line.
- **Models climb only when needed.** Each lane starts on the lowest model and effort that can handle it, and moves up one rung only when it fails. Budgets, failover and access rules come from a profile you control.
- **Runs survive restarts.** Workers are detached processes that write to disk, so a long build isn't lost when a window closes.

## What CatHouse adds

With catherd alone, you install Bun, the catherd CLI, the Claude plugin and each worker backend by hand in the terminal, edit profile JSON files with no validation or diff, and follow a run through a terminal dashboard, logs and run files. CatHouse replaces that with one VS Code view:

| With catherd in the terminal                              | With CatHouse                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Install and check each requirement with separate commands | **Setup** lists what's missing and installs each item with a click                                 |
| Start catherd in a Claude Code or Codex terminal          | **Chat** starts the task from the Activity Bar and streams it into the editor                      |
| Watch the terminal for questions and permission prompts   | Questions and permissions appear as cards, and you get a notification when a run needs you         |
| Read the TUI, logs and `state.md` to see progress         | **Runs** shows live roles, budget, climbs, milestones and each role's reply, and can cancel a role |
| Edit profile JSON by hand                                 | **Profile** is a form that catherd validates and that saves each change, with Undo                 |
| Run `catherd doctor` and read the output                  | **Setup** shows only what needs fixing, each with one button                                       |

The views in detail:

- **Setup** installs and checks everything catherd needs: Bun, catherd 1.4.0, the selected host's plugin and login, and your worker backends. Codex hosting also checks its app-server daemon. Nothing is installed or started until you click.
- **Chat** runs a catherd task through Claude Code or Codex directly from the CatHouse Activity Bar view. Questions and permission requests appear as cards, and you get a notification when the orchestrator is waiting for you. If Claude hits its session limit, a Switch to Codex action appears beside the message for new tasks. A run can continue after a window reload.
- **Runs** shows live roles, budget, climbs, routes, landed milestones, each role's reply and debug output, and `state.md`. You can cancel a live role.
- **Profile** switches the orchestration host between Claude Code and Codex and edits catherd profiles: rungs per role, access, failover, budget, isolation and more. Picking a profile makes it active; each profile change saves itself, with Undo.
- **Models** browses the model catalog, refreshes listings, and maps unscored rungs with treat-like.
- **Languages** — fully translated into English, Chinese (中文), Hindi (हिन्दी), Spanish (Español), French (Français), and Persian (فارسی). Persian natively supports RTL layout. You can change the language dynamically from the app's Settings menu.
- **Setup** also shows catherd doctor, opens catherd's logs, and runs heavy commands behind catherd's lock.

catherd stays the source of truth: CatHouse only uses catherd's CLI and MCP server, and never edits its files.

## Requirements

- VS Code 1.100 or newer, or Cursor.
- macOS or Linux (Windows is not supported yet).
- A trusted workspace that is a git repository.
- A Claude or Codex account for the selected orchestration host (Setup can open the login).
- At least one worker backend: Codex CLI (the default profile), opencode v2, the claude CLI for `claude-code:` rungs, Cursor's `cursor-agent` for `cursor:` rungs, xAI's `grok` CLI for `grok:` rungs, or Google's `agy` for `antigravity:` rungs. Setup shows what's missing and how to fix it.

The Claude Code runtime ships inside this extension (the build is platform-specific), so you don't need a separate `claude` install unless your profile uses `claude-code:` rungs.

Codex as the orchestration host needs Codex CLI 0.159.2 or newer, the native catherd plugin, and the managed app-server daemon started from Setup. Codex used only as a worker keeps catherd's lower CLI minimum.

## Install

### VS Code

Install [CatHouse from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse), or search for `CatHouse` in the Extensions view.

```bash
code --install-extension cathouse.cathouse
```

### Cursor

Install [CatHouse from Open VSX](https://open-vsx.org/extension/cathouse/cathouse), or search for `CatHouse` in Cursor's Extensions view.

```bash
cursor --install-extension cathouse.cathouse
```

The `cursor` command is available after Command Palette → **Shell Command: Install 'cursor' command in PATH**. For manual or offline installation, download the matching platform VSIX from [GitHub Releases](https://github.com/mahtifarahani/CatHouse/releases) and choose **Extensions → … → Install from VSIX...**. The extension id is `cathouse.cathouse`.

## Getting started

1. Open a git repository and click the CatHouse icon in the activity bar.
2. Open Setup and click through the items it lists.
3. The default **Chat** tab is ready for a task; describe it and click **Start task**.

## Commands

- **CatHouse: Check Setup** (runs catherd doctor)
