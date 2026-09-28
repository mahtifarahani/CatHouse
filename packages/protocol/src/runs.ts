import { z } from "zod";

const Tokens = z.object({ input: z.number(), cached: z.number(), output: z.number() });
const Spent = z.object({ spent: z.number(), cap: z.number() });

export const BudgetSchema = z
  .object({
    fraction: z.number(),
    minutes: Spent.optional(),
    tokens: Spent.optional(),
    usd: Spent.optional(),
  })
  .nullable();

export const RunListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  repo: z.string(),
  createdAt: z.string(),
  live: z.number(),
  roleRuns: z.number(),
  landed: z.number().optional(),
  budgetFraction: z.number().nullable().optional(),
});
export type RunListItem = z.infer<typeof RunListItemSchema>;

export const RecordLiteSchema = z.object({
  dispatchId: z.string(),
  name: z.string(),
  role: z.string(),
  lane: z.string().nullable(),
  rung: z.string(),
  status: z.string(),
  secs: z.number(),
  startedAt: z.string(),
  endedAt: z.string(),
  replyStatus: z.string().nullable(),
  replyWhy: z.string().nullable(),
  tokens: Tokens,
  costUsd: z.number().nullable(),
  changedOwned: z.array(z.string()),
  violations: z.array(z.string()),
  threadHeavy: z.boolean(),
});
export type RecordLite = z.infer<typeof RecordLiteSchema>;

export const RouteLiteSchema = z.object({
  at: z.string(),
  lane: z.string(),
  role: z.string(),
  rung: z.string(),
  source: z.enum(["route", "climb"]),
  decidedBy: z.string(),
  from: z.string().nullable(),
  reason: z.string().nullable(),
  kind: z.string().nullable(),
  difficulty: z.string().nullable(),
  env: z.boolean().optional(),
});
export type RouteLite = z.infer<typeof RouteLiteSchema>;

export const RunDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  repo: z.string(),
  createdAt: z.string(),
  stateMd: z.string(),
  live: z.array(
    z.object({ name: z.string(), rung: z.string(), state: z.string(), secs: z.number() }),
  ),
  totals: z.object({
    runs: z.number(),
    ok: z.number(),
    notOk: z.array(z.string()),
    tokens: Tokens,
    costUsd: z.number().nullable(),
    wallMinutes: z.number(),
  }),
  agents: z.object({ runs: z.number(), totalTokens: z.number(), costUsd: z.number().nullable() }),
  jev: z.object({ decisions: z.number(), fallbacks: z.number() }),
  budget: BudgetSchema,
  milestones: z.array(z.string()),
  warnings: z.array(z.string()),
  records: z.array(RecordLiteSchema),
  /** The last route row per lane (TUI "ROUTES"). */
  routes: z.array(RouteLiteSchema),
  /** Every climb row (TUI "CLIMBS"). */
  climbs: z.array(RouteLiteSchema),
});
export type RunDetail = z.infer<typeof RunDetailSchema>;

export const RoleReplySchema = z.object({
  name: z.string(),
  state: z.string().nullable(),
  reply: z.string(),
  replyPath: z.string().nullable(),
});

export const RoleDebugSchema = z.object({
  name: z.string(),
  dispatchId: z.string(),
  rung: z.string(),
  exit: z
    .object({
      code: z.number().nullable(),
      signal: z.string().nullable(),
      reason: z.string(),
      endedAt: z.string(),
    })
    .nullable(),
  stderrTail: z.array(z.string()),
  eventsTail: z.array(z.string()),
  supervisorTail: z.array(z.string()),
});
