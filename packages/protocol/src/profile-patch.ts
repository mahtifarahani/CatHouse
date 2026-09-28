import type { ProfileDoc } from "./profiles";

// Pure: builds catherd's profile patch (RFC 7396: maps merge, arrays replace, null deletes;
// catherd src/domain/profile.ts:251-287) from an edited ProfileDoc. The view's `isolated` and
// `heavy` map to the patch's `harness.<b>.isolated` and `lock.heavy`.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type ProfilePatch = { [k: string]: Json };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

/** RFC 7396 merge patch from `before` to `after` (undefined keys in `after` become null). */
function mergePatch(before: unknown, after: unknown): Json | undefined {
  if (deepEqual(before, after)) return undefined;
  if (!isObj(before) || !isObj(after)) return (after ?? null) as Json;
  const out: Record<string, Json> = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(k in after) || after[k] === undefined) {
      if (k in before && before[k] !== undefined) out[k] = null;
      continue;
    }
    const p = mergePatch(before[k], after[k]);
    if (p !== undefined) out[k] = p;
  }
  return Object.keys(out).length ? out : undefined;
}

/** ProfileDoc (view shape) → catherd's stored shape, only the keys a patch may carry. */
function toPatchShape(d: ProfileDoc): Record<string, unknown> {
  return {
    objective: d.objective,
    jev: { use: d.jev.use },
    billing: d.billing,
    roles: Object.fromEntries(
      Object.entries(d.roles).map(([r, c]) => [
        r,
        {
          enabled: c.enabled,
          access: c.access,
          rungs: c.rungs,
          ...(c.defaultRung === undefined ? {} : { defaultRung: c.defaultRung }),
        },
      ]),
    ),
    harness: Object.fromEntries(Object.entries(d.isolated).map(([b, v]) => [b, { isolated: v }])),
    failover: d.failover,
    budget: d.budget,
    timeouts: d.timeouts,
    preflight: d.preflight,
    lock: { heavy: d.heavy },
    notify: d.notify,
  };
}

/** The patch that turns `base` into `draft`, or undefined when nothing changed. */
export function profilePatch(base: ProfileDoc, draft: ProfileDoc): ProfilePatch | undefined {
  const p = mergePatch(toPatchShape(base), toPatchShape(draft));
  return p && isObj(p) ? (p as ProfilePatch) : undefined;
}

/** Flattens a patch into "path: before → after" lines for the save preview. */
export function describePatch(
  base: ProfileDoc,
  patch: ProfilePatch,
): { path: string; before: unknown; after: unknown }[] {
  const shaped = toPatchShape(base);
  const out: { path: string; before: unknown; after: unknown }[] = [];
  const walk = (p: Json, b: unknown, path: string) => {
    if (isObj(p) && !Array.isArray(p) && (isObj(b) || b === undefined)) {
      for (const [k, v] of Object.entries(p))
        walk(v, isObj(b) ? b[k] : undefined, path ? `${path}.${k}` : k);
      return;
    }
    out.push({ path, before: b, after: p });
  };
  walk(patch, shaped, "");
  return out;
}
