import { describe, expect, it } from "vitest";
import { parseAgentName, roleOfDispatch, rungParts } from "./format";

describe("agent and dispatch names", () => {
  it("parses catherd's native agent names", () => {
    expect(parseAgentName("catherd-default-architect-claude-opus-5-5-high")).toEqual({
      profile: "default",
      role: "architect",
      model: "claude-opus-5-5",
      effort: "high",
    });
    expect(parseAgentName("catherd-mahdi-hard-verifier-claude-opus-5-5-high")).toMatchObject({
      profile: "mahdi-hard",
      role: "verifier",
      model: "claude-opus-5-5",
    });
    expect(parseAgentName("catherd-x-ui-reviewer-claude-sonnet-5-medium")).toMatchObject({
      profile: "x",
      role: "ui-reviewer",
      model: "claude-sonnet-5",
    });
    expect(parseAgentName("general-purpose")).toBeUndefined();
    expect(parseAgentName(undefined)).toBeUndefined();
  });

  it("finds the role of a live dispatch", () => {
    expect(roleOfDispatch("worker-M1.L2")).toBe("worker");
    expect(roleOfDispatch("ui-reviewer-M1")).toBe("ui-reviewer");
    expect(roleOfDispatch("reviewer-M1")).toBe("reviewer");
    expect(roleOfDispatch("M1.L1")).toBeUndefined();
  });

  it("splits a rung", () => {
    expect(rungParts("codex:gpt-6-luna#high")).toEqual({
      backend: "codex",
      model: "gpt-6-luna",
      effort: "high",
    });
    expect(rungParts("gpt-6-sol")).toEqual({ model: "gpt-6-sol" });
  });
});
