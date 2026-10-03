import { z } from "zod";

export const OrchestratorHostSchema = z.enum(["claude-code", "codex"]);
export type OrchestratorHost = z.infer<typeof OrchestratorHostSchema>;

export const SetupActionIdSchema = z.enum([
  "install-bun",
  "upgrade-bun",
  "init-catherd",
  "install-plugin",
  "update-plugin",
  "install-codex-plugin",
  "update-codex-plugin",
  "login-claude",
  "install-claude-cli",
  "install-codex",
  "login-codex",
  "start-codex-daemon",
  "restart-codex-daemon",
  "install-opencode",
  "check-readiness",
  "save-api-keys",
]);
export type SetupActionId = z.infer<typeof SetupActionIdSchema>;

export const SetupItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  state: z.enum(["ok", "missing", "outdated", "error", "warn", "unknown", "info"]),
  detail: z.string(),
  /** gate: blocks the whole UI · start: blocks starting tasks · optional: informational */
  level: z.enum(["gate", "start", "optional"]),
  fix: z.string().optional(),
  action: z.object({ id: SetupActionIdSchema, label: z.string() }).optional(),
});
export type SetupItem = z.infer<typeof SetupItemSchema>;

export const SetupStateSchema = z.object({
  host: OrchestratorHostSchema,
  checking: z.boolean(),
  /** The action currently running, if any (one at a time). */
  running: SetupActionIdSchema.optional(),
  items: z.array(SetupItemSchema),
  /** All gate items are ok: the dashboards may open. */
  gateOpen: z.boolean(),
  /** Gate open, selected host logged in, readiness (doctor) checked and ready. */
  canStart: z.boolean(),
  canStartReason: z.string().optional(),
  checkedAt: z.string().optional(),
  doctorAt: z.string().optional(),
  /** Which optional catherd keys are already saved; never the values. */
  savedKeys: z.object({ jev: z.boolean(), aa: z.boolean() }).optional(),
});
export type SetupState = z.infer<typeof SetupStateSchema>;

export const SetupTopicSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), state: SetupStateSchema }),
  z.object({
    type: z.literal("output"),
    action: SetupActionIdSchema,
    chunk: z.string(),
  }),
  z.object({
    type: z.literal("action_done"),
    action: SetupActionIdSchema,
    ok: z.boolean(),
    message: z.string().optional(),
  }),
]);
export type SetupTopic = z.infer<typeof SetupTopicSchema>;
