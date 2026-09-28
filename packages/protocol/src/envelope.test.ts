import { describe, expect, it } from "vitest";
import {
  HostMessageSchema,
  isMethodName,
  methods,
  PROTOCOL_VERSION,
  RequestEnvelopeSchema,
} from "./index";

describe("protocol envelope", () => {
  it("accepts a well-formed request", () => {
    const parsed = RequestEnvelopeSchema.safeParse({
      v: PROTOCOL_VERSION,
      id: "1",
      kind: "request",
      method: "app.ping",
      params: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a request from another protocol version", () => {
    const parsed = RequestEnvelopeSchema.safeParse({
      v: 2,
      id: "1",
      kind: "request",
      method: "app.ping",
      params: {},
    });
    expect(parsed.success).toBe(false);
  });

  it("parses both host message kinds", () => {
    expect(
      HostMessageSchema.safeParse({ v: 1, id: "1", kind: "response", ok: true, result: {} })
        .success,
    ).toBe(true);
    expect(
      HostMessageSchema.safeParse({
        v: 1,
        id: "1",
        kind: "response",
        ok: false,
        error: { code: "E_X", message: "m" },
      }).success,
    ).toBe(true);
    expect(
      HostMessageSchema.safeParse({ v: 1, kind: "event", topic: "app", payload: null }).success,
    ).toBe(true);
  });

  it("knows its methods", () => {
    expect(isMethodName("app.ping")).toBe(true);
    expect(isMethodName("toString")).toBe(false);
    expect(methods["app.ping"].params.safeParse({}).success).toBe(true);
  });
});
