import {
  ACCESS,
  type CatalogModel,
  type ProfileDoc,
  ROLES,
  type RoleConfig,
} from "@cathouse/protocol";
import {
  Button,
  cn,
  Icon,
  IconButton,
  inputClass,
  quietSelectClass,
  Segmented,
  Switch,
} from "@cathouse/ui";
import { useMemo, useState } from "react";
import { t } from "../../lib/strings";
import { rungParts } from "../../session/format";

export type Edit = (
  fn: (d: ProfileDoc) => void,
  treatLike?: { rung: string; like: string },
) => void;

const ACCESS_LABEL: Record<(typeof ACCESS)[number], string> = {
  "read-only": "read",
  "workspace-write": "write",
  full: "full",
};

type Rung = CatalogModel["rungs"][number] & {
  model: string;
  backend: string;
  listed: boolean | null;
};

function rungsFor(models: CatalogModel[], role: string): Rung[] {
  return models
    .filter((m) => m.roles.includes(role))
    .flatMap((m) =>
      m.rungs.map((r) => ({ ...r, model: m.name, backend: m.backend, listed: m.listed })),
    );
}

const emptyRole: RoleConfig = { enabled: false, access: "read-only", rungs: [] };

/**
 * The eight catherd roles as compact rows: on/off, name and the model it starts on. A row opens in
 * place to edit access, the model ladder and the starting rung.
 */
export function RolesEditor({
  doc,
  edit,
  models,
  enforcement,
  open,
  setOpen,
}: {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  enforcement: Record<string, string>;
  open: string | undefined;
  setOpen: (role: string | undefined) => void;
}) {
  const enabled = ROLES.filter((r) => doc.roles[r]?.enabled).length;
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="m-0 flex items-baseline gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("profiles.roles")}
        <span className="font-normal normal-case tracking-normal">
          {t("profiles.summary.roles", { n: enabled, total: ROLES.length })}
        </span>
      </h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {ROLES.map((role) => (
          <RoleRow
            key={role}
            role={role}
            doc={doc}
            edit={edit}
            models={models}
            enforcement={enforcement[role]}
            open={open === role}
            onToggle={() => setOpen(open === role ? undefined : role)}
          />
        ))}
      </ul>
    </section>
  );
}

function RoleRow({
  role,
  doc,
  edit,
  models,
  enforcement,
  open,
  onToggle,
}: {
  role: string;
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  enforcement: string | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const cfg: RoleConfig = doc.roles[role] ?? emptyRole;
  const set = (patch: Partial<RoleConfig>) =>
    edit((d) => {
      d.roles[role] = { ...cfg, ...patch };
    });
  const start = cfg.defaultRung ?? cfg.rungs[0];
  const startModel = start ? rungParts(start) : undefined;
  return (
    <li id={`role-${role}`} className={cn("rounded-md", open && "bg-surface")}>
      <div className="flex min-h-9 min-w-0 items-center gap-2 rounded-md px-1.5 hover:bg-surface">
        <Switch
          checked={cfg.enabled}
          onChange={(enabled) => set({ enabled })}
          label={t("profiles.enableRole", { role })}
        />
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-start"
        >
          <span className={cn("shrink-0 font-medium", !cfg.enabled && "text-muted-foreground")}>
            {role}
          </span>
          <span className="min-w-0 flex-1 truncate text-end font-mono text-xs text-muted-foreground">
            {startModel
              ? `${startModel.model}${startModel.effort ? `#${startModel.effort}` : ""}`
              : t("profiles.noModels")}
            {cfg.rungs.length > 1 && ` +${cfg.rungs.length - 1}`}
          </span>
          <Icon
            name="chevron"
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2.5 px-2.5 pt-1 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label={t("profiles.access", { role })}
              value={cfg.access as (typeof ACCESS)[number]}
              options={ACCESS.map((a) => ({ value: a, label: ACCESS_LABEL[a] }))}
              onChange={(access) => set({ access })}
            />
            {enforcement && (
              <span
                className={cn(
                  "text-xs",
                  enforcement === "enforced" ? "text-muted-foreground" : "text-warning",
                )}
                title={t("profiles.enforcementHint")}
              >
                {enforcement}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t("profiles.ladder")}</span>
            {cfg.rungs.length === 0 && (
              <p className="m-0 text-xs text-muted-foreground">{t("profiles.noModels")}</p>
            )}
            <ol className="m-0 flex list-none flex-col p-0">
              {cfg.rungs.map((r, i) => (
                <li
                  key={r}
                  className="group flex min-h-7 min-w-0 items-center gap-1 rounded-md ps-1 hover:bg-surface-hover"
                >
                  <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={r}>
                    {r}
                  </span>
                  {r === cfg.defaultRung && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("profiles.startsHere")}
                    </span>
                  )}
                  <span className="flex shrink-0 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton
                      small
                      icon="chevronUp"
                      label={t("profiles.up")}
                      disabled={i === 0}
                      onClick={() => {
                        const rs = [...cfg.rungs];
                        [rs[i - 1], rs[i]] = [rs[i] as string, rs[i - 1] as string];
                        set({ rungs: rs });
                      }}
                    />
                    <IconButton
                      small
                      icon="chevronDown"
                      label={t("profiles.down")}
                      disabled={i === cfg.rungs.length - 1}
                      onClick={() => {
                        const rs = [...cfg.rungs];
                        [rs[i + 1], rs[i]] = [rs[i] as string, rs[i + 1] as string];
                        set({ rungs: rs });
                      }}
                    />
                    <IconButton
                      small
                      icon="x"
                      tone="danger"
                      label={t("profiles.removeRung", { rung: r })}
                      onClick={() =>
                        edit((d) => {
                          const next = { ...cfg, rungs: cfg.rungs.filter((x) => x !== r) };
                          if (next.defaultRung && !next.rungs.includes(next.defaultRung))
                            delete next.defaultRung;
                          d.roles[role] = next;
                        })
                      }
                    />
                  </span>
                </li>
              ))}
            </ol>
            <ModelPicker role={role} models={models} taken={cfg.rungs} edit={edit} cfg={cfg} />
          </div>

          {cfg.rungs.length > 1 && (
            <label className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
              <span className="text-muted-foreground">{t("profiles.defaultRung")}</span>
              <select
                className={cn(quietSelectClass, "max-w-full font-mono text-foreground")}
                value={cfg.defaultRung ?? ""}
                onChange={(e) =>
                  edit((d) => {
                    const r = { ...cfg };
                    if (e.target.value) r.defaultRung = e.target.value;
                    else delete r.defaultRung;
                    d.roles[role] = r;
                  })
                }
              >
                <option value="">{t("profiles.cheapest")}</option>
                {cfg.rungs.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </li>
  );
}

/** Search the catalog and add a model to the role's ladder; unscored models ask for a stand-in. */
function ModelPicker({
  role,
  models,
  taken,
  edit,
  cfg,
}: {
  role: string;
  models: CatalogModel[];
  taken: string[];
  edit: Edit;
  cfg: ProfileDoc["roles"][string];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [treat, setTreat] = useState<{ rung: string; like: string }>();
  const all = useMemo(() => rungsFor(models, role), [models, role]);
  const scored = useMemo(
    () => [
      ...new Set(
        models.flatMap((m) =>
          m.rungs.filter((r) => r.scored).map((r) => r.rung.split(":")[1] ?? r.rung),
        ),
      ),
    ],
    [models],
  );
  const needle = query.trim().toLowerCase();
  const matches = all
    .filter((r) => !taken.includes(r.rung))
    .filter((r) => !needle || `${r.rung} ${r.model}`.toLowerCase().includes(needle))
    .slice(0, 30);
  const add = (rung: string, like?: string) => {
    const fn = (d: ProfileDoc) => {
      d.roles[role] = { ...cfg, rungs: [...cfg.rungs, rung] };
    };
    if (like) edit(fn, { rung, like });
    else edit(fn);
    setQuery("");
    setOpen(false);
    setTreat(undefined);
  };

  if (treat) {
    return (
      <div className="mt-1 flex flex-col gap-1.5 rounded-md bg-surface-hover p-2 text-xs">
        <span>{t("profiles.treatPrompt", { rung: treat.rung })}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            className={cn(inputClass, "min-w-0 max-w-full flex-1")}
            value={treat.like}
            onChange={(e) => setTreat({ ...treat, like: e.target.value })}
          >
            <option value="">{t("models.pickScored")}</option>
            {scored.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => add(treat.rung, treat.like || undefined)}>
            {treat.like ? t("profiles.addWithTreat") : t("profiles.addInferred")}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setTreat(undefined)}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }
  if (!open) {
    return (
      <Button variant="quiet" size="sm" className="mt-0.5 self-start" onClick={() => setOpen(true)}>
        <Icon name="plus" />
        {t("profiles.addModel")}
      </Button>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-1">
      <label className="relative flex items-center">
        <Icon
          name="search"
          className="pointer-events-none absolute start-2.5 text-muted-foreground"
        />
        <input
          // biome-ignore lint/a11y/noAutofocus: opened by an explicit click on "Add model"
          autoFocus
          type="search"
          aria-label={t("profiles.addRung", { role })}
          placeholder={t("profiles.searchModels")}
          className={cn(inputClass, "w-full ps-8 text-xs")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              const first = matches[0];
              if (!first.scored && !first.treatLike) setTreat({ rung: first.rung, like: "" });
              else add(first.rung);
            }
          }}
        />
      </label>
      <ul className="m-0 flex max-h-56 list-none flex-col overflow-y-auto rounded-md bg-surface-hover p-1">
        {matches.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground">{t("models.none")}</li>
        )}
        {matches.map((r) => (
          <li key={r.rung}>
            <button
              type="button"
              className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-start text-xs hover:bg-surface"
              onClick={() => {
                if (!r.scored && !r.treatLike) setTreat({ rung: r.rung, like: "" });
                else add(r.rung);
              }}
            >
              <span className="min-w-0 flex-1 truncate font-mono">{r.rung}</span>
              {r.costTier !== undefined && (
                <span className="shrink-0 text-muted-foreground">${r.costTier}</span>
              )}
              {!r.scored && !r.treatLike && (
                <span className="shrink-0 text-warning" title={t("profiles.unscored")}>
                  ?
                </span>
              )}
              {r.listed === false && (
                <span className="shrink-0 text-warning" title={t("models.notListed")}>
                  !
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="quiet" size="sm" className="self-end" onClick={() => setOpen(false)}>
        {t("common.cancel")}
      </Button>
    </div>
  );
}
