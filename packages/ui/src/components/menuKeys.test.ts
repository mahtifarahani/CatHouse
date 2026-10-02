import { describe, expect, it } from "vitest";
import { nextIndex } from "./menuKeys";

describe("nextIndex", () => {
  const enabled = [true, false, true, true];
  it("moves and wraps while skipping disabled entries", () => {
    expect(nextIndex(0, "ArrowDown", enabled)).toBe(2);
    expect(nextIndex(3, "ArrowDown", enabled)).toBe(0);
    expect(nextIndex(0, "ArrowUp", enabled)).toBe(3);
    expect(nextIndex(2, "ArrowUp", enabled)).toBe(0);
  });
  it("starts from either end and supports Home and End", () => {
    expect(nextIndex(-1, "ArrowDown", enabled)).toBe(0);
    expect(nextIndex(-1, "ArrowUp", enabled)).toBe(3);
    expect(nextIndex(2, "Home", enabled)).toBe(0);
    expect(nextIndex(0, "End", enabled)).toBe(3);
  });
  it("ignores unknown keys and empty lists", () => {
    expect(nextIndex(0, "x", enabled)).toBeNull();
    expect(nextIndex(0, "Home", [false, false])).toBeNull();
    expect(nextIndex(-1, "ArrowDown", [])).toBeNull();
  });
});
