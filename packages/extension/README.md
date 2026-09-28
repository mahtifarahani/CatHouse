# CatHouse

A home for [catherd](https://github.com/47vigen/catherd) in VS Code. catherd runs autopilot builds: Claude plans and verifies, while Codex, opencode or headless Claude Code workers write the code. CatHouse gives it a full UI:

- **Setup** installs and checks everything catherd needs: Bun, catherd 1.0.0, the catherd Claude plugin, your Claude login, and your worker backends. Nothing is installed until you click.
- **New Chat** runs `/catherd` on a task directly from the CatHouse Activity Bar view. Questions and permission requests appear as cards, and you get a notification when the orchestrator is waiting for you. A run continues after a window reload.
- **Runs** shows live roles, budget, climbs, routes, landed milestones, each role's reply and debug output, and `state.md`. You can cancel a live role.
- **Profiles** edits catherd profiles: rungs per role, access, failover, budget, isolation and more. Edits are staged with undo/redo, and you see a diff before saving.
- **Models** browses the model catalog, refreshes listings, and maps unscored rungs with treat-like.
- **Diagnostics** shows catherd doctor, catherd's logs, and runs heavy commands behind catherd's lock.

catherd stays the source of truth: CatHouse only uses catherd's CLI and MCP server, and never edits its files.

## Requirements

- macOS or Linux (Windows is not supported yet).
- A trusted workspace that is a git repository.
- A Claude account (Setup can open the login).
- At least one worker backend: Codex CLI (the default profile), opencode v2, or the claude CLI for `claude-code:` rungs. Setup shows what's missing and how to fix it.

The Claude Code runtime ships inside this extension (the VSIX is platform-specific), so you don't need a separate `claude` install unless your profile uses `claude-code:` rungs.

## Getting started

1. Install the VSIX for your platform: Extensions → … → Install from VSIX.
2. Open a git repository and click the CatHouse icon in the activity bar.
3. Open Setup and click through the items it lists.
4. The default **New Chat** tab is ready for a task; describe it and click **Start task**.

## Commands

- **CatHouse: Check Setup** (runs catherd doctor)
