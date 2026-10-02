import { z } from "zod";

// Session models shared by the host (packages/extension/src/orchestrator) and the webview.

export const SessionEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("init"),
    sessionId: z.string(),
    claudeCodeVersion: z.string(),
    /** The orchestrator session's model (SDK init `model`). */
    model: z.string().optional(),
    catherdPlugin: z
      .object({ name: z.string(), path: z.string(), version: z.string().optional() })
      .optional(),
    catherdMcpStatus: z.string().optional(),
    pluginErrors: z.array(
      z.object({ plugin: z.string(), type: z.string().optional(), message: z.string().optional() }),
    ),
    agents: z.array(z.string()),
    permissionMode: z.string(),
  }),
  z.object({ kind: z.literal("text"), text: z.string(), parentToolUseId: z.string().nullable() }),
  z.object({ kind: z.literal("thinking"), parentToolUseId: z.string().nullable() }),
  z.object({
    kind: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
    parentToolUseId: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("tool_result"),
    toolUseId: z.string(),
    isError: z.boolean(),
    text: z.string(),
    parentToolUseId: z.string().nullable(),
  }),
  z.object({ kind: z.literal("tool_progress"), toolUseId: z.string(), elapsedSecs: z.number() }),
  z.object({ kind: z.literal("run_started"), runId: z.string(), dir: z.string() }),
  z.object({
    kind: z.literal("task"),
    phase: z.enum(["started", "progress", "updated", "notification"]),
    taskId: z.string(),
    description: z.string().optional(),
    subagentType: z.string().optional(),
    status: z.string().optional(),
    durationMs: z.number().optional(),
    lastTool: z.string().optional(),
  }),
  z.object({ kind: z.literal("status"), subtype: z.string(), detail: z.string().optional() }),
  z.object({
    kind: z.literal("result"),
    subtype: z.string(),
    sessionId: z.string(),
    isError: z.boolean(),
    costUsd: z.number().optional(),
    text: z.string().optional(),
  }),
  z.object({ kind: z.literal("user"), text: z.string() }),
  /**
   * A turn the session started on its own: catherd 1.1+ pushes each finished role into the
   * session's peer inbox. The SDK does not show the message text, only that a turn began.
   */
  z.object({ kind: z.literal("inbound") }),
  /** The conversation was compacted; the catherd skill is known to decay after this. */
  z.object({ kind: z.literal("compacted") }),
]);
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const QuestionSchema = z.object({
  question: z.string(),
  header: z.string(),
  multiSelect: z.boolean(),
  options: z.array(
    z.object({ label: z.string(), description: z.string(), preview: z.string().optional() }),
  ),
});

export const PromptRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("question"), questions: z.array(QuestionSchema) }),
  z.object({
    kind: z.literal("permission"),
    toolName: z.string(),
    input: z.record(z.string(), z.unknown()),
    title: z.string().optional(),
    decisionReason: z.string().optional(),
    canAlwaysAllow: z.boolean(),
  }),
]);
export type PromptRequest = z.infer<typeof PromptRequestSchema>;

export const PromptAnswerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("question"),
    answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    response: z.string().optional(),
  }),
  z.object({
    kind: z.literal("permission"),
    decision: z.enum(["allow", "always", "deny"]),
    message: z.string().optional(),
  }),
]);
export type PromptAnswer = z.infer<typeof PromptAnswerSchema>;

export const PendingPromptSchema = z.object({ id: z.string(), request: PromptRequestSchema });
export type PendingPrompt = z.infer<typeof PendingPromptSchema>;

export const SessionStateSchema = z.object({
  phase: z.enum(["idle", "starting", "running", "ended"]),
  /** True only while Claude is processing the current user turn. */
  turnActive: z.boolean(),
  permissionMode: z.string().optional(),
  repo: z.string().optional(),
  sessionId: z.string().optional(),
  runId: z.string().optional(),
  error: z.object({ code: z.string(), message: z.string(), fix: z.string().optional() }).optional(),
  /** Recent events (bounded) so a reloaded webview can rebuild the transcript. */
  events: z.array(SessionEventSchema),
  prompts: z.array(PendingPromptSchema),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

/** Payload of events on the "session" topic. */
export const SessionTopicSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: SessionEventSchema }),
  z.object({ type: z.literal("prompt"), prompt: PendingPromptSchema }),
  z.object({ type: z.literal("prompt_resolved"), id: z.string() }),
  z.object({ type: z.literal("state"), state: SessionStateSchema }),
]);
export type SessionTopic = z.infer<typeof SessionTopicSchema>;
