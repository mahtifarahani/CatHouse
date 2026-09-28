import { describe, expect, it, vi } from "vitest";

vi.mock("./rpc", () => ({ viewState: { get: () => undefined, update: () => {} } }));
const { clampScale, FONT_SCALE } = await import("./settings");

describe("clampScale", () => {
  it("snaps to the step and stays within bounds", () => {
    expect(clampScale(1.12)).toBe(1.1);
    expect(clampScale(0.1)).toBe(FONT_SCALE.min);
    expect(clampScale(9)).toBe(FONT_SCALE.max);
    expect(clampScale(Number.NaN)).toBe(FONT_SCALE.default);
  });
});
