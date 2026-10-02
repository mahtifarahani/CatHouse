import { z } from "zod";

// Raw catherd 1.4.0 output shapes (docs/research/catherd-*-contract.md). Objects are loose so a
// newer catherd adding fields does not break parsing; only the fields CatHouse uses are checked.

export const DoctorCheckSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  // "info" (1.1+): worth knowing, nothing to fix (the shipped defaults' access rows)
  state: z.enum(["ok", "warn", "fail", "skip", "info"]),
  word: z.string(),
  detail: z.string(),
  fix: z.string().optional(),
});
export const DoctorReportSchema = z.looseObject({
  ready: z.boolean(),
  version: z.string(),
  checks: z.array(DoctorCheckSchema),
});
export type DoctorReport = z.infer<typeof DoctorReportSchema>;

const Spent = z.object({ spent: z.number(), cap: z.number() });
/** The Claude Code session that started a run (1.1+); null for runs started by 1.0. */
const RunSessionSchema = z.looseObject({ name: z.string(), live: z.boolean() }).nullable();
export const RunSummarySchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  repo: z.string(),
  createdAt: z.string(),
  stateTail: z.array(z.string()),
  live: z.array(
    z.looseObject({
      name: z.string(),
      rung: z.string(),
      state: z.enum(["starting", "running"]),
      secs: z.number(),
      dispatchId: z.string(),
    }),
  ),
  totals: z.looseObject({
    runs: z.number(),
    ok: z.number(),
    notOk: z.array(z.string()),
    tokens: z.looseObject({ input: z.number(), cached: z.number(), output: z.number() }),
    costUsd: z.number().nullable(),
    wallMinutes: z.number(),
  }),
  agents: z.looseObject({
    runs: z.number(),
    totalTokens: z.number(),
    costUsd: z.number().nullable(),
  }),
  jev: z.looseObject({ decisions: z.number(), fallbacks: z.number() }),
  budget: z
    .looseObject({
      fraction: z.number(),
      minutes: Spent.optional(),
      tokens: Spent.optional(),
      usd: Spent.optional(),
    })
    .nullable(),
  milestones: z.array(z.string()),
  warnings: z.array(z.string()),
  questions: z.array(z.looseObject({ milestone: z.string(), question: z.string() })),
  verifier: z.looseObject({ at: z.string(), item: z.string(), carried: z.boolean() }).nullable(),
  session: RunSessionSchema,
  continuedIn: z.string().nullable(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const StatusSchema = z.looseObject({
  version: z.string(),
  runs: z.array(RunSummarySchema),
  warnings: z.array(z.string()),
});
export type Status = z.infer<typeof StatusSchema>;

export const RunsListSchema = z.looseObject({
  runs: z.array(
    z.looseObject({
      id: z.string(),
      title: z.string(),
      repo: z.string(),
      createdAt: z.string(),
      live: z.number(),
      roleRuns: z.number(),
      session: RunSessionSchema,
      continuedIn: z.string().nullable(),
    }),
  ),
  corrupt: z.array(z.looseObject({ id: z.string(), dir: z.string(), reason: z.string() })),
});
export type RunsList = z.infer<typeof RunsListSchema>;

export const RunRecordSchema = z.looseObject({
  runId: z.string(),
  dispatchId: z.string(),
  name: z.string(),
  role: z.string(),
  lane: z.string().nullable(),
  backend: z.string(),
  rung: z.string(),
  status: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  secs: z.number(),
  replyStatus: z.string().nullable(),
  replyPath: z.string(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

export const RunsShowSchema = z.looseObject({
  summary: RunSummarySchema,
  records: z.array(RunRecordSchema),
  dispatches: z.array(z.looseObject({ name: z.string(), dispatchId: z.string() })).optional(),
});
export type RunsShow = z.infer<typeof RunsShowSchema>;

export const ProfileListSchema = z.array(
  z.looseObject({ name: z.string(), active: z.boolean(), repos: z.array(z.string()) }),
);

export const ProfileShowSchema = z.looseObject({
  profile: z.looseObject({ name: z.string(), roles: z.record(z.string(), z.unknown()) }),
  active: z.unknown(),
  enforcement: z.record(z.string(), z.string()),
  standIns: z.array(
    z.looseObject({ from: z.string(), to: z.string(), inferred: z.boolean(), via: z.unknown() }),
  ),
});

export const CatalogSchema = z.looseObject({
  total: z.number(),
  models: z.array(
    z.looseObject({
      id: z.string(),
      backend: z.string(),
      model: z.string(),
      listed: z.boolean().nullable(),
      rungs: z.array(z.looseObject({ rung: z.string(), enabled: z.boolean() })),
    }),
  ),
});

export const CatalogRefreshSchema = z.array(
  z.looseObject({
    backend: z.string(),
    models: z.number(),
    fetchedAt: z.string().nullable(),
    error: z.string().optional(),
    fix: z.string().optional(),
  }),
);

export const McpErrorSchema = z.object({ code: z.string(), message: z.string(), fix: z.string() });
