import type { RouteLite } from "@cathouse/protocol";
import { z } from "zod";

// routes.jsonl rows (catherd src/domain/route.ts:29-46), read through MCP read_run_file (ADR 0007).
const RouteRowSchema = z.looseObject({
  at: z.string(),
  lane: z.string(),
  role: z.string(),
  rung: z.string(),
  source: z.enum(["route", "climb"]),
  decidedBy: z.string(),
  from: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  env: z.boolean().optional(),
});

/** Parses a catherd JSONL file: skips the {"schema","kind"} header, bad rows and a partial tail. */
export function parseJsonl(text: string): unknown[] {
  const lines = text.split("\n");
  if (!text.endsWith("\n")) lines.pop(); // a crash can leave the last line half-written
  const out: unknown[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const v = JSON.parse(line) as Record<string, unknown>;
      if ("kind" in v && "schema" in v && Object.keys(v).length === 2) continue;
      out.push(v);
    } catch {
      // skip the corrupt row, as catherd's own reader does
    }
  }
  return out;
}

export function parseRoutes(text: string): { routes: RouteLite[]; climbs: RouteLite[] } {
  const rows: RouteLite[] = [];
  for (const raw of parseJsonl(text)) {
    const r = RouteRowSchema.safeParse(raw);
    if (!r.success) continue;
    const d = r.data;
    rows.push({
      at: d.at,
      lane: d.lane,
      role: d.role,
      rung: d.rung,
      source: d.source,
      decidedBy: d.decidedBy,
      from: d.from ?? null,
      reason: d.reason ?? null,
      kind: d.kind ?? null,
      difficulty: d.difficulty ?? null,
      ...(d.env === undefined ? {} : { env: d.env }),
    });
  }
  const last = new Map<string, RouteLite>();
  for (const r of rows) last.set(r.lane, r); // a lane's last row is its current route
  return { routes: [...last.values()], climbs: rows.filter((r) => r.source === "climb") };
}
