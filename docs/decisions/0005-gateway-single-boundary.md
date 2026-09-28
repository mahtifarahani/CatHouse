# 0005: CatherdGateway is the only boundary to catherd; CatHouse never calls orchestrator tools

- Status: accepted (2026-09-28)

## Context
catherd's `wait` and `cancel` hand each dispatch record to exactly one caller, through a lease on disk (`src/services/dispatch-service.ts:172-173,262-265,302` in catherd). A second consumer calling `wait` would steal records from the orchestrator. catherd also stays the source of truth for runs and profiles.

## Decision
- All reads and writes go through `packages/extension/src/gateway/`. The UI never spawns processes or reads catherd files.
- Allowed MCP tools: `status`, `result`, `runs_summary`, `read_run_file`, `read_knowledge`, `profile_get`, `profile_validate`, `profile_set`, `catalog_query`, `cancel`.
- Forbidden from CatHouse: `wait`, `dispatch`, `run_start`, `route`, `preflight`, `climb`, `ask`, `land`, `set_next`, `record_agent_run`, `write_run_file`. Only the orchestrator session (the skill) calls them. The gateway enforces this with an allowlist and a unit test.
- After a UI `cancel`, the gateway's caller sends the live orchestrator session a note (`streamInput`) with the cancelled role and its record status, because the orchestrator's `wait` will not return that record.
- Every response is validated with zod and mapped to stable `protocol` models. Errors from MCP (`structuredContent`) and CLI (stderr `error`/`fix` lines) become one `CatherdError {code, message, fix}`.
