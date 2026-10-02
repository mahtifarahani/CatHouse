# Orchestrator session

Status: **built in Phases 1 and 4** (session, controller, event mapper, panel wiring; repo picker, permission modes, prompt badge/notification, cancel-role note, Continue, compaction marker). Moved to catherd 1.2's push model on 2026-09-29 (`docs/spikes/catherd-1.2.md`). Native Codex host switch added on 2026-10-02 (ADR 0009; live push check pending). Source: `packages/extension/src/orchestrator/`.

## Selectable host (2026-10-02)

Profile contains CatHouse's `Claude Code / Codex` host selector. The preference is stored in VS Code global state; it affects new sessions, gateway/CLI host identity, and Setup gates. `SessionController` retains the same panel methods and events for both hosts. Saved links are keyed by host and repository; old Claude-only links are read as Claude links. A cross-host resume is refused, and Codex requires a saved link to resume rather than guessing the latest run.

`session.ts` remains the Claude Agent SDK adapter. `codex.ts` connects to the managed daemon’s Unix WebSocket after the user starts it from Setup, initializes JSON-RPC, starts or resumes a thread, resolves the installed `catherd` skill from `skills/list`, then sends a skill plus text input on `turn/start`. App-server `item/*` events become CatHouse text/tool/run events. `turn/completed` is the end-of-turn result; a queued native turn becomes `inbound`. Codex command/file permission requests and `request_user_input` become the existing prompt cards. The socket never exposes daemon stderr to CatHouse logs. On close, an active turn is interrupted before the socket disconnects.

The shared daemon choice is required by catherd-cli 1.4.0 at commit `804682f`: `src/infra/codex-queue.ts:117-121` calls `codex queue --remote unix://` for the original thread UUID. CatHouse's gateway never calls orchestrator-only MCP tools. Codex's installed plugin supplies those tools to the native thread. A profile's explicit `claude:` rungs are invalid on the Codex host; catherd validation reports that. The local Codex CLI 0.158.0 and absent Codex plugin prevented a live catherd push test; see ADR 0009 for the exact next check.

## Pieces

| File | What |
|---|---|
| `plugin.ts` | `findCatherdPlugin()` reads `$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json` (default `~/.claude`) → `plugins["catherd@catherd"][0].{installPath, version}` |
| `session.ts` | `OrchestratorSession`: one Agent SDK `query()` in streaming-input mode |
| `events.ts` | `createEventMapper()`: SDK messages → protocol `SessionEvent`s (pure). It remembers `run_start` tool_use ids so the matching tool_result becomes `run_started {runId, dir}`, maps tool heartbeats (`tool_progress`, whose `parent_tool_use_id` is the real call) to `tool_progress {toolUseId, elapsedSecs}`, and maps `command_lifecycle {state: "started"}` (a turn catherd's push started) to `inbound` |
| `controller.ts` | `SessionController`: the one session of a window. It handles start/resume/send/interrupt/answer/stop, keeps pending prompt cards and a bounded transcript (500 events) so a reloaded webview can rebuild, and saves the run ↔ session link. It is vscode-free (deps injected) |

## SDK options (`session.ts`)

```ts
query({ prompt: inbox /* AsyncIterable<SDKUserMessage> */, options: {
  cwd: repo,
  settingSources: ["user", "project", "local"],   // user's CLAUDE.md, rules, hooks, ~/.claude/agents (catherd's native roles)
  plugins: [{ type: "local", path: installPath }], // catherd@catherd from installed_plugins.json
  allowedTools: ["mcp__plugin_catherd_catherd__*"],// ADR 0002; SDK warns CLAUDE_SDK_CAN_USE_TOOL_SHADOWED (expected)
  canUseTool,                                      // AskUserQuestion + permissions → onPrompt → webview cards
  permissionMode: "default",
  toolConfig: { askUserQuestion: { previewFormat: "markdown" } },
  env: { ...processEnv(), MCP_TOOL_TIMEOUT: "14400000" }, // 4 h ceiling; no catherd 1.2 tool blocks
  resume?: sessionId,
}})
```

The SDK is ESM-only and finds its platform binary (`@anthropic-ai/claude-agent-sdk-<platform>/claude`, Claude Code 2.1.283) relative to its own package. So it is **external** to the esbuild bundle (`build.mjs`) and loaded with `await import(...)`. esbuild keeps the dynamic import in the CJS output (verified). Packaging must ship `node_modules/@anthropic-ai/claude-agent-sdk*` for the target platform (ADR 0008, Phase 5).

## Prompts

- `canUseTool("AskUserQuestion")` → `{kind: "question", questions}`. The answer is returned as `updatedInput: {questions, answers, response?}`.
- Any other unresolved tool → `{kind: "permission", toolName, input, title?, decisionReason?, canAlwaysAllow}`. `always` echoes `suggestions` with `destination: "localSettings"` (writes `.claude/settings.local.json`).
- The controller gives each prompt a UUID and broadcasts `{type: "prompt"}`; `session.answer` resolves it and broadcasts `{type: "prompt_resolved"}`. An answer whose kind doesn't match is rejected. An abort signal or stop resolves pending prompts with deny / empty answers.

## Start and resume

- **Start** sends `/catherd:catherd <task>` as the first message. The skill does the rest (A-lines, `run_start`, …).
- **Link:** on `init` → `sessionId`, on `run_started` → `runId`, saved in `workspaceState["cathouse.links.v1"][repo] = {sessionId, runId?, savedAt}`.
- **Resume** (after a window reload): if the saved session's transcript exists (`getSessionInfo`), it resumes it with `RESUME_PROMPT(runId)` ("call `peek(run)` first, read unread records with `result`, carry on"). Otherwise it starts a fresh session with a bare `/catherd:catherd` (the skill resumes the latest run). **Resume never sends a task, so it never calls `run_start`.** Spike (d) verified the resumed path: the same run, no duplicate.
- One session per window (`E_SESSION_ACTIVE`). A missing plugin → `E_PLUGIN_MISSING`.

## Timing behaviour: push (catherd 1.1+, from `docs/spikes/catherd-1.2.md`)

- `dispatch` returns at once and the orchestrator **ends its turn**. The SDK emits `result`, `turnActive` becomes false, and the session stays open and idle while roles run. The user can send follow-ups meanwhile.
- When a role finishes, catherd's MCP server (a child of the SDK's Claude Code, which gives it `CLAUDE_CODE_MESSAGING_SOCKET`) writes the notice to the session's peer inbox. The session starts a turn by itself: `command_lifecycle started` → `system/init` (same session id) → assistant … → `result`. The notice text is not in the SDK stream.
- The controller maps `command_lifecycle started` to an `inbound` event: `turnActive` becomes true (Interrupt works) and the transcript shows a "catherd reported back" divider. It drops a repeated `init` with a session id it already has, so each push does not add another init chip.
- (1.0, historical) `wait` was a foreground tool call that blocked 178 s in Phase 1 spike (a).

## Protocol surface

Methods: `session.state`, `session.start {task, repo?}`, `session.resume {repo?}`, `session.send {text}`, `session.interrupt`, `session.stop`, `session.reset`, `session.answer {id, answer}`. Events on topic `session`: `event`, `prompt`, `prompt_resolved`, `state`. Schemas: `packages/protocol/src/session.ts`. `SessionState.turnActive` is true from Start/Resume/Send until an SDK `result` or a successful Interrupt; it is separate from `phase: "running"`, because the streaming session remains open between user turns.

## Webview

`packages/webview/src/session/`: `useSession` (snapshot + live events, `orchestratorModel`), `toTranscript` (folds tool_use + result + progress; tags catherd role agents), `Transcript`, `PromptCard` (question with options, multi-select and "Other"; permission with Allow once / Always / Deny + note), `LiveRoles`, `SessionPage`. It is the Activity Bar view's default **Chat** tab; its layout is described in `webview.md` §Pages. The controls map onto the methods like this: the composer's one primary button calls `session.start` (idle), `session.send` (live session) or `session.interrupt` (while `turnActive` and the input is empty); **End session** in the `⋯` menu calls `session.stop`; **Resume saved run** (welcome link or `⋯` menu) calls `session.resume`; **New chat** calls `session.reset` (`SessionController.reset()`): it stops a live session (second click confirms, "Stop and start new?") and clears the transcript back to the empty chat. The saved run ↔ session link is kept, so Resume still reopens the previous chat. Pending permission/question cards live in a fixed, height-capped prompt tray above the composer.


## Phase 4 additions

- **Repo:** `app.workspace` lists the workspace folders and the selected repo; `app.setRepo` changes it (stored in `workspaceState["cathouse.repo.v1"]`, broadcast on topic `app`). Before a chat starts, `app.addFolders` opens VS Code's native multi-folder picker and `app.removeFolder` removes the selected folder from the workspace without deleting it from disk. Workspace mutations are rejected during a starting/running session. `repoFor()` in `extension.ts` resolves requested → selected → first folder. Start and Resume pass the selected repo explicitly; the per-repo gateway follows the selection. One orchestrator session per window, on the repo it started in.
- **Permission mode:** `session.start {permissionMode}` (default `default`; also `acceptEdits`, `plan`, `auto`) and `session.setMode` (→ `query.setPermissionMode`). catherd's own tools stay allowed in every mode (ADR 0002).
- **Waiting prompts:** the controller calls `onPromptsChanged(count, latest)`. The extension shows the count as the Activity Bar badge (`SidebarProvider.setBadge`) and, if the CatHouse view isn't visible, a notification ("the orchestrator has a question / asks to use X") whose Open action reveals that same view.
- **Cancel note:** `runs.cancelRole` cancels through the CLI, which leaves the record unread, so catherd still pushes it to the owning session. `controller.noteRoleCancelled(run, name, status)` then tells the live session that the user cancelled it from the dashboard (ADR 0005).
- **Continue:** a run's detail page has "Continue in orchestrator" (→ `session.resume`, then the Orchestrator tab).
- **Compaction:** `system/compact_boundary` → `{kind: "compacted"}` → a warning line in the transcript (the skill is known to decay after compaction; `docs/research/catherd-known-issues.md`).

## Tests

`events.test.ts` (init, run_started, failed run_start, heartbeat, `command_lifecycle` → `inbound`, task/result) and `controller.test.ts` (start prompt + link, single session, missing plugin, resume without task and with `peek`, fresh fallback, prompt round-trip + kind mismatch, deny on stop, follow-ups, prompt count + permission mode, pushed turn: `turnActive` and a single init). E2E `pages.e2e.ts` covers `app.workspace` / `app.setRepo`.
