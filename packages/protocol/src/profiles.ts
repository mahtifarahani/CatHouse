import { z } from "zod";

// The profile as MCP profile_get returns it (ProfileView, catherd src/services/ports.ts:12-29).
// Edits are made on this shape; profilePatch() maps them to catherd's patch shape.

export const ROLES = [
  "architect",
  "verifier",
  "worker",
  "reviewer",
  "ui-reviewer",
  "artist",
  "writer",
  "researcher",
] as const;
export const ACCESS = ["read-only", "workspace-write", "full"] as const;
export const NOTIFY = ["milestone", "finish", "blocked"] as const;
export const BILLING_MODES = ["chatgpt-plan", "claude-plan", "subscription", "metered"] as const;

export const RoleConfigSchema = z.object({
  enabled: z.boolean(),
  access: z.string(),
  rungs: z.array(z.string()),
  defaultRung: z.string().optional(),
});
export type RoleConfig = z.infer<typeof RoleConfigSchema>;

export const ProfileDocSchema = z.object({
  name: z.string(),
  objective: z.string(),
  roles: z.record(z.string(), RoleConfigSchema),
  billing: z.record(z.string(), z.string()),
  jev: z.object({ use: z.string() }),
  isolated: z.record(z.string(), z.boolean()),
  failover: z.record(z.string(), z.string()),
  budget: z.object({
    minutes: z.number().optional(),
    tokens: z.number().optional(),
    usd: z.number().optional(),
  }),
  timeouts: z.object({ idleMin: z.number(), wallMin: z.number() }),
  preflight: z.object({ confirm: z.boolean() }),
  heavy: z.union([z.number(), z.string()]),
  notify: z.array(z.string()),
});
export type ProfileDoc = z.infer<typeof ProfileDocSchema>;

export const IssueSchema = z.object({
  path: z.string(),
  message: z.string(),
  fix: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const ProfilesStateSchema = z.object({
  /** The global active profile. */
  active: z.string(),
  /** The profile the current repo runs on (bound, else active). */
  here: z.string(),
  names: z.array(z.string()),
  /** Repos bound to each profile (from `profile list --json`). */
  bindings: z.record(z.string(), z.array(z.string())),
  profile: ProfileDocSchema,
  enforcement: z.record(z.string(), z.string()),
  standIns: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      inferred: z.boolean(),
      via: z.string().nullable(),
    }),
  ),
  validation: z.object({
    valid: z.boolean(),
    errors: z.array(IssueSchema),
    warnings: z.array(IssueSchema),
  }),
});
export type ProfilesState = z.infer<typeof ProfilesStateSchema>;

export const ProfileSaveResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("saved"),
    diff: z.array(z.object({ path: z.string(), before: z.unknown(), after: z.unknown() })),
    warnings: z.array(IssueSchema),
    newSessionNeededFor: z.array(z.string()),
    activated: z.boolean(),
  }),
  z.object({
    status: z.literal("refused"),
    errors: z.array(IssueSchema),
    warnings: z.array(IssueSchema),
  }),
  /** The profile changed on disk since the editor loaded it; `current` is the new base. */
  z.object({ status: z.literal("conflict"), current: ProfileDocSchema }),
  z.object({ status: z.literal("unchanged") }),
]);
export type ProfileSaveResult = z.infer<typeof ProfileSaveResultSchema>;
