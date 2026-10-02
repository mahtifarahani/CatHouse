import type { RunDetail } from "@cathouse/protocol";
import { cn, Dot } from "@cathouse/ui";
import { t } from "../lib/strings";
import { mmss, roleOfDispatch, rungParts } from "./format";

/**
 * Who is working right now: one chip per live dispatch with its role, model and elapsed time.
 * catherd names dispatches `<role>-<lane>`; a finished record with the same name is the fallback.
 */
export function LiveRoles({
  run,
  className,
}: {
  run: Pick<RunDetail, "live" | "records">;
  className?: string;
}) {
  if (run.live.length === 0) return null;
  return (
    <ul
      aria-label={t("session.liveRoles")}
      className={cn("m-0 flex list-none flex-wrap gap-1 p-0", className)}
    >
      {run.live.map((l) => {
        const role = roleOfDispatch(l.name) ?? run.records.find((r) => r.name === l.name)?.role;
        const rung = rungParts(l.rung);
        return (
          <li
            key={l.name}
            title={`${l.name} · ${l.rung} · ${l.state}`}
            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-xs"
          >
            <Dot tone={l.state === "running" ? "good" : "info"} pulse={l.state === "running"} />
            <span className="shrink-0 font-semibold">{role ?? l.name}</span>
            <span className="min-w-0 truncate font-mono text-muted-foreground">
              {rung.model}
              {rung.effort && `#${rung.effort}`}
            </span>
            {rung.backend && (
              <span className="hidden shrink-0 text-muted-foreground @[20rem]:inline">
                {rung.backend}
              </span>
            )}
            <span className="shrink-0 tabular-nums text-muted-foreground">{mmss(l.secs)}</span>
          </li>
        );
      })}
    </ul>
  );
}
