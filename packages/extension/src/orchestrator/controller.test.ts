import type { SessionTopic } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import {
  type ControllerDeps,
  type SavedLink,
  SessionController,
  type SessionLike,
} from "./controller";
import type { SessionOptions } from "./session";

function setup(overrides: Partial<ControllerDeps> = {}) {
  const links = new Map<string, SavedLink>();
  const sent: SessionTopic[] = [];
  const created: SessionOptions[] = [];
  let finish!: () => void;
  const fake: SessionLike & { sentTexts: string[]; interruptions: number } = {
    sessionId: undefined,
    runId: undefined,
    sentTexts: [],
    interruptions: 0,
    start: async () => {},
    send(t) {
      this.sentTexts.push(t);
    },
    interrupt: async function () {
      this.interruptions += 1;
    },
    finished: () => new Promise<void>((r) => (finish = r)),
    close: () => finish?.(),
  };
  const deps: ControllerDeps = {
    env: async () => ({}),
    findPluginPath: async () => "/plugin",
    links: { get: (r) => links.get(r), set: (r, l) => links.set(r, l) },
    sessionExists: async () => true,
    createSession: (o) => {
      created.push(o);
      return fake;
    },
    broadcast: (p) => sent.push(p),
    log: () => {},
    ...overrides,
  };
  return { c: new SessionController(deps), links, sent, created, fake, end: () => finish() };
}

describe("SessionController", () => {
  it("starts with the namespaced command and records the run ↔ session link", async () => {
    const { c, created, links } = setup();
    await c.start("/repo", "add a util");
    expect(created[0]?.prompt).toBe("/catherd:catherd add a util");
    const o = created[0] as SessionOptions;
    o.onEvent({
      kind: "init",
      sessionId: "s1",
      claudeCodeVersion: "2.1.283",
      catherdPlugin: { name: "catherd", path: "/p", version: "1.0.0" },
      catherdMcpStatus: "connected",
      pluginErrors: [],
      agents: [],
      permissionMode: "default",
    });
    o.onEvent({ kind: "run_started", runId: "r1", dir: "/d" });
    expect(links.get("/repo")).toMatchObject({ sessionId: "s1", runId: "r1" });
    expect(c.snapshot()).toMatchObject({ phase: "running", runId: "r1", sessionId: "s1" });
    expect(c.snapshot().events[0]).toEqual({ kind: "user", text: "add a util" });
  });

  it("refuses a second session", async () => {
    const { c } = setup();
    await c.start("/repo", "a");
    await expect(c.start("/repo", "b")).rejects.toMatchObject({ code: "E_SESSION_ACTIVE" });
  });

  it("refuses to start without the plugin", async () => {
    const { c } = setup({ findPluginPath: async () => undefined });
    await expect(c.start("/repo", "a")).rejects.toMatchObject({ code: "E_PLUGIN_MISSING" });
  });

  it("resumes the saved session without a task (no duplicate run_start)", async () => {
    const { c, links, created } = setup();
    links.set("/repo", { sessionId: "s9", runId: "r9", savedAt: "x" });
    const state = await c.resume("/repo");
    expect(created[0]?.resume).toBe("s9");
    expect(created[0]?.prompt).toContain("catherd run r9");
    expect(created[0]?.prompt).not.toContain("/catherd:catherd ");
    expect(state.runId).toBeUndefined(); // state published before; snapshot now has it
    expect(c.snapshot().runId).toBe("r9");
  });

  it("falls back to a fresh /catherd:catherd when the transcript is gone", async () => {
    const { c, links, created } = setup({ sessionExists: async () => false });
    links.set("/repo", { sessionId: "gone", savedAt: "x" });
    await c.resume("/repo");
    expect(created[0]?.resume).toBeUndefined();
    expect(created[0]?.prompt).toBe("/catherd:catherd");
  });

  it("round-trips a prompt card and rejects mismatched answers", async () => {
    const { c, created, sent } = setup();
    await c.start("/repo", "a");
    const ac = new AbortController();
    const answer = (created[0] as SessionOptions).onPrompt(
      { kind: "permission", toolName: "Bash", input: { command: "ls" }, canAlwaysAllow: true },
      ac.signal,
    );
    const pending = c.snapshot().prompts[0];
    expect(pending?.request.kind).toBe("permission");
    const id = pending?.id as string;
    expect(c.answer(id, { kind: "question", answers: {} })).toBe(false);
    expect(c.answer(id, { kind: "permission", decision: "always" })).toBe(true);
    await expect(answer).resolves.toEqual({ kind: "permission", decision: "always" });
    expect(sent.some((p) => p.type === "prompt_resolved" && p.id === id)).toBe(true);
    expect(c.snapshot().prompts).toEqual([]);
  });

  it("denies pending permissions on stop", async () => {
    const { c, created } = setup();
    await c.start("/repo", "a");
    const answer = (created[0] as SessionOptions).onPrompt(
      { kind: "permission", toolName: "Bash", input: {}, canAlwaysAllow: false },
      new AbortController().signal,
    );
    c.stop();
    await expect(answer).resolves.toMatchObject({ decision: "deny" });
    expect(c.snapshot().phase).toBe("ended");
  });

  it("resets to an empty idle chat and keeps the saved link", async () => {
    const { c, links, created } = setup();
    await c.start("/repo", "a");
    (created[0] as SessionOptions).onEvent({ kind: "run_started", runId: "r1", dir: "/d" });
    links.set("/repo", { sessionId: "s1", runId: "r1", savedAt: "t" });
    c.reset();
    expect(c.snapshot()).toMatchObject({ phase: "idle", events: [], prompts: [] });
    expect(links.get("/repo")).toBeDefined();
    await expect(c.start("/repo", "b")).resolves.toMatchObject({ phase: "starting" });
  });

  it("reports the pending prompt count and switches permission mode", async () => {
    const counts: number[] = [];
    const modes: string[] = [];
    const { c, created, fake } = setup({ onPromptsChanged: (n) => counts.push(n) });
    fake.setPermissionMode = async (m) => {
      modes.push(m);
    };
    await c.start("/repo", "a", "plan");
    expect(created[0]?.permissionMode).toBe("plan");
    const p = (created[0] as SessionOptions).onPrompt(
      { kind: "question", questions: [] },
      new AbortController().signal,
    );
    c.answer(c.snapshot().prompts[0]?.id as string, { kind: "question", answers: {} });
    await p;
    await c.setPermissionMode("acceptEdits");
    expect(counts).toEqual([1, 0]);
    expect(modes).toEqual(["acceptEdits"]);
    expect(c.snapshot().permissionMode).toBe("acceptEdits");
  });

  it("sends follow-ups into the running session", async () => {
    const { c, fake } = setup();
    await c.start("/repo", "a");
    c.send("also add docs");
    expect(fake.sentTexts).toEqual(["also add docs"]);
    expect(() => {
      c.stop();
      c.send("x");
    }).toThrow();
  });

  it("tracks whether the current turn can be interrupted", async () => {
    const { c, created, fake } = setup();
    await c.start("/repo", "a");
    expect(c.snapshot().turnActive).toBe(true);

    await c.interrupt();
    expect(fake.interruptions).toBe(1);
    expect(c.snapshot().turnActive).toBe(false);

    await c.interrupt();
    expect(fake.interruptions).toBe(1);

    c.send("continue");
    expect(c.snapshot().turnActive).toBe(true);
    (created[0] as SessionOptions).onEvent({
      kind: "result",
      subtype: "success",
      sessionId: "s1",
      isError: false,
    });
    expect(c.snapshot().turnActive).toBe(false);
  });

  it("treats a catherd push as a new turn and shows its repeated init once", async () => {
    const { c, created, sent } = setup();
    await c.start("/repo", "a");
    const o = created[0] as SessionOptions;
    const init = {
      kind: "init" as const,
      sessionId: "s1",
      claudeCodeVersion: "2.1.283",
      catherdPlugin: { name: "catherd", path: "/p", version: "1.2.0" },
      catherdMcpStatus: "connected",
      pluginErrors: [],
      agents: [],
      permissionMode: "default",
    };
    o.onEvent(init);
    o.onEvent({ kind: "result", subtype: "success", sessionId: "s1", isError: false });
    expect(c.snapshot().turnActive).toBe(false);

    // the SDK stream of a pushed turn: command_lifecycle started → init again → … → result
    o.onEvent({ kind: "inbound" });
    expect(c.snapshot().turnActive).toBe(true);
    expect(sent.at(-1)).toMatchObject({ type: "state", state: { turnActive: true } });
    o.onEvent(init);
    expect(c.snapshot().events.filter((e) => e.kind === "init")).toHaveLength(1);
    expect(c.snapshot().events.filter((e) => e.kind === "inbound")).toHaveLength(1);
    o.onEvent({ kind: "result", subtype: "success", sessionId: "s1", isError: false });
    expect(c.snapshot().turnActive).toBe(false);
  });

  it("resumes with peek, never with the removed wait", async () => {
    const { c, links, created } = setup();
    links.set("/repo", { sessionId: "s9", runId: "r9", savedAt: "x" });
    await c.resume("/repo");
    expect(created[0]?.prompt).toContain('peek("r9")');
    expect(created[0]?.prompt).not.toMatch(/\bwait\b/);
  });
});
