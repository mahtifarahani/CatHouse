import { z } from "zod";
import { PROTOCOL_VERSION } from "./envelope";

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
} as const;

export type Methods = typeof methods;
export type MethodName = keyof Methods;
export type ParamsOf<M extends MethodName> = z.input<Methods[M]["params"]>;
export type ResultOf<M extends MethodName> = z.infer<Methods[M]["result"]>;

export function isMethodName(name: string): name is MethodName {
  return Object.hasOwn(methods, name);
}
