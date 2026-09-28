import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Path of the Claude Code binary bundled with the Agent SDK for this platform
 * (`@anthropic-ai/claude-agent-sdk-<platform>-<arch>/claude`, docs/research/claude-agent-sdk.md §1).
 * Resolved relative to the SDK package because pnpm does not hoist the platform package.
 */
export function bundledClaudePath(): string | undefined {
  const req = createRequire(__filename);
  let sdkEntry: string;
  try {
    sdkEntry = req.resolve("@anthropic-ai/claude-agent-sdk");
  } catch {
    return undefined;
  }
  const fromSdk = createRequire(sdkEntry);
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  const names = [`${process.platform}-${process.arch}`];
  if (process.platform === "linux") names.push(`linux-${process.arch}-musl`);
  for (const n of names) {
    try {
      const pkg = fromSdk.resolve(`@anthropic-ai/claude-agent-sdk-${n}/package.json`);
      const bin = join(dirname(pkg), exe);
      if (existsSync(bin)) return bin;
    } catch {
      // try the next variant
    }
  }
  return undefined;
}
