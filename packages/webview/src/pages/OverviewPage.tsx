import { Button, Empty, ErrorText, Section } from "@cathouse/ui";
import type { ReactNode } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { usePoll } from "../lib/usePoll";
import { useSetup } from "../setup/useSetup";
import { RunRow } from "./RunsPage";

type Target = "setup" | "profiles" | "session" | "runs";

function Tile({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "good" | "warn" | "bad" | undefined;
  onClick: () => void;
}) {
  const color =
    tone === "good"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : tone === "bad"
          ? "text-danger"
          : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col gap-0.5 rounded-sm border border-border px-3 py-2 text-start hover:bg-secondary"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`truncate font-medium ${color}`}>{value}</span>
      {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
    </button>
  );
}

/** At-a-glance state: each tile links to the tab that owns the detail. */
export function OverviewPage({
  go,
  openRun,
}: {
  go: (tab: Target) => void;
  openRun: (id: string) => void;
}) {
  const { state: setup } = useSetup();
  const profile = usePoll(() => request("profiles.get", {}), 0, "overview-profile");
  const runs = usePoll(() => request("runs.list", {}), 2000, "overview-runs");
  const issues = setup?.items.filter((i) => i.level !== "optional" && i.state !== "ok").length ?? 0;
  const live = runs.data?.runs.filter((r) => r.live > 0).length ?? 0;
  const p = profile.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
        <Tile
          label={t("overview.setup")}
          value={setup?.canStart ? t("setup.ready") : t("overview.issues", { n: issues })}
          tone={setup ? (setup.canStart ? "good" : "bad") : undefined}
          onClick={() => go("setup")}
        />
        <Tile
          label={t("overview.profile")}
          value={p?.here ?? "…"}
          tone={p && !p.validation.valid ? "bad" : undefined}
          detail={
            p &&
            (!p.validation.valid
              ? t("profiles.invalid")
              : `${p.here === p.active ? t("profiles.active") : t("profiles.thisRepo")} · ${t(
                  "overview.profileCount",
                  { n: p.names.length },
                )}`)
          }
          onClick={() => go("profiles")}
        />
        <Tile
          label={t("tabs.runs")}
          value={runs.data ? t("overview.runCount", { n: runs.data.runs.length }) : "…"}
          tone={live > 0 ? "warn" : undefined}
          detail={live > 0 ? t("runs.live", { n: live }) : t("runs.idle")}
          onClick={() => go("runs")}
        />
      </div>
      {profile.error && <ErrorText>{profile.error}</ErrorText>}

      <Section
        title={t("overview.recentRuns")}
        actions={
          <Button onClick={() => go("session")} disabled={!setup?.canStart}>
            {t("overview.newTask")}
          </Button>
        }
      >
        {runs.error && <ErrorText>{runs.error}</ErrorText>}
        {runs.data?.runs.length === 0 && <Empty>{t("runs.empty")}</Empty>}
        <ul className="divide-y divide-border rounded-sm border border-border empty:hidden">
          {runs.data?.runs.slice(0, 5).map((r) => (
            <RunRow key={r.id} run={r} onOpen={() => openRun(r.id)} />
          ))}
        </ul>
      </Section>
    </div>
  );
}
