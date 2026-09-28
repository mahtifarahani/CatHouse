import {
  ACCESS,
  BILLING_MODES,
  type CatalogModel,
  deepEqual,
  describePatch,
  NOTIFY,
  type ProfileDoc,
  type ProfileSaveResult,
  profilePatch,
  ROLES,
} from "@cathouse/protocol";
import { Badge, Button, Card, cn, ErrorText, inputClass, Section } from "@cathouse/ui";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { request, viewState } from "../lib/rpc";
import { t } from "../lib/strings";
import { toast } from "../lib/toasts";
import { errorText, usePoll } from "../lib/usePoll";
import { type Draft, dirtyCount, draftReducer } from "./profileDraft";

type Edit = (fn: (d: ProfileDoc) => void, treatLike?: { rung: string; like: string }) => void;

export function ProfilesPage() {
  const [name, setName] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<number>();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string }>();
  const state = usePoll(
    () => request("profiles.get", name ? { name } : {}),
    0,
    `profiles-${name ?? "here"}`,
  );
  const catalog = usePoll(
    () => request("catalog.query", { scoredOnly: false }),
    0,
    "profiles-catalog",
  );
  const [draft, dispatch] = useReducer(
    draftReducer,
    viewState.get<{ profileDraft?: Draft }>()?.profileDraft as Draft,
  );
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<ProfileSaveResult>();
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "activate"; scope: "global" | "repo" }
    | { kind: "discard" }
    | { kind: "switch"; name: string }
    | undefined
  >();

  const loaded = state.data?.profile;
  useEffect(() => {
    if (loaded && (!draft || draft.base.name !== loaded.name || dirtyCount(draft) === 0)) {
      dispatch({ type: "reset", base: loaded });
    }
  }, [loaded, draft]);

  const dirty = draft ? dirtyCount(draft) : 0;
  useEffect(() => {
    if (draft) viewState.update({ profileDraft: draft });
  }, [draft]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("cathouse:dirty", { detail: dirty }));
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => {
      window.removeEventListener("beforeunload", guard);
      window.dispatchEvent(new CustomEvent("cathouse:dirty", { detail: 0 }));
    };
  }, [dirty]);
  useEffect(() => {
    const focusFilter = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      event.preventDefault();
      filterRef.current?.focus();
    };
    window.addEventListener("keydown", focusFilter);
    return () => window.removeEventListener("keydown", focusFilter);
  }, []);
  if (state.error && !state.data) return <ErrorText>{state.error}</ErrorText>;
  if (!state.data || !draft) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  const s = state.data;
  const shown = s.profile.name;
  const edit: Edit = (fn, treatLike) =>
    dispatch({ type: "edit", fn, ...(treatLike ? { treatLike } : {}) });

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ tone: "ok", text: ok });
      toast(ok, "ok");
      state.refresh();
    } catch (e) {
      const text = errorText(e);
      setMsg({ tone: "bad", text });
      toast(text, "bad");
    }
  };

  const save = async (activate: "no" | "global" | "repo") => {
    setPreview(false);
    const submitted = {
      base: structuredClone(draft.base),
      doc: structuredClone(draft.doc),
      treatLikes: structuredClone(draft.treatLikes),
    };
    try {
      const r = await request("profiles.save", {
        name: shown,
        base: submitted.base,
        draft: submitted.doc,
        treatLikes: submitted.treatLikes,
        activate,
      });
      setResult(r);
      if (r.status === "saved" || r.status === "unchanged") {
        state.refresh();
        dispatch({
          type: "saved",
          base: submitted.doc,
          submitted: submitted.doc,
          submittedTreatLikes: submitted.treatLikes,
        });
        toast(
          r.status === "saved"
            ? t("profiles.saved", { n: r.diff.length })
            : t("profiles.unchanged"),
          "ok",
        );
      }
    } catch (e) {
      setMsg({ tone: "bad", text: errorText(e) });
    }
  };

  const bound = s.bindings[shown] ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="font-semibold">{t("profiles.profile")}</span>
          <select
            className={inputClass}
            value={shown}
            onChange={(e) => {
              if (dirty) setConfirm({ kind: "switch", name: e.target.value });
              else {
                setName(e.target.value);
                setResult(undefined);
              }
            }}
          >
            {s.names.map((n) => (
              <option key={n} value={n}>
                {n}
                {n === s.active ? ` (${t("profiles.active")})` : ""}
                {n === s.here && n !== s.active ? ` (${t("profiles.thisRepo")})` : ""}
              </option>
            ))}
          </select>
        </label>
        {shown === s.here && (
          <Badge tone="good">
            {shown === s.active ? t("profiles.active") : t("profiles.thisRepo")}
          </Badge>
        )}
        {dirty > 0 && <Badge tone="warn">{t("profiles.unsaved", { n: dirty })}</Badge>}
        <span className="ms-auto flex flex-wrap gap-2">
          {shown !== s.active && (
            <Button
              variant="secondary"
              onClick={() => setConfirm({ kind: "activate", scope: "global" })}
            >
              {t("profiles.makeActive")}
            </Button>
          )}
          {shown !== s.here && (
            <Button
              variant="secondary"
              onClick={() => setConfirm({ kind: "activate", scope: "repo" })}
            >
              {t("profiles.useForRepo")}
            </Button>
          )}
          {s.here !== s.active && shown === s.here && (
            <Button
              variant="secondary"
              onClick={() =>
                void act(() => request("profiles.unbindRepo", {}), t("profiles.unbound"))
              }
            >
              {t("profiles.unbind")}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              const n = window.prompt(t("profiles.newPrompt"));
              if (!n) return;
              if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(n))
                return setMsg({ tone: "bad", text: t("profiles.badName") });
              if (s.names.includes(n))
                return setMsg({ tone: "bad", text: t("profiles.exists", { name: n }) });
              void act(
                () => request("profiles.create", { name: n, from: shown }),
                t("profiles.created", { name: n }),
              ).then(() => setName(n));
            }}
          >
            {t("profiles.new")}
          </Button>
          {shown !== s.active && bound.length === 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                if (!confirmDelete || Date.now() - confirmDelete > 5000)
                  return setConfirmDelete(Date.now());
                setConfirmDelete(undefined);
                void act(
                  () => request("profiles.remove", { name: shown }),
                  t("profiles.removed", { name: shown }),
                ).then(() => setName(undefined));
              }}
            >
              {confirmDelete ? t("profiles.deleteConfirm") : t("profiles.delete")}
            </Button>
          )}
        </span>
      </div>
      {bound.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("profiles.boundTo", { repos: bound.join(", ") })}
        </p>
      )}
      {msg && (
        <p role="status" className={msg.tone === "ok" ? "text-success" : "text-danger"}>
          {msg.text}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t("profiles.filter")}</span>
        <input
          ref={filterRef}
          type="search"
          className={inputClass}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("profiles.filterHelp")}
        />
      </label>
      <SaveResultView
        result={result}
        onRebase={(current) => {
          dispatch({ type: "reset", base: current });
          setResult(undefined);
        }}
      />
      {(s.validation.errors.length > 0 || s.validation.warnings.length > 0) && (
        <Card className="flex flex-col gap-1 text-xs">
          {s.validation.errors.map((e) => (
            <p key={`e-${e.path}`} className="text-danger">
              ✗ {e.path}: {e.message}
              {e.fix && ` — ${e.fix}`}
            </p>
          ))}
          {s.validation.warnings.map((w) => (
            <p key={`w-${w.path}`} className="text-warning">
              ! {w.path}: {w.message}
            </p>
          ))}
        </Card>
      )}

      <RolesEditor
        doc={draft.doc}
        edit={edit}
        models={catalog.data?.models ?? []}
        enforcement={s.enforcement}
        filter={filter}
      />
      <GeneralEditor
        doc={draft.doc}
        edit={edit}
        models={catalog.data?.models ?? []}
        standIns={s.standIns}
        filter={filter}
      />

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-background py-2">
        <Button
          variant="secondary"
          disabled={draft.past.length === 0}
          onClick={() => dispatch({ type: "undo" })}
        >
          {t("profiles.undo")}
        </Button>
        <Button
          variant="secondary"
          disabled={draft.future.length === 0}
          onClick={() => dispatch({ type: "redo" })}
        >
          {t("profiles.redo")}
        </Button>
        <Button
          variant="secondary"
          disabled={dirty === 0}
          onClick={() => setConfirm({ kind: "discard" })}
        >
          {t("profiles.discard")}
        </Button>
        <Button className="ms-auto" disabled={dirty === 0} onClick={() => setPreview(true)}>
          {t("profiles.save")}
        </Button>
      </div>
      {preview && (
        <SavePreview
          draft={draft}
          activeHere={shown === s.here}
          onCancel={() => setPreview(false)}
          onSave={(a) => void save(a)}
        />
      )}
      {confirm?.kind === "activate" && (
        <ConfirmDialog
          title={t("profiles.activateTitle")}
          detail={`${t(
            confirm.scope === "global" ? "profiles.activateGlobal" : "profiles.activateRepo",
            { name: shown },
          )}${dirty ? ` ${t("profiles.activateDirty")}` : ""}`}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            const scope = confirm.scope;
            setConfirm(undefined);
            void act(
              async () => {
                await request("profiles.get", { name: shown });
                await request("profiles.activate", { name: shown, scope });
              },
              scope === "global"
                ? t("profiles.activated", { name: shown })
                : t("profiles.bound", { name: shown }),
            );
          }}
        />
      )}
      {confirm?.kind === "discard" && (
        <ConfirmDialog
          title={t("profiles.discardConfirm")}
          detail={t("profiles.discardDetail")}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            setConfirm(undefined);
            void request("profiles.get", { name: shown }).then((fresh) => {
              if (!deepEqual(fresh.profile, draft.base))
                setMsg({ tone: "bad", text: t("profiles.conflict") });
              dispatch({ type: "reset", base: fresh.profile });
            });
          }}
        />
      )}
      {confirm?.kind === "switch" && (
        <ConfirmDialog
          title={t("profiles.discardConfirm")}
          detail={t("profiles.discardDetail")}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            setName(confirm.name);
            setResult(undefined);
            setConfirm(undefined);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  detail,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);
  return (
    <div
      ref={dialog}
      className="fixed inset-0 z-20 flex items-center justify-center bg-background/90 p-4"
      role="presentation"
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-detail"
        className="flex w-full max-w-md flex-col gap-3 bg-background"
      >
        <h2 id="confirm-title" className="font-semibold">
          {title}
        </h2>
        <p id="confirm-detail" className="text-muted-foreground">
          {detail}
        </p>
        <div className="flex justify-end gap-2">
          <Button ref={cancel} variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("profiles.confirm")}</Button>
        </div>
      </Card>
    </div>
  );
}

function SaveResultView({
  result,
  onRebase,
}: {
  result: ProfileSaveResult | undefined;
  onRebase: (p: ProfileDoc) => void;
}) {
  if (!result) return null;
  if (result.status === "saved")
    return (
      <Card className="text-xs">
        <p className="text-success">
          {t("profiles.saved", { n: result.diff.length })}
          {result.activated && ` · ${t("profiles.nowActive")}`}
        </p>
        {result.warnings.map((w) => (
          <p key={w.path} className="text-warning">
            ! {w.path}: {w.message}
          </p>
        ))}
        {result.newSessionNeededFor.length > 0 && (
          <p className="text-warning">
            {t("profiles.newSession", { agents: result.newSessionNeededFor.join(", ") })}
          </p>
        )}
        <p className="text-muted-foreground">{t("profiles.appliesWhen")}</p>
      </Card>
    );
  if (result.status === "refused")
    return (
      <Card className="text-xs">
        <p className="text-danger">{t("profiles.refused")}</p>
        {result.errors.map((e) => (
          <p key={e.path} className="text-danger">
            ✗ {e.path}: {e.message}
            {e.fix && ` — ${e.fix}`}
          </p>
        ))}
      </Card>
    );
  if (result.status === "conflict")
    return (
      <Card className="text-xs">
        <p className="text-warning">{t("profiles.conflict")}</p>
        <Button variant="secondary" onClick={() => onRebase(result.current)}>
          {t("profiles.reload")}
        </Button>
      </Card>
    );
  return <p className="text-xs text-muted-foreground">{t("profiles.unchanged")}</p>;
}

function SavePreview({
  draft,
  activeHere,
  onSave,
  onCancel,
}: {
  draft: Draft;
  activeHere: boolean;
  onSave: (a: "no" | "global" | "repo") => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);
  const patch = profilePatch(draft.base, draft.doc);
  const lines = patch ? describePatch(draft.base, patch) : [];
  const fmt = (v: unknown) =>
    v === undefined || v === null ? "—" : typeof v === "string" ? v : JSON.stringify(v);
  return (
    <div
      ref={dialog}
      className="fixed inset-0 z-10 flex items-center justify-center bg-background/90 p-4"
      role="presentation"
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-preview-title"
        className="flex max-h-full w-full max-w-2xl flex-col gap-2 overflow-auto bg-background"
      >
        <h2 id="save-preview-title" className="font-semibold">
          {t("profiles.previewTitle")}
        </h2>
        <ul className="font-mono text-xs">
          {lines.map((l) => (
            <li key={l.path}>
              {l.path}: <span className="text-danger">{fmt(l.before)}</span> →{" "}
              <span className="text-success">{fmt(l.after)}</span>
            </li>
          ))}
          {draft.treatLikes.map((tl) => (
            <li key={tl.rung}>{t("profiles.treatLikeLine", tl)}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("profiles.appliesWhen")}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSave("no")}>{t("common.save")}</Button>
          {!activeHere && (
            <Button variant="secondary" onClick={() => onSave("global")}>
              {t("profiles.saveActivate")}
            </Button>
          )}
          {!activeHere && (
            <Button variant="secondary" onClick={() => onSave("repo")}>
              {t("profiles.saveRepo")}
            </Button>
          )}
          <Button ref={cancel} variant="ghost" className="ms-auto" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function rungsFor(models: CatalogModel[], role: string) {
  return models
    .filter((m) => m.roles.includes(role))
    .flatMap((m) => m.rungs.map((r) => ({ ...r, model: m.name, listed: m.listed })));
}

function RolesEditor({
  doc,
  edit,
  models,
  enforcement,
  filter,
}: {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  enforcement: Record<string, string>;
  filter: string;
}) {
  const [treatFor, setTreatFor] = useState<{ role: string; rung: string; like: string }>();
  const scored = useMemo(
    () =>
      models.flatMap((m) =>
        m.rungs.filter((r) => r.scored).map((r) => r.rung.split(":")[1] ?? r.rung),
      ),
    [models],
  );
  const needle = filter.trim().toLowerCase();
  const roles = ROLES.filter((role) => {
    const cfg = doc.roles[role] ?? { enabled: false, access: "read-only", rungs: [] };
    return !needle || `roles ${role} access ${JSON.stringify(cfg)}`.toLowerCase().includes(needle);
  });
  if (roles.length === 0) return null;
  return (
    <Section title={t("profiles.roles")}>
      <p className="text-xs text-muted-foreground">{t("profiles.help.roles")}</p>
      <div className="flex flex-col gap-2">
        {roles.map((role) => {
          const cfg = doc.roles[role] ?? { enabled: false, access: "read-only", rungs: [] };
          const available = rungsFor(models, role).filter((r) => !cfg.rungs.includes(r.rung));
          return (
            <Card key={role} className={cn("flex flex-col gap-1.5", !cfg.enabled && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 font-medium">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) =>
                      edit((d) => {
                        d.roles[role] = { ...cfg, enabled: e.target.checked };
                      })
                    }
                  />
                  {role}
                </label>
                <select
                  aria-label={t("profiles.access", { role })}
                  className={inputClass}
                  value={cfg.access}
                  onChange={(e) =>
                    edit((d) => {
                      d.roles[role] = { ...cfg, access: e.target.value };
                    })
                  }
                >
                  {ACCESS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                {enforcement[role] && (
                  <Badge tone={enforcement[role] === "enforced" ? "good" : "warn"}>
                    {enforcement[role]}
                  </Badge>
                )}
                <label className="ms-auto flex items-center gap-1 text-xs">
                  {t("profiles.defaultRung")}
                  <select
                    className={inputClass}
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
              </div>
              <ol className="flex flex-col gap-0.5">
                {cfg.rungs.map((r, i) => (
                  <li key={r} className="flex items-center gap-1 font-mono text-xs">
                    <span className="w-4 text-muted-foreground">{i + 1}</span>
                    <span className="flex-1">{r}</span>
                    <Button
                      variant="ghost"
                      className="px-1 py-0"
                      aria-label={t("profiles.up")}
                      disabled={i === 0}
                      onClick={() =>
                        edit((d) => {
                          const rs = [...cfg.rungs];
                          [rs[i - 1], rs[i]] = [rs[i] as string, rs[i - 1] as string];
                          d.roles[role] = { ...cfg, rungs: rs };
                        })
                      }
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-1 py-0"
                      aria-label={t("profiles.down")}
                      disabled={i === cfg.rungs.length - 1}
                      onClick={() =>
                        edit((d) => {
                          const rs = [...cfg.rungs];
                          [rs[i + 1], rs[i]] = [rs[i] as string, rs[i + 1] as string];
                          d.roles[role] = { ...cfg, rungs: rs };
                        })
                      }
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-1 py-0"
                      aria-label={t("profiles.remove")}
                      onClick={() =>
                        edit((d) => {
                          const next = { ...cfg, rungs: cfg.rungs.filter((x) => x !== r) };
                          if (next.defaultRung && !next.rungs.includes(next.defaultRung))
                            delete next.defaultRung;
                          d.roles[role] = next;
                        })
                      }
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ol>
              <select
                aria-label={t("profiles.addRung", { role })}
                className={cn(inputClass, "text-xs")}
                value=""
                onChange={(e) => {
                  const pick = available.find((a) => a.rung === e.target.value);
                  if (!pick) return;
                  if (!pick.scored && !pick.treatLike)
                    setTreatFor({ role, rung: pick.rung, like: "" });
                  else
                    edit((d) => {
                      d.roles[role] = { ...cfg, rungs: [...cfg.rungs, pick.rung] };
                    });
                }}
              >
                <option value="">{t("profiles.addRungPlaceholder")}</option>
                {available.map((a) => (
                  <option key={a.rung} value={a.rung}>
                    {a.rung}
                    {!a.scored && !a.treatLike ? ` — ${t("profiles.unscored")}` : ""}
                    {a.listed === false ? ` — ${t("models.notListed")}` : ""}
                  </option>
                ))}
              </select>
              {treatFor?.role === role && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {t("profiles.treatPrompt", { rung: treatFor.rung })}
                  <select
                    className={inputClass}
                    value={treatFor.like}
                    onChange={(e) => setTreatFor({ ...treatFor, like: e.target.value })}
                  >
                    <option value="">{t("models.pickScored")}</option>
                    {[...new Set(scored)].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!treatFor.like}
                    onClick={() => {
                      edit(
                        (d) => {
                          d.roles[role] = { ...cfg, rungs: [...cfg.rungs, treatFor.rung] };
                        },
                        { rung: treatFor.rung, like: treatFor.like },
                      );
                      setTreatFor(undefined);
                    }}
                  >
                    {t("profiles.addWithTreat")}
                  </Button>
                  <Button variant="ghost" onClick={() => setTreatFor(undefined)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

function num(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) || n <= 0 ? undefined : n;
}

function GeneralEditor({
  doc,
  edit,
  models,
  standIns,
  filter,
}: {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  standIns: { from: string; to: string; inferred: boolean }[];
  filter: string;
}) {
  const [fo, setFo] = useState({ from: "", to: "" });
  const ladderRungs = [
    ...new Set(
      Object.values(doc.roles)
        .filter((r) => r.enabled)
        .flatMap((r) => r.rungs),
    ),
  ].filter((r) => !r.startsWith("claude:"));
  const allRungs = models.flatMap((m) =>
    m.rungs.filter((r) => r.scored || r.treatLike).map((r) => r.rung),
  );
  const visible = (path: string, value: unknown) =>
    !filter.trim() ||
    `${path} ${JSON.stringify(value)}`.toLowerCase().includes(filter.trim().toLowerCase());
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {visible("routing objective jev", { objective: doc.objective, jev: doc.jev }) && (
        <Section title={t("profiles.routing")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.routing")}</p>
          <label className="flex items-center gap-2">
            {t("profiles.objective")}
            <select
              className={inputClass}
              value={doc.objective}
              onChange={(e) =>
                edit((d) => {
                  d.objective = e.target.value;
                })
              }
            >
              <option value="cost">cost</option>
              <option value="speed">speed</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            {t("profiles.jev")}
            <select
              className={inputClass}
              value={doc.jev.use}
              onChange={(e) =>
                edit((d) => {
                  d.jev.use = e.target.value;
                })
              }
            >
              <option value="auto">auto</option>
              <option value="off">off</option>
            </select>
          </label>
        </Section>
      )}
      {visible("billing", doc.billing) && (
        <Section title={t("profiles.billing")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.billing")}</p>
          {Object.entries(doc.billing).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-xs">
              <span className="w-24">{k}</span>
              <select
                className={inputClass}
                value={v}
                onChange={(e) =>
                  edit((d) => {
                    d.billing[k] = e.target.value;
                  })
                }
              >
                {BILLING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </Section>
      )}
      {visible("harness isolation", doc.isolated) && (
        <Section title={t("profiles.harness")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.harness")}</p>
          {Object.entries(doc.isolated).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) =>
                  edit((d) => {
                    d.isolated[k] = e.target.checked;
                  })
                }
              />
              {k}{" "}
              <span className="text-xs text-muted-foreground">
                {v ? t("profiles.isolated") : t("profiles.ownConfig")}
              </span>
            </label>
          ))}
        </Section>
      )}
      {visible("budget minutes tokens usd", doc.budget) && (
        <Section title={t("profiles.budget")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.budget")}</p>
          {(["minutes", "tokens", "usd"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs">
              <span className="w-16">{k}</span>
              <input
                type="number"
                min={0}
                className={inputClass}
                placeholder={t("profiles.noCap")}
                value={doc.budget[k] ?? ""}
                onChange={(e) =>
                  edit((d) => {
                    const n = num(e.target.value);
                    if (n === undefined) delete d.budget[k];
                    else d.budget[k] = n;
                  })
                }
              />
            </label>
          ))}
        </Section>
      )}
      {visible("failover stand in", doc.failover) && (
        <Section title={t("profiles.failover")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.failover")}</p>
          <ul className="font-mono text-xs">
            {Object.entries(doc.failover).map(([from, to]) => (
              <li key={from} className="flex items-center gap-1">
                <span className="flex-1">
                  {from} → {to}
                  {standIns.find((s) => s.from === from && s.to === to)?.inferred
                    ? ` (${t("profiles.inferred")})`
                    : ""}
                </span>
                <Button
                  variant="ghost"
                  className="px-1 py-0"
                  aria-label={t("profiles.remove")}
                  onClick={() =>
                    edit((d) => {
                      delete d.failover[from];
                    })
                  }
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1 text-xs">
            <select
              className={inputClass}
              value={fo.from}
              onChange={(e) => setFo({ ...fo, from: e.target.value })}
            >
              <option value="">{t("profiles.failoverFrom")}</option>
              {ladderRungs.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={fo.to}
              onChange={(e) => setFo({ ...fo, to: e.target.value })}
            >
              <option value="">{t("profiles.failoverTo")}</option>
              {allRungs
                .filter((r) => r.split(":")[0] !== fo.from.split(":")[0])
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
            <Button
              variant="secondary"
              disabled={!fo.from || !fo.to}
              onClick={() => {
                edit((d) => {
                  d.failover[fo.from] = fo.to;
                });
                setFo({ from: "", to: "" });
              }}
            >
              {t("profiles.add")}
            </Button>
          </div>
        </Section>
      )}
      {visible("timeouts limits idle wall preflight heavy", {
        timeouts: doc.timeouts,
        preflight: doc.preflight,
        heavy: doc.heavy,
      }) && (
        <Section title={t("profiles.timeouts")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.timeouts")}</p>
          {(["idleMin", "wallMin"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs">
              <span className="w-16">{k}</span>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={doc.timeouts[k]}
                onChange={(e) => {
                  const n = num(e.target.value);
                  if (n)
                    edit((d) => {
                      d.timeouts[k] = n;
                    });
                }}
              />
            </label>
          ))}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={doc.preflight.confirm}
              onChange={(e) =>
                edit((d) => {
                  d.preflight.confirm = e.target.checked;
                })
              }
            />{" "}
            {t("profiles.preflightConfirm")}
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span className="w-16">{t("profiles.heavy")}</span>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder="cpus/2"
              value={typeof doc.heavy === "number" ? doc.heavy : ""}
              onChange={(e) => {
                const n = num(e.target.value);
                edit((d) => {
                  d.heavy = n ?? "cpus/2";
                });
              }}
            />
          </label>
        </Section>
      )}
      {visible("notify push notifications", doc.notify) && (
        <Section title={t("profiles.notify")}>
          <p className="text-xs text-muted-foreground">{t("profiles.help.notify")}</p>
          {NOTIFY.map((n) => (
            <label key={n} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={doc.notify.includes(n)}
                onChange={(e) =>
                  edit((d) => {
                    d.notify = e.target.checked
                      ? [...d.notify, n]
                      : d.notify.filter((x) => x !== n);
                  })
                }
              />{" "}
              {n}
            </label>
          ))}
        </Section>
      )}
    </div>
  );
}
