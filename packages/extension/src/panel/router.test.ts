import { methods } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import { createRouter, HandlerError, type Handlers } from "./router";

const ctx = { view: "sidebar" as const };
const ping = { v: 1, id: "a", kind: "request", method: "app.ping", params: {} };

const unused = Object.fromEntries(
  Object.keys(methods).map((k) => [
    k,
    () => {
      throw new Error(`${k} is not used in this test`);
    },
  ]),
) as unknown as Handlers<typeof ctx>;

function router(overrides: Partial<Handlers<typeof ctx>> = {}) {
  return createRouter<typeof ctx>({
    ...unused,
    "app.ping": (_p, c) => ({ pong: true, extensionVersion: "1.2.3", protocol: 1, view: c.view }),
    "app.openDashboard": () => ({ opened: true }),
    ...overrides,
  });
}

describe("router", () => {
  it("answers a valid request", async () => {
    expect(await router()(ping, ctx)).toEqual({
      v: 1,
      id: "a",
      kind: "response",
      ok: true,
      result: { pong: true, extensionVersion: "1.2.3", protocol: 1, view: "sidebar" },
    });
  });

  it("ignores non-requests without an id", async () => {
    expect(await router()({ hello: 1 }, ctx)).toBeUndefined();
  });

  it("answers a malformed envelope that has an id", async () => {
    const r = await router()({ id: "x", kind: "request" }, ctx);
    expect(r).toMatchObject({ ok: false, error: { code: "E_PROTOCOL" } });
  });

  it("rejects unknown methods, including prototype keys", async () => {
    for (const method of ["nope", "toString"]) {
      const r = await router()({ ...ping, method }, ctx);
      expect(r).toMatchObject({ ok: false, error: { code: "E_METHOD_UNKNOWN" } });
    }
  });

  it("rejects invalid params", async () => {
    const r = await router()({ ...ping, params: "x" }, ctx);
    expect(r).toMatchObject({ ok: false, error: { code: "E_INPUT_INVALID" } });
  });

  it("passes HandlerError through and hides nothing else", async () => {
    const r1 = await router({
      "app.ping": () => {
        throw new HandlerError("E_SETUP", "not ready", "open Setup");
      },
    })(ping, ctx);
    expect(r1).toMatchObject({
      ok: false,
      error: { code: "E_SETUP", message: "not ready", fix: "open Setup" },
    });
    const r2 = await router({
      "app.ping": () => {
        throw new Error("boom");
      },
    })(ping, ctx);
    expect(r2).toMatchObject({ ok: false, error: { code: "E_INTERNAL", message: "boom" } });
  });

  it("refuses a handler result that breaks the schema", async () => {
    const bad = router({ "app.ping": () => ({ pong: false }) as never });
    expect(await bad(ping, ctx)).toMatchObject({ ok: false, error: { code: "E_INTERNAL" } });
  });
});
