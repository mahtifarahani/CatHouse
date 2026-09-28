# 0007: Read-only RunFilesReader for routes.jsonl

- Status: accepted (2026-09-28)

## Context
The Runs page needs CLIMBS and ROUTES. No CLI or MCP output includes them; only the TUI reads `routes.jsonl` directly (`src/entry/tui/effects.ts:40,200`). See `docs/research/public-surface-gaps.md`.

## Decision
`packages/extension/src/gateway/run-files.ts` reads `<data>/repos/<repoKey>/runs/<runId>/routes.jsonl` read-only. It resolves the data dir the way catherd does (`CATHERD_HOME`/`XDG_DATA_HOME`), locates the run through the `runs list --json`/`status` output's repo and id, validates rows with zod (`RouteRow`), skips the header and a partial last line, and is tied to the catherd version in `compat.json`. It is the only direct file read. It is removed when upstream exposes routes.
