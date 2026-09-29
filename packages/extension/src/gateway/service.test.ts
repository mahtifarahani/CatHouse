import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ProfileDoc } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import type { CatherdCli } from "./cli";
import type { CatherdMcp } from "./mcp-client";
import { parseJsonl, parseRoutes } from "./run-files";
import { CatherdGateway } from "./service";

const fixture = (n: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../compat/fixtures/1.2.0/${n}`, import.meta.url)),
      "utf8",
    ),
  );

describe("run files", () => {
  it("skips the header, corrupt rows and a partial last line", () => {
    const text = '{"schema":1,"kind":"routes"}\n{"a":1}\nnot json\n{"b":2}\n{"c":';
    expect(parseJsonl(text)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("keeps the last route per lane and every climb", () => {
    const row = (lane: string, source: string, rung: string, extra = {}) =>
      JSON.stringify({
        at: "t",
        lane,
        role: "worker",
        rung,
        ladder: [],
        source,
        decidedBy: "lane",
        from: null,
        reason: null,
        kind: "repo_code",
        difficulty: "build",
        ...extra,
      });
    const text = `${[
      '{"schema":1,"kind":"routes"}',
      row("M1.L1", "route", "codex:a#high"),
      row("M1.L2", "route", "codex:a#high"),
      row("M1.L1", "climb", "codex:b#medium", {
        from: "codex:a#high",
        reason: "check-failed-twice",
      }),
    ].join("\n")}\n`;
    const { routes, climbs } = parseRoutes(text);
    expect(routes.find((r) => r.lane === "M1.L1")?.rung).toBe("codex:b#medium");
    expect(routes).toHaveLength(2);
    expect(climbs).toEqual([
      expect.objectContaining({ lane: "M1.L1", reason: "check-failed-twice" }),
    ]);
  });
});

function gatewayWith(
  calls: { tool: string; args: unknown }[],
  answers: Record<string, unknown>,
  actions: string[][] = [],
  cliExtra: Record<string, unknown> = {},
) {
  const mcp = {
    call: async (tool: string, args: unknown) => {
      calls.push({ tool, args });
      const a = answers[tool];
      return typeof a === "function" ? (a as (x: unknown) => unknown)(args) : a;
    },
    close: async () => {},
  } as unknown as CatherdMcp;
  const cli = {
    action: async (args: string[]) => {
      actions.push(args);
      return "";
    },
    profileList: async () => fixture("profile-list.json"),
    profileShow: async () => fixture("profile-show-default.json"),
    ...cliExtra,
  } as unknown as CatherdCli;
  return new CatherdGateway("/repo", cli, mcp);
}

describe("CatherdGateway profiles", () => {
  const get = fixture("mcp-profile_get.json");
  const base = get.profile as ProfileDoc;

  it("maps profile_get + list + show + validate", async () => {
    const g = gatewayWith([], {
      profile_get: get,
      profile_validate: { valid: true, errors: [], warnings: [] },
    });
    const s = await g.profiles();
    expect(s.here).toBe("default");
    expect(s.profile.roles.worker?.rungs.length).toBe(4);
    expect(s.standIns[0]).toMatchObject({ from: "codex:gpt-6-luna#high", inferred: false });
    expect(s.standIns[1]).toMatchObject({
      from: "codex:gpt-6-sol#medium",
      inferred: true,
      note: "scores borrowed from gpt-6-sol#medium",
    });
    expect(s.enforcement.worker).toBe("enforced");
  });

  it("refuses to save over a profile that changed on disk", async () => {
    const changed = { ...get, profile: { ...base, objective: "speed" } };
    const calls: { tool: string; args: unknown }[] = [];
    const g = gatewayWith(calls, { profile_get: changed });
    const r = await g.profileSave({
      name: "default",
      base,
      draft: { ...base, objective: "speed" },
      treatLikes: [],
      activate: "no",
    });
    expect(r.status).toBe("conflict");
    expect(calls.some((c) => c.tool === "profile_set")).toBe(false);
  });

  it("creates a profile as a copy through catherd's CLI", async () => {
    const actions: string[][] = [];
    const g = gatewayWith([], {}, actions);
    await g.createProfile("new-profile", "default");
    expect(actions).toEqual([["profile", "new", "new-profile", "--from", "default"]]);
  });

  it("sends only the patch, then activates; reports catherd refusals", async () => {
    const calls: { tool: string; args: unknown }[] = [];
    const actions: string[][] = [];
    const g = gatewayWith(
      calls,
      {
        profile_get: get,
        profile_set: {
          saved: true,
          errors: [],
          warnings: [],
          diff: [{ path: "objective", before: "cost", after: "speed" }],
          linked: [],
          pruned: [],
          newSessionNeededFor: [],
        },
      },
      actions,
    );
    const r = await g.profileSave({
      name: "default",
      base,
      draft: { ...base, objective: "speed" },
      treatLikes: [{ rung: "codex:x#low", like: "codex:gpt-6-sol#low" }],
      activate: "repo",
    });
    expect(r).toMatchObject({ status: "saved", activated: true });
    expect(calls.find((c) => c.tool === "profile_set")?.args).toEqual({
      repo: "/repo",
      name: "default",
      patch: { objective: "speed" },
    });
    expect(actions).toEqual([
      ["catalog", "treat-like", "codex:x#low", "codex:gpt-6-sol#low"],
      ["profile", "use", "default", "--repo"],
    ]);

    const refused = gatewayWith([], {
      profile_get: get,
      profile_set: fixture("mcp-profile_set-refused.json"),
    });
    const r2 = await refused.profileSave({
      name: "default",
      base,
      draft: { ...base, objective: "speed" },
      treatLikes: [],
      activate: "no",
    });
    expect(r2).toMatchObject({ status: "refused", errors: [{ path: "roles.worker.enabled" }] });
  });

  it("maps catalog_query rungs (scored, treat-like, cost)", async () => {
    const g = gatewayWith([], { catalog_query: fixture("mcp-catalog_query-worker.json") });
    const c = await g.catalog({ role: "worker", scoredOnly: false });
    const fable = c.models.find((m) => m.id === "claude-fable-5-1" && m.backend === "claude");
    expect(fable?.rungs.find((r) => r.rung === "claude:claude-fable-5-1#low")).toMatchObject({
      enabled: true,
      scored: true,
      treatLike: null,
      costMode: "claude-plan",
    });
  });

  it("does not count 1.2's inferred values as scores", async () => {
    const inferred = { value: 1, confidence: "inferred", source: "shipped", from: "x#high" };
    const g = gatewayWith([], {
      catalog_query: {
        total: 1,
        models: [
          {
            id: "m",
            name: null,
            backend: "codex",
            model: "m",
            roles: ["worker"],
            listed: true,
            rungs: [
              { rung: "codex:m#low", enabled: true, scores: { repo_code: inferred } },
              {
                rung: "codex:m#high",
                enabled: true,
                scores: { repo_code: { ...inferred, confidence: "measured" } },
                treatLike: { like: "x#high", source: "user" },
              },
            ],
          },
        ],
      },
    });
    const [m] = (await g.catalog({ scoredOnly: false })).models;
    expect(m?.rungs.map((r) => [r.scored, r.treatLike])).toEqual([
      [false, null],
      [true, "x#high"],
    ]);
  });
});

describe("CatherdGateway runs (catherd 1.1+ push model)", () => {
  const detail = fixture("gw-run-detail.json");
  const summary = {
    ...detail,
    stateTail: [],
    live: [],
    session: { sessionId: "s", hostSessionId: null, name: "repo-6c", live: true },
    continuedIn: null,
  };
  const show = {
    summary,
    records: detail.records.map((r: Record<string, unknown>) => ({
      ...r,
      runId: detail.id,
      backend: "codex",
      replyPath: `dispatches/${r.name}/reply.md`,
    })),
  };

  it("reads a reply from its file, never through MCP result (which marks it read)", async () => {
    const calls: { tool: string; args: unknown }[] = [];
    const g = gatewayWith(
      calls,
      {
        status: { version: "1.2.0", runs: [summary], warnings: [] },
        read_run_file: "STATUS: done\nall 5 tests pass",
      },
      [],
      { runsShow: async () => show },
    );
    const r = await g.roleReply(detail.id, "M1.L1");
    expect(r).toEqual({
      name: "M1.L1",
      state: "finished",
      reply: "STATUS: done\nall 5 tests pass",
      replyPath: "dispatches/M1.L1/reply.md",
    });
    expect(calls.map((c) => c.tool)).not.toContain("result");
    expect(calls.find((c) => c.tool === "read_run_file")?.args).toEqual({
      run: detail.id,
      path: "dispatches/M1.L1/reply.md",
    });
  });

  it("cancels through the CLI, so catherd still announces the record", async () => {
    const calls: { tool: string; args: unknown }[] = [];
    const cliCalls: string[][] = [];
    const g = gatewayWith(calls, {}, [], {
      action: async (args: string[]) => {
        cliCalls.push(args);
        return "✓ M1.L1 cancelled\n  the lane's files may be half-written\n";
      },
    });
    await expect(g.cancelRole("r1", "M1.L1")).resolves.toEqual({
      status: "cancelled",
      hints: ["the lane's files may be half-written"],
    });
    expect(cliCalls).toEqual([["runs", "cancel", "r1", "M1.L1"]]);
    expect(calls).toEqual([]);
  });

  it("lists runs with the session that started them", async () => {
    const g = gatewayWith([], { status: { version: "1.2.0", runs: [summary], warnings: [] } }, [], {
      runsList: async () => ({
        runs: [
          {
            id: detail.id,
            title: detail.title,
            repo: detail.repo,
            createdAt: detail.createdAt,
            live: 0,
            roleRuns: 2,
            session: summary.session,
            continuedIn: null,
          },
        ],
        corrupt: [],
      }),
    });
    const { runs } = await g.runsList();
    expect(runs[0]).toMatchObject({
      session: { name: "repo-6c", live: true },
      continuedIn: null,
      landed: 1,
    });
    expect(runs[0]?.session).not.toHaveProperty("sessionId");
  });
});
