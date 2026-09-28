import { ROLES } from "@cathouse/protocol";
import { Badge, Button, Empty, ErrorText, inputClass, Section } from "@cathouse/ui";
import { useMemo, useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
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
      q.refresh();
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  const saveTreat = async () => {
    if (!treat?.like) return;
    try {
      await request("catalog.treatLike", treat);
      setMsg(t("models.treated", treat));
      setTreat(undefined);
      q.refresh();
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  return (
    <Section
      title={t("models.title", { n: q.data?.total ?? 0 })}
      actions={
        <Button variant="secondary" onClick={() => void refresh()}>
          {t("models.refresh")}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={t("models.role")}
          className={inputClass}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">{t("models.anyRole")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          aria-label={t("models.backend")}
          className={inputClass}
          value={backend}
          onChange={(e) => setBackend(e.target.value)}
        >
          <option value="">{t("models.anyBackend")}</option>
          {backends.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          aria-label={t("models.search")}
          placeholder={t("models.search")}
          className={inputClass}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={scoredOnly}
            onChange={(e) => setScoredOnly(e.target.checked)}
          />{" "}
          {t("models.scoredOnly")}
        </label>
      </div>
      {msg && (
        <p role="status" className="text-xs">
          {msg}
        </p>
      )}
      {q.error && <ErrorText>{q.error}</ErrorText>}
      {q.data?.models.length === 0 && <Empty>{t("models.none")}</Empty>}
      <ul className="flex flex-col gap-2">
        {q.data?.models.map((m) => (
          <li key={`${m.backend}-${m.id}`} className="rounded-sm border border-border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{m.name}</span>
              <Badge>{m.backend}</Badge>
              {m.listed === false && <Badge tone="warn">{t("models.notListed")}</Badge>}
              <span className="text-xs text-muted-foreground">{m.roles.join(", ")}</span>
            </div>
            {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
            <div className="mt-1 flex flex-wrap gap-1">
              {m.rungs.map((r) => (
                <button
                  key={r.rung}
                  type="button"
                  title={
                    r.why ??
                    (r.treatLike ? t("models.treatLikeTitle", { like: r.treatLike }) : r.rung)
                  }
                  onClick={() => !r.scored && setTreat({ rung: r.rung, like: "" })}
                  className={`rounded-sm border px-1.5 font-mono text-xs ${r.enabled ? "border-success" : "border-border text-muted-foreground"}`}
                >
                  {r.rung.split("#")[1]}
                  {r.treatLike && " ≈"}
                  {!r.scored && !r.treatLike && " ?"}
                  {r.costTier !== undefined && (
                    <span className="ms-1 text-muted-foreground">${r.costTier}</span>
                  )}
                </button>
              ))}
            </div>
            {treat && m.rungs.some((r) => r.rung === treat.rung) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{treat.rung}</span> {t("models.treatAs")}
                <select
                  className={inputClass}
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
                <Button disabled={!treat.like} onClick={() => void saveTreat()}>
                  {t("common.save")}
                </Button>
                <Button variant="ghost" onClick={() => setTreat(undefined)}>
                  {t("common.cancel")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("models.legend")}</p>
    </Section>
  );
}
