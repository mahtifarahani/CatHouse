import type { SessionEvent } from "@cathouse/protocol";
import { cn } from "@cathouse/ui";
import { useMemo } from "react";
import { t } from "../lib/strings";
import { mmss, oneLine, shortTool } from "./format";
import { toTranscript } from "./useSession";

export function Transcript({ events }: { events: SessionEvent[] }) {
  const items = useMemo(() => toTranscript(events), [events]);
  return (
    <ol className="flex flex-col gap-1.5" aria-label={t("session.transcript")}>
      {items.map((it, i) => {
        const key = `${it.type}-${i}`;
        switch (it.type) {
          case "user":
            return (
              <li key={key} className="rounded-sm bg-secondary px-2 py-1 whitespace-pre-wrap">
                {it.text}
              </li>
            );
          case "init":
            return (
              <li
                key={key}
                className={cn("text-xs", it.ok ? "text-muted-foreground" : "text-danger")}
              >
                {it.detail}
              </li>
            );
          case "text":
            return (
              <li
                key={key}
                className={cn("whitespace-pre-wrap", it.nested && "ms-4 text-muted-foreground")}
              >
                {it.text}
              </li>
            );
          case "tool":
            return (
              <li key={key} className={cn("font-mono text-xs", it.nested && "ms-4")}>
                <details>
                  <summary className="cursor-pointer">
                    <span className={cn(it.result?.isError && "text-danger")}>
                      {it.result ? (it.result.isError ? "✗" : "✓") : "…"} {shortTool(it.name)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {oneLine(it.input)}
                      {!it.result && it.elapsedSecs !== undefined && ` · ${mmss(it.elapsedSecs)}`}
                    </span>
                  </summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-sm bg-background p-2 whitespace-pre-wrap">
                    {JSON.stringify(it.input, null, 2)}
                    {it.result && `\n\n→ ${it.result.text.slice(0, 4000)}`}
                  </pre>
                </details>
              </li>
            );
          case "run":
            return (
              <li key={key} className="text-link">
                {t("session.runStarted", { run: it.runId })}
              </li>
            );
          case "task":
            return (
              <li key={key} className="ms-4 text-xs text-muted-foreground">
                ◆ {it.description}
                {it.status && ` · ${it.status}`}
                {it.durationMs !== undefined && ` · ${mmss(it.durationMs / 1000)}`}
              </li>
            );
          case "result":
            return (
              <li
                key={key}
                className={cn("text-xs", it.isError ? "text-danger" : "text-muted-foreground")}
              >
                {t("session.turnEnded", {
                  subtype: it.subtype,
                  cost: it.costUsd === undefined ? "–" : `$${it.costUsd.toFixed(2)}`,
                })}
              </li>
            );
        }
      })}
    </ol>
  );
}
