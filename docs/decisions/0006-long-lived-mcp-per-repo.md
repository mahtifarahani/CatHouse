# 0006: One long-lived `catherd mcp` process per repo

- Status: accepted (2026-09-28)

## Context
Every `catherd mcp` process runs `reconcileAll` at startup, which finalizes and watches dispatches across all runs and writes files (`src/entry/mcp/server.ts:59-72`). Setup tools default `repo` to the server's cwd. Starting a process per call would be slow (bunx) and would reconcile repeatedly.

## Decision
The gateway keeps one MCP client (`@modelcontextprotocol/sdk` over stdio) per workspace-folder repo, spawned as `bunx catherd-cli@<pinned> mcp` (1.5.0 since 2026-10-03) with `cwd` = the repo root, and always passes `repo` explicitly. It restarts on crash with backoff, and is disposed with the extension. The handshake checks `serverInfo.version` and `tools/list`.

Note (catherd 1.1+): this server must stay session-less. It gets no `CLAUDE_CODE_*` variables, so it never owns a run and never pushes notices. It also runs catherd's background source sync at start (at most every 12 h).
