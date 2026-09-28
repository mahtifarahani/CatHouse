# Orchestrator session

Status: **built in Phases 1 and 4** (session, controller, event mapper, panel wiring; repo picker, permission modes, prompt badge/notification, cancel-role note, Continue, compaction marker). Source: `packages/extension/src/orchestrator/`.

## Pieces

| File | What |
|---|---|
| `plugin.ts` | `findCatherdPlugin()` reads `$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json` (default `~/.claude`) → `plugins["catherd@catherd"][0].{installPath, version}` |
| `session.ts` | `OrchestratorSession`: one Agent SDK `query()` in streaming-input mode |
| `events.ts` | `createEventMapper()`: SDK messages → protocol `SessionEvent`s (pure). It remembers `run_start` tool_use ids so the matching tool_result becomes `run_started {runId, dir}`, and maps `wait` heartbeats (`tool_progress`, whose `parent_tool_use_id` is the real call) to `tool_progress {toolUseId, elapsedSecs}` |
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
  env: { ...processEnv(), MCP_TOOL_TIMEOUT: "14400000" }, // 4 h: a catherd `wait` blocks in the foreground
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
- **Resume** (after a window reload): if the saved session's transcript exists (`getSessionInfo`), it resumes it with `RESUME_PROMPT(runId)` ("call status() first, collect roles with wait, carry on"). Otherwise it starts a fresh session with a bare `/catherd:catherd` (the skill resumes the latest run). **Resume never sends a task, so it never calls `run_start`.** Spike (d) verified the resumed path: the same run, no duplicate.
- One session per window (`E_SESSION_ACTIVE`). A missing plugin → `E_PLUGIN_MISSING`.

## Timing behaviour (from spikes)

- A catherd `wait` is a **foreground** tool call. It blocked 178 s in the spike and was not backgrounded. The UI shows it as a running tool with `tool_progress` elapsed time (heartbeat every 30 s).
- A follow-up sent with `session.send` during a `wait` queues until the tool returns. Use **Interrupt** to cut in.

## Protocol surface

Methods: `session.state`, `session.start {task, repo?}`, `session.resume {repo?}`, `session.send {text}`, `session.interrupt`, `session.stop`, `session.answer {id, answer}`. Events on topic `session`: `event`, `prompt`, `prompt_resolved`, `state`. Schemas: `packages/protocol/src/session.ts`.

## Webview

`packages/webview/src/session/`: `useSession` (snapshot + live events), `toTranscript` (folds tool_use + result + progress), `Transcript`, `PromptCard` (question with options, multi-select and "Other"; permission with Allow once / Always / Deny + note), `SessionPage` (task form, Resume, Interrupt/Stop, follow-up). It is the Activity Bar view's default **New Chat** tab.


## Phase 4 additions

- **Repo:** `app.workspace` lists the workspace folders and the selected repo; `app.setRepo` changes it (stored in `workspaceState["cathouse.repo.v1"]`, broadcast on topic `app`). Before a chat starts, `app.addFolders` opens VS Code's native multi-folder picker and `app.removeFolder` removes the selected folder from the workspace without deleting it from disk. Workspace mutations are rejected during a starting/running session. `repoFor()` in `extension.ts` resolves requested → selected → first folder. Start and Resume pass the selected repo explicitly; the per-repo gateway follows the selection. One orchestrator session per window, on the repo it started in.
- **Permission mode:** `session.start {permissionMode}` (default `default`; also `acceptEdits`, `plan`, `auto`) and `session.setMode` (→ `query.setPermissionMode`). catherd's own tools stay allowed in every mode (ADR 0002).
- **Waiting prompts:** the controller calls `onPromptsChanged(count, latest)`. The extension shows the count as the Activity Bar badge (`SidebarProvider.setBadge`) and, if the CatHouse view isn't visible, a notification ("the orchestrator has a question / asks to use X") whose Open action reveals that same view.
- **Cancel note:** `runs.cancelRole` calls `controller.noteRoleCancelled(run, name, status)`, which sends the live session a message (its `wait` will never return that record; ADR 0005).
- **Continue:** a run's detail page has "Continue in orchestrator" (→ `session.resume`, then the Orchestrator tab).
- **Compaction:** `system/compact_boundary` → `{kind: "compacted"}` → a warning line in the transcript (the skill is known to decay after compaction; `docs/research/catherd-known-issues.md`).

## Tests

`events.test.ts` (init, run_started, failed run_start, heartbeat, task/result) and `controller.test.ts` (start prompt + link, single session, missing plugin, resume without task, fresh fallback, prompt round-trip + kind mismatch, deny on stop, follow-ups, prompt count + permission mode). E2E `pages.e2e.ts` covers `app.workspace` / `app.setRepo`.
