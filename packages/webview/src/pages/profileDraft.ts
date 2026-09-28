import { deepEqual, type ProfileDoc, profilePatch } from "@cathouse/protocol";

// Staged edits, like catherd's TUI (src/entry/tui/state.ts): nothing touches disk before Save;
// 100 undo steps; a treat-like and the rung it enables are one step.

export interface Draft {
  base: ProfileDoc;
  doc: ProfileDoc;
  treatLikes: { rung: string; like: string }[];
  past: { doc: ProfileDoc; treatLikes: Draft["treatLikes"] }[];
  future: { doc: ProfileDoc; treatLikes: Draft["treatLikes"] }[];
}

export type DraftAction =
  | { type: "edit"; fn: (d: ProfileDoc) => void; treatLike?: { rung: string; like: string } }
  | { type: "undo" }
  | { type: "redo" }
  | {
      type: "saved";
      base: ProfileDoc;
      submitted: ProfileDoc;
      submittedTreatLikes: Draft["treatLikes"];
    }
  | { type: "reset"; base: ProfileDoc };

const MAX_UNDO = 100;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Applies only edits made after Save was pressed to the newly saved base. */
function rebaseValue(saved: unknown, submitted: unknown, current: unknown): unknown {
  if (deepEqual(current, submitted)) return clone(saved);
  if (!isObject(submitted) || !isObject(current) || !isObject(saved)) return clone(current);
  const out: Record<string, unknown> = clone(saved);
  for (const key of new Set([...Object.keys(submitted), ...Object.keys(current)])) {
    if (!(key in current)) delete out[key];
    else if (!deepEqual(current[key], submitted[key]))
      out[key] = rebaseValue(saved[key], submitted[key], current[key]);
  }
  return out;
}

export function initDraft(base: ProfileDoc): Draft {
  return { base, doc: clone(base), treatLikes: [], past: [], future: [] };
}

export function draftReducer(s: Draft, a: DraftAction): Draft {
  switch (a.type) {
    case "edit": {
      const doc = clone(s.doc);
      a.fn(doc);
      return {
        ...s,
        doc,
        treatLikes: a.treatLike
          ? [...s.treatLikes.filter((t) => t.rung !== a.treatLike?.rung), a.treatLike]
          : s.treatLikes,
        past: [...s.past, { doc: s.doc, treatLikes: s.treatLikes }].slice(-MAX_UNDO),
        future: [],
      };
    }
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return {
        ...s,
        ...prev,
        past: s.past.slice(0, -1),
        future: [{ doc: s.doc, treatLikes: s.treatLikes }, ...s.future],
      };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return {
        ...s,
        ...next,
        past: [...s.past, { doc: s.doc, treatLikes: s.treatLikes }],
        future: s.future.slice(1),
      };
    }
    case "saved": {
      const doc = rebaseValue(a.base, a.submitted, s.doc) as ProfileDoc;
      const submitted = new Set(a.submittedTreatLikes.map((t) => `${t.rung}\0${t.like}`));
      const treatLikes = s.treatLikes.filter((t) => !submitted.has(`${t.rung}\0${t.like}`));
      return { base: clone(a.base), doc, treatLikes, past: [], future: [] };
    }
    case "reset":
      return initDraft(a.base);
  }
}

/** Changed leaf fields + staged treat-likes (the TUI's "N unsaved"). */
export function dirtyCount(d: Draft): number {
  const patch = profilePatch(d.base, d.doc);
  const count = (v: unknown): number =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.values(v).reduce<number>((n, x) => n + count(x), 0)
      : 1;
  return (patch ? count(patch) : 0) + d.treatLikes.length;
}
