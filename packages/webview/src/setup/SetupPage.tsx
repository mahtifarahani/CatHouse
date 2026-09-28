import type { SetupItem } from "@cathouse/protocol";
import { Button, cn } from "@cathouse/ui";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { useSetup } from "./useSetup";

const GLYPH: Record<SetupItem["state"], { g: string; cls: string }> = {
  ok: { g: "✓", cls: "text-success" },
  missing: { g: "✗", cls: "text-danger" },
  outdated: { g: "↑", cls: "text-warning" },
  error: { g: "✗", cls: "text-danger" },
  warn: { g: "!", cls: "text-warning" },
  unknown: { g: "?", cls: "text-muted-foreground" },
  info: { g: "i", cls: "text-muted-foreground" },
};

const LEVEL_TITLE: Record<SetupItem["level"], Parameters<typeof t>[0]> = {
  gate: "setup.level.gate",
  start: "setup.level.start",
  optional: "setup.level.optional",
};

export function SetupPage() {
  const { state, output, lastDone } = useSetup();
  if (!state || state.items.length === 0) {
    return <p className="text-muted-foreground">{t("setup.checking")}</p>;
  }
  const busy = state.checking || !!state.running;
  const groups = (["gate", "start", "optional"] as const)
    .map((level) => ({ level, items: state.items.filter((i) => i.level === level) }))
    .filter((g) => g.items.length > 0);
  const log = state.running
    ? output[state.running]
    : lastDone
      ? output[lastDone.action]
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{t("setup.title")}</h2>
        <span
          className={cn(
            "rounded-sm px-1.5",
            state.canStart
              ? "bg-primary text-primary-foreground"
              : "bg-badge text-badge-foreground",
          )}
        >
          {state.canStart
            ? t("setup.ready")
            : state.gateOpen
              ? t("setup.almost")
              : t("setup.required")}
        </span>
        <span className="ms-auto flex gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void request("setup.check", { readiness: false })}
          >
            {state.checking ? t("setup.checkingShort") : t("setup.recheck")}
          </Button>
        </span>
      </header>
      {!state.canStart && state.canStartReason && (
        <p className="text-muted-foreground">{state.canStartReason}</p>
      )}

      {groups.map((g) => (
        <section key={g.level} className="flex flex-col gap-1">
          <h3 className="font-semibold text-muted-foreground">{t(LEVEL_TITLE[g.level])}</h3>
          <ul className="flex flex-col divide-y divide-border rounded-sm border border-border">
            {g.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-start gap-2 px-2 py-1.5">
                <span aria-hidden className={cn("w-4 text-center font-mono", GLYPH[it.state].cls)}>
                  {GLYPH[it.state].g}
                </span>
                <div className="min-w-0 flex-1">
                  <div>
                    <span className="font-medium">{it.label}</span>
                    <span className="sr-only"> ({it.state})</span>
                  </div>
                  <div className="break-words text-muted-foreground">{it.detail}</div>
                  {it.fix && !it.action && (
                    <div className="mt-1 flex items-center gap-2">
                      <code className="break-all font-mono text-xs">{it.fix}</code>
                      <Button
                        variant="ghost"
                        className="px-1 py-0 text-xs"
                        onClick={() => void navigator.clipboard.writeText(it.fix ?? "")}
                      >
                        {t("setup.copy")}
                      </Button>
                    </div>
                  )}
                </div>
                {it.action && (
                  <Button
                    variant={it.level === "optional" ? "secondary" : "primary"}
                    disabled={busy}
                    onClick={() => it.action && void request("setup.run", { action: it.action.id })}
                  >
                    {state.running === it.action.id ? t("setup.running") : it.action.label}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lastDone && !state.running && (
        <p role="status" className={lastDone.ok ? "text-success" : "text-danger"}>
          {lastDone.ok ? t("setup.done", { action: lastDone.action }) : lastDone.message}
        </p>
      )}
      {log !== undefined && log.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="font-semibold text-muted-foreground">{t("setup.output")}</h3>
          <pre className="max-h-72 overflow-auto rounded-sm bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
            {log}
          </pre>
        </section>
      )}
    </div>
  );
}
