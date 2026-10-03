# CatherdGateway

Status: **built in Phase 1** (CLI + MCP + env + schemas); Phase 3 adds the per-repo `CatherdGateway` and run-file parsing via MCP `read_run_file` (ADR 0007). On 2026-09-29 it moved to **catherd 1.2.0** (`docs/research/catherd-1.2-upgrade.md`). Source: `packages/extension/src/gateway/`.

The gateway is CatHouse's only boundary to catherd (ADR 0005). It never imports `vscode`, so vitest can test all of it.

## Files

| File | What |
|---|---|
| `errors.ts` | `CatherdError {code, message, fix}` and `parseCliError(stderr)` for catherd's `error E_CODE: msg` / `fix: …` lines |
| `env.ts` | `processEnv()`: the environment for every spawned process. It merges the login-shell PATH (read once via `$SHELL -ilc`, 5 s timeout) with `~/.bun/bin`, `~/.local/bin`, `~/.opencode/bin`, `/opt/homebrew/bin`, `/usr/local/bin`. It strips a host Claude session's variables (`CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*`, `CLAUDE_PID`, `CLAUDE_EFFORT`, `CLAUDE_PREVIEW_*`, `ANTHROPIC_BASE_URL`), because they break the child's CLI login (`docs/spikes/phase1.md` finding 3). It sets `CATHERD_ORCHESTRATION_HOST=claude-code` (catherd 1.4+ resolves omitted architect/verifier rungs from the host and fails on `unknown`; `docs/research/catherd-1.4-upgrade.md` §1) |
| `process.ts` | `runProcess(cmd, args, opts)`: spawn with timeout, AbortSignal, stdin and live output callback. It resolves on any exit code and rejects only when spawn fails |
| `cli.ts` | `CatherdCli`: runs `bunx catherd-cli@<PINNED.catherd> …` in the repo cwd. Typed methods: `version, doctor, status, runsList, runsShow, profileList, profileShow, catalogList, catalogRefresh`, plus `action(args)` for mutating commands (success = exit 0) and `raw(args)`. Timeout 180 s (the first bunx is silent for ~30 s) |
| `mcp-tools.ts` | `ALLOWED_TOOLS` (status, runs_summary, read_run_file, read_knowledge, profile_get, profile_validate, profile_set, catalog_query, catalog_sync) and `ORCHESTRATOR_TOOLS` (forbidden: result, cancel, peek, park, answer, gate_check, gate_pass, dispatch, run_start, route, preflight, climb, ask, land, set_next, record_agent_run, write_run_file) |
| `mcp-client.ts` | `CatherdMcp`: one long-lived stdio client per repo (ADR 0006), spawned as `bunx catherd-cli@<PINNED.catherd> mcp` with cwd = repo. Connects lazily and reconnects after a close. Handshake: `serverInfo` must be `catherd@<PINNED.catherd>`, else `E_VERSION_MISMATCH`. `call(tool, args)` rejects non-allowlisted tools with `E_TOOL_FORBIDDEN` before anything is sent. `decodeToolResult` parses JSON text (raw text for read tools) or throws `CatherdError` from `structuredContent` |
| `service.ts` | `CatherdGateway` (one per repo; the extension keeps one for the first workspace folder): `runsList` (CLI list + `status(run)` for the newest 10), `runGet` (`status` + `runs show` + `read_run_file` for `state.md` and `routes.jsonl`), `roleReply` (`runs show` for the latest record's `replyPath`, then `read_run_file`; a live role returns its state and no reply), `roleDebug` (`runs show --debug --name`), `cancelRole` (CLI `runs cancel <run> <name>`, parsed by `parseCancelOutput`), `profiles` (`profile_get` + `profile list/show` + `profile_validate`), `profileSave` (conflict check against a fresh `profile_get`, treat-likes via CLI, patch via `profile_set`, optional `profile use`), `activate/unbindRepo/createProfile/removeProfile` (CLI), `catalog` (`catalog_query`, limit 500), `catalogRefresh`, `treatLike` |
| `run-files.ts` | `parseJsonl` (header, corrupt rows, partial tail) and `parseRoutes` (last row per lane + climbs) for text from `read_run_file` (ADR 0007) |
| `schemas.ts` | zod schemas for catherd 1.2–1.4 shapes (1.3 changed none; 1.4 only added fields) (doctor `state` includes `info`; `RunSummary` has `questions`, `verifier`, `session`, `continuedIn`; runs-list rows have `session`, `continuedIn`) (loose objects; only the fields CatHouse uses are checked): DoctorReport, RunSummary, Status, RunsList, RunRecord, RunsShow, ProfileList, ProfileShow, Catalog, CatalogRefresh, McpError |

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
- **Never mark a record read and never claim a run** (catherd 1.1+). catherd pushes a finished role only to the session that owns the run, and only while its record is unread. MCP `result` and `cancel` mark records read, and `peek` claims the run, so the gateway uses neither. The gateway's own `catherd mcp` gets no `CLAUDE_CODE_*` session variables (`processEnv()` strips them), so it never owns a run.
- Every catherd invocation uses the pinned version (`bunx catherd-cli@<PINNED.catherd>`, now 1.5.0), the same one the plugin's MCP server runs.
- `doctor` runs only on demand (it has side effects; `docs/research/catherd-doctor-setup.md`).
- Secrets never go to logs. The gateway never logs env values.

## Tests

- Unit: `gateway.test.ts`. It covers stderr parsing on a real fixture, the allowlist (including `result`, `cancel`, `peek`), `decodeToolResult`, every fixture against its schema, doctor `info` rows, and `CatherdCli` with a fake runner (pinning, doctor exit 3, stderr → CatherdError, contract break, missing bunx). `service.test.ts` adds: reply read from `replyPath` with no `result` call, cancel through the CLI with no MCP call, runs list with its session, and 1.2 `inferred` scores not counted as scored.
- Live contract (opt-in): `CATHOUSE_CONTRACT=1 pnpm test`. It runs against the real catherd on the machine: CLI version, MCP handshake, `status`/`profile_get`/`profile_validate`/`catalog_query` decoding, `profile_set` with an invalid patch (must return `saved: false` and write nothing), `E_RUN_NOT_FOUND` from `read_run_file`, and forbidden tools. With `CATHOUSE_CONTRACT_RUN_REPO=<repo with a run>` it also reads a real run and a reply. `CATHOUSE_RECORD=1` refreshes the fixtures (home dir redacted to `/Users/dev`; redact any scratch repo path by hand). Last run: 7/7 on 2026-10-01 against 1.3.0.
- Fixtures: `packages/compat/fixtures/1.5.0/` (re-recorded 2026-10-03 against 1.5.0 with `CATHERD_ORCHESTRATION_HOST=claude-code`: every fixture except `gw-run-detail.json`, which carried over from 1.2.0; everything but `doctor-ready.json` comes from an isolated `CATHERD_HOME`/`CLAUDE_CONFIG_DIR`/`CATHERD_CLAUDE_AGENTS_DIR` with a fresh default profile and `CATHERD_NO_SYNC=1`): doctor ready/not-ready (clean env, so `push` is `skip`), status/runs list (empty), profile list/show, MCP status/profile_get/profile_validate/catalog_query/profile_set-refused, stderr E_RUN_NOT_FOUND, and `gw-run-detail.json` (a real 1.2 run through the gateway). The CLI fixtures are captured by hand, with a clean env (no `CLAUDE_CODE_*`) and a temporary `CATHERD_HOME` for the not-ready doctor.

## Contract details found live (1.0.0, still true in 1.2.0)

- `catalog_query` rungs carry `treatLike` as an object `{like, source: "shipped" | "user"}` (not a string).
- `catalog_query` returns `name: null` for models known only from a backend's listing.
- `read_run_file` can read catherd's own run files (`routes.jsonl`, `runs.jsonl`, `state.md`, `meta.json`), so CatHouse reads nothing from disk (ADR 0007). In 1.2 this also covers each record's reply (`dispatches/<name>/…`, the record's `replyPath`).

## Contract details found live (1.2.0, still true in 1.5.0)

- `doctor --json` rows can be `state: "info"`; without that in the schema, the whole report failed with `E_CONTRACT`.
- `runs list --json` rows carry `session {sessionId, hostSessionId, name, live}`. The gateway passes only `{name, live}` to the webview.
- `catalog_query` values carry `confidence`; a rung whose only values are `inferred` is shown as unscored.
- `catherd runs cancel` has no `--json`; it prints `<mark> <name> <status>` and indented hints.

## Still to build

Multi-root (one gateway per folder, picker in the UI, dispose on folder removal); a crash backoff for the MCP client.
