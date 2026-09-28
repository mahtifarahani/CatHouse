# 0007: Run files are read through MCP `read_run_file`, never from disk

- Status: accepted (2026-09-28); **revised the same day** (originally: a direct read-only reader for routes.jsonl)

## Context
The Runs page needs CLIMBS and ROUTES (`routes.jsonl`) and the full `state.md`. No CLI `--json` output includes routes; the TUI reads the file directly (`src/entry/tui/effects.ts:40,200` upstream). See `docs/research/public-surface-gaps.md` gap 1.

## Decision
Read run files with catherd's own MCP tool `read_run_file(run, path)`. It is on the gateway allowlist (ADR 0005), read-only, and resolves the run folder itself. A probe on 2026-09-28 against catherd 1.0.0 confirmed it returns `routes.jsonl`, `runs.jsonl`, `state.md`, `meta.json` and `roles/<name>/latest`. CatHouse parses JSONL with a zod `RouteRow` schema, skips the `{"schema":1,"kind":…}` header and a partial last line.

CatHouse therefore reads **no catherd file directly**. The one exception is Setup's read of `config.json` (whether init ran) and Claude's `installed_plugins.json` / `known_marketplaces.json`, which are detector reads (`docs/architecture/setup.md`).

## Rejected
A direct file reader (the original version of this ADR). It needed CatHouse to recompute catherd's repo key and data dir, and it duplicated upstream path logic.
