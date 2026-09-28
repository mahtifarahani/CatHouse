# 0006: One long-lived `catherd mcp` process per repo

- Status: accepted (2026-09-28)

## Context
Every `catherd mcp` process runs `reconcileAll` at startup, which finalizes and watches dispatches across all runs and writes files (`src/entry/mcp/server.ts:59-72`). Setup tools default `repo` to the server's cwd. Starting a process per call would be slow (bunx) and would reconcile repeatedly.

## Decision
The gateway keeps one MCP client (`@modelcontextprotocol/sdk` over stdio) per workspace-folder repo, spawned as `bunx catherd-cli@1.0.0 mcp` with `cwd` = the repo root, and always passes `repo` explicitly. It restarts on crash with backoff, and is disposed with the extension. The handshake checks `serverInfo.version` and `tools/list`.
