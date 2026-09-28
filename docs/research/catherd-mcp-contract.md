# catherd 1.0.0: MCP server contract

Citations are relative to the catherd repo at commit `b257da7`. The server has **exactly 21 tools**; `test/entry/mcp.test.ts:17-39` asserts the list.

## Summary for CatHouse

- A successful result has **no `structuredContent`** and no `outputSchema`. Parse the JSON from `content[0].text`.
- An error result is `isError: true`, with `structuredContent: {code, message, fix}`.
- `wait` has **no timeout**. It sends progress only when the request carries a `progressToken`.
- **`wait` and `cancel` hand each record to exactly one caller.** A CatHouse `wait` would steal records from the orchestrator, so CatHouse must never call `wait`. `cancel` is allowed, but the orchestrator must then be told.
- Every new `catherd mcp` process runs `reconcileAll` at startup, which writes files. Keep one long-lived process per repo.

## 1. Where it is defined

| Piece | Location |
|---|---|
| CLI routing | `src/cli.ts:53`: `mcp: () => import("./entry/mcp/command.ts")` |
| Command | `src/entry/mcp/command.ts:4-7`, which calls `startMcpServer()` |
| Server | `src/entry/mcp/server.ts:39-56`; `new McpServer({ name: "catherd", version: deps.version })` at `:40` |
| Transport | `StdioServerTransport` (`server.ts:61`) |
| Tool groups | `registerRunTools` (`run-tools.ts`), `registerLaneTools` (`lane-tools.ts`), `registerDispatchTools` (`dispatch-tools.ts`), `registerSetupTools` (`setup-tools.ts`), called at `server.ts:51-54` |
| Deps | `src/entry/deps.ts:7-16`: `pollMs: 250`, `tickMs: Number(process.env.CATHERD_TICK_MS) \|\| 30_000`, `version: VERSION` |
| Plugin launch config | `plugin/.mcp.json`: `{"mcpServers":{"catherd":{"command":"bunx","args":["catherd-cli@1.0.0","mcp"]}}}` |

**Startup** (`server.ts:59-72`): the server connects first, then runs `reconcileAll` (`src/services/reconcile.ts:55-101`) over every run on disk. Reconcile finalizes finished dispatches that have no record, watches live ones, and scrubs world-readable `spec.json` files left by older builds. Warnings go to stderr as `catherd: <warning>`; nothing is sent over MCP.

**Logging:** one JSONL file per day at `<data>/logs/catherd-<date>.jsonl`. The server never writes logs to stdout. The level comes from `CATHERD_LOG` or `--verbose` (`src/infra/log.ts:8-19,73`). Each tool call is logged with its name, duration, ok flag and error code, never its input (`server.ts:18-37`).

## 2. Result and error envelope (`src/entry/mcp/result.ts`)

- **Success** (`:5-7`): `content: [{type: "text", text}]`, where `text = JSON.stringify(v, null, 2)`.
  - `read_run_file` and `read_knowledge` return their raw string, not JSON.
- **Failure** (`:10-19`): `isError: true`, `text = JSON.stringify(err)`, `structuredContent: err`.
  - `err` is always `{code, message, fix}`. `fix` is always present and defaults to `""`.
  - A non-catherd error becomes `{code: "E_IO_UNEXPECTED", message, fix: "this is a catherd bug: report it with the message"}`.
- **SDK-level errors** (unknown tool, or input the zod schema rejects) are rewritten by `sdkToolError` (`:41-51`, hooked at `server.ts:45-50`) to code `E_INPUT_INVALID`.
  - For an unknown tool, `fix` says to call a tool from `tools/list` and that it may need a newer catherd.
  - For bad input, `fix` is `"correct the argument the message names, then call again"`.
- Many results carry `hints: string[]`: one line each on what to do next.

## 3. Error codes (`src/domain/errors.ts:1-28`; class at `:37-53`)

| Area | Codes |
|---|---|
| Config | `E_CONFIG_INVALID`, `E_CONFIG_NEWER_SCHEMA`, `E_CONFIG_KEYBIND` |
| Backend | `E_BACKEND_MISSING`, `E_BACKEND_TOO_OLD`, `E_BACKEND_NOT_LOGGED_IN`, `E_BACKEND_MODEL_UNKNOWN` |
| Run | `E_RUN_NOT_FOUND`, `E_RUN_CORRUPT`, `E_RUN_BUDGET`, `E_RUN_COMMIT`, `E_RUN_NOT_LIVE` |
| Admission | `E_ADMIT_RUNG`, `E_ADMIT_DUPLICATE`, `E_ADMIT_OVERLAP`, `E_ADMIT_ID`, `E_ADMIT_THREAD` |
| Lane | `E_LANE_INVALID` |
| Jev | `E_JEV_KEY`, `E_JEV_NETWORK`, `E_JEV_RESPONSE` |
| IO | `E_IO_LOCK`, `E_IO_WRITE`, `E_IO_PATH`, `E_IO_UNEXPECTED` |
| Other | `E_INPUT_INVALID`, `E_RUNTIME_TOO_OLD` |

- `E_CONFIG_NEWER_SCHEMA`: a file's `schema` is higher than this build understands (`src/infra/store.ts:113-127`).
- `E_RUNTIME_TOO_OLD`: Bun is older than 1.4.0. It is printed to stderr with exit 1 before anything runs (`src/cli.ts:7-11`, `src/domain/runtime.ts:2,15-21`).

## 4. Shared input types

- `ID_PATTERN = /^[A-Za-z0-9][\w.-]{0,127}$/` (`src/domain/ids.ts:4`). `assertId` also rejects `..`.
- `ROLES` (`src/domain/roles.ts:3-12`): `architect, verifier, worker, reviewer, ui-reviewer, artist, writer, researcher`.
- `CLIMB_REASONS` (`src/domain/route.ts:4-11`): `check-failed-twice, blocker, same-defect, refused, blocked, unchanged`.
- `PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/` (`src/domain/profile.ts:15`).
- Rung: `backend:model#effort`. Backends: `codex, claude-code, opencode, cursor, grok, claude` (`ids.ts:15-18,32-48`).
- Run id: `<YYYYMMDD-HHMMSS UTC>-<slug(title)>[-n]` (`src/services/run-store.ts:78-97`). `findRun` searches every repo, not just the current one (`run-store.ts:163-172`).

## 5. Tools

### Run tools (`src/entry/mcp/run-tools.ts`)

| Tool | Input (zod) | Output |
|---|---|---|
| `run_start` (`:21-33`) | `repo` string min 1; `title` string min 1; `a_lines` string[] min 1 (each min 1) | `{run, dir, hints?}` (`src/services/run-service.ts:23-42`). `E_IO_PATH` if `repo` is not inside a git repo. |
| `write_run_file` (`:35-43`) | `run`; `path` min 1; `content` | `{path (absolute), bytes}` (`run-service.ts:44-51`). catherd's own files are refused. |
| `read_run_file` (`:45-52`) | `run`; `path` min 1 | raw text (`run-service.ts:53-60`) |
| `status` (`:54-66`) | `run?` | `{version, runs: RunSummary[], warnings}`, redacted (`src/services/summary.ts:96-106`). Without `run`: every run with a live role, else only the newest run, across all repos. |
| `result` (`:68-75`) | `run`; `name` (ID) | `{name, state: "starting"\|"running"\|"finished"\|null, record: RunRecord\|null, reply (capped at 250 lines / 20k chars), replyPath}` (`run-service.ts:85-112`) |
| `set_next` (`:77-85`) | `run`; `next` min 1 | `{state: string\|null, hints?}` (`run-service.ts:66-72`) |
| `record_agent_run` (`:87-118`) | `run`; `name` ID; `role` enum ROLES; `rung` min 3; `total_tokens` int ≥ 0; `duration_ms?` ≥ 0; `cost_usd?` ≥ 0; `status` enum `ok\|failed\|cancelled` (default `ok`); `lane?` ID | AgentRun `{at, name, role, rung, agent, totalTokens, costUsd, secs, status, lane}` (`run-service.ts:115-150`; schema `run-store.ts:227-239`). The rung must be `claude:`, else `E_ADMIT_RUNG`. |
| `read_knowledge` (`:120-128`) | `repo` min 1 | raw markdown, or a "no knowledge recorded yet" line (`run-service.ts:153-161`) |
| `runs_summary` (`:130-143`) | `run?`, `repo?`, `role?` (enum), `since_days?` (positive) | `{rungs: RungStats[], agents: {rung, runs, totalTokens, secs}[], harness: HarnessCost[]}` (`summary.ts:108-227`) |

### Lane tools (`src/entry/mcp/lane-tools.ts`)

| Tool | Input | Output |
|---|---|---|
| `route` (`:12-24`) | `run`; `lane_file?`; `role` enum (default `worker`) | `{lane, role, rung, ladder[], source: "jev"\|"jev-kind"\|"lane"\|"default", kind, difficulty, backend, agent, questionSet, jev: {pKind, pA, pB, nouls}\|null}` (`src/services/lane-service.ts:35-49,67-106`) |
| `preflight` (`:26-34`) | `run`; `confirmed?` bool | Either `{needsConfirmation: true, commands: [{lane, check}]}`, or `{needsConfirmation: false, commands, results: [{lane, check, outcome: pass\|fails-as-expected\|skipped\|cannot-start, exitCode, tail[], note}], blocked}` (`src/services/preflight.ts:12-31`). Each check has a 120 s timeout. |
| `climb` (`:36-50`) | `run`; `lane` ID; `reason` enum CLIMB_REASONS; `evidence?`; `env?` bool | `{lane, rung, top, backend, agent, hints?}` (`lane-service.ts:109-159`) |
| `ask` (`:52-64`) | `run`; `question` enum `finding\|same-defect`; `state` record<string,string> | `{value, probability, confidence, source: "jev"\|"default"}` (`src/domain/jev.ts:255-262`) |
| `land` (`:66-82`) | `run`; `milestone`, `what`, `evidence`, `next` (each min 1); `commit` matching `/^[0-9a-f]{7,40}$/`; `learned?` | `{ledger, minutes, hints?}` (`lane-service.ts:167-225`). `E_RUN_COMMIT` if the commit does not exist. |

### Dispatch tools (`src/entry/mcp/dispatch-tools.ts`)

| Tool | Input | Output |
|---|---|---|
| `dispatch` (`:31-48`) | `run`; `role` enum; `name` ID; `brief` min 1; `rung` min 3; `thread?`; `lane?` ID; `next?` | `{dispatched: {name, role, rung, dispatchId, admittedAt}, hints[]}` (`src/services/dispatch-service.ts:54-65,152-168`). Returns about 1 s after launch. |
| `wait` (`:50-71`) | `run`; `names?` ID[]; `all?` bool | `{records: [{record: RunRecord, hints[]}], started: Dispatched[], running: string[], hints[]}` (`dispatch-service.ts:75-83,212-304`) |
| `cancel` (`:73-81`) | `run`; `name` ID | `{record, hints[]}` (`dispatch-service.ts:461-479`). `E_RUN_NOT_LIVE` when the role has no live dispatch. |

### Setup and profile tools (`src/entry/mcp/setup-tools.ts`)

| Tool | Input | Output |
|---|---|---|
| `catalog_query` (`:27-50`) | `repo?` min 1; `role?` enum; `backend?`; `text?`; `scored_only` bool (default false); `limit` int 1..500 (default 50) | `{total, models: CatalogModel[]}` (`src/services/catalog-service.ts:315-382`). Prices use the billing of the repo's profile (`:47`). |
| `profile_get` (`:52-60`) | `name?` PROFILE_NAME; `repo?` | `{active, here, profiles: string[], profile: ProfileView, enforcement: {role: "enforced"\|"advisory"}}` (`src/services/ports.ts:47-59`, `src/services/profile-service.ts:272-282`) |
| `profile_validate` (`:62-70`) | `name?`; `repo?` | `{valid, errors: Issue[], warnings: Issue[]}`; Issue = `{path, message, fix?}` (`src/domain/profile-rules.ts:18-22`, `profile-service.ts:283-286`) |
| `profile_set` (`:72-80`) | `name?`; `repo?`; `patch: ProfilePatchSchema` | `{saved, errors, warnings, diff: [{path, before, after}], linked[], pruned[], newSessionNeededFor[]}` (`ports.ts:32-41`, `profile-service.ts:93-119`). An invalid patch writes nothing and returns `saved: false` as a normal success, not a tool error. A `name` that does not exist creates a new profile from the default. |

**`ProfilePatchSchema`** (`src/domain/profile.ts:251-275`) is strict at every level. The merge rule is RFC 7396 (`:279-287`): lists replace, maps merge, and `null` deletes a key.

```ts
{
  objective?: "cost" | "speed",
  jev?: { use?: "auto" | "off" },
  billing?: Partial<Record<BillingKey, "chatgpt-plan"|"claude-plan"|"subscription"|"metered" | null>>,
  roles?: Partial<Record<Role, { enabled?: boolean, access?: "read-only"|"workspace-write"|"full",
                                  rungs?: string[], defaultRung?: string | null }>>,
  harness?: Partial<Record<"codex"|"claude-code"|"opencode"|"cursor"|"grok", { isolated?: boolean }>>,
  failover?: Record<string /*rung*/, string /*rung*/ | null>,
  budget?: { minutes?: number|null, tokens?: number|null, usd?: number|null },
  timeouts?: { idleMin?: number, wallMin?: number },
  preflight?: { confirm?: boolean },
  lock?: { heavy?: number | "cpus/2" },
  notify?: ("milestone"|"finish"|"blocked")[],
}
```

BillingKey is `codex, claude, claude-code, opencode-go, opencode, cursor, grok` (`catalog.ts:14-22`).

## 6. Shared output types

- **ProfileView** (`ports.ts:12-29`): `{name, objective, roles{enabled, access, rungs, defaultRung?}, billing, jev, isolated{backend: bool}, failover, budget, timeouts, preflight, heavy, notify}`. This is **not** the shape of CLI `profile show --json`; see `catherd-profile-schema.md`.
- **CatalogModel** (`catalog-service.ts:315-328`): `{id, name, backend, model, billing, efforts[], context, capabilities, roles[], listed: bool|null, notes, rungs: [{rung, enabled, why?, scores: {dim: {value, benchmark, confidence}}, treatLike, cost: {tier, value, mode}}]}` (`:282-313`, `src/domain/cost.ts:64-82`). `listed: false` means the user's account's last listing does not offer it.
- **RunRecord** (`src/domain/record.ts:41-74`): see `catherd-data-layout.md` §runs.jsonl. It is a `looseObject`, so newer builds may add fields.
- **RunSummary** (`summary.ts:20-36`):

```ts
{ id, title, repo, createdAt,
  stateTail: string[],                 // last 3 non-blank lines of state.md
  live: { name, rung, state: "starting"|"running", secs, dispatchId }[],
  totals: { runs, ok, notOk: string[] /* "name (status)" */, tokens: {input, cached, output}, costUsd, wallMinutes },
  agents: { runs, totalTokens, costUsd },
  jev: { decisions, fallbacks },
  harness: { backend, native, isolated }[],
  budget: { fraction, minutes?: {spent, cap}, tokens?: {spent, cap}, usd?: {spent, cap} } | null,
  milestones: string[],               // ledger rows after the header
  warnings: string[] }
```

## 7. `wait`: blocking, progress, single delivery

- **No timeout.** It polls every `pollMs` (250 ms) until at least one targeted dispatch finishes, or every one with `all: true` (`dispatch-service.ts:239-287`). Dispatch lifetimes are bounded by the profile's `timeouts` (idle 15 min, wall 90 min by default), which the supervisor enforces.
- **Returns at once** with a hint when nothing is left to collect (`:170,224-227`).
- **Progress** is sent only when the request has `_meta.progressToken` (`dispatch-tools.ts:61-69`, `progressTo` at `:15-28`).
  - Method `notifications/progress`, params `{progressToken, progress: n, message}`.
  - Sent every `tickMs` (30 000 ms by default; `CATHERD_TICK_MS` overrides), one per open dispatch (`dispatch-service.ts:275-286`).
  - Message: `"<name> · <rung> · <secs>s[ · <lastEvent>]"`.
  - No other notification types exist: no logging capability, resources or prompts.
- **Client timeout:** an MCP client cuts off a long `wait` unless it passes a progressToken with `resetTimeoutOnProgress: true` (as `test/mcp-helpers.ts:25-28` does) or uses a very large timeout. Inside Claude Code / the Agent SDK this is governed by `MCP_TOOL_TIMEOUT`.
- **Cancellation:** an aborted request (`extra.signal`) puts back anything it collected and returns `hints: ["wait was cancelled: nothing collected"]` (`:240-243,294-297`).
- **Single delivery.** `wait` and `cancel` hand each record to exactly one caller, through a claim-based lease on disk (`:172-173,262-265,302`).
  - **Safe for CatHouse** (do not affect the orchestrator): `status`, `result`, `runs_summary`, `read_run_file`, `read_knowledge`, `catalog_query`, `profile_get`, `profile_validate`, `profile_set`.
  - **Allowed with care:** `cancel`. It collects the record itself, so the orchestrator's `wait` will not return it. If a `wait` was already in flight, `cancel` adds the hint "a wait in flight also returned this record".
  - **Never from CatHouse:** `wait`, `dispatch`, `run_start`, `route`, `preflight`, `climb`, `ask`, `land`, `set_next`, `record_agent_run`, `write_run_file`. These belong to the orchestrator.

## 8. How the server finds the repo

- Run and lane tools take an explicit `repo` (`run_start`, `read_knowledge`) or a `run`. `repo` is resolved with `git rev-parse --show-toplevel` (`src/infra/git.ts:52-55`).
- Setup tools default `repo` to the server process's `process.cwd()`.
  - Profile tools refuse a `repo` outside git with `E_IO_PATH` (`setup-tools.ts:17-24`).
  - `catalog_query` falls back to global listings and the active profile (`:44`).
- Profile resolution: the profile bound to the repo (`projects.json`), else the active profile (`profile-service.ts:269-274`).
- **CatHouse rule:** spawn the server with `cwd` set to the repo root **and** always pass `repo` explicitly.

## 9. Version

- `serverInfo = {name: "catherd", version}` in the MCP `initialize` response (`server.ts:40`).
- The `status` tool's top-level `version` (`summary.ts:99-100`). The skill requires an exact match with `catherd-cli@1.0.0`.
- Detect features by tool name in `tools/list`. The server says an unknown tool means a newer catherd is needed (`result.ts:47`).

## 10. Environment variables the server reads

`CATHERD_HOME`, `CATHERD_CONFIG_DIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` (paths); `CATHERD_TICK_MS`; `CATHERD_LOG` (`off|error|warn|info|debug`); `CATHERD_LOCK_SLOTS`; `CATHERD_CLAUDE_AGENTS_DIR`; `CLAUDE_CONFIG_DIR`; `TYPESAFE_API_KEY`; `NO_COLOR`; `IS_SANDBOX` (lets preflight run as root).
