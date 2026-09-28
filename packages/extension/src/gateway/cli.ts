import { PINNED } from "@cathouse/compat";
import type { z } from "zod";
import { CatherdError, parseCliError } from "./errors";
import { type RunOptions, type RunResult, runProcess } from "./process";
import {
  CatalogRefreshSchema,
  CatalogSchema,
  DoctorReportSchema,
  ProfileListSchema,
  ProfileShowSchema,
  RunsListSchema,
  RunsShowSchema,
  StatusSchema,
} from "./schemas";

export type Runner = (cmd: string, args: string[], opts: RunOptions) => Promise<RunResult>;

export interface CliOptions {
  /** Repo root; catherd resolves "the profile this repo runs on" from cwd. */
  cwd: string;
  env: () => Promise<Record<string, string>>;
  runner?: Runner;
}

const EXIT_NOT_READY = 3;
/** The first bunx resolve of catherd is silent for ~30 s (docs/research/catherd-known-issues.md). */
const DEFAULT_TIMEOUT_MS = 180_000;

/** Runs `bunx catherd-cli@<pinned> …` and turns its output into typed values or CatherdError. */
export class CatherdCli {
  private readonly runner: Runner;

  constructor(private readonly opts: CliOptions) {
    this.runner = opts.runner ?? runProcess;
  }

  async raw(args: string[], extra: Partial<RunOptions> = {}): Promise<RunResult> {
    const env = await this.opts.env();
    try {
      return await this.runner("bunx", [`catherd-cli@${PINNED.catherd}`, ...args], {
        cwd: this.opts.cwd,
        env,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        ...extra,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        throw new CatherdError(
          "E_BUN_MISSING",
          "bunx is not on PATH",
          "install Bun from the CatHouse Setup page",
        );
      }
      throw e;
    }
  }

  /** Runs a command expected to print JSON; `okCodes` lists exit codes that still carry JSON. */
  private async json<S extends z.ZodType>(
    schema: S,
    args: string[],
    okCodes: number[] = [0],
  ): Promise<z.infer<S>> {
    const r = await this.raw([...args, "--json"]);
    if (r.timedOut) {
      throw new CatherdError("E_TIMEOUT", `catherd ${args.join(" ")} timed out`);
    }
    if (r.code === null || !okCodes.includes(r.code)) {
      throw (
        parseCliError(r.stderr) ??
        new CatherdError(
          "E_CLI_FAILED",
          `catherd ${args.join(" ")} exited ${r.code}: ${r.stderr.trim().slice(0, 500)}`,
        )
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(r.stdout);
    } catch {
      throw new CatherdError("E_CLI_OUTPUT", `catherd ${args.join(" ")} printed invalid JSON`);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new CatherdError(
        "E_CONTRACT",
        `catherd ${args.join(" ")} output does not match the ${PINNED.catherd} contract: ${parsed.error.message}`,
        "check docs/research for the expected shape; a newer catherd needs a new adapter",
      );
    }
    return parsed.data;
  }

  /** Runs a mutating command without --json: success is exit 0. */
  async action(args: string[]): Promise<string> {
    const r = await this.raw(args);
    if (r.code !== 0) {
      throw (
        parseCliError(r.stderr) ??
        new CatherdError("E_CLI_FAILED", `catherd ${args.join(" ")} exited ${r.code}`)
      );
    }
    return r.stdout;
  }

  async version(): Promise<string> {
    const r = await this.raw(["--version"]);
    if (r.code !== 0) throw parseCliError(r.stderr) ?? new CatherdError("E_CLI_FAILED", r.stderr);
    return r.stdout.trim();
  }

  /** Has side effects (listings, locks probe, MCP reconcile): call on demand only. */
  doctor() {
    return this.json(DoctorReportSchema, ["doctor"], [0, EXIT_NOT_READY]);
  }
  status(run?: string) {
    return this.json(StatusSchema, run ? ["status", run] : ["status"]);
  }
  runsList(repo?: string) {
    return this.json(RunsListSchema, repo ? ["runs", "list", "--repo", repo] : ["runs", "list"]);
  }
  runsShow(id: string, debug?: { name?: string }) {
    const args = ["runs", "show", id];
    if (debug) args.push("--debug", ...(debug.name ? ["--name", debug.name] : []));
    return this.json(RunsShowSchema, args);
  }
  profileList() {
    return this.json(ProfileListSchema, ["profile", "list"]);
  }
  profileShow(name?: string) {
    return this.json(ProfileShowSchema, name ? ["profile", "show", name] : ["profile", "show"]);
  }
  catalogList() {
    return this.json(CatalogSchema, ["catalog", "list"]);
  }
  catalogRefresh() {
    return this.json(CatalogRefreshSchema, ["catalog", "refresh"], [0, 1]);
  }
}
