import { describe, expect, it } from "vitest";
import { AREAS, t } from "./strings";

describe("string areas", () => {
  it("owns every key exactly once under its declared prefixes", () => {
    const keys = new Set<string>();
    for (const area of Object.values(AREAS)) {
      for (const key of Object.keys(area.STRINGS)) {
        expect(keys.has(key), `duplicate key: ${key}`).toBe(false);
        expect(
          area.PREFIXES.some((prefix) => key.startsWith(prefix)),
          key,
        ).toBe(true);
        keys.add(key);
      }
    }
  });

  it("interpolates variables", () => {
    expect(t("time.secs", { n: 5 })).toBe("5s ago");
  });
});
