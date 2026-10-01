# CatHouse

CatHouse brings [catherd](https://github.com/47vigen/catherd) into VS Code, with a full graphical UI in place of catherd's terminal setup and TUI.

## What catherd does for you

catherd runs autopilot builds from your own Claude Code session. You describe a task with `/catherd`, and it splits the work between models:

- **Claude plans and verifies.** An architect role breaks the task into milestones and lanes. An independent verifier runs each milestone and gives it PASS or FAIL, so "done" means tested, not just written.
- **Cheaper workers write the code.** Codex, opencode or headless Claude Code workers take one lane each. Your Claude session stays on planning and review instead of spending tokens on every line.
- **Models climb only when needed.** Each lane starts on the lowest model and effort that can handle it, and moves up one rung only when it fails. Budgets, failover and access rules come from a profile you control.
- **Runs survive restarts.** Workers are detached processes that write to disk, so a long build isn't lost when a window closes.

## What CatHouse adds

With catherd alone, you install Bun, the catherd CLI, the Claude plugin and each worker backend by hand in the terminal, edit profile JSON files with no validation or diff, and follow a run through a terminal dashboard, logs and run files. CatHouse replaces that with one VS Code view:

| With catherd in the terminal | With CatHouse |
|---|---|
| Install and check each requirement with separate commands | **Setup** lists what's missing and installs each item with a click |
| Start `/catherd` in a Claude Code terminal | **Chat** starts the task from the Activity Bar and streams it into the editor |
| Watch the terminal for questions and permission prompts | Questions and permissions appear as cards, and you get a notification when a run needs you |
| Read the TUI, logs and `state.md` to see progress | **Runs** shows live roles, budget, climbs, milestones and each role's reply, and can cancel a role |
| Edit profile JSON by hand | **Profiles** is a form with validation, undo/redo and a diff before saving |
| Run `catherd doctor` and read the output | **Diagnostics** shows each problem with its fix |

The views in detail:

- **Setup** installs and checks everything catherd needs: Bun, catherd 1.3.0, the catherd Claude plugin, your Claude login, and your worker backends. Nothing is installed until you click.
- **Chat** runs `/catherd` on a task directly from the CatHouse Activity Bar view. Questions and permission requests appear as cards, and you get a notification when the orchestrator is waiting for you. A run continues after a window reload.
- **Runs** shows live roles, budget, climbs, routes, landed milestones, each role's reply and debug output, and `state.md`. You can cancel a live role.
- **Profiles** edits catherd profiles: rungs per role, access, failover, budget, isolation and more. Edits are staged with undo/redo, and you see a diff before saving.
- **Models** browses the model catalog, refreshes listings, and maps unscored rungs with treat-like.
- **Diagnostics** shows catherd doctor, catherd's logs, and runs heavy commands behind catherd's lock.

catherd stays the source of truth: CatHouse only uses catherd's CLI and MCP server, and never edits its files.

## Requirements

- VS Code 1.100 or newer, or Cursor.
- macOS or Linux (Windows is not supported yet).
- A trusted workspace that is a git repository.
- A Claude account (Setup can open the login).
- At least one worker backend: Codex CLI (the default profile), opencode v2, or the claude CLI for `claude-code:` rungs. Setup shows what's missing and how to fix it.

The Claude Code runtime ships inside this extension (the build is platform-specific), so you don't need a separate `claude` install unless your profile uses `claude-code:` rungs.

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
