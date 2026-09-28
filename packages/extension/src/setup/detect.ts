import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CompatEntry } from "@cathouse/compat";
import type { CatherdCli } from "../gateway/cli";
import type { RunOptions, RunResult } from "../gateway/process";
import { findCatherdPlugin } from "../orchestrator/plugin";
import type { SetupFacts } from "./facts";

// Detectors have no side effects: nothing is downloaded or written. catherd is probed with
// `bunx --no-install`, the plugin through installed_plugins.json, the login through the bundled
// binary's `auth status --json`. `doctor` (which does write) runs only via readiness().

export type Runner = (cmd: string, args: string[], opts: RunOptions) => Promise<RunResult>;

export interface DetectDeps {
  run: Runner;
  env: () => Promise<Record<string, string>>;
  bundledClaude: () => string | undefined;
  cli: () => CatherdCli;
  pin: CompatEntry;
  /** Environment for path resolution (tests pass their own). */
  vars?: Record<string, string | undefined>;
}

const firstVersion = (s: string) => /(\d+\.\d+\.\d+)/.exec(s)?.[1];

async function version(
  deps: DetectDeps,
  cmd: string,
  args: string[],
): Promise<{ version?: string; error?: string }> {
  try {
    const r = await deps.run(cmd, args, { env: await deps.env(), timeoutMs: 20_000 });
    if (r.code !== 0) return { error: (r.stderr || r.stdout).trim().split("\n").pop() ?? "failed" };
    const v = firstVersion(r.stdout);
    return v ? { version: v } : { error: `unexpected output: ${r.stdout.trim().slice(0, 80)}` };
  } catch (e) {
    return {
      error: (e as NodeJS.ErrnoException).code === "ENOENT" ? `${cmd} is not on PATH` : String(e),
    };
  }
}

/** catherd's config dir, resolved like src/infra/paths.ts upstream. */
export function catherdConfigDir(vars: Record<string, string | undefined> = process.env): string {
  if (vars.CATHERD_CONFIG_DIR) return vars.CATHERD_CONFIG_DIR;
  if (vars.CATHERD_HOME) return join(vars.CATHERD_HOME, "config");
  return join(vars.XDG_CONFIG_HOME || join(homedir(), ".config"), "catherd");
}

async function hasActiveConfig(dir: string): Promise<boolean> {
  try {
    const cfg = JSON.parse(await readFile(join(dir, "config.json"), "utf8")) as {
      activeProfile?: unknown;
    };
    return typeof cfg.activeProfile === "string";
  } catch {
    return false;
  }
}

async function claudeLogin(
  deps: DetectDeps,
  bin: string | undefined,
): Promise<SetupFacts["claudeLogin"]> {
  if (!bin) return { error: "bundled Claude is missing" };
  try {
    const r = await deps.run(bin, ["auth", "status", "--json"], {
      env: await deps.env(),
      timeoutMs: 20_000,
    });
    const j = JSON.parse(r.stdout) as { loggedIn?: boolean; authMethod?: string; email?: string };
    return {
      loggedIn: j.loggedIn === true,
      ...(j.authMethod && j.authMethod !== "none" ? { method: j.authMethod } : {}),
      ...(j.email ? { email: j.email } : {}),
    };
  } catch (e) {
    return { error: `could not read login status: ${String(e)}` };
  }
}

/** True when any role ladder or failover stand-in of the repo's profile is a claude-code: rung. */
async function profileNeedsClaudeCli(deps: DetectDeps, catherdReady: boolean): Promise<boolean> {
  if (!catherdReady) return false;
  try {
    const show = await deps.cli().profileShow();
    const text = JSON.stringify({ roles: show.profile.roles, failover: show.profile.failover });
    return text.includes('"claude-code:');
  } catch {
    return false;
  }
}

export async function detect(deps: DetectDeps): Promise<SetupFacts> {
  const bin = deps.bundledClaude();
  const configDir = catherdConfigDir(deps.vars);
  const [bun, catherd, sdkVersion, plugin, login, configExists] = await Promise.all([
    version(deps, "bun", ["--version"]),
    version(deps, "bunx", ["--no-install", `catherd-cli@${deps.pin.catherd}`, "--version"]),
    bin
      ? version(deps, bin, ["--version"])
      : Promise.resolve<{ version?: string; error?: string }>({ error: "missing" }),
    findCatherdPlugin(deps.vars?.CLAUDE_CONFIG_DIR || undefined),
    claudeLogin(deps, bin),
    hasActiveConfig(configDir),
  ]);
  const catherdReady = catherd.version === deps.pin.catherd && configExists;
  const needsClaudeCli = await profileNeedsClaudeCli(deps, catherdReady);
  const claudeCli = needsClaudeCli ? await version(deps, "claude", ["--version"]) : {};
  return {
    bun,
    catherd: catherd.error?.includes("--no-install") ? {} : catherd,
    catherdConfig: { exists: configExists, path: join(configDir, "config.json") },
    sdkBinary: bin
      ? { path: bin, ...(sdkVersion.version ? { version: sdkVersion.version } : {}) }
      : { error: "the Claude binary for this platform is not bundled" },
    plugin: plugin ?? {},
    claudeLogin: login,
    needsClaudeCli,
    claudeCli,
  };
}
