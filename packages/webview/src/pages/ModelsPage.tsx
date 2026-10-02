import { ROLES } from "@cathouse/protocol";
import { Button, cn, Empty, ErrorText, Icon, IconButton, inputClass, Switch } from "@cathouse/ui";
import { useMemo, useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { toast } from "../lib/toasts";
import { errorText, usePoll } from "../lib/usePoll";

export function ModelsPage() {
  const [role, setRole] = useState("");
  const [backend, setBackend] = useState("");
  const [text, setText] = useState("");
  const [scoredOnly, setScoredOnly] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [treat, setTreat] = useState<{ rung: string; like: string }>();
  const key = JSON.stringify({ role, backend, text, scoredOnly });
  const q = usePoll(
    () =>
      request("catalog.query", {
        ...(role ? { role } : {}),
        ...(backend ? { backend } : {}),
        ...(text ? { text } : {}),
        scoredOnly,
      }),
    0,
    key,
  );
  const scored = useMemo(
    () =>
      (q.data?.models ?? []).flatMap((m) =>
        m.rungs.filter((r) => r.scored).map((r) => r.rung.split(":")[1] ?? r.rung),
      ),
    [q.data],
  );
  const backends = useMemo(
    () => [...new Set((q.data?.models ?? []).map((m) => m.backend))].sort(),
    [q.data],
  );

  const refresh = async () => {
    setMsg(t("models.refreshing"));
    try {
      const r = await request("catalog.refresh", {});
      setMsg(
        r
          .map(
            (b) => `${b.backend}: ${b.error ? `✗ ${b.error}` : t("models.count", { n: b.models })}`,
          )
          .join(" · "),
      );
      toast(t("models.count", { n: r.reduce((sum, b) => sum + b.models, 0) }), "ok");
      q.refresh();
    } catch (e) {
      const text = errorText(e);
      setMsg(text);
      toast(text, "bad");
    }
  };
  const saveTreat = async () => {
    if (!treat?.like) return;
    try {
      await request("catalog.treatLike", treat);
      setMsg(t("models.treated", treat));
      toast(t("models.treated", treat), "ok");
      setTreat(undefined);
      q.refresh();
    } catch (e) {
      const text = errorText(e);
      setMsg(text);
      toast(text, "bad");
    }
  };

  const pill = (on: boolean) =>
    cn(
      "min-h-6 shrink-0 rounded-full px-2.5 text-xs",
      on
        ? "bg-primary text-primary-foreground"
        : "bg-surface text-muted-foreground hover:bg-surface-hover",
    );
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">
          {t("tabs.models")}
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            {t("models.count", { n: q.data?.total ?? 0 })}
          </span>
        </h2>
        <IconButton icon="refresh" label={t("models.refresh")} onClick={() => void refresh()} />
      </header>
      <label className="relative flex items-center">
        <Icon
          name="search"
          className="pointer-events-none absolute start-2.5 text-muted-foreground"
        />
        <input
          type="search"
          aria-label={t("models.search")}
          placeholder={t("models.search")}
          className={cn(inputClass, "w-full ps-8")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0">
          <legend className="sr-only">{t("models.role")}</legend>
          <button
            type="button"
            aria-pressed={!role}
            className={pill(!role)}
            onClick={() => setRole("")}
          >
            {t("models.anyRole")}
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              className={pill(role === r)}
              onClick={() => setRole(role === r ? "" : r)}
            >
              {r}
            </button>
          ))}
        </fieldset>
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0">
          <legend className="sr-only">{t("models.backend")}</legend>
          <button
            type="button"
            aria-pressed={!backend}
            className={pill(!backend)}
            onClick={() => setBackend("")}
          >
            {t("models.anyBackend")}
          </button>
          {backends.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={backend === b}
              className={pill(backend === b)}
              onClick={() => setBackend(backend === b ? "" : b)}
            >
              {b}
            </button>
          ))}
          <span className="ms-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Switch checked={scoredOnly} onChange={setScoredOnly} label={t("models.scoredOnly")} />
            <span aria-hidden="true">{t("models.scoredOnly")}</span>
          </span>
        </fieldset>
      </div>
      {msg && (
        <p role="status" className="m-0 text-xs text-muted-foreground">
          {msg}
        </p>
      )}
      {q.error && <ErrorText>{q.error}</ErrorText>}
      {q.data?.models.length === 0 && <Empty>{t("models.none")}</Empty>}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {q.data?.models.map((m) => (
          <li
            key={`${m.backend}-${m.id}`}
            className="flex flex-col gap-1 rounded-md px-2 py-2 hover:bg-surface"
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground">{m.backend}</span>
              {m.listed === false && (
                <span className="text-xs text-warning">{t("models.notListed")}</span>
              )}
              <span className="ms-auto min-w-0 truncate text-xs text-muted-foreground">
                {m.roles.join(", ")}
              </span>
            </div>
            {m.notes && <p className="m-0 text-xs text-muted-foreground">{m.notes}</p>}
            <div className="flex flex-wrap gap-1">
              {m.rungs.map((r) => (
                <button
                  key={r.rung}
                  type="button"
                  title={
                    r.why ??
                    (r.treatLike ? t("models.treatLikeTitle", { like: r.treatLike }) : r.rung)
                  }
                  onClick={() => !r.scored && setTreat({ rung: r.rung, like: "" })}
                  className={cn(
                    "rounded-full px-2 font-mono text-xs leading-5",
                    r.enabled ? "bg-success/15 text-success" : "bg-surface text-muted-foreground",
                    !r.scored && "cursor-pointer hover:bg-surface-hover",
                  )}
                >
                  {r.enabled && "✓ "}
                  {r.rung.split("#")[1] ?? r.rung}
                  {r.treatLike && " ≈"}
                  {!r.scored && !r.treatLike && " ?"}
                  {r.costTier !== undefined && (
                    <span className="ms-1 opacity-70">${r.costTier}</span>
                  )}
                </button>
              ))}
            </div>
            {treat && m.rungs.some((r) => r.rung === treat.rung) && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface p-2 text-xs">
                <span className="font-mono">{treat.rung}</span> {t("models.treatAs")}
                <select
                  className={cn(inputClass, "min-w-0 max-w-full")}
                  value={treat.like}
                  onChange={(e) => setTreat({ ...treat, like: e.target.value })}
                >
                  <option value="">{t("models.pickScored")}</option>
                  {[...new Set(scored)].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!treat.like} onClick={() => void saveTreat()}>
                  {t("common.save")}
                </Button>
                <Button size="sm" variant="quiet" onClick={() => setTreat(undefined)}>
                  {t("common.cancel")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 px-1 text-xs text-muted-foreground">{t("models.legend")}</p>
    </div>
  );
}
