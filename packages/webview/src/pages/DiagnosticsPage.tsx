import { Badge, Button, inputClass, Section } from "@cathouse/ui";
import { useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { errorText } from "../lib/usePoll";
import { useSetup } from "../setup/useSetup";
import { ago } from "./RunsPage";

export function DiagnosticsPage() {
  const { state } = useSetup();
  const [cmd, setCmd] = useState("");
  const [msg, setMsg] = useState<string>();
  const doctorRows =
    state?.items.filter((i) => i.id.startsWith("doctor:") || i.id === "readiness") ?? [];
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setMsg(undefined);
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("diag.doctor", { ago: state?.doctorAt ? ago(state.doctorAt) : t("diag.never") })}
        actions={
          <Button
            variant="secondary"
            disabled={!!state?.running || state?.checking}
            onClick={() => void run(() => request("setup.run", { action: "check-readiness" }))}
          >
            {t("diag.runDoctor")}
          </Button>
        }
      >
        <ul className="flex flex-col gap-1 text-xs">
          {doctorRows.map((r) => (
            <li key={r.id} className="flex flex-col">
              <span>
                <Badge
                  tone={
                    r.state === "ok"
                      ? "good"
                      : r.state === "error"
                        ? "bad"
                        : r.state === "warn"
                          ? "warn"
                          : "neutral"
                  }
                >
                  {r.state}
                </Badge>{" "}
                <span className="font-medium">{r.label}</span> — {r.detail}
              </span>
              {r.fix && (
                <span className="ms-6 flex items-center gap-2">
                  <code className="font-mono">{r.fix}</code>
                  <Button
                    variant="ghost"
                    className="px-1 py-0 text-xs"
                    onClick={() => void navigator.clipboard.writeText(r.fix ?? "")}
                  >
                    {t("setup.copy")}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section
        title={t("diag.logs")}
        actions={
          <Button
            variant="secondary"
            onClick={() => void run(() => request("diagnostics.openLogs", {}))}
          >
            {t("diag.openLogs")}
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">{t("diag.logsHelp")}</p>
      </Section>
      <Section title={t("diag.lock")}>
        <p className="text-xs text-muted-foreground">{t("diag.lockHelp")}</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cmd.trim()) void run(() => request("diagnostics.lock", { command: cmd.trim() }));
          }}
        >
          <input
            className={`${inputClass} flex-1 font-mono`}
            placeholder="bun test"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            aria-label={t("diag.lock")}
          />
          <Button type="submit" variant="secondary" disabled={!cmd.trim()}>
            {t("diag.runLocked")}
          </Button>
        </form>
      </Section>
      {msg && (
        <p role="alert" className="text-danger">
          {msg}
        </p>
      )}
    </div>
  );
}
