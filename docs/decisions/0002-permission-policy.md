# 0002: Permission policy for orchestrator sessions

- Status: accepted (2026-09-28, user decision)

## Context
The catherd orchestrator runs Bash (fast checks, `git commit`), Agent (native subagents) and many MCP calls. catherd marks no tool `readOnlyHint` (run-findings Ruling 2), so every catherd MCP call hits permission checks unless allowed.

## Decision
- `allowedTools: ["mcp__plugin_catherd_catherd__*"]`: catherd's own tools are auto-allowed.
- Everything else follows the user's own Claude settings (`settingSources: ["user", "project", "local"]`: allow/deny rules, default mode).
- Anything still unresolved reaches `canUseTool` and becomes a prompt card in the UI: Allow once / Always allow (echo `suggestions` with destination `localSettings`) / Deny with a message.
- The Start form can set the session's permission mode (default `default`); `setPermissionMode` changes it live.

## Rejected
- Asking for everything: autopilot stalls. A CatHouse-shipped allowlist preset: hides policy from the user's own settings.
