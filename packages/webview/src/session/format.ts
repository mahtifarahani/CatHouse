const CATHERD = "mcp__plugin_catherd_catherd__";

/** "mcp__plugin_catherd_catherd__wait" → "catherd · wait"; other MCP tools → "server · tool". */
export function shortTool(name: string): string {
  if (name.startsWith(CATHERD)) return `catherd · ${name.slice(CATHERD.length)}`;
  const m = /^mcp__(.+?)__(.+)$/.exec(name);
  return m ? `${m[1]} · ${m[2]}` : name;
}

export function oneLine(input: unknown, max = 120): string {
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    const pick =
      o.command ??
      o.description ??
      o.file_path ??
      o.skill ??
      o.query ??
      o.pattern ??
      o.url ??
      o.name ??
      o.run ??
      o.prompt;
    if (typeof pick === "string") return pick.length > max ? `${pick.slice(0, max)}…` : pick;
  }
  const s = JSON.stringify(input ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function mmss(secs: number): string {
  const m = Math.floor(secs / 60);
  return `${m}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
}

/** Splits a tool name into its MCP server (if any) and the bare tool, for chip + label display. */
export function toolParts(name: string): { server?: string; tool: string } {
  if (name.startsWith(CATHERD)) return { server: "catherd", tool: name.slice(CATHERD.length) };
  const m = /^mcp__(.+?)__(.+)$/.exec(name);
  return m?.[1] && m[2] ? { server: m[1], tool: m[2] } : { tool: name };
}

// catherd's role names, longest first so "ui-reviewer" wins over "reviewer".
const ROLE_NAMES = [
  "ui-reviewer",
  "researcher",
  "architect",
  "reviewer",
  "verifier",
  "worker",
  "artist",
  "writer",
];
const EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh", "max"]);

/**
 * catherd links its native Claude agents as `catherd-<profile>-<role>-<model>-<effort>`
 * (e.g. `catherd-default-architect-claude-opus-5-5-high`). Returns the parts, or undefined for
 * any other agent name.
 */
export function parseAgentName(
  name: string | undefined,
): { profile: string; role: string; model: string; effort?: string } | undefined {
  if (!name?.startsWith("catherd-")) return undefined;
  const rest = name.slice("catherd-".length);
  let best: { at: number; role: string } | undefined;
  for (const role of ROLE_NAMES) {
    const at = rest.indexOf(`-${role}-`);
    if (at > 0 && (!best || at < best.at || (at === best.at && role.length > best.role.length)))
      best = { at, role };
  }
  if (!best) return undefined;
  const profile = rest.slice(0, best.at);
  const tail = rest.slice(best.at + best.role.length + 2).split("-");
  const last = tail.at(-1);
  const effort = last && EFFORTS.has(last) && tail.length > 1 ? last : undefined;
  const model = (effort ? tail.slice(0, -1) : tail).join("-");
  return { profile, role: best.role, model, ...(effort ? { effort } : {}) };
}

/** catherd names live dispatches `<role>-<lane>` (e.g. `worker-M1.L2`, `ui-reviewer-M1`). */
export function roleOfDispatch(name: string): string | undefined {
  return ROLE_NAMES.find((r) => name === r || name.startsWith(`${r}-`));
}

/** `codex:gpt-6-luna#high` → { backend: "codex", model: "gpt-6-luna", effort: "high" }. */
export function rungParts(rung: string): { backend?: string; model: string; effort?: string } {
  const [head, effort] = rung.split("#");
  const colon = (head ?? "").indexOf(":");
  const backend = colon > 0 ? head?.slice(0, colon) : undefined;
  const model = colon > 0 ? (head ?? "").slice(colon + 1) : (head ?? rung);
  return { ...(backend ? { backend } : {}), model, ...(effort ? { effort } : {}) };
}
