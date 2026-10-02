import type { ProfileDoc } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import { dirtyCount, draftReducer, initDraft, saveOutcome } from "./profileDraft";

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

  it("keeps edits made while a save is in flight over the saved base", () => {
    let d = initDraft(base);
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.objective = "speed";
      },
    });
    const submitted = structuredClone(d.doc);
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.timeouts.idleMin = 20;
      },
    });
    d = draftReducer(d, {
      type: "saved",
      base: submitted,
      submitted,
      submittedTreatLikes: [],
    });
    expect(d.base.objective).toBe("speed");
    expect(d.doc.objective).toBe("speed");
    expect(d.doc.timeouts.idleMin).toBe(20);
    expect(dirtyCount(d)).toBe(1);
  });

  it("stages a role checkbox toggle", () => {
    let d = initDraft(base);
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        const worker = x.roles.worker as NonNullable<(typeof x.roles)[string]>;
        x.roles.worker = { ...worker, enabled: false };
      },
    });
    expect(d.doc.roles.worker?.enabled).toBe(false);
    expect(dirtyCount(d)).toBe(1);
    expect(d.past).toHaveLength(1);
  });

  it("auto-save keeps edits made while a save was in flight", () => {
    let d = initDraft(base);
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.objective = "speed";
      },
    });
    const submitted = { base: d.base, doc: structuredClone(d.doc), treatLikes: d.treatLikes };
    // The user keeps editing while catherd saves.
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.timeouts.idleMin = 30;
      },
    });
    d = draftReducer(
      d,
      saveOutcome(submitted, {
        status: "saved",
        diff: [],
        warnings: [],
        newSessionNeededFor: [],
        activated: false,
      }),
    );
    expect(d.base.objective).toBe("speed");
    expect(d.doc.timeouts.idleMin).toBe(30);
    expect(dirtyCount(d)).toBe(1);
  });

  it("auto-save reverts a refused change and rebases on a conflict", () => {
    let d = initDraft(base);
    d = draftReducer(d, {
      type: "edit",
      fn: (x) => {
        x.objective = "speed";
      },
    });
    const submitted = { base: d.base, doc: structuredClone(d.doc), treatLikes: [] };
    const refused = draftReducer(
      d,
      saveOutcome(submitted, { status: "refused", errors: [], warnings: [] }),
    );
    expect(refused.doc.objective).toBe("cost");
    expect(dirtyCount(refused)).toBe(0);
    const current = { ...base, objective: "speed", timeouts: { idleMin: 5, wallMin: 90 } };
    const conflict = draftReducer(d, saveOutcome(submitted, { status: "conflict", current }));
    expect(conflict.base.timeouts.idleMin).toBe(5);
    expect(dirtyCount(conflict)).toBe(0);
  });
});
