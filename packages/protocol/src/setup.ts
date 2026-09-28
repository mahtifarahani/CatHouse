import { z } from "zod";

export const SetupActionIdSchema = z.enum([
  "install-bun",
  "upgrade-bun",
  "init-catherd",
  "install-plugin",
  "update-plugin",
  "login-claude",
  "install-claude-cli",
  "install-codex",
  "login-codex",
  "install-opencode",
  "check-readiness",
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
  checking: z.boolean(),
  /** The action currently running, if any (one at a time). */
  running: SetupActionIdSchema.optional(),
  items: z.array(SetupItemSchema),
  /** All gate items are ok: the dashboards may open. */
  gateOpen: z.boolean(),
  /** Gate open, Claude logged in, readiness (doctor) checked and ready. */
  canStart: z.boolean(),
  canStartReason: z.string().optional(),
  checkedAt: z.string().optional(),
  doctorAt: z.string().optional(),
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
