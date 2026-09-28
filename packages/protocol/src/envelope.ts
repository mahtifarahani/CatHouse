import { z } from "zod";

/** Bumped only on a breaking change to the envelope or an existing method's schema. */
export const PROTOCOL_VERSION = 1;

export const ProtocolErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fix: z.string().optional(),
});
export type ProtocolError = z.infer<typeof ProtocolErrorSchema>;

export const RequestEnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: z.string().min(1),
  kind: z.literal("request"),
  method: z.string().min(1),
  params: z.unknown(),
});
export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;

export const ResponseEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string(),
    kind: z.literal("response"),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.object({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string(),
    kind: z.literal("response"),
    ok: z.literal(false),
    error: ProtocolErrorSchema,
  }),
]);
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;

export const EventTopicSchema = z.enum(["setup", "session", "run", "profile", "catalog", "app"]);
export type EventTopic = z.infer<typeof EventTopicSchema>;

export const EventEnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  kind: z.literal("event"),
  topic: EventTopicSchema,
  payload: z.unknown(),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/** Anything the host sends to the webview. */
export const HostMessageSchema = z.union([ResponseEnvelopeSchema, EventEnvelopeSchema]);
export type HostMessage = z.infer<typeof HostMessageSchema>;
