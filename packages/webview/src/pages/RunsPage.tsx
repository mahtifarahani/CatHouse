import type { RecordLite, RunDetail, RunListItem } from "@cathouse/protocol";
import {
  Button,
  Collapsible,
  cn,
  Dot,
  Empty,
  ErrorText,
  Icon,
  IconButton,
  Meter,
} from "@cathouse/ui";
import { type ReactNode, useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { errorText, usePoll } from "../lib/usePoll";
import { mmss, roleOfDispatch, rungParts } from "../session/format";

export function ago(iso: string | number | undefined): string {
  if (iso === undefined) return "";
  const secs = Math.max(0, (Date.now() - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000);
  if (secs < 60) return t("time.secs", { n: Math.round(secs) });
  if (secs < 3600) return t("time.mins", { n: Math.round(secs / 60) });
  if (secs < 86400) return t("time.hours", { n: Math.round(secs / 3600) });
  return t("time.days", { n: Math.round(secs / 86400) });
}

function RunRow({ run, onOpen }: { run: RunListItem; onOpen: () => void }) {
  const meta = [
    t("runs.roleRuns", { n: run.roleRuns }),
    run.landed !== undefined && t("runs.landed", { n: run.landed }),
    typeof run.budgetFraction === "number" &&
      t("runs.budget", { pct: Math.round(run.budgetFraction * 100) }),
    run.session &&
      t(run.session.live ? "runs.sessionLive" : "runs.session", { name: run.session.name }),
    run.continuedIn && t("runs.continuedIn", { name: run.continuedIn }),
  ].filter(Boolean);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-w-0 items-start gap-2.5 rounded-md px-2 py-2 text-start hover:bg-surface"
      >
        <Dot tone={run.live > 0 ? "good" : "neutral"} pulse={run.live > 0} className="mt-1.5" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-medium">{run.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{ago(run.createdAt)}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {run.live > 0 && (
              <span className="text-success">{t("runs.live", { n: run.live })} · </span>
            )}
            {meta.join(" · ")}
          </span>
        </span>
      </button>
    </li>
  );
}

/** All runs of the repo: what is live now first, then history. Opening one shows its detail. */
export function RunsPage({
  openRun,
  onOpenRun,
  onChat,
  canStart,
}: {
  openRun?: string | undefined;
  onOpenRun: (id: string | undefined) => void;
  onChat: () => void;
  canStart: boolean;
}) {
  const list = usePoll(() => request("runs.list", {}), 2000, "runs", !!openRun);
  if (openRun) {
    return (
      <RunDetailView
        id={openRun}
        onBack={() => onOpenRun(undefined)}
        onChat={onChat}
        canStart={canStart}
      />
    );
  }
  const runs = list.data?.runs ?? [];
  const live = runs.filter((r) => r.live > 0).length;
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">
          {t("tabs.runs")}
          {list.data && (
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {t("runs.summary", { n: runs.length })}
              {live > 0 && <span className="text-success"> · {t("runs.live", { n: live })}</span>}
            </span>
          )}
        </h2>
        <Button size="sm" onClick={onChat} disabled={!canStart}>
          <Icon name="plus" />
          {t("runs.newTask")}
        </Button>
      </header>
      {list.error && <ErrorText>{list.error}</ErrorText>}
      {list.data && list.data.corrupt > 0 && (
        <p className="m-0 text-xs text-warning">{t("runs.corrupt", { n: list.data.corrupt })}</p>
      )}
      {list.data && runs.length === 0 && <Empty>{t("runs.empty")}</Empty>}
      {list.loading && !list.data && <Empty>{t("common.loading")}</Empty>}
      <ul className="m-0 flex list-none flex-col p-0">
        {runs.map((r) => (
          <RunRow key={r.id} run={r} onOpen={() => onOpenRun(r.id)} />
        ))}
      </ul>
    </div>
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

function Label({ children }: { children: ReactNode }) {
  return (
    <h3 className="m-0 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-md bg-surface px-2.5 py-1.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-medium tabular-nums">{value}</span>
    </div>
  );
}

function RunDetailView({
  id,
  onBack,
  onChat,
  canStart,
}: {
  id: string;
  onBack: () => void;
  onChat: () => void;
  canStart: boolean;
}) {
  const run = usePoll(() => request("runs.get", { id }), 1500, `run-${id}`);
  const [armed, setArmed] = useState<{ name: string; at: number }>();
  const [notice, setNotice] = useState<string>();
  const [reply, setReply] = useState<string>();
  const [more, setMore] = useState(false);
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
      <header className="flex min-w-0 items-center gap-1">
        <IconButton icon="arrowLeft" label={t("runs.back")} onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-base font-semibold" title={d?.title ?? id}>
            {d?.title ?? id}
          </h2>
          {d && (
            <p className="m-0 truncate text-xs text-muted-foreground" title={`${id} · ${d.repo}`}>
              {t("runs.started", { ago: ago(d.createdAt) })} ·{" "}
              <span className="font-mono">{id}</span>
            </p>
          )}
        </div>
        <Button
          size="sm"
          disabled={!canStart}
          title={t("runs.continueHelp")}
          onClick={() =>
            void request("session.resume", {})
              .then(onChat)
              .catch((e: unknown) => setNotice(errorText(e)))
          }
        >
          <Icon name="chat" />
          <span className="hidden @[22rem]:inline">{t("runs.continue")}</span>
        </Button>
      </header>
      {run.error && <ErrorText>{run.error}</ErrorText>}
      {notice && (
        <p role="status" className="m-0 text-xs">
          {notice}
        </p>
      )}
      {d && (
        <>
          {d.live.length > 0 && (
            <section className="flex flex-col gap-1">
              <Label>{t("runs.liveTitle")}</Label>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {d.live.map((l) => {
                  const rung = rungParts(l.rung);
                  const role = roleOfDispatch(l.name);
                  return (
                    <li
                      key={l.name}
                      className="flex min-w-0 items-center gap-2 rounded-md bg-surface px-2.5 py-1.5"
                    >
                      <Dot tone="good" pulse={l.state === "running"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {role ?? l.name}
                          {role && (
                            <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                              {l.name.slice(role.length + 1)}
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {rung.model}
                          {rung.effort && `#${rung.effort}`}
                          {rung.backend && ` · ${rung.backend}`} · {l.state}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {mmss(l.secs)}
                      </span>
                      {armed?.name === l.name ? (
                        <Button
                          size="sm"
                          variant="quiet"
                          className="text-danger"
                          onClick={() => void cancel(l.name)}
                        >
                          {t("runs.cancelConfirm")}
                        </Button>
                      ) : (
                        <IconButton
                          small
                          icon="stop"
                          tone="danger"
                          label={t("runs.cancelNamed", { name: l.name })}
                          onClick={() => void cancel(l.name)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {d.questions.length > 0 && (
            <section className="flex flex-col gap-1.5 rounded-md bg-warning/10 px-3 py-2">
              <span className="text-xs font-semibold text-warning">{t("runs.questionsTitle")}</span>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {d.questions.map((q) => (
                  <li key={q.milestone} className="[overflow-wrap:anywhere]">
                    <span className="me-1.5 font-mono text-xs text-warning">{q.milestone}</span>
                    {q.question}
                  </li>
                ))}
              </ul>
              <span className="text-xs text-muted-foreground">{t("runs.questionsHelp")}</span>
            </section>
          )}

          {d.budget && (
            <section className="flex flex-col gap-1">
              <Label>{t("runs.budgetTitle")}</Label>
              <Meter fraction={d.budget.fraction} label={t("runs.budgetTitle")} />
              <span className="px-1 text-xs text-muted-foreground">{budgetCaps(d.budget)}</span>
            </section>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5">
            <Stat label={t("runs.stat.roleRuns")} value={`${d.totals.ok}/${d.totals.runs}`} />
            <Stat
              label={t("runs.stat.tokens")}
              value={`${Math.round(d.totals.tokens.input / 1000)}k / ${Math.round(d.totals.tokens.output / 1000)}k`}
            />
            <Stat
              label={t("runs.stat.cost")}
              value={d.totals.costUsd === null ? "–" : `$${d.totals.costUsd.toFixed(2)}`}
            />
            <Stat label={t("runs.stat.minutes")} value={Math.round(d.totals.wallMinutes)} />
            <Stat label={t("runs.stat.landed")} value={d.milestones.length} />
          </div>
          {d.totals.notOk.length > 0 && (
            <p className="m-0 text-xs text-danger">{d.totals.notOk.join(", ")}</p>
          )}
          {d.verifier && (
            <p className="m-0 px-1 text-xs text-muted-foreground">
              {t(d.verifier.carried ? "runs.verifierCarried" : "runs.verifierStep", {
                item: d.verifier.item,
                ago: ago(d.verifier.at),
              })}
            </p>
          )}

          <section className="flex flex-col gap-1">
            <Label>{t("runs.recordsTitle")}</Label>
            {d.records.length === 0 ? (
              <Empty>{t("runs.noRecords")}</Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {d.records.map((r) => (
                  <RecordRow
                    key={r.dispatchId}
                    runId={id}
                    record={r}
                    open={reply === r.dispatchId}
                    onToggle={() => setReply(reply === r.dispatchId ? undefined : r.dispatchId)}
                  />
                ))}
              </ul>
            )}
          </section>

          {d.warnings.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              {d.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <Collapsible title={t("runs.details")} open={more} onToggle={() => setMore((o) => !o)}>
            <RunDetails d={d} />
          </Collapsible>
        </>
      )}
    </div>
  );
}

function RecordRow({
  runId,
  record: r,
  open,
  onToggle,
}: {
  runId: string;
  record: RecordLite;
  open: boolean;
  onToggle: () => void;
}) {
  const rung = rungParts(r.rung);
  return (
    <li className={cn("rounded-md", open && "bg-surface")}>
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-start hover:bg-surface"
        onClick={onToggle}
      >
        <Icon
          name={r.status === "ok" ? "check" : "x"}
          className={cn("mt-1 shrink-0", r.status === "ok" ? "text-success" : "text-danger")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-medium">{r.role}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {mmss(r.secs)}
            </span>
          </span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {rung.model}
            {rung.effort && `#${rung.effort}`}
            {r.replyStatus && ` · ${r.replyStatus}`}
            {r.violations.length > 0 && (
              <span className="text-danger">
                {" "}
                · {t("runs.violations", { n: r.violations.length })}
              </span>
            )}
          </span>
        </span>
      </button>
      {open && <RoleDetail runId={runId} record={r} />}
    </li>
  );
}

function RunDetails({ d }: { d: RunDetail }) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <p className="m-0 text-muted-foreground">
        {d.repo} · {t("runs.jevLine", { decisions: d.jev.decisions, fallbacks: d.jev.fallbacks })} ·{" "}
        {t("runs.agentRuns", { n: d.agents.runs })}
      </p>
      <section className="flex flex-col gap-1">
        <Label>{t("runs.routesTitle")}</Label>
        {d.routes.length === 0 ? (
          <Empty>{t("runs.noRoutes")}</Empty>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {d.routes.map((r) => (
              <li key={r.lane} className="flex min-w-0 flex-wrap gap-x-2 px-1">
                <span className="font-medium">{r.lane}</span>
                <span>{r.role}</span>
                <span className="min-w-0 truncate font-mono text-muted-foreground">{r.rung}</span>
                <span className="text-muted-foreground">
                  {[r.decidedBy, r.kind, r.difficulty].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {d.climbs.length > 0 && (
        <section className="flex flex-col gap-1">
          <Label>{t("runs.climbsTitle")}</Label>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 font-mono">
            {d.climbs.map((c) => (
              <li key={`${c.lane}-${c.at}`} className="px-1 [overflow-wrap:anywhere]">
                {c.lane}: {c.from ?? "?"} → {c.rung} · {c.reason}
                {c.env && ` ${t("runs.environment")}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.milestones.length > 0 && (
        <section className="flex flex-col gap-1">
          <Label>{t("runs.landedTitle")}</Label>
          <ul className="m-0 flex list-none flex-col p-0 px-1 font-mono">
            {d.milestones.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-1">
        <Label>{t("runs.stateTitle")}</Label>
        <pre className="m-0 max-h-80 overflow-auto rounded-md bg-surface p-2 font-mono whitespace-pre-wrap wrap-anywhere">
          {d.stateMd}
        </pre>
      </section>
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
    <div className="flex flex-col gap-2 px-2 pb-2 text-xs">
      <p className="m-0 text-muted-foreground [overflow-wrap:anywhere]">
        {record.replyWhy && `${record.replyWhy} · `}
        {t("runs.tokensLine", {
          input: Math.round(record.tokens.input / 1000),
          output: Math.round(record.tokens.output / 1000),
        })}
        {record.changedOwned.length > 0 &&
          ` · ${t("runs.changed", { files: record.changedOwned.join(", ") })}`}
      </p>
      {record.violations.length > 0 && (
        <p className="m-0 text-danger">
          {t("runs.violationFiles", { files: record.violations.join(", ") })}
        </p>
      )}
      {reply.error && <ErrorText>{reply.error}</ErrorText>}
      <pre className="m-0 max-h-72 overflow-auto rounded-md bg-background/60 p-2 font-mono whitespace-pre-wrap wrap-anywhere">
        {reply.data?.reply || t("common.loading")}
      </pre>
      {!debug && (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => void loadDebug().then(setDebug)}
        >
          <Icon name="terminal" />
          {t("runs.debug")}
        </Button>
      )}
      {debug?.map((dd) => (
        <div key={dd.dispatchId} className="flex flex-col gap-1">
          <p className="m-0 font-mono">
            {dd.dispatchId} ·{" "}
            {dd.exit ? `${dd.exit.reason} (${dd.exit.code ?? dd.exit.signal})` : t("runs.noExit")}
          </p>
          {(["stderrTail", "eventsTail", "supervisorTail"] as const).map((k) =>
            dd[k].length > 0 ? (
              <details key={k}>
                <summary className="cursor-pointer text-muted-foreground">{k}</summary>
                <pre className="m-0 max-h-60 overflow-auto rounded-md bg-background/60 p-2 font-mono whitespace-pre-wrap wrap-anywhere">
                  {dd[k].join("\n")}
                </pre>
              </details>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}
