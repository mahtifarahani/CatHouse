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
