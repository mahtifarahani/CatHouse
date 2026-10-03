# 0005: CatherdGateway is the only boundary to catherd; CatHouse never calls orchestrator tools

- Status: accepted (2026-09-28); amended 2026-09-29 for catherd 1.1+ (push model)

## Context
catherd's `wait` and `cancel` hand each dispatch record to exactly one caller, through a lease on disk (`src/services/dispatch-service.ts:172-173,262-265,302` in catherd). A second consumer calling `wait` would steal records from the orchestrator. catherd also stays the source of truth for runs and profiles.

## Decision
- All reads and writes go through `packages/extension/src/gateway/`. The UI never spawns processes or reads catherd files.
- Allowed MCP tools: `status`, `result`, `runs_summary`, `read_run_file`, `read_knowledge`, `profile_get`, `profile_validate`, `profile_set`, `catalog_query`, `cancel`.
- Forbidden from CatHouse: `wait`, `dispatch`, `run_start`, `route`, `preflight`, `climb`, `ask`, `land`, `set_next`, `record_agent_run`, `write_run_file`. Only the orchestrator session (the skill) calls them. The gateway enforces this with an allowlist and a unit test.
- After a UI `cancel`, the gateway's caller sends the live orchestrator session a note (`streamInput`) with the cancelled role and its record status, because the orchestrator's `wait` will not return that record.
- Every response is validated with zod and mapped to stable `protocol` models. Errors from MCP (`structuredContent`) and CLI (stderr `error`/`fix` lines) become one `CatherdError {code, message, fix}`.

## Amendment (2026-09-29): catherd 1.1+ pushes records to the owning session

catherd 1.1 removed `wait`. A finished role's record now stays *unread* until `result` reads it, and the MCP server that owns the run pushes it to the owning Claude Code session's peer inbox. `dispatch` and `peek` make the caller the run's owner. MCP `result` and `cancel` mark a record read, while the CLI `catherd runs cancel` leaves it unread, so it is still announced (catherd `src/entry/mcp/run-tools.ts:69`, `src/services/dispatch-service.ts:210,589-594`, commit `3cee546`). A second consumer that reads records or claims runs would therefore silence the orchestrator.

- Allowed MCP tools: `status`, `runs_summary`, `read_run_file`, `read_knowledge`, `profile_get`, `profile_validate`, `profile_set`, `catalog_query`, `catalog_sync`.
- Forbidden from CatHouse: `result`, `cancel`, `peek`, `park`, `answer`, `gate_check`, `gate_pass`, `dispatch`, `run_start`, `route`, `preflight`, `climb`, `ask`, `land`, `set_next`, `record_agent_run`, `write_run_file`.
- Role replies are read with `read_run_file(run, record.replyPath)`. A role is cancelled with the CLI `catherd runs cancel <run> <name>`, then the live session gets a note that the user did it.
- The gateway's `catherd mcp` must never see `CLAUDE_CODE_*` session variables (`processEnv()` strips them), or it would count as a session.

## Amendment (2026-10-03): catherd 1.5 coordinator tools and role scope

catherd 1.5 has 38 MCP tools. The new coordinator tools change a run's plan or ownership: `test_push`, `run_pin`, `lane_set`, `owns_add`, `workspace_start`, `workspace_contract`, `workspace_child_start`, `workspace_budget`, `workspace_pause` and `workspace_resume`. They join the forbidden list. The allowlist is unchanged. The read-only `workspace_status` and `workspace_inspect` may be allowed later, once a Workspaces view needs them.

catherd 1.5 treats any process carrying `CATHERD_ROLE=<run>/<name>` as a role and refuses its coordinator calls, `profile_set` included, with `E_ROLE_SCOPE` (catherd `src/domain/role-scope.ts:8,57`, commit `2061e6e`). CatHouse is never a role, so `processEnv()` also strips `CATHERD_ROLE`. Details: `docs/research/catherd-1.5-upgrade.md`.
