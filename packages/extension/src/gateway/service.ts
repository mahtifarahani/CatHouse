import {
  type CatalogModel,
  deepEqual,
  type ProfileDoc,
  ProfileDocSchema,
  type ProfileSaveResult,
  type ProfilesState,
  profilePatch,
  type RecordLite,
  type RunDetail,
  type RunListItem,
} from "@cathouse/protocol";
import { z } from "zod";
import type { CatherdCli } from "./cli";
import { CatherdError } from "./errors";
import type { CatherdMcp } from "./mcp-client";
import { parseRoutes } from "./run-files";
import { type RunRecord, type RunSummary, RunSummarySchema, StatusSchema } from "./schemas";

// One per repo. Maps raw catherd output to protocol models; every write goes through MCP
// profile_set or the CLI (ADR 0005). vscode-free.

const ProfileGetSchema = z.looseObject({
  active: z.string(),
  here: z.string(),
  profiles: z.array(z.string()),
  profile: z.unknown(),
  enforcement: z.record(z.string(), z.string()),
});
const ValidateSchema = z.object({
  valid: z.boolean(),
  errors: z.array(
    z.looseObject({ path: z.string(), message: z.string(), fix: z.string().optional() }),
  ),
  warnings: z.array(
    z.looseObject({ path: z.string(), message: z.string(), fix: z.string().optional() }),
  ),
});
const SavedSchema = z.looseObject({
  saved: z.boolean(),
  errors: ValidateSchema.shape.errors,
  warnings: ValidateSchema.shape.warnings,
  diff: z.array(z.looseObject({ path: z.string(), before: z.unknown(), after: z.unknown() })),
  newSessionNeededFor: z.array(z.string()),
});
const CatalogQuerySchema = z.looseObject({
  total: z.number(),
  models: z.array(
    z.looseObject({
      id: z.string(),
      // null for models only known from a backend's listing (seen live on 1.0.0)
      name: z.string().nullable(),
      backend: z.string(),
      model: z.string(),
      roles: z.array(z.string()),
      listed: z.boolean().nullable(),
      notes: z.unknown().optional(),
      rungs: z.array(
        z.looseObject({
          rung: z.string(),
          enabled: z.boolean(),
          why: z.string().optional(),
          scores: z.record(z.string(), z.unknown()).optional(),
          // {like, source: "shipped" | "user"} in 1.0.0; a bare string is accepted too.
          treatLike: z
            .union([z.string(), z.looseObject({ like: z.string(), source: z.string().optional() })])
            .nullable()
            .optional(),
          cost: z
            .looseObject({ tier: z.number().optional(), mode: z.string().optional() })
            .optional(),
        }),
      ),
    }),
  ),
});
const CancelSchema = z.looseObject({
  record: z.looseObject({ status: z.string() }).nullable().optional(),
  hints: z.array(z.string()).optional(),
});
const ResultSchema = z.looseObject({
  name: z.string(),
  state: z.string().nullable(),
  reply: z.string().nullable().optional(),
  replyPath: z.string().nullable().optional(),
});

function issues(list: { path: string; message: string; fix?: string | undefined }[]) {
  return list.map((i) => ({ path: i.path, message: i.message, ...(i.fix ? { fix: i.fix } : {}) }));
}

function recordLite(r: RunRecord): RecordLite {
  const x = r as RunRecord & Record<string, unknown>;
  const tokens = (x.tokens as RecordLite["tokens"] | undefined) ?? {
    input: 0,
    cached: 0,
    output: 0,
  };
  return {
    dispatchId: r.dispatchId,
    name: r.name,
    role: r.role,
    lane: r.lane,
    rung: r.rung,
    status: r.status,
    secs: r.secs,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    replyStatus: r.replyStatus,
    replyWhy: (x.replyWhy as string | null | undefined) ?? null,
    tokens,
    costUsd: (x.costUsd as number | null | undefined) ?? null,
    changedOwned: (x.changedOwned as string[] | undefined) ?? [],
    violations: (x.violations as string[] | undefined) ?? [],
    threadHeavy: x.threadHeavy === true,
  };
}

export class CatherdGateway {
  constructor(
    readonly repo: string,
    private readonly cli: CatherdCli,
    private readonly mcp: CatherdMcp,
  ) {}

  private async summary(id: string): Promise<RunSummary | undefined> {
    const s = StatusSchema.parse(await this.mcp.call("status", { run: id }));
    const found = s.runs.find((r) => r.id === id) ?? s.runs[0];
    return found ? RunSummarySchema.parse(found) : undefined;
  }

  /** Runs of this repo, newest first; the newest 10 get landed/budget from status(run). */
  async runsList(): Promise<{ runs: RunListItem[]; corrupt: number }> {
    const list = await this.cli.runsList(this.repo);
    const runs: RunListItem[] = list.runs.map((r) => ({ ...r }));
    await Promise.all(
      runs.slice(0, 10).map(async (r) => {
        try {
          const s = await this.summary(r.id);
          if (s) {
            r.landed = s.milestones.length;
            r.budgetFraction = s.budget?.fraction ?? null;
          }
        } catch {
          // a corrupt or vanished run keeps its basic row
        }
      }),
    );
    return { runs, corrupt: list.corrupt.length };
  }

  async runGet(id: string): Promise<RunDetail> {
    const [s, show, state, routesText] = await Promise.all([
      this.summary(id),
      this.cli.runsShow(id),
      this.mcp.call("read_run_file", { run: id, path: "state.md" }).catch(() => ""),
      this.mcp.call("read_run_file", { run: id, path: "routes.jsonl" }).catch(() => ""),
    ]);
    const summary = s ?? show.summary;
    const { routes, climbs } = parseRoutes(typeof routesText === "string" ? routesText : "");
    return {
      id: summary.id,
      title: summary.title,
      repo: summary.repo,
      createdAt: summary.createdAt,
      stateMd: typeof state === "string" ? state : "",
      live: summary.live.map((l) => ({ name: l.name, rung: l.rung, state: l.state, secs: l.secs })),
      totals: summary.totals,
      agents: summary.agents,
      jev: summary.jev,
      budget: summary.budget,
      milestones: summary.milestones,
      warnings: summary.warnings,
      records: show.records.map(recordLite),
      routes,
      climbs,
    };
  }

  async roleReply(id: string, name: string) {
    const r = ResultSchema.parse(await this.mcp.call("result", { run: id, name }));
    return { name: r.name, state: r.state, reply: r.reply ?? "", replyPath: r.replyPath ?? null };
  }

  async roleDebug(id: string, name: string) {
    const show = await this.cli.runsShow(id, { name });
    return (show.dispatches ?? []).map((d) => {
      const x = d as Record<string, unknown>;
      return {
        name: String(x.name),
        dispatchId: String(x.dispatchId),
        rung: String(x.rung ?? ""),
        exit: (x.exit as never) ?? null,
        stderrTail: (x.stderrTail as string[]) ?? [],
        eventsTail: (x.eventsTail as string[]) ?? [],
        supervisorTail: (x.supervisorTail as string[]) ?? [],
      };
    });
  }

  /** Stops a live role. The caller must tell a live orchestrator session (ADR 0005). */
  async cancelRole(id: string, name: string) {
    const r = CancelSchema.parse(await this.mcp.call("cancel", { run: id, name }));
    return { status: r.record?.status ?? "cancelled", hints: r.hints ?? [] };
  }

  private async profileDoc(
    name?: string,
  ): Promise<{ get: z.infer<typeof ProfileGetSchema>; doc: ProfileDoc }> {
    const get = ProfileGetSchema.parse(
      await this.mcp.call("profile_get", { repo: this.repo, ...(name ? { name } : {}) }),
    );
    const doc = ProfileDocSchema.safeParse(get.profile);
    if (!doc.success) {
      throw new CatherdError(
        "E_CONTRACT",
        `profile_get returned an unexpected profile: ${doc.error.message}`,
      );
    }
    return { get, doc: doc.data };
  }

  async profiles(name?: string): Promise<ProfilesState> {
    const { get, doc } = await this.profileDoc(name);
    const [list, show, valid] = await Promise.all([
      this.cli.profileList(),
      this.cli.profileShow(doc.name),
      this.mcp.call("profile_validate", { repo: this.repo, name: doc.name }),
    ]);
    const v = ValidateSchema.parse(valid);
    return {
      active: get.active,
      here: get.here,
      names: get.profiles,
      bindings: Object.fromEntries(list.map((p) => [p.name, p.repos])),
      profile: doc,
      enforcement: get.enforcement,
      standIns: show.standIns.map((s) => ({
        from: s.from,
        to: s.to,
        inferred: s.inferred,
        via: typeof s.via === "string" ? s.via : null,
      })),
      validation: { valid: v.valid, errors: issues(v.errors), warnings: issues(v.warnings) },
    };
  }

  /**
   * Saves an edited profile: refuses when the file changed since `base` was loaded (catherd's
   * `expect` is not public; gap 5), writes staged treat-likes, then the patch via profile_set,
   * then optionally activates.
   */
  async profileSave(p: {
    name: string;
    base: ProfileDoc;
    draft: ProfileDoc;
    treatLikes: { rung: string; like: string }[];
    activate: "no" | "global" | "repo";
  }): Promise<ProfileSaveResult> {
    const { doc: current } = await this.profileDoc(p.name);
    if (!deepEqual(current, p.base)) return { status: "conflict", current };
    const patch = profilePatch(p.base, p.draft);
    if (!patch && p.treatLikes.length === 0 && p.activate === "no") return { status: "unchanged" };
    for (const t of p.treatLikes) await this.cli.action(["catalog", "treat-like", t.rung, t.like]);
    let diff: { path: string; before: unknown; after: unknown }[] = [];
    let warnings: ReturnType<typeof issues> = [];
    let newSessionNeededFor: string[] = [];
    if (patch) {
      const r = SavedSchema.parse(
        await this.mcp.call("profile_set", { repo: this.repo, name: p.name, patch }),
      );
      if (!r.saved)
        return { status: "refused", errors: issues(r.errors), warnings: issues(r.warnings) };
      diff = r.diff;
      warnings = issues(r.warnings);
      newSessionNeededFor = r.newSessionNeededFor;
    }
    if (p.activate !== "no") await this.activate(p.name, p.activate);
    return { status: "saved", diff, warnings, newSessionNeededFor, activated: p.activate !== "no" };
  }

  async activate(name: string, scope: "global" | "repo"): Promise<void> {
    await this.cli.action(["profile", "use", name, ...(scope === "repo" ? ["--repo"] : [])]);
  }
  async unbindRepo(): Promise<void> {
    await this.cli.action(["profile", "use", "--repo", "--clear"]);
  }
  async createProfile(name: string, from?: string): Promise<void> {
    await this.cli.action(["profile", "new", name, ...(from ? ["--from", from] : [])]);
  }
  async removeProfile(name: string): Promise<void> {
    await this.cli.action(["profile", "rm", name]);
  }

  async catalog(q: {
    role?: string | undefined;
    backend?: string | undefined;
    text?: string | undefined;
    scoredOnly: boolean;
  }): Promise<{ total: number; models: CatalogModel[] }> {
    const raw = CatalogQuerySchema.parse(
      await this.mcp.call("catalog_query", {
        repo: this.repo,
        ...(q.role ? { role: q.role } : {}),
        ...(q.backend ? { backend: q.backend } : {}),
        ...(q.text ? { text: q.text } : {}),
        scored_only: q.scoredOnly,
        limit: 500,
      }),
    );
    return {
      total: raw.total,
      models: raw.models.map((m) => ({
        id: m.id,
        name: m.name ?? m.model,
        backend: m.backend,
        model: m.model,
        roles: m.roles,
        listed: m.listed,
        ...(m.notes && typeof m.notes === "object"
          ? { notes: Object.values(m.notes as Record<string, string>).join(" · ") }
          : typeof m.notes === "string"
            ? { notes: m.notes }
            : {}),
        rungs: m.rungs.map((r) => ({
          rung: r.rung,
          enabled: r.enabled,
          ...(r.why ? { why: r.why } : {}),
          scored: Object.keys(r.scores ?? {}).length > 0,
          treatLike:
            typeof r.treatLike === "object" && r.treatLike
              ? r.treatLike.like
              : (r.treatLike ?? null),
          ...(r.cost?.tier === undefined ? {} : { costTier: r.cost.tier }),
          ...(r.cost?.mode ? { costMode: r.cost.mode } : {}),
        })),
      })),
    };
  }

  catalogRefresh() {
    return this.cli.catalogRefresh();
  }
  async treatLike(rung: string, like: string): Promise<void> {
    await this.cli.action(["catalog", "treat-like", rung, like]);
  }

  dispose(): Promise<void> {
    return this.mcp.close();
  }
}
