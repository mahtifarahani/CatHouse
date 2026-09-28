import {
  isMethodName,
  type MethodName,
  type Methods,
  methods,
  PROTOCOL_VERSION,
  type ProtocolError,
  RequestEnvelopeSchema,
  type ResponseEnvelope,
  type ResultOf,
} from "@cathouse/protocol";
import type { z } from "zod";

// Kept free of the `vscode` module so it can be unit-tested with plain vitest.

export type Handlers<Ctx> = {
  [M in MethodName]: (
    params: z.infer<Methods[M]["params"]>,
    ctx: Ctx,
  ) => Promise<ResultOf<M>> | ResultOf<M>;
};

/** An error a handler throws on purpose; it reaches the webview as-is. */
export class HandlerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fix?: string,
  ) {
    super(message);
  }
}

function fail(id: string, error: ProtocolError): ResponseEnvelope {
  return { v: PROTOCOL_VERSION, id, kind: "response", ok: false, error };
}

function idOf(raw: unknown): string | undefined {
  if (typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string") {
    return raw.id;
  }
  return undefined;
}

/**
 * Validates an incoming webview message, runs its handler and returns the response to post back.
 * Returns undefined for messages that are not requests and carry no id to answer.
 */
export function createRouter<Ctx>(handlers: Handlers<Ctx>) {
  return async function handle(raw: unknown, ctx: Ctx): Promise<ResponseEnvelope | undefined> {
    const env = RequestEnvelopeSchema.safeParse(raw);
    if (!env.success) {
      const id = idOf(raw);
      return id === undefined
        ? undefined
        : fail(id, { code: "E_PROTOCOL", message: "malformed request envelope" });
    }
    const { id, method } = env.data;
    if (!isMethodName(method)) {
      return fail(id, {
        code: "E_METHOD_UNKNOWN",
        message: `unknown method ${method}`,
        fix: "reload the window so the webview and the extension match",
      });
    }
    const spec = methods[method];
    const params = spec.params.safeParse(env.data.params);
    if (!params.success) {
      return fail(id, { code: "E_INPUT_INVALID", message: params.error.message });
    }
    try {
      const handler = handlers[method] as (p: unknown, c: Ctx) => unknown;
      const result = spec.result.safeParse(await handler(params.data, ctx));
      if (!result.success) {
        return fail(id, {
          code: "E_INTERNAL",
          message: `${method} returned an invalid result: ${result.error.message}`,
        });
      }
      return { v: PROTOCOL_VERSION, id, kind: "response", ok: true, result: result.data };
    } catch (e) {
      if (e instanceof HandlerError) {
        return fail(id, {
          code: e.code,
          message: e.message,
          ...(e.fix === undefined ? {} : { fix: e.fix }),
        });
      }
      return fail(id, { code: "E_INTERNAL", message: e instanceof Error ? e.message : String(e) });
    }
  };
}
