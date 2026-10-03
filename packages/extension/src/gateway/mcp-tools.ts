// ADR 0005: CatHouse may call only these catherd MCP tools. Since catherd 1.1, catherd pushes each
// finished role's record to the Claude Code session that owns the run, and a record stays "unread"
// until the orchestrator reads it. `result` and `cancel` mark a record read (so the owner is never
// told about it) and `peek` makes the caller the run's owner, so all three are forbidden here: the
// gateway reads replies with `read_run_file` and cancels with the CLI (`catherd runs cancel`).

export const ALLOWED_TOOLS = [
  "status",
  "runs_summary",
  "read_run_file",
  "read_knowledge",
  "profile_get",
  "profile_validate",
  "profile_set",
  "catalog_query",
  "catalog_sync",
] as const;
export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

/** Orchestrator-only tools, listed so a test can prove none of them is allowed. */
export const ORCHESTRATOR_TOOLS = [
  "result",
  "cancel",
  "peek",
  "park",
  "answer",
  "gate_check",
  "gate_pass",
  "dispatch",
  "run_start",
  "route",
  "preflight",
  "climb",
  "ask",
  "land",
  "set_next",
  "record_agent_run",
  "write_run_file",
  // 1.5 coordinator tools (a role gets E_ROLE_SCOPE for them)
  "test_push",
  "run_pin",
  "lane_set",
  "owns_add",
  "workspace_start",
  "workspace_contract",
  "workspace_child_start",
  "workspace_budget",
  "workspace_pause",
  "workspace_resume",
] as const;

export function isAllowedTool(name: string): name is AllowedTool {
  return (ALLOWED_TOOLS as readonly string[]).includes(name);
}
