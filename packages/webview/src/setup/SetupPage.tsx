import type { SetupActionId, SetupItem } from "@cathouse/protocol";
import { Button, Collapsible, cn, Icon, IconButton, type IconName, inputClass } from "@cathouse/ui";
import { useEffect, useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { toast } from "../lib/toasts";
import { errorText } from "../lib/usePoll";
import { ago } from "../pages/RunsPage";
import { useSetup } from "./useSetup";

const STATE: Record<SetupItem["state"], { icon: IconName; cls: string }> = {
  ok: { icon: "check", cls: "text-success" },
  missing: { icon: "x", cls: "text-danger" },
  outdated: { icon: "arrowUp", cls: "text-warning" },
  error: { icon: "x", cls: "text-danger" },
  warn: { icon: "warning", cls: "text-warning" },
  unknown: { icon: "refresh", cls: "text-muted-foreground" },
  info: { icon: "cat", cls: "text-muted-foreground" },
};

/**
 * Setup and diagnostics in one place: a clear verdict, only the things that need a click, and
 * everything else folded away. Installers still run only from a button (AGENTS rule 5).
 */
export interface SetupPageProps {
  onOpenChat?: (() => void) | undefined;
}

export function SetupPage(_props: SetupPageProps) {
  const { state, output, lastDone } = useSetup();
  const [version, setVersion] = useState<string>();
  const [showAll, setShowAll] = useState(false);
  const [showTools, setShowTools] = useState(false);
  useEffect(() => {
    void request("app.workspace", {})
      .then((w) => setVersion(w.catherdVersion))
      .catch(() => undefined);
  }, []);
  if (!state || state.items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Icon name="spinner" />
        {t("setup.checking")}
      </p>
    );
  }
  const busy = state.checking || !!state.running;
  const required = state.items.filter((i) => i.level !== "optional" && i.state !== "ok");
  const recommended = state.items.filter(
    (i) => i.level === "optional" && ["missing", "outdated", "error", "warn"].includes(i.state),
  );
  const rest = state.items.filter((i) => !required.includes(i) && !recommended.includes(i));
  const log = state.running
    ? output[state.running]
    : lastDone
      ? output[lastDone.action]
      : undefined;
  const logFor = state.running ?? lastDone?.action;
  const checkedAt = state.doctorAt ?? state.checkedAt;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
            state.canStart ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          <Icon name={state.canStart ? "check" : "wrench"} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-semibold">
            {state.canStart
              ? t("setup.readyTitle")
              : t("setup.toFixTitle", { n: Math.max(1, required.length) })}
          </h2>
          <p className="m-0 truncate text-xs text-muted-foreground">
            {[
              version && `catherd ${version}`,
              checkedAt && t("setup.checkedAgo", { ago: ago(checkedAt) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {/* One way to re-check: hidden while a "Check readiness" row already offers it. */}
        {!required.some((i) => i.action?.id === "check-readiness") && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void request("setup.check", { readiness: true })}
          >
            <Icon name={state.checking ? "spinner" : "refresh"} />
            <span className="hidden @[20rem]:inline">
              {state.checking ? t("setup.checkingShort") : t("setup.recheck")}
            </span>
          </Button>
        )}
      </header>

      {required.length > 0 && (
        <ItemList
          title={t("setup.toFix")}
          items={required}
          busy={busy}
          running={state.running}
          firstPrimary
          log={log}
          logFor={logFor}
        />
      )}
      {recommended.length > 0 && (
        <ItemList
          title={t("setup.recommended")}
          items={recommended}
          busy={busy}
          running={state.running}
          log={log}
          logFor={logFor}
        />
      )}
      {lastDone && !state.running && !lastDone.ok && (
        <p role="alert" className="m-0 rounded-md bg-danger/10 px-3 py-2 text-danger">
          {lastDone.message}
        </p>
      )}

      {rest.length > 0 && (
        <Collapsible
          title={t("setup.allChecks", { n: rest.length })}
          open={showAll}
          onToggle={() => setShowAll((o) => !o)}
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {rest.map((it) => (
              <Row key={it.id} it={it} busy={busy} running={state.running} quiet />
            ))}
          </ul>
        </Collapsible>
      )}
      <Collapsible
        title={t("setup.tools")}
        open={showTools}
        onToggle={() => setShowTools((o) => !o)}
      >
        <Tools />
      </Collapsible>
    </div>
  );
}

function ItemList({
  title,
  items,
  busy,
  running,
  firstPrimary,
  log,
  logFor,
}: {
  title: string;
  items: SetupItem[];
  busy: boolean;
  running: SetupActionId | undefined;
  firstPrimary?: boolean;
  log: string | undefined;
  logFor: string | undefined;
}) {
  const firstAction = items.find((i) => i.action)?.id;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="m-0 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((it) => (
          <Row
            key={it.id}
            it={it}
            busy={busy}
            running={running}
            primary={!!firstPrimary && it.id === firstAction}
            log={it.action?.id === logFor ? log : undefined}
          />
        ))}
      </ul>
    </section>
  );
}

function Row({
  it,
  busy,
  running,
  primary,
  quiet,
  log,
}: {
  it: SetupItem;
  busy: boolean;
  running: string | undefined;
  primary?: boolean;
  quiet?: boolean;
  log?: string | undefined;
}) {
  const s = STATE[it.state];
  const isRunning = !!it.action && running === it.action.id;
  return (
    <li
      className={cn(
        "@container flex flex-col gap-1.5 rounded-md px-2.5 py-2",
        quiet ? "py-1.5 hover:bg-surface" : "bg-surface",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1.5">
        <Icon name={isRunning ? "spinner" : s.icon} className={cn("mt-1 shrink-0", s.cls)} />
        <div className="min-w-0 flex-1 basis-40">
          <div className="font-medium">
            {it.label}
            <span className="sr-only"> ({it.state})</span>
          </div>
          <div className="text-xs break-words text-muted-foreground">{it.detail}</div>
        </div>
        {it.action && (
          <Button
            size="sm"
            variant={primary ? "primary" : "secondary"}
            disabled={busy}
            className="ms-auto"
            onClick={() => it.action && void request("setup.run", { action: it.action.id })}
          >
            {isRunning ? t("setup.running") : it.action.label}
          </Button>
        )}
      </div>
      {it.fix && !it.action && (
        <div className="flex min-w-0 items-center gap-1 ps-6">
          <code
            className="min-w-0 flex-1 truncate rounded-md bg-background/60 px-2 py-1 font-mono text-xs"
            title={it.fix}
          >
            {it.fix}
          </code>
          <IconButton
            small
            icon="copy"
            label={t("setup.copy")}
            onClick={() => {
              void navigator.clipboard.writeText(it.fix ?? "");
              toast(t("setup.copied"), "ok", { key: "copy" });
            }}
          />
        </div>
      )}
      {log !== undefined && log.length > 0 && (
        <pre className="m-0 ms-6 min-w-0 overflow-x-hidden rounded-md bg-background/60 p-2 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
          {log}
        </pre>
      )}
    </li>
  );
}

/** What used to be Diagnostics: catherd's logs and its machine-wide heavy-work lock. */
function Tools() {
  const [cmd, setCmd] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast(errorText(e), "bad");
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
          {t("diag.logsHelp")}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void run(() => request("diagnostics.openLogs", {}))}
        >
          <Icon name="folder" />
          {t("diag.openLogs")}
        </Button>
      </div>
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (cmd.trim()) void run(() => request("diagnostics.lock", { command: cmd.trim() }));
        }}
      >
        <label htmlFor="lock-cmd" className="text-xs font-medium">
          {t("diag.lock")}
        </label>
        <div className="flex gap-1.5">
          <input
            id="lock-cmd"
            className={`${inputClass} min-w-0 flex-1 font-mono`}
            placeholder="bun test"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!cmd.trim()}>
            <Icon name="terminal" />
            <span className="hidden @[22rem]:inline">{t("diag.runLocked")}</span>
          </Button>
        </div>
        <p className="m-0 text-xs text-muted-foreground">{t("diag.lockHelp")}</p>
      </form>
    </div>
  );
}
