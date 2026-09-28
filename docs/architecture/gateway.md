# CatherdGateway

Status: **built in Phase 1** (CLI + MCP + env + schemas); Phase 3 adds the per-repo `CatherdGateway` and run-file parsing via MCP `read_run_file` (ADR 0007). Source: `packages/extension/src/gateway/`.

The gateway is CatHouse's only boundary to catherd (ADR 0005). It never imports `vscode`, so vitest can test all of it.

## Files

| File | What |
|---|---|
| `errors.ts` | `CatherdError {code, message, fix}` and `parseCliError(stderr)` for catherd's `error E_CODE: msg` / `fix: …` lines |
| `env.ts` | `processEnv()`: the environment for every spawned process. It merges the login-shell PATH (read once via `$SHELL -ilc`, 5 s timeout) with `~/.bun/bin`, `~/.local/bin`, `~/.opencode/bin`, `/opt/homebrew/bin`, `/usr/local/bin`. It strips a host Claude session's variables (`CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*`, `CLAUDE_PID`, `CLAUDE_EFFORT`, `CLAUDE_PREVIEW_*`, `ANTHROPIC_BASE_URL`), because they break the child's CLI login (`docs/spikes/phase1.md` finding 3) |
| `process.ts` | `runProcess(cmd, args, opts)`: spawn with timeout, AbortSignal, stdin and live output callback. It resolves on any exit code and rejects only when spawn fails |
| `cli.ts` | `CatherdCli`: runs `bunx catherd-cli@<PINNED.catherd> …` in the repo cwd. Typed methods: `version, doctor, status, runsList, runsShow, profileList, profileShow, catalogList, catalogRefresh`, plus `action(args)` for mutating commands (success = exit 0) and `raw(args)`. Timeout 180 s (the first bunx is silent for ~30 s) |
| `mcp-tools.ts` | `ALLOWED_TOOLS` (status, result, runs_summary, read_run_file, read_knowledge, profile_get, profile_validate, profile_set, catalog_query, cancel) and `ORCHESTRATOR_TOOLS` (forbidden) |
| `mcp-client.ts` | `CatherdMcp`: one long-lived stdio client per repo (ADR 0006), spawned as `bunx catherd-cli@1.0.0 mcp` with cwd = repo. Connects lazily and reconnects after a close. Handshake: `serverInfo` must be `catherd@<PINNED.catherd>`, else `E_VERSION_MISMATCH`. `call(tool, args)` rejects non-allowlisted tools with `E_TOOL_FORBIDDEN` before anything is sent. `decodeToolResult` parses JSON text (raw text for read tools) or throws `CatherdError` from `structuredContent` |
| `schemas.ts` | zod schemas for catherd 1.0.0 shapes (loose objects; only the fields CatHouse uses are checked): DoctorReport, RunSummary, Status, RunsList, RunRecord, RunsShow, ProfileList, ProfileShow, Catalog, CatalogRefresh, McpError |

Compat pins live in `packages/compat/src/index.ts` (`PINNED`, `SUPPORTED`, `findCompat`, `compareVersions`, `atLeast`).

## Error codes CatHouse adds on top of catherd's

| Code | When |
|---|---|
| `E_BUN_MISSING` | `bunx` not found (spawn ENOENT) |
| `E_TIMEOUT` | CLI call exceeded its timeout |
| `E_CLI_FAILED` | non-zero exit with no parsable catherd error |
| `E_CLI_OUTPUT` | `--json` output was not JSON |
| `E_CONTRACT` | JSON does not match the pinned catherd shape (a newer catherd needs an adapter) |
| `E_VERSION_MISMATCH` | MCP server is not catherd@PINNED |
| `E_TOOL_FORBIDDEN` | CatHouse code tried an orchestrator-only MCP tool |
| `E_MCP_ERROR` | MCP error without `{code,message,fix}` |

## Invariants

- Only the allowlisted MCP tools are ever called. A unit test proves no orchestrator tool is allowed.
- Every catherd invocation uses the pinned version (`bunx catherd-cli@1.0.0`), the same one the plugin's MCP server runs.
- `doctor` runs only on demand (it has side effects; `docs/research/catherd-doctor-setup.md`).
- Secrets never go to logs. The gateway never logs env values.

## Tests

- Unit: `gateway.test.ts`. It covers stderr parsing on a real fixture, the allowlist, `decodeToolResult`, every fixture against its schema, and `CatherdCli` with a fake runner (pinning, doctor exit 3, stderr → CatherdError, contract break, missing bunx).
- Live contract (opt-in): `CATHOUSE_CONTRACT=1 pnpm test`. It runs against the real catherd on the machine: CLI version, MCP handshake, `status`/`profile_get`/`profile_validate`/`catalog_query` decoding, `profile_set` with an invalid patch (must return `saved: false` and write nothing), `E_RUN_NOT_FOUND`, and forbidden tools. `CATHOUSE_RECORD=1` refreshes the fixtures (home dir redacted to `/Users/dev`). Last run: 6/6 on 2026-09-28.
- Fixtures: `packages/compat/fixtures/1.0.0/`: doctor ready/not-ready, status/runs list (empty), profile list/show, MCP status/profile_get/profile_validate/catalog_query/profile_set-refused, stderr E_RUN_NOT_FOUND. Runs with records still need fixtures (recorded in Phase 3).

## Still to build

`RunFilesReader` (routes.jsonl), per-repo gateway instances with dispose on folder removal, and a crash backoff for the MCP client.
