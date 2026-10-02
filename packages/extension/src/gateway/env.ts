import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { OrchestratorHost } from "@cathouse/protocol";

// GUI-launched editors on macOS inherit a minimal PATH that misses ~/.bun/bin, Homebrew and
// npm-global bins. We merge the user's login-shell PATH with the well-known install dirs.

const WELL_KNOWN = [
  join(homedir(), ".bun", "bin"),
  join(homedir(), ".local", "bin"),
  join(homedir(), ".opencode", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

/** Env vars from a host Claude session that must not leak into processes CatHouse starts. */
// Also ANTHROPIC_BASE_URL etc.: a host session routes API calls through its own proxy, and the
// child would then ignore the user's CLI login (docs/spikes/phase1.md finding 3).
const STRIPPED_PREFIXES = [
  "CLAUDECODE",
  "CLAUDE_CODE_",
  "CLAUDE_AGENT_SDK_",
  "CLAUDE_PID",
  "CLAUDE_EFFORT",
  "CLAUDE_PREVIEW_",
  "ANTHROPIC_BASE_URL",
  "CODEX_THREAD_ID",
  "CODEX_SESSION_ID",
];

let loginPath: Promise<string> | undefined;

function readLoginShellPath(): Promise<string> {
  const shell = process.env.SHELL || "/bin/zsh";
  return new Promise((resolve) => {
    execFile(
      shell,
      ["-ilc", 'printf "__CATHOUSE_PATH__%s" "$PATH"'],
      { timeout: 5_000 },
      (err, stdout) => {
        const m = /__CATHOUSE_PATH__(.*)$/s.exec(String(stdout ?? ""));
        resolve(err || !m ? "" : (m[1] as string).trim());
      },
    );
  });
}

export function mergePath(...parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const dir of part.split(delimiter)) {
      if (dir && !seen.has(dir)) {
        seen.add(dir);
        out.push(dir);
      }
    }
  }
  return out.join(delimiter);
}

/** The environment for every process CatHouse spawns. */
export async function processEnv(
  extra: Record<string, string> = {},
  host: OrchestratorHost = "claude-code",
): Promise<Record<string, string>> {
  loginPath ??= readLoginShellPath();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !STRIPPED_PREFIXES.some((p) => k.startsWith(p))) env[k] = v;
  }
  env.PATH = mergePath(await loginPath, process.env.PATH ?? "", WELL_KNOWN.join(delimiter));
  // catherd 1.4 resolves omitted architect/verifier rungs from the orchestration host. CatHouse's
  // gateway client is neither Codex nor Claude Code by name, so without this a host-default profile
  // fails with E_CONFIG_INVALID. Match the selected session host for gateway and CLI calls.
  env.CATHERD_ORCHESTRATION_HOST = host;
  return { ...env, ...extra };
}
