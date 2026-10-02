export type StyleRule = "border" | "divide" | "raw-colour";
export interface StyleViolation {
  line: number;
  rule: StyleRule;
  text: string;
}

export const LEGACY_MARKER = "@style-legacy";

const utility =
  /(?<![\w/-])(?:[\w@-]+:)*(border-border|border(?:-[0-9]+|-(?:t|b|s|e|l|r|x|y)(?:-[0-9]+)?)?|divide-[\w-]+)(?![\w/-])/g;
const allowedBorderColour =
  /(?<![\w/-])(?:[\w@-]+:)*border-(?:input-border|transparent|focus)(?![\w/-])/;
const literalColour = /-\[(?:#[\da-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\()/;
const colourFunction = /\b(?:rgb|rgba|hsl|hsla)\(/;
const hexColour = /(?:["']#[\da-fA-F]{3,8}["']|:\s*#[\da-fA-F]{3,8}\b)/;

export function styleViolations(source: string): StyleViolation[] {
  const violations: StyleViolation[] = [];
  for (const [index, text] of source.split(/\r?\n/).entries()) {
    if (text.includes("style-allow")) continue;
    if (/^\s*(?:\/\/|\/\*|\*)/.test(text)) continue;
    const tokens = Array.from(text.matchAll(utility), (match) => match[1]);
    if (
      tokens.includes("border-border") ||
      (tokens.some((token) => token?.startsWith("border") && token !== "border-0") &&
        !allowedBorderColour.test(text))
    ) {
      violations.push({ line: index + 1, rule: "border", text: text.trim() });
    }
    if (tokens.some((token) => token?.startsWith("divide-"))) {
      violations.push({ line: index + 1, rule: "divide", text: text.trim() });
    }
    if (literalColour.test(text) || colourFunction.test(text) || hexColour.test(text)) {
      violations.push({ line: index + 1, rule: "raw-colour", text: text.trim() });
    }
  }
  return violations;
}
