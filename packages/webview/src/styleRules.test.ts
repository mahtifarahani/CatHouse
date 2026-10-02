import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_MARKER, styleViolations } from "./lib/styleRules";

const root = resolve(import.meta.dirname, "../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("minimal style rules", () => {
  it.each([
    ['className="border border-border"', ["border"]],
    ['"border-t px-2"', ["border"]],
    ['"border border-input-border"', []],
    ['"border-transparent border-2"', []],
    ['"divide-y"', ["divide"]],
    ['"bg-[#fff]"', ["raw-colour"]],
    ['color: "#ffcc00"', ["raw-colour"]],
    ['"rgb(0 0 0)"', ["raw-colour"]],
    ['"codex:gpt-6-sol#high"', []],
    ['"border-border" // style-allow', []],
  ])("checks %s", (source, rules) => {
    expect(styleViolations(source).map((violation) => violation.rule)).toEqual(rules);
  });

  it("finds no unmarked violations in webview or UI sources", () => {
    const files = ["packages/webview/src", "packages/ui/src"].flatMap((dir) =>
      sourceFiles(resolve(root, dir)),
    );
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      if (source.includes(LEGACY_MARKER)) return [];
      return styleViolations(source).map(
        ({ line, rule, text }) => `${relative(root, file)}:${line}: ${rule}: ${text}`,
      );
    });
    expect(violations).toEqual([]);
  });
});
