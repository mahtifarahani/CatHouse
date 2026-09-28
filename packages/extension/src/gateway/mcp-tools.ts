// ADR 0005: CatHouse may call only these catherd MCP tools. `wait` and `cancel` hand each record
// to exactly one caller; `wait` would steal records from the orchestrator, so it is forbidden.
// `cancel` is allowed, but the caller must then tell the orchestrator session.

export const ALLOWED_TOOLS = [
  "status",
  "result",
  "runs_summary",
  "read_run_file",
  "read_knowledge",
  "profile_get",
  "profile_validate",
  "profile_set",
  "catalog_query",
  "cancel",
] as const;
export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

/** Orchestrator-only tools, listed so a test can prove none of them is allowed. */
export const ORCHESTRATOR_TOOLS = [
  "wait",
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
] as const;

export function isAllowedTool(name: string): name is AllowedTool {
  return (ALLOWED_TOOLS as readonly string[]).includes(name);
}
