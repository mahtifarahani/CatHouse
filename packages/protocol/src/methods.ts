import { z } from "zod";
import { PROTOCOL_VERSION } from "./envelope";
import { PromptAnswerSchema, SessionStateSchema } from "./session";

/**
 * Every request the webview can make, with its params and result schemas.
 * Add a method here first; the host router and the webview client are typed from this table.
 */
export const methods = {
  "app.ping": {
    params: z.object({}),
    result: z.object({
      pong: z.literal(true),
      extensionVersion: z.string(),
      protocol: z.literal(PROTOCOL_VERSION),
      view: z.enum(["sidebar", "dashboard"]),
    }),
  },
  "app.openDashboard": {
    params: z.object({}),
    result: z.object({ opened: z.literal(true) }),
  },
  "catherd.status": {
    params: z.object({}),
    result: z.object({
      version: z.string(),
      runs: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          repo: z.string(),
          live: z.number(),
          roleRuns: z.number(),
          stateTail: z.array(z.string()),
        }),
      ),
    }),
  },
  "session.state": { params: z.object({}), result: SessionStateSchema },
  "session.start": {
    params: z.object({ task: z.string().min(1), repo: z.string().optional() }),
    result: SessionStateSchema,
  },
  "session.resume": {
    params: z.object({ repo: z.string().optional() }),
    result: SessionStateSchema,
  },
  "session.send": { params: z.object({ text: z.string().min(1) }), result: z.object({}) },
  "session.interrupt": { params: z.object({}), result: z.object({}) },
  "session.stop": { params: z.object({}), result: SessionStateSchema },
  "session.answer": {
    params: z.object({ id: z.string(), answer: PromptAnswerSchema }),
    result: z.object({ accepted: z.boolean() }),
  },
} as const;

export type Methods = typeof methods;
export type MethodName = keyof Methods;
export type ParamsOf<M extends MethodName> = z.input<Methods[M]["params"]>;
export type ResultOf<M extends MethodName> = z.infer<Methods[M]["result"]>;

export function isMethodName(name: string): name is MethodName {
  return Object.hasOwn(methods, name);
}
