import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

// The SDK does not install marketplace plugins; it loads a local plugin dir. We read the path the
// Claude CLI recorded when it installed catherd@catherd (docs/research/claude-agent-sdk.md §3).

const InstalledPluginsSchema = z.looseObject({
  plugins: z.record(
    z.string(),
    z.array(z.looseObject({ installPath: z.string(), version: z.string(), scope: z.string() })),
  ),
});

export interface InstalledPlugin {
  installPath: string;
  version: string;
}

export function claudeHome(env: Record<string, string | undefined> = process.env): string {
  return env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

export async function findCatherdPlugin(home = claudeHome()): Promise<InstalledPlugin | undefined> {
  let raw: string;
  try {
    raw = await readFile(join(home, "plugins", "installed_plugins.json"), "utf8");
  } catch {
    return undefined;
  }
  const parsed = InstalledPluginsSchema.safeParse(JSON.parse(raw));
  const entry = parsed.success ? parsed.data.plugins["catherd@catherd"]?.[0] : undefined;
  return entry ? { installPath: entry.installPath, version: entry.version } : undefined;
}
