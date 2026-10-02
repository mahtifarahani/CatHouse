# ADR 0009: Selectable Claude Code or Codex orchestrator

Status: accepted and implemented on 2026-10-02.

## Context

CatHouse's original Agent SDK session makes Claude Code the only orchestration host. Selecting Codex rungs in a catherd profile moves worker roles but leaves the main session on Claude, so a Claude session limit still stops a new task. catherd-cli 1.4.0 (tag `v1.4.0`, commit `804682f`) recognizes native Codex as a host and exposes a durable completion queue. The owner requested a switch in CatHouse's Profile tab.

## Decision

`cathouse.orchestratorHost.v1` in VS Code global state selects `claude-code` (default) or `codex`. The Profile tab changes this preference for future sessions only; a live session must end first. catherd profiles still own role rungs, billing and routing. Each host has its own saved session link for a repository. A Claude-owned saved session is never resumed under Codex.

CatHouse 0.4.3 also offers **Switch to Codex** beside a Claude session-limit message in Chat. That explicit click stops the current Claude session before changing the host; the previous transcript and saved link stay under Claude. New tasks use Codex after Setup passes. This action never transfers an active catherd run or silently changes the profile's role rungs. The Profile selector remains the general host control.

The Claude path keeps the bundled Agent SDK. The Codex path uses the user's native Codex CLI and installed `catherd@catherd` Codex plugin. After the user clicks Start daemon in Setup, CatHouse connects directly to the managed daemon’s Unix WebSocket for JSON-RPC. `codex app-server daemon start` can install the managed server package, so chat startup never invokes it. This reaches the same native Unix endpoint used by catherd's `codex queue --remote unix://` completion push (`catherd/src/infra/codex-queue.ts:117-121` at `804682f`). A private `codex app-server --listen stdio://` process would not share that endpoint.

The Codex thread uses the installed catherd skill from `skills/list`, loaded as a native `UserInput` skill. catherd's own MCP server performs orchestration. CatHouse maps app-server items, turns, approvals and questions to its existing transcript and prompt cards; it does not call catherd's orchestrator-only tools. Gateway and CLI subprocesses set `CATHERD_ORCHESTRATION_HOST` to the selected host. Inherited `CODEX_THREAD_ID` and `CODEX_SESSION_ID` are stripped so a parent Codex session cannot be mistaken for the CatHouse thread (`catherd/src/infra/host-context.ts:18-31`).

## Invariants and traps

- Never switch while a session is starting or running. The Profile control disables itself and the host rejects a raced request.
- The Codex Setup gate requires CLI >= 0.159.2, a logged-in account, plugin version 1.4.0, and a running app-server daemon at >= 0.159.2. Installers run only after a Setup click. Claude's SDK, plugin and login gate the Claude path only.
- Codex's daemon may outlive the CatHouse panel. Closing a CatHouse session interrupts an active turn before closing its WebSocket; it does not stop the user's daemon.
- catherd 1.4.0 profiles with explicit native `claude:` architect/verifier rungs are invalid under Codex. The user must choose valid Codex rungs in Profile or use catherd's reviewed host-default reset. CatHouse does not rewrite profiles to make this switch.
- `doctor` remains user-triggered because it has side effects. Its `push-capability` row only establishes that the CLI exposes the queue command; a live pushed role completion still needs a separate run check.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec biome check packages/extension/src/orchestrator/codex.ts packages/extension/src/orchestrator/codex.test.ts packages/webview/src/pages/profile/OrchestratorHost.tsx
```

The app-server `initialize`, `thread/start`, `skills/list`, `turn/start` and `turn/completed` shapes were checked against the installed Codex CLI 0.158.0 in an ephemeral thread. A fake Unix WebSocket app-server test covers skill input, MCP `run_start`, queued inbound turns and transcript event mapping. A live Unix WebSocket `initialize` and `skills/list` check succeeded against the local 0.158.0 daemon. A live catherd role push remains unverified until the local Codex CLI is upgraded and the Codex plugin is installed through Setup.

`pnpm test:e2e` passed the two available VS Code checks; three workspace-dependent checks were pending. `pnpm lint` still reports formatting errors in untouched `packages/ui/src/components/controls.tsx` and `packages/webview/src/session/SessionPage.tsx`; the changed code passes a targeted Biome check. The developer smoke probe of `codex app-server daemon start` installed a managed daemon package on this machine; the daemon was stopped after the WebSocket check. No CatHouse runtime path starts it without a Setup click.

## Remaining work and next step

In the Extension Development Host, select Codex in Profile, use Setup's click actions to update the CLI, install the Codex plugin and start or restart the daemon, run Check readiness, choose a Codex-valid profile, start a task, wait for a role completion push, then reload and resume. If the managed daemon has an older server version, click Restart daemon in Setup after updating the CLI. Record the live result in `docs/spikes/` before calling native push verified.
