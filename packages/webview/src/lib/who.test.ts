import type { SessionEvent } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import {
  dispatchRole,
  liveRole,
  modelLabel,
  nativeAgentRole,
  parseRung,
  rungLabel,
  sameModel,
  whoFromEvents,
} from "./who";

function event(value: object): SessionEvent {
  return value as SessionEvent;
}

describe("rung and model labels", () => {
  it("splits the backend and final effort suffix", () => {
    expect(parseRung("codex:gpt-6-sol#high")).toEqual({
      backend: "codex",
      model: "gpt-6-sol",
      effort: "high",
    });
    expect(parseRung("claude:opus")).toEqual({ backend: "claude", model: "opus", effort: null });
    expect(parseRung("odd")).toEqual({ backend: "", model: "odd", effort: null });
    expect(parseRung("custom:a#b#max")).toEqual({
      backend: "custom",
      model: "a#b",
      effort: "max",
    });
    expect(rungLabel("codex:gpt-6-sol#high")).toBe("gpt-6-sol · high");
    expect(rungLabel("claude:opus")).toBe("opus");
  });

  it("shows Claude family versions and strips model suffixes", () => {
    expect(modelLabel("claude-opus-5-5-20261001")).toBe("Opus 5.5");
    expect(modelLabel("claude-opus-5-5[1m]")).toBe("Opus 5.5");
    expect(modelLabel("claude-sonnet-5")).toBe("Sonnet 5");
    expect(modelLabel("claude-haiku-4-5")).toBe("Haiku 4.5");
    expect(modelLabel("gpt-6-sol")).toBe("gpt-6-sol");
    expect(modelLabel("")).toBe("");
    expect(sameModel("claude-opus-5-5", "claude-opus-5-5-20261001")).toBe(true);
    expect(sameModel("claude-opus-5-5", "claude-opus-5-5[1m]")).toBe(true);
    expect(sameModel("claude-opus-5-5", "claude-sonnet-5")).toBe(false);
  });
});

describe("role resolution", () => {
  it("takes the longest dispatch prefix and retains the lane", () => {
    expect(dispatchRole("ui-reviewer-M1.L2")).toEqual({ role: "ui-reviewer", lane: "M1.L2" });
    expect(dispatchRole("reviewer-M1.L2")).toEqual({ role: "reviewer", lane: "M1.L2" });
    expect(dispatchRole("writer-M1.L1")).toEqual({ role: "writer", lane: "M1.L1" });
    expect(dispatchRole("M1.L1")).toEqual({ role: null, lane: "M1.L1" });
    expect(dispatchRole("verifier")).toEqual({ role: "verifier", lane: "" });
  });

  it("finds the last bounded native role after a hyphenated profile", () => {
    expect(nativeAgentRole("catherd-default-ui-reviewer-claude-sonnet-5-high")).toBe("ui-reviewer");
    expect(nativeAgentRole("catherd-worker-architect-opus-high")).toBe("architect");
    expect(nativeAgentRole("catherd-default-reviewer-opus-high")).toBe("reviewer");
    expect(nativeAgentRole("catherd-my-profile-worker-gpt-high")).toBe("worker");
    expect(nativeAgentRole("general-purpose")).toBeNull();
  });

  it("falls back from a live dispatch name to its route", () => {
    expect(liveRole("M1.L1", [{ lane: "M1.L1", role: "worker" }])).toBe("worker");
    expect(liveRole("reviewer-M1", [])).toBe("reviewer");
    expect(liveRole("x", [{ lane: "x", role: "bogus" }])).toBeNull();
  });
});

describe("whoFromEvents", () => {
  it("tracks orchestrator and native agents in task start order", () => {
    const state = whoFromEvents([
      event({ kind: "init", model: "claude-opus-5-5" }),
      event({
        kind: "task",
        phase: "started",
        taskId: "one",
        toolUseId: "tool-one",
        subagentType: "catherd-my-profile-ui-reviewer-sonnet-high",
      }),
      event({ kind: "model", model: "claude-sonnet-5", parentToolUseId: "tool-one" }),
      event({ kind: "task", phase: "started", taskId: "two", description: "Inspect code" }),
      event({ kind: "model", model: "claude-haiku-4-5", parentToolUseId: null }),
    ]);
    expect(state.orchestratorModel).toBe("claude-haiku-4-5");
    expect(state.agents).toEqual([
      {
        id: "tool-one",
        taskId: "one",
        role: "ui-reviewer",
        label: "catherd-my-profile-ui-reviewer-sonnet-high",
        model: "claude-sonnet-5",
        running: true,
      },
      {
        id: "two",
        taskId: "two",
        role: null,
        label: "Inspect code",
        model: undefined,
        running: true,
      },
    ]);
  });

  it.each(["completed", "failed", "killed", "stopped"])("ends a task with status %s", (status) => {
    expect(
      whoFromEvents([
        event({ kind: "task", phase: "started", taskId: "one" }),
        event({ kind: "task", phase: "updated", taskId: "one", status }),
      ]).agents[0]?.running,
    ).toBe(false);
  });

  it("ends a task on notification and accepts a later tool ID", () => {
    const state = whoFromEvents([
      event({ kind: "task", phase: "started", taskId: "one" }),
      event({ kind: "task", phase: "progress", taskId: "one", toolUseId: "tool-one" }),
      event({ kind: "model", model: "claude-sonnet-5", parentToolUseId: "tool-one" }),
      event({ kind: "task", phase: "notification", taskId: "one" }),
    ]);
    expect(state.agents).toEqual([
      {
        id: "tool-one",
        taskId: "one",
        role: null,
        label: "task",
        model: "claude-sonnet-5",
        running: false,
      },
    ]);
  });
});
