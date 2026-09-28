import type { RecordLite, RunDetail, RunListItem } from "@cathouse/protocol";
import { Badge, Button, Card, cn, Empty, ErrorText, Meter, Section } from "@cathouse/ui";
import { useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { errorText, usePoll } from "../lib/usePoll";
import { mmss } from "../session/format";

export function ago(iso: string | number | undefined): string {
  if (iso === undefined) return "";
  const secs = Math.max(0, (Date.now() - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000);
  if (secs < 60) return t("time.secs", { n: Math.round(secs) });
  if (secs < 3600) return t("time.mins", { n: Math.round(secs / 60) });
  if (secs < 86400) return t("time.hours", { n: Math.round(secs / 3600) });
  return t("time.days", { n: Math.round(secs / 86400) });
}

export function RunRow({ run, onOpen }: { run: RunListItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-wrap items-center gap-2 px-2 py-1.5 text-start hover:bg-secondary"
      >
        <Badge tone={run.live > 0 ? "good" : "neutral"}>
          {run.live > 0 ? t("runs.live", { n: run.live }) : t("runs.idle")}
        </Badge>
        <span className="font-medium">{run.title}</span>
        <span className="text-xs text-muted-foreground">
          {t("runs.roleRuns", { n: run.roleRuns })}
          {run.landed !== undefined && ` · ${t("runs.landed", { n: run.landed })}`}
          {typeof run.budgetFraction === "number" &&
            ` · ${t("runs.budget", { pct: Math.round(run.budgetFraction * 100) })}`}
        </span>
        <span className="ms-auto text-xs text-muted-foreground">{ago(run.createdAt)}</span>
      </button>
    </li>
  );
}

export function RunsPage({
  openRun,
  onOpenRun,
  onContinue,
  canStart,
}: {
  openRun?: string | undefined;
  onOpenRun: (id: string | undefined) => void;
  onContinue: () => void;
  canStart: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const list = usePoll(() => request("runs.list", {}), 2000, "runs", paused || !!openRun);
  if (openRun) {
    return (
      <RunDetailView
        id={openRun}
        onBack={() => onOpenRun(undefined)}
        onContinue={onContinue}
        canStart={canStart}
      />
    );
  }
  return (
    <Section
      title={paused ? t("runs.paused") : t("runs.updated", { ago: ago(list.updatedAt) })}
      actions={
        <>
          <Button variant="secondary" onClick={list.refresh}>
            {t("common.refresh")}
          </Button>
          <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? t("runs.resume") : t("runs.pause")}
          </Button>
        </>
      }
    >
      {list.error && <ErrorText>{list.error}</ErrorText>}
      {list.data && list.data.corrupt > 0 && (
        <p className="text-warning">{t("runs.corrupt", { n: list.data.corrupt })}</p>
      )}
      {list.data?.runs.length === 0 && <Empty>{t("runs.empty")}</Empty>}
      {list.loading && !list.data && <Empty>{t("common.loading")}</Empty>}
      <ul className="divide-y divide-border rounded-sm border border-border">
        {list.data?.runs.map((r) => (
          <RunRow key={r.id} run={r} onOpen={() => onOpenRun(r.id)} />
        ))}
      </ul>
    </Section>
  );
}

function budgetCaps(b: NonNullable<RunDetail["budget"]>): string {
  return [
    b.minutes && `${Math.round(b.minutes.spent)}/${b.minutes.cap} min`,
    b.tokens && `${Math.round(b.tokens.spent / 1000)}k/${Math.round(b.tokens.cap / 1000)}k tokens`,
    b.usd && `$${b.usd.spent.toFixed(2)}/$${b.usd.cap}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function RunDetailView({
  id,
  onBack,
  onContinue,
  canStart,
}: {
  id: string;
  onBack: () => void;
  onContinue: () => void;
  canStart: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const run = usePoll(() => request("runs.get", { id }), 1000, `run-${id}`, paused);
  const [armed, setArmed] = useState<{ name: string; at: number }>();
  const [notice, setNotice] = useState<string>();
  const [reply, setReply] = useState<RecordLite>();
  const d = run.data;

  const cancel = async (name: string) => {
    if (!armed || armed.name !== name || Date.now() - armed.at > 5000) {
      setArmed({ name, at: Date.now() });
      return;
    }
    setArmed(undefined);
    try {
      const r = await request("runs.cancelRole", { id, name });
      setNotice(t("runs.cancelled", { name, status: r.status }));
    } catch (e) {
      setNotice(errorText(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← {t("runs.back")}
        </Button>
        <h2 className="text-base font-semibold">{d?.title ?? id}</h2>
        <span className="font-mono text-xs text-muted-foreground">{id}</span>
        <span className="ms-auto flex gap-2">
          <Button
            disabled={!canStart}
            title={t("runs.continueHelp")}
            onClick={() =>
              void request("session.resume", {})
                .then(onContinue)
                .catch((e: unknown) => setNotice(errorText(e)))
            }
          >
            {t("runs.continue")}
          </Button>
          <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? t("runs.resume") : t("runs.pause")}
          </Button>
        </span>
      </div>
      {run.error && <ErrorText>{run.error}</ErrorText>}
      {notice && <p role="status">{notice}</p>}
      {d && (
        <>
          <p className="text-xs text-muted-foreground">
            {d.repo} · {t("runs.started", { ago: ago(d.createdAt) })} ·{" "}
            {t("runs.updated", { ago: ago(run.updatedAt) })}
          </p>
          {d.budget && (
            <Section title={t("runs.budgetTitle")}>
              <Meter fraction={d.budget.fraction} label={t("runs.budgetTitle")} />
              <span className="text-xs text-muted-foreground">{budgetCaps(d.budget)}</span>
            </Section>
          )}
          <Section title={t("runs.totals")}>
            <p className="text-xs">
              {t("runs.totalsLine", {
                runs: d.totals.runs,
                ok: d.totals.ok,
                input: Math.round(d.totals.tokens.input / 1000),
                output: Math.round(d.totals.tokens.output / 1000),
                cost: d.totals.costUsd === null ? "–" : `$${d.totals.costUsd.toFixed(2)}`,
                agents: d.agents.runs,
                minutes: Math.round(d.totals.wallMinutes),
              })}
            </p>
            {d.totals.notOk.length > 0 && (
              <p className="text-xs text-danger">{d.totals.notOk.join(", ")}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("runs.jevLine", { decisions: d.jev.decisions, fallbacks: d.jev.fallbacks })}
            </p>
          </Section>
          <Section title={t("runs.liveTitle")}>
            {d.live.length === 0 ? (
              <Empty>{t("runs.noLive")}</Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {d.live.map((l) => (
                  <li key={l.name} className="flex flex-wrap items-center gap-2">
                    <Badge tone="good">{l.state}</Badge>
                    <span className="font-medium">{l.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{l.rung}</span>
                    <span className="text-xs tabular-nums">{mmss(l.secs)}</span>
                    <Button
                      variant="secondary"
                      className="ms-auto"
                      onClick={() => void cancel(l.name)}
                    >
                      {armed?.name === l.name ? t("runs.cancelConfirm") : t("runs.cancel")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {d.climbs.length > 0 && (
            <Section title={t("runs.climbsTitle")}>
              <ul className="flex flex-col gap-0.5 font-mono text-xs">
                {d.climbs.map((c) => (
                  <li key={`${c.lane}-${c.at}`}>
                    {c.lane}: {c.from ?? "?"} → {c.rung} · {c.reason}
                    {c.env && ` ${t("runs.environment")}`}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title={t("runs.routesTitle")}>
            {d.routes.length === 0 ? (
              <Empty>{t("runs.noRoutes")}</Empty>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-start">{t("runs.col.lane")}</th>
                    <th className="text-start">{t("runs.col.role")}</th>
                    <th className="text-start">{t("runs.col.source")}</th>
                    <th className="text-start">{t("runs.col.kind")}</th>
                    <th className="text-start">{t("runs.col.rung")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.routes.map((r) => (
                    <tr key={r.lane}>
                      <td>{r.lane}</td>
                      <td>{r.role}</td>
                      <td>{r.decidedBy}</td>
                      <td>{[r.kind, r.difficulty].filter(Boolean).join("/")}</td>
                      <td className="font-mono">{r.rung}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
          <Section title={t("runs.landedTitle")}>
            {d.milestones.length === 0 ? (
              <Empty>{t("runs.noLanded")}</Empty>
            ) : (
              <ul className="font-mono text-xs">
                {d.milestones.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t("runs.recordsTitle")}>
            {d.records.length === 0 ? (
              <Empty>{t("runs.noRecords")}</Empty>
            ) : (
              <ul className="divide-y divide-border rounded-sm border border-border text-xs">
                {d.records.map((r) => (
                  <li key={r.dispatchId}>
                    <button
                      type="button"
                      className="flex w-full flex-wrap gap-2 px-2 py-1 text-start hover:bg-secondary"
                      onClick={() => setReply(reply?.dispatchId === r.dispatchId ? undefined : r)}
                    >
                      <Badge tone={r.status === "ok" ? "good" : "bad"}>{r.status}</Badge>
                      <span className="font-medium">{r.name}</span>
                      <span className="font-mono text-muted-foreground">{r.rung}</span>
                      <span>{mmss(r.secs)}</span>
                      {r.replyStatus && <span>STATUS: {r.replyStatus}</span>}
                      {r.violations.length > 0 && (
                        <span className="text-danger">
                          {t("runs.violations", { n: r.violations.length })}
                        </span>
                      )}
                    </button>
                    {reply?.dispatchId === r.dispatchId && <RoleDetail runId={id} record={r} />}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t("runs.stateTitle")}>
            <pre className="max-h-80 overflow-auto rounded-sm bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
              {d.stateMd}
            </pre>
          </Section>
          {d.warnings.length > 0 && (
            <Section title={t("runs.warningsTitle")}>
              <ul className="text-xs text-warning">
                {d.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function RoleDetail({ runId, record }: { runId: string; record: RecordLite }) {
  const reply = usePoll(
    () => request("runs.reply", { id: runId, name: record.name }),
    0,
    `reply-${record.dispatchId}`,
  );
  const [debug, setDebug] = useState<Awaited<ReturnType<typeof loadDebug>>>();
  const loadDebug = () => request("runs.debug", { id: runId, name: record.name });
  return (
    <Card className={cn("m-2 flex flex-col gap-2")}>
      <p className="text-muted-foreground">
        {record.replyWhy && `${record.replyWhy} · `}
        {t("runs.tokensLine", {
          input: Math.round(record.tokens.input / 1000),
          output: Math.round(record.tokens.output / 1000),
        })}
        {record.changedOwned.length > 0 &&
          ` · ${t("runs.changed", { files: record.changedOwned.join(", ") })}`}
      </p>
      {record.violations.length > 0 && (
        <p className="text-danger">
          {t("runs.violationFiles", { files: record.violations.join(", ") })}
        </p>
      )}
      {reply.error && <ErrorText>{reply.error}</ErrorText>}
      <pre className="max-h-72 overflow-auto rounded-sm bg-background p-2 font-mono whitespace-pre-wrap">
        {reply.data?.reply || t("common.loading")}
      </pre>
      <div>
        <Button variant="secondary" onClick={() => void loadDebug().then(setDebug)}>
          {t("runs.debug")}
        </Button>
      </div>
      {debug?.map((dd) => (
        <div key={dd.dispatchId} className="flex flex-col gap-1">
          <p className="font-mono">
            {dd.dispatchId} ·{" "}
            {dd.exit ? `${dd.exit.reason} (${dd.exit.code ?? dd.exit.signal})` : t("runs.noExit")}
          </p>
          {(["stderrTail", "eventsTail", "supervisorTail"] as const).map((k) =>
            dd[k].length > 0 ? (
              <details key={k}>
                <summary>{k}</summary>
                <pre className="max-h-60 overflow-auto bg-background p-2 font-mono whitespace-pre-wrap">
                  {dd[k].join("\n")}
                </pre>
              </details>
            ) : null,
          )}
        </div>
      ))}
    </Card>
  );
}
