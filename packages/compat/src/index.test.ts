import { describe, expect, it } from "vitest";
import { atLeast, compareVersions, findCompat, PINNED } from "./index";

describe("compat", () => {
  it("pins catherd 1.5.0 with SDK >= 0.3.282", () => {
    expect(PINNED.catherd).toBe("1.5.0");
    expect(atLeast(PINNED.sdk, "0.3.282")).toBe(true);
    expect(findCompat("1.5.0")).toBe(PINNED);
    expect(findCompat("1.1.0")).toBeUndefined();
  });

  it("compares versions numerically", () => {
    expect(compareVersions("1.4.2", "1.4.0")).toBe(1);
    expect(compareVersions("0.142.2", "0.157.0")).toBe(-1);
    expect(compareVersions("2.1.283", "2.1.283")).toBe(0);
    expect(atLeast("1.10.0", "1.9.9")).toBe(true);
  });
});
