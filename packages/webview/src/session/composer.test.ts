import { describe, expect, it } from "vitest";
import { shouldSubmitComposer } from "./composer";

describe("shouldSubmitComposer", () => {
  it("submits on Enter", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
  });

  it("keeps Shift+Enter for a new line", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
  });

  it("does not submit while an input method is composing text", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
  });
});
