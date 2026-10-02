import type { Issue, ProfileDoc } from "@cathouse/protocol";
import {
  Button,
  cn,
  ErrorText,
  Icon,
  inputClass,
  Menu,
  MenuItem,
  MenuSeparator,
} from "@cathouse/ui";
import { type Dispatch, useEffect, useReducer, useRef, useState } from "react";
import { request, viewState } from "../../lib/rpc";
import { t } from "../../lib/strings";
import { toast } from "../../lib/toasts";
import { errorText, usePoll } from "../../lib/usePoll";
import {
  type Draft,
  type DraftAction,
  dirtyCount,
  draftReducer,
  initDraft,
  type Submitted,
  saveOutcome,
} from "./profileDraft";
import { type Edit, RolesEditor } from "./RolesEditor";
import { SettingsEditor } from "./SettingsEditor";

type SaveStatus = "idle" | "saving" | "saved" | "error";
const SAVE_DELAY_MS = 600;

/**
 * Every edit saves itself: after a short pause the draft's difference goes to catherd through
 * `profiles.save` (one request at a time; edits made meanwhile ride the next one). A success toast
 * offers Undo, which is just another edit back to the previous profile.
 */
function useAutoSave(
  name: string | undefined,
  draft: Draft | undefined,
  dispatch: Dispatch<DraftAction>,
  onDone: () => void,
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [refused, setRefused] = useState<Issue[]>([]);
  const inFlight = useRef(false);
  const [tick, setTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` re-checks after a save lands
  useEffect(() => {
    if (!name || !draft || dirtyCount(draft) === 0 || inFlight.current) return;
    const timer = window.setTimeout(async () => {
      inFlight.current = true;
      setStatus("saving");
      const submitted: Submitted = {
        base: structuredClone(draft.base),
        doc: structuredClone(draft.doc),
        treatLikes: structuredClone(draft.treatLikes),
      };
      try {
        const r = await request("profiles.save", {
          name,
          base: submitted.base,
          draft: submitted.doc,
          treatLikes: submitted.treatLikes,
          activate: "no",
        });
        dispatch(saveOutcome(submitted, r));
        if (r.status === "saved" || r.status === "unchanged") {
          setStatus("saved");
          setRefused([]);
          const previous = submitted.base;
          toast(t("profiles.autoSaved"), "ok", {
            key: "profile-save",
            action: {
              label: t("profiles.undo"),
              run: () => dispatch({ type: "edit", fn: (d) => replaceDoc(d, previous) }),
            },
          });
          if (r.status === "saved" && r.newSessionNeededFor.length > 0)
            toast(t("profiles.newSession", { agents: r.newSessionNeededFor.join(", ") }), "info");
        } else if (r.status === "refused") {
          setStatus("error");
          setRefused(r.errors);
          toast(t("profiles.refusedShort"), "bad", { key: "profile-save" });
        } else {
          setStatus("idle");
          toast(t("profiles.conflictShort"), "info", { key: "profile-save" });
        }
        onDone();
      } catch (e) {
        setStatus("error");
        toast(errorText(e), "bad", { key: "profile-save" });
        dispatch({ type: "reset", base: submitted.base });
      } finally {
        inFlight.current = false;
        setTick((n) => n + 1);
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [name, draft, tick]);
  return { status, refused };
}

function replaceDoc(target: ProfileDoc, source: ProfileDoc) {
  for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key];
  Object.assign(target, structuredClone(source));
}

export function ProfilesPage() {
  const [name, setName] = useState<string>();
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
    (s: Draft | undefined, a: DraftAction | { type: "load"; base: ProfileDoc }) =>
      a.type === "load" ? initDraft(a.base) : s ? draftReducer(s, a) : s,
    undefined,
  );
  const [openRole, setOpenRole] = useState<string | undefined>(
    () => viewState.get<{ profileOpenRole?: string }>()?.profileOpenRole,
  );
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string>();
  useEffect(() => viewState.update({ profileOpenRole: openRole }), [openRole]);

  const loaded = state.data?.profile;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    const current = draftRef.current;
    // Take catherd's copy whenever nothing is waiting to be saved.
    if (loaded && (!current || current.base.name !== loaded.name || dirtyCount(current) === 0))
      dispatch({ type: "load", base: loaded });
  }, [loaded]);
  const shown = state.data?.profile.name;
  const { status, refused } = useAutoSave(shown, draft, dispatch, state.refresh);

  if (state.error && !state.data) return <ErrorText>{state.error}</ErrorText>;
  if (!state.data || !draft) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Icon name="spinner" />
        {t("common.loading")}
      </p>
    );
  }
  const s = state.data;
  const profileName = s.profile.name;
  const edit: Edit = (fn, treatLike) =>
    dispatch({ type: "edit", fn, ...(treatLike ? { treatLike } : {}) });
  const bound = s.bindings[profileName] ?? [];
  const repoPinned = s.here !== s.active;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok, "ok");
      state.refresh();
      return true;
    } catch (e) {
      toast(errorText(e), "bad");
      return false;
    }
  };
  // Picking a profile puts it to work: it becomes catherd's active profile in one step.
  const pick = (next: string) => {
    if (next === profileName) return;
    if (next === s.active || next === s.here) {
      setName(next);
      return;
    }
    void act(
      () => request("profiles.activate", { name: next, scope: "global" }),
      t("profiles.activated", { name: next }),
    ).then((ok) => ok && setName(next));
  };
  const deletable = s.names.filter(
    (n) => n !== s.active && n !== s.here && (s.bindings[n] ?? []).length === 0,
  );
  const issues = [
    ...refused.map((e) => ({ ...e, tone: "bad" as const })),
    ...s.validation.errors.map((e) => ({ ...e, tone: "bad" as const })),
    ...s.validation.warnings.map((w) => ({ ...w, tone: "warn" as const })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">{t("profiles.profile")}</span>
            <select
              className="min-h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-md bg-transparent ps-1.5 pe-7 text-base font-semibold hover:bg-surface"
              value={profileName}
              onChange={(e) => pick(e.target.value)}
            >
              {s.names.map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === s.active ? ` · ${t("profiles.active")}` : ""}
                  {n === s.here && n !== s.active ? ` · ${t("profiles.thisRepo")}` : ""}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              className="pointer-events-none absolute end-2 text-muted-foreground"
            />
          </label>
          <SaveIndicator status={status} />
          <Menu label={t("profiles.more")} trigger={<Icon name="more" />}>
            {(close) => (
              <>
                <MenuItem
                  icon="plus"
                  onSelect={() => {
                    close();
                    setCreating(true);
                  }}
                >
                  {t("profiles.newFrom", { name: profileName })}
                </MenuItem>
                {repoPinned && profileName === s.here ? (
                  <MenuItem
                    icon="x"
                    onSelect={() => {
                      close();
                      void act(
                        () => request("profiles.unbindRepo", {}),
                        t("profiles.unbound"),
                      ).then((ok) => ok && setName(undefined));
                    }}
                  >
                    {t("profiles.unbind")}
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon="folder"
                    onSelect={() => {
                      close();
                      void act(
                        () => request("profiles.activate", { name: profileName, scope: "repo" }),
                        t("profiles.bound", { name: profileName }),
                      );
                    }}
                  >
                    {t("profiles.pinToRepo")}
                  </MenuItem>
                )}
                {deletable.length > 0 && <MenuSeparator />}
                {deletable.map((n) => (
                  <MenuItem
                    key={n}
                    icon="trash"
                    danger
                    onSelect={() => {
                      if (confirmDelete !== n) return setConfirmDelete(n);
                      setConfirmDelete(undefined);
                      close();
                      void act(
                        () => request("profiles.remove", { name: n }),
                        t("profiles.removed", { name: n }),
                      );
                    }}
                  >
                    {confirmDelete === n
                      ? t("profiles.deleteConfirm")
                      : t("profiles.deleteNamed", { name: n })}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </div>
        <p className="m-0 px-1.5 text-xs text-muted-foreground">
          {profileName === s.here
            ? repoPinned
              ? t("profiles.pinnedHere")
              : t("profiles.inUse")
            : profileName === s.active
              ? t("profiles.activeButPinned", { name: s.here })
              : t("profiles.notInUse")}
          {repoPinned && profileName !== s.here && profileName === s.active && (
            <>
              {" · "}
              <button
                type="button"
                className="text-link hover:underline"
                onClick={() =>
                  void act(() => request("profiles.unbindRepo", {}), t("profiles.unbound"))
                }
              >
                {t("profiles.unpin")}
              </button>
            </>
          )}
          {bound.length > 0 && ` · ${t("profiles.boundTo", { repos: bound.join(", ") })}`}
        </p>
        {creating && (
          <NewProfile
            from={profileName}
            existing={s.names}
            onCancel={() => setCreating(false)}
            onCreate={async (newName) => {
              const ok = await act(
                async () => {
                  await request("profiles.create", { name: newName, from: profileName });
                  await request("profiles.activate", { name: newName, scope: "global" });
                },
                t("profiles.created", { name: newName }),
              );
              if (ok) {
                setCreating(false);
                setName(newName);
              }
              return ok;
            }}
          />
        )}
      </header>

      {issues.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 rounded-md bg-surface p-2 text-xs">
          {issues.map((e) => {
            const role = /^roles\.([\w-]+)/.exec(e.path)?.[1];
            return (
              <li key={`${e.tone}-${e.path}-${e.message}`} className="flex min-w-0 gap-1.5">
                <Icon
                  name="warning"
                  className={cn("mt-0.5", e.tone === "bad" ? "text-danger" : "text-warning")}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {role ? (
                    <button
                      type="button"
                      className="font-mono text-link hover:underline"
                      onClick={() => {
                        setOpenRole(role);
                        requestAnimationFrame(() =>
                          document
                            .getElementById(`role-${role}`)
                            ?.scrollIntoView({ block: "nearest" }),
                        );
                      }}
                    >
                      {e.path}
                    </button>
                  ) : (
                    <span className="font-mono">{e.path}</span>
                  )}
                  : {e.message}
                  {e.fix && <span className="text-muted-foreground"> — {e.fix}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <RolesEditor
        doc={draft.doc}
        edit={edit}
        models={catalog.data?.models ?? []}
        enforcement={s.enforcement}
        open={openRole}
        setOpen={setOpenRole}
      />
      <SettingsEditor
        doc={draft.doc}
        edit={edit}
        models={catalog.data?.models ?? []}
        standIns={s.standIns}
      />
      <p className="m-0 px-1 text-xs text-muted-foreground">{t("profiles.appliesWhen")}</p>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 px-1 text-xs",
        status === "error" ? "text-danger" : "text-muted-foreground",
      )}
    >
      <Icon name={status === "saving" ? "spinner" : status === "saved" ? "check" : "warning"} />
      <span className="hidden @[20rem]:inline">{t(`profiles.status.${status}`)}</span>
    </span>
  );
}

function NewProfile({
  from,
  existing,
  onCreate,
  onCancel,
}: {
  from: string;
  existing: string[];
  onCreate: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const value = name.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(value)) return setError(t("profiles.badName"));
    if (existing.includes(value)) return setError(t("profiles.exists", { name: value }));
    setError(undefined);
    setBusy(true);
    if (!(await onCreate(value))) setBusy(false);
  };
  return (
    <form
      className="mt-1 flex flex-col gap-1.5 rounded-md bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="new-profile" className="text-xs text-muted-foreground">
        {t("profiles.newFrom", { name: from })}
      </label>
      <div className="flex gap-1.5">
        <input
          id="new-profile"
          // biome-ignore lint/a11y/noAutofocus: opened by an explicit menu choice
          autoFocus
          className={cn(inputClass, "min-w-0 flex-1")}
          value={name}
          disabled={busy}
          placeholder={t("profiles.name")}
          aria-describedby={error ? "new-profile-error" : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
        />
        <Button type="submit" size="md" disabled={busy || !name.trim()}>
          {busy ? t("profiles.creating") : t("profiles.create")}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
      {error && (
        <p id="new-profile-error" role="alert" className="m-0 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
