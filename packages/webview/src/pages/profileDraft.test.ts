import type { ProfileDoc } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import { dirtyCount, draftReducer, initDraft } from "./profileDraft";

const base = {
  name: "p",
  objective: "cost",
  roles: { worker: { enabled: true, access: "workspace-write", rungs: ["codex:a#high"] } },
  billing: {},
  jev: { use: "auto" },
  isolated: { codex: false },
  failover: {},
  budget: {},
  timeouts: { idleMin: 15, wallMin: 90 },
  preflight: { confirm: false },
  heavy: "cpus/2",
  notify: [],
} as ProfileDoc;

describe("profile draft", () => {
  it("stages edits with undo/redo and counts dirty fields", () => {
    let d = initDraft(base);
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.objective = "speed";
      },
    });
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.roles.worker?.rungs.push("codex:b#low");
      },
      treatLike: { rung: "codex:b#low", like: "codex:a#high" },
    });
    expect(dirtyCount(d)).toBe(3); // objective, worker.rungs, one treat-like
    d = draftReducer(d, { type: "undo" });
    expect(d.treatLikes).toEqual([]);
    expect(dirtyCount(d)).toBe(1);
    d = draftReducer(d, { type: "redo" });
    expect(d.doc.roles.worker?.rungs).toEqual(["codex:a#high", "codex:b#low"]);
    expect(base.roles.worker?.rungs).toEqual(["codex:a#high"]); // base never mutated
    d = draftReducer(d, { type: "reset", base });
    expect(dirtyCount(d)).toBe(0);
  });
});
