import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { CatherdCli } from "./cli";
import { processEnv } from "./env";
import { CatherdMcp } from "./mcp-client";
import type { AllowedTool } from "./mcp-tools";

// Live contract tests against the real catherd-cli@1.0.0 on this machine. Opt-in:
//   CATHOUSE_CONTRACT=1 pnpm test
// They only read, plus one profile_set that must be refused (nothing is written).
// CATHOUSE_RECORD=1 also refreshes fixtures in packages/compat/fixtures/1.0.0/.
const live = process.env.CATHOUSE_CONTRACT === "1";
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const record = (name: string, data: unknown) => {
  if (process.env.CATHOUSE_RECORD !== "1") return;
  const out = JSON.stringify(data, null, 2).replaceAll(process.env.HOME ?? "~", "/Users/dev");
  writeFileSync(
    fileURLToPath(new URL(`../../../compat/fixtures/1.0.0/${name}`, import.meta.url)),
    `${out}\n`,
  );
};

describe.skipIf(!live)("catherd 1.0.0 live contract", () => {
  const env = () => processEnv();
  const mcp = new CatherdMcp({ repo, env });
  const cli = new CatherdCli({ cwd: repo, env });
  afterAll(() => mcp.close());

  it("CLI reports the pinned version", async () => {
    expect(await cli.version()).toBe("1.0.0");
  });

  it("MCP handshake reports catherd 1.0.0", async () => {
    expect(await mcp.serverVersion()).toBe("1.0.0");
  }, 120_000);

  it("status, profile_get, profile_validate, catalog_query decode", async () => {
    const status = (await mcp.call("status")) as { version: string };
    expect(status.version).toBe("1.0.0");
    const profile = (await mcp.call("profile_get", { repo })) as { active: string; here: string };
    expect(typeof profile.active).toBe("string");
    const valid = (await mcp.call("profile_validate", { repo })) as { valid: boolean };
    expect(typeof valid.valid).toBe("boolean");
    const catalog = (await mcp.call("catalog_query", { repo, role: "worker", limit: 5 })) as {
      total: number;
    };
    expect(catalog.total).toBeGreaterThan(0);
    record("mcp-status.json", status);
    record("mcp-profile_get.json", profile);
    record("mcp-profile_validate.json", valid);
    record("mcp-catalog_query-worker.json", catalog);
  }, 120_000);

  it("profile_set refuses an invalid patch without writing", async () => {
    const r = (await mcp.call("profile_set", {
      repo,
      patch: { roles: { worker: { enabled: false } } },
    })) as { saved: boolean; errors: { path: string }[] };
    expect(r.saved).toBe(false);
    expect(r.errors.some((e) => e.path.startsWith("roles.worker"))).toBe(true);
    record("mcp-profile_set-refused.json", r);
  }, 120_000);

  it("a missing run is a CatherdError", async () => {
    await expect(mcp.call("result", { run: "nope", name: "x" })).rejects.toMatchObject({
      code: "E_RUN_NOT_FOUND",
    });
  }, 120_000);

  it("gateway reads a real run (runs list, detail, reply, routes via read_run_file)", async () => {
    const spikeRepo = process.env.CATHOUSE_CONTRACT_RUN_REPO;
    if (!spikeRepo) return;
    const { CatherdGateway } = await import("./service");
    const g = new CatherdGateway(
      spikeRepo,
      new CatherdCli({ cwd: spikeRepo, env }),
      new CatherdMcp({ repo: spikeRepo, env }),
    );
    const list = await g.runsList();
    expect(list.runs.length).toBeGreaterThan(0);
    const id = list.runs[0]?.id as string;
    const detail = await g.runGet(id);
    expect(detail.stateMd).toContain("#");
    expect(detail.records.length).toBeGreaterThan(0);
    const reply = await g.roleReply(id, detail.records[0]?.name as string);
    expect(reply.state).toBe("finished");
    record("gw-run-detail.json", detail);
    await g.dispose();
  }, 180_000);

  it("forbidden tools never reach the server", async () => {
    await expect(mcp.call("wait" as AllowedTool, { run: "x" })).rejects.toMatchObject({
      code: "E_TOOL_FORBIDDEN",
    });
  });
});
