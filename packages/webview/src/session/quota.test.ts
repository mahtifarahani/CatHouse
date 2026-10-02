import { describe, expect, it } from "vitest";
import { isClaudeSessionLimit } from "./quota";

describe("Claude session limit", () => {
  it("recognizes the message shown in a Claude transcript", () => {
    expect(isClaudeSessionLimit("You've hit your session limit · resets 4:40pm")).toBe(true);
    expect(isClaudeSessionLimit("Session limit reached. Try later.")).toBe(true);
  });

  it("does not offer a host switch for other failures", () => {
    expect(isClaudeSessionLimit("Permission denied")).toBe(false);
    expect(isClaudeSessionLimit("The worker hit its budget limit")).toBe(false);
    expect(isClaudeSessionLimit(undefined)).toBe(false);
  });
});
