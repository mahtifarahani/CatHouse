import { type ProfileDoc, profilePatch } from "@cathouse/protocol";

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
  | { type: "reset"; base: ProfileDoc };

const MAX_UNDO = 100;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

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
