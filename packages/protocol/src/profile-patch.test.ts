import { describe, expect, it } from "vitest";
import { describePatch, profilePatch } from "./profile-patch";
import type { ProfileDoc } from "./profiles";

const base: ProfileDoc = {
  name: "default",
  objective: "cost",
  roles: {
    worker: {
      enabled: true,
      access: "workspace-write",
      rungs: ["codex:a#high", "codex:b#medium"],
      defaultRung: "codex:b#medium",
    },
    reviewer: { enabled: true, access: "read-only", rungs: ["codex:b#high"] },
  },
  billing: { codex: "chatgpt-plan" },
  jev: { use: "auto" },
  isolated: { codex: false, opencode: false },
  failover: { "codex:a#high": "opencode:x#high" },
  budget: {},
  timeouts: { idleMin: 15, wallMin: 90 },
  preflight: { confirm: false },
  heavy: "cpus/2",
  notify: ["milestone", "finish", "blocked"],
};
const clone = (d: ProfileDoc): ProfileDoc => JSON.parse(JSON.stringify(d)) as ProfileDoc;

describe("profilePatch", () => {
  it("is undefined when nothing changed", () => {
    expect(profilePatch(base, clone(base))).toBeUndefined();
  });

  it("maps isolated/heavy to harness/lock and replaces arrays", () => {
    const d = clone(base);
    d.isolated.codex = true;
    d.heavy = 2;
    d.notify = ["finish"];
    (d.roles.worker as { rungs: string[] }).rungs = ["codex:b#medium"];
    expect(profilePatch(base, d)).toEqual({
      harness: { codex: { isolated: true } },
      lock: { heavy: 2 },
      notify: ["finish"],
      roles: { worker: { rungs: ["codex:b#medium"] } },
    });
  });

  it("deletes with null: budget caps cleared, failover entries removed, defaultRung unset", () => {
    const b = clone(base);
    b.budget = { usd: 20 };
    const d = clone(b);
    d.budget = {};
    d.failover = {};
    delete (d.roles.worker as { defaultRung?: string }).defaultRung;
    expect(profilePatch(b, d)).toEqual({
      budget: { usd: null },
      failover: { "codex:a#high": null },
      roles: { worker: { defaultRung: null } },
    });
  });

  it("describes a patch as path lines with before/after", () => {
    const d = clone(base);
    d.objective = "speed";
    d.isolated.opencode = true;
    const lines = describePatch(base, profilePatch(base, d) ?? {});
    expect(lines).toContainEqual({ path: "objective", before: "cost", after: "speed" });
    expect(lines).toContainEqual({ path: "harness.opencode.isolated", before: false, after: true });
  });
});
