import { describe, expect, it } from "vitest";
import { CATHERD_TOOL_PREFIX, createEventMapper } from "./events";

describe("event mapper", () => {
  it("maps init and finds the catherd plugin and MCP server", () => {
    const [e] = createEventMapper()({
      type: "system",
      subtype: "init",
      session_id: "s1",
      claude_code_version: "2.1.283",
      plugins: [{ name: "catherd", path: "/p", version: "1.0.0" }],
      mcp_servers: [{ name: "plugin:catherd:catherd", status: "pending" }],
      agents: ["catherd-default-architect-claude-opus-5-5-high"],
      permissionMode: "default",
    });
    expect(e).toMatchObject({
      kind: "init",
      sessionId: "s1",
      catherdPlugin: { version: "1.0.0" },
      catherdMcpStatus: "pending",
    });
  });

  it("emits run_started from the run_start tool result", () => {
    const map = createEventMapper();
    map({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          { type: "tool_use", id: "t1", name: `${CATHERD_TOOL_PREFIX}run_start`, input: {} },
        ],
      },
    });
    const events = map({
      type: "user",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: [{ type: "text", text: '{"run":"20260928-1-x","dir":"/d"}' }],
          },
        ],
      },
    });
    expect(events).toContainEqual({ kind: "run_started", runId: "20260928-1-x", dir: "/d" });
  });

  it("ignores tool results of other tools and failed run_start", () => {
    const map = createEventMapper();
    map({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", id: "t2", name: `${CATHERD_TOOL_PREFIX}run_start` }],
      },
    });
    const ev = map({
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: "t2", is_error: true, content: "{}" }],
      },
    });
    expect(ev.some((e) => e.kind === "run_started")).toBe(false);
  });

  it("maps task messages and results", () => {
    const map = createEventMapper();
    expect(
      map({
        type: "system",
        subtype: "task_progress",
        task_id: "k",
        description: "verifier",
        usage: { duration_ms: 5 },
      })[0],
    ).toMatchObject({ kind: "task", phase: "progress", durationMs: 5 });
    expect(
      map({ type: "result", subtype: "success", session_id: "s", is_error: false })[0],
    ).toMatchObject({ kind: "result", subtype: "success" });
  });
});
