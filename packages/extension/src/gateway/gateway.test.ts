import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CatherdCli, type Runner } from "./cli";
import { CatherdError, parseCliError } from "./errors";
import { decodeToolResult } from "./mcp-client";
import { ALLOWED_TOOLS, isAllowedTool, ORCHESTRATOR_TOOLS } from "./mcp-tools";
import {
  DoctorReportSchema,
  ProfileListSchema,
  ProfileShowSchema,
  RunsListSchema,
  StatusSchema,
} from "./schemas";

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../compat/fixtures/1.2.0/${name}`, import.meta.url)),
    "utf8",
  );

describe("parseCliError", () => {
  it("parses a real catherd stderr error", () => {
    const e = parseCliError(fixture("stderr-run-not-found.txt"));
    expect(e).toBeInstanceOf(CatherdError);
    expect(e?.toJSON()).toEqual({
      code: "E_RUN_NOT_FOUND",
      message: 'no run "nope"',
      fix: "catherd runs list",
    });
  });

  it("returns undefined for unrelated stderr", () => {
    expect(parseCliError("Resolving dependencies\nsomething else")).toBeUndefined();
  });
});

describe("MCP tool allowlist (ADR 0005)", () => {
  it("never allows an orchestrator tool", () => {
    for (const t of ORCHESTRATOR_TOOLS) expect(isAllowedTool(t)).toBe(false);
    // 1.1+: result/cancel mark a record read and peek claims the run, hiding it from the orchestrator
    for (const t of ["wait", "result", "cancel", "peek"]) expect(ALLOWED_TOOLS).not.toContain(t);
  });
});

describe("decodeToolResult", () => {
  it("decodes JSON text", () => {
    expect(decodeToolResult({ content: [{ type: "text", text: '{"a":1}' }] })).toEqual({ a: 1 });
  });
  it("returns raw text for read tools", () => {
    expect(decodeToolResult({ content: [{ type: "text", text: "# state" }] })).toBe("# state");
  });
  it("throws CatherdError from structuredContent", () => {
    expect(() =>
      decodeToolResult({
        isError: true,
        content: [{ type: "text", text: "{}" }],
        structuredContent: { code: "E_RUN_NOT_LIVE", message: "no live role", fix: "" },
      }),
    ).toThrowError(expect.objectContaining({ code: "E_RUN_NOT_LIVE" }));
  });
});

describe("catherd 1.0.0 fixtures match the schemas", () => {
  it.each([
    ["doctor-ready.json", DoctorReportSchema],
    ["doctor-not-ready.json", DoctorReportSchema],
    ["status-empty.json", StatusSchema],
    ["runs-list-empty.json", RunsListSchema],
    ["profile-list.json", ProfileListSchema],
    ["profile-show-default.json", ProfileShowSchema],
  ] as const)("%s", (name, schema) => {
    const r = schema.safeParse(JSON.parse(fixture(name)));
    expect(r.error).toBeUndefined();
  });
});

function fakeRunner(result: { code: number; stdout?: string; stderr?: string }, seen: string[][]) {
  const runner: Runner = async (cmd, args) => {
    seen.push([cmd, ...args]);
    return { stdout: "", stderr: "", signal: null, timedOut: false, ...result };
  };
  return runner;
}

describe("CatherdCli", () => {
  const env = async () => ({});

  it("pins the version and accepts doctor's not-ready exit 3", async () => {
    const seen: string[][] = [];
    const cli = new CatherdCli({
      cwd: "/repo",
      env,
      runner: fakeRunner({ code: 3, stdout: fixture("doctor-not-ready.json") }, seen),
    });
    const report = await cli.doctor();
    expect(report.ready).toBe(false);
    expect(seen[0]).toEqual(["bunx", "catherd-cli@1.2.0", "doctor", "--json"]);
  });

  it("accepts 1.1's info rows in doctor", async () => {
    const cli = new CatherdCli({
      cwd: "/repo",
      env,
      runner: fakeRunner({ code: 0, stdout: fixture("doctor-ready.json") }, []),
    });
    const report = await cli.doctor();
    expect(report.checks.find((c) => c.id === "access:full")?.state).toBe("info");
  });

  it("turns stderr into CatherdError", async () => {
    const cli = new CatherdCli({
      cwd: "/repo",
      env,
      runner: fakeRunner({ code: 1, stderr: fixture("stderr-run-not-found.txt") }, []),
    });
    await expect(cli.runsShow("nope")).rejects.toMatchObject({ code: "E_RUN_NOT_FOUND" });
  });

  it("reports a contract break as E_CONTRACT", async () => {
    const cli = new CatherdCli({
      cwd: "/repo",
      env,
      runner: fakeRunner({ code: 0, stdout: '{"version":"1.0.0"}' }, []),
    });
    await expect(cli.status()).rejects.toMatchObject({ code: "E_CONTRACT" });
  });

  it("maps a missing bunx to E_BUN_MISSING", async () => {
    const cli = new CatherdCli({
      cwd: "/repo",
      env,
      runner: async () => {
        throw Object.assign(new Error("spawn bunx ENOENT"), { code: "ENOENT" });
      },
    });
    await expect(cli.version()).rejects.toMatchObject({ code: "E_BUN_MISSING" });
  });
});
