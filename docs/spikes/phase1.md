# Phase 1 spikes: running catherd from a Claude Agent SDK session

Date: 2026-09-28. Machine: macOS (Darwin 27, arm64), Node 22.13.1, Bun 1.4.2, catherd-cli 1.0.0, plugin catherd@catherd 1.0.0 (commit a32507f), `@anthropic-ai/claude-agent-sdk` 0.3.283 (bundled Claude Code 2.1.283), Codex CLI 0.158.0 (ChatGPT login), Claude login claude.ai (Pro).

Harness: `packages/extension/scripts/spike.ts`, built with `node packages/extension/build.mjs --spike` into `packages/extension/dist-spike/spike.mjs`. It drives `OrchestratorSession` (`packages/extension/src/orchestrator/session.ts`) outside VS Code, auto-answers questions (first option) and permissions (allow), and logs `events.jsonl`, `raw.jsonl`, `prompts.jsonl` and `summary.json` into `spike-<timestamp>/` next to the repo. Scratch repo: a git repo with `package.json`, `tsconfig.json`, `src/index.ts` and `README.md`.

```bash
export PATH="$HOME/.bun/bin:$PATH"
node packages/extension/build.mjs --spike   # run inside packages/extension
env -u ANTHROPIC_BASE_URL node dist-spike/spike.mjs --repo <scratch repo> --prompt "<prompt>" [--resume <sessionId>] [--max-minutes N]
```

## Results

| # | Risk | Result | Evidence |
|---|---|---|---|
| 0 | The plugin loads from `installPath` and its MCP server connects | ✅ | init: `plugins` has `{name: "catherd", path: ~/.claude/plugins/cache/catherd/catherd/1.0.0, source: "catherd@inline", version: "1.0.0"}`; `mcp_servers` has `plugin:catherd:catherd` **connected** (source `plugin`); `plugin_errors` empty; `slash_commands` has `catherd:catherd`, `catherd:catherd-setup`. ToolSearch loads the deferred tools and `status` returns `version: "1.0.0"`. Cost $0.19. |
| b | catherd's native subagents register in an SDK session | ✅ | init `agents` has `catherd-default-architect-claude-opus-5-5-high` and `catherd-default-verifier-claude-opus-5-5-low` (symlinks in `~/.claude/agents`, loaded via `settingSources: ["user", …]`). |
| a | A catherd `wait` longer than 2 min survives | ✅ | `run_start` → `dispatch` (worker `codex:gpt-6-luna#high`, brief "sleep 150, then append a line") → one `wait` call that **blocked 178 s in the foreground** and returned the record (`status: ok`, `replyStatus: complete`, `secs: 180`). No backgrounding: no `background_tasks_changed` or `task_*` messages. While it blocked, the SDK emitted **5 `tool_progress` messages** (catherd's 30 s progress ticks), which the UI can show. `MCP_TOOL_TIMEOUT` was set to 4 h (`MCP_TOOL_TIMEOUT_MS`). The worker really edited `README.md`. Cost $0.16. |
| d | Resume after a restart continues the same run with no duplicate | ✅ | New process with `resume: 0ca9f70a-…`: without calling `run_start`, the session named run `20260928-101130-spike-long-wait` from its history, called `status` for it (0 live, 1 role run). `catherd runs list --json` still shows exactly one run. Cost $0.20. |
| c | `canUseTool` + AskUserQuestion answered from the webview | ✅ (owner-reported) | 2026-09-28: the owner ran a task from the dashboard in VS Code (dev host on the scratch repo) and reported it worked ("aali bood"). The transcript was not inspected by the agent; re-verify details (question card, permission card, reload → Resume) in the Phase 4 checklist. |
| runId | CatHouse captures the run id | ✅ | The event mapper turned the `run_start` tool_result `{run, dir}` into `run_started` (`packages/extension/src/orchestrator/events.ts`). |

## Findings that change the design

1. **Long `wait` is a foreground tool call in the SDK**, not a background task. The session is "busy" for the whole wait, which is fine because CatHouse streams events meanwhile. Keep `MCP_TOOL_TIMEOUT` large. Show `tool_progress` as the live heartbeat. User messages sent with `streamInput` during a wait queue until the tool returns; to cut in, call `interrupt()`.
2. **`allowedTools: ["mcp__plugin_catherd_catherd__*"]` shadows `canUseTool`** for catherd tools. The SDK prints the warning `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`. This is intended (ADR 0002). The UI should filter this warning out of logs.
3. **Environment leaks from a host Claude session break auth.** From a shell inside the Claude desktop app, `claude auth status --json` said `loggedIn: false` until `CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*` and `ANTHROPIC_BASE_URL` were removed. With a clean env: `loggedIn: true`. `processEnv()` (`packages/extension/src/gateway/env.ts`) strips `CLAUDE*` variables. The spike harness also drops `ANTHROPIC_*`. VS Code's extension host normally has none of these, but Setup's login check must use the same clean env.
4. **The init message model was `claude-opus-5-5[1m]`** (the user's default). The orchestrator runs on the user's own model, as the skill intends.
5. **claude.ai MCP connectors load in SDK sessions** (Claude Docs, Figma showed `pending`), because settingSources don't control them. This is harmless, but it adds context. A later option: set `ENABLE_CLAUDEAI_MCP_SERVERS=false` in the session env if users want a lean orchestrator.
6. **Fresh-install doctor quirk:** right after upgrading Codex, the first `doctor --json` reported `profile invalid` (worker has no usable rung), and a second run reported ready. The stale model listing was refreshed during the first run. Setup should run `catalog refresh --json` before `doctor --json` after any backend install/upgrade.
7. **Plugin install via the bundled binary works** with a clean env plus the HTTPS `insteadOf` variables (see `docs/research/catherd-known-issues.md`). No standalone `claude` is needed (ADR 0001 confirmed).

## Next

Phase 2 (mandatory Setup).
