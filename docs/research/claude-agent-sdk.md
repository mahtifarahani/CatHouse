# Claude Agent SDK (TypeScript) for CatHouse's OrchestratorSession

Package: `@anthropic-ai/claude-agent-sdk`. Researched at **0.3.283** (npm `latest` on 2026-09-28). Types: `sdk.d.ts` in the package (reference copy: https://cdn.jsdelivr.net/npm/@anthropic-ai/claude-agent-sdk@0.3.283/sdk.d.ts). Docs: https://code.claude.com/docs/en/agent-sdk/ (index at https://code.claude.com/docs/llms.txt).

## 1. Bundled binary and versions

- The SDK bundles a native Claude Code binary as a platform optional dependency: `@anthropic-ai/claude-agent-sdk-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64`, `-win32-x64`.
- **Version rule:** SDK `0.3.N` bundles Claude Code `2.1.N`. catherd's `claude-code` adapter needs ≥ 2.1.282, so CatHouse pins SDK ≥ 0.3.282 (currently 0.3.283).
- `pathToClaudeCodeExecutable` (Options) overrides the binary; the default is the bundled one. `executable: 'bun'|'deno'|'node'` is auto-detected.
- CatHouse also runs the bundled binary directly for `plugin marketplace add/update`, `plugin install/update` and `auth status --json` / `auth login`, so users don't need a standalone `claude` unless their profile has `claude-code:` rungs (ADR 0001).
- **Packaging consequence:** each VSIX must ship its platform's binary (`vsce package --target …`; ADR 0008).

## 2. `query()` options CatHouse uses (field names exact, from `sdk.d.ts`)

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const q = query({
  prompt: userMessages,             // AsyncIterable<SDKUserMessage>: streaming-input mode (required for canUseTool, interrupt, streamInput)
  options: {
    cwd: repoRoot,
    settingSources: ["user", "project", "local"], // omitted = same; [] = none. Loads CLAUDE.md, settings (incl. permission rules, hooks), ~/.claude/agents, skills, commands
    plugins: [{ type: "local", path: catherdInstallPath }], // from ~/.claude/plugins/installed_plugins.json
    allowedTools: ["mcp__plugin_catherd_catherd__*"],
    canUseTool,                       // see §4
    permissionMode: "default",        // 'default'|'acceptEdits'|'bypassPermissions'|'plan'|'dontAsk'|'auto'
    includePartialMessages: true,     // stream_event deltas for live text
    toolConfig: { askUserQuestion: { previewFormat: "markdown" } },
    env: { ...process.env, MCP_TOOL_TIMEOUT: "<large ms>" }, // keep CLAUDE_CONFIG_DIR / CATHERD_HOME as the user has them
    resume: sessionId,                // string: resume a specific session
    forkSession: false,
    persistSession: true,             // default; transcripts in ~/.claude/projects/<encoded-cwd>/<id>.jsonl
    abortController,
    stderr: (d) => log(d),
  },
});
```

Other useful options: `disallowedTools`, `model`, `maxTurns`, `systemPrompt` (preset or string), `agentProgressSummaries` (emits `task_progress` summaries for subagents), `forwardSubagentText` (subagent text with `parent_tool_use_id`), `hooks` (programmatic, e.g. `PreToolUse`), `mcpServers`.

**settingSources:** `"user"` = `~/.claude/settings.json`, `~/.claude/CLAUDE.md`, rules, and `~/.claude/{skills,commands,agents}`. `"project"` = `<cwd>/.claude/settings.json`, hooks, CLAUDE.md up the tree, project skills/commands/agents. `"local"` = `CLAUDE.local.md`, `.claude/settings.local.json`. Managed policy, `~/.claude.json`, auto memory and claude.ai MCP connectors load regardless. catherd's native agents are symlinks in `~/.claude/agents`, so `"user"` must be on.

## 3. Plugins

- `plugins: [{type: "local", path}]` is the only supported form. **The SDK does not install marketplace plugins.** For a CLI-installed plugin, pass its install path (`~/.claude/plugins/installed_plugins.json` → `plugins["catherd@catherd"][0].installPath` and `.version`).
- The SDK doesn't expand `~`. A nonexistent path is skipped silently, so check the init message.
- Plugin skills and commands are namespaced: send `"/catherd:catherd <task>"` as the prompt. Plugin MCP tools are `mcp__plugin_catherd_catherd__<tool>`.
- Plugin MCP servers usually show `pending` in the init message and connect in the background. With tool search on (the default), the skill's ToolSearch step loads them. `CLAUDE_CODE_MCP_STARTUP_WAIT_MS` (Claude Code ≥ 2.1.274) sets the first-turn wait.
- `q.reloadPlugins()` re-reads plugins mid-session; it may hold on cache impact (`holdOnCacheImpact`).

## 4. Permissions and questions: `canUseTool`

```ts
type CanUseTool = (toolName: string, input: Record<string, unknown>, options: {
  signal: AbortSignal; suggestions?: PermissionUpdate[]; blockedPath?: string;
  mcpServer?: { name: string; source: string }; decisionReason?: string;
  title?: string; displayName?: string; /* … */ suppressAlwaysAllowRule?: boolean;
}) => Promise<PermissionResult>;

type PermissionResult =
  | { behavior: "allow"; updatedInput?: Record<string, unknown>; updatedPermissions?: PermissionUpdate[] }
  | { behavior: "deny"; message: string; interrupt?: boolean };
```

- It fires only for calls that nothing earlier in the permission flow resolved (allow rules, mode). `allowedTools` entries never reach it.
- The callback may stay pending indefinitely; execution pauses until it resolves. It is the natural hook for UI prompt cards.
- **Always allow:** echo back `suggestions.filter(s => s.destination === "localSettings")` as `updatedPermissions`. That writes to `.claude/settings.local.json`. Skip the option when `suppressAlwaysAllowRule` is true.
- **AskUserQuestion** arrives as `toolName === "AskUserQuestion"`. Input: `{questions: [{question, header (≤ 12 chars), options: [{label, description, preview?}] (2-4), multiSelect}]}` (1-4 questions). Answer:

  ```ts
  return { behavior: "allow", updatedInput: {
    questions: input.questions,
    answers: { [q.question]: "Label" /* multi: ["A","B"] or "A, B"; free text for "Other" */ },
    // response?: "free reply instead of answers"
  }};
  ```

- `AskUserQuestion` is not available inside subagents.
- `PermissionMode` values: `default`, `acceptEdits`, `bypassPermissions`, `plan`, `dontAsk`, `auto`. `acceptEdits` does not auto-approve MCP tools; use `allowedTools`.

## 5. Sessions

- `session_id` is on the init system message and on every result message.
- `resume: "<id>"` resumes a specific session (with full context). Since Claude Code 2.1.223 the lookup searches beyond the cwd's project dir, on the same machine only. `continue: true` resumes the most recent session in the cwd. `forkSession: true` branches.
- Transcripts: `~/.claude/projects/<cwd with non-alphanumerics → "-">/<id>.jsonl` (under `$CLAUDE_CONFIG_DIR` if set).
- Helpers: `listSessions()`, `getSessionMessages()`, `getSessionInfo()`, `renameSession()`, `tagSession()`. CatHouse can use `getSessionInfo` to check a stored session still exists before resuming, and `tagSession`/`renameSession` to label sessions with the run id.

## 6. The `Query` object (methods, from `sdk.d.ts`)

`interrupt()`, `setPermissionMode(mode)`, `setModel(model?)`, `initializationResult()`, `supportedCommands()`, `mcpServerStatus()`, `reconnectMcpServer(name)`, `reloadPlugins({holdOnCacheImpact?})`, `reloadSkills()`, `streamInput(stream)`, `stopTask(taskId)`, `close()`. It is also an `AsyncGenerator<SDKMessage>`.

## 7. Messages CatHouse maps to UI events

| Message | Use |
|---|---|
| `system/init` | `session_id`, `claude_code_version`, `cwd`, `tools`, `mcp_servers[{name,status,source}]`, `permissionMode`, `slash_commands`, `skills`, `plugins[{name,path,version}]`, `plugin_errors[{plugin,type,message}]`, `agents`. **Gate:** catherd plugin present, version 1.0.0, no plugin error; catherd MCP server not `failed`. |
| `assistant` / `user` | content blocks: text, thinking, `tool_use`, `tool_result` (with `parent_tool_use_id` for subagents). **Extract `runId` from the `tool_result` of `mcp__plugin_catherd_catherd__run_start`** (JSON `{run, dir}`). |
| `stream_event` | partial deltas (with `includePartialMessages`) |
| `system/task_started`, `task_progress`, `task_updated`, `task_notification` | subagents and background tasks: description, `subagent_type`, usage `{total_tokens, tool_uses, duration_ms}`, `last_tool_name`, status `completed/failed/stopped` |
| `system/background_tasks_changed` | full set of live background tasks (REPLACE semantics; reset on process restart) |
| `system/api_retry`, `system/compact_boundary`, `system/status`, `system/notification`, `system/session_state_changed`, `system/commands_changed` | status line, compaction marker (the catherd skill decays after compaction; surface it), notifications |
| `result` | `subtype` `success`/`error_*`, `session_id`, cost/usage, `result` text |

## 8. MCP inside SDK sessions

- MCP tools need permission. `allowedTools: ["mcp__plugin_catherd_catherd__*"]` grants exactly catherd's tools.
- **Timeouts:** `MCP_TIMEOUT` = connect timeout (30 s default). `MCP_TOOL_TIMEOUT` = how long a running tool call may take. catherd's `wait` has no timeout of its own and can block for tens of minutes, so CatHouse sets a large `MCP_TOOL_TIMEOUT` and verifies the behaviour in the Phase 1 spike. In interactive Claude Code, long MCP calls are backgrounded after about 2 min and a notification wakes the session; whether the SDK does the same is part of the spike.
- Outputs over 25k tokens are saved to a file (`MAX_MCP_OUTPUT_TOKENS` raises the limit).

## 9. Risks to verify in the Phase 1 spike

1. A `wait` longer than 2 min survives in an SDK session (with `MCP_TOOL_TIMEOUT`), or is backgrounded and wakes the session.
2. catherd's native subagents (`~/.claude/agents/catherd-*`) are registered in the SDK session (`init.agents`).
3. `canUseTool` + AskUserQuestion round-trips from the webview.
4. After a window reload, `resume: sessionId` continues the same run with no duplicate `run_start`.
5. The plugin loads from `installPath` with the MCP server connecting (`mcpServerStatus()` shows `plugin_catherd_catherd` connected).
