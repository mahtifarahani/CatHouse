import { Badge, Button, Empty, ErrorText, Section } from "@cathouse/ui";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { usePoll } from "../lib/usePoll";
import { useSetup } from "../setup/useSetup";
import { RunRow } from "./RunsPage";

export function OverviewPage({
  go,
  openRun,
}: {
  go: (tab: "setup" | "profiles" | "session") => void;
  openRun: (id: string) => void;
}) {
  const { state: setup } = useSetup();
  const profile = usePoll(() => request("profiles.get", {}), 0, "overview-profile");
  const runs = usePoll(() => request("runs.list", {}), 2000, "overview-runs");
  const failing = setup?.items.filter((i) => i.level !== "optional" && i.state !== "ok") ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("overview.setup")}
        actions={
          <Button variant="secondary" onClick={() => go("setup")}>
            {t("overview.openSetup")}
          </Button>
        }
      >
        {setup?.canStart ? (
          <p>
            <Badge tone="good">{t("setup.ready")}</Badge> {t("overview.readyLine")}
          </p>
        ) : (
          <ul className="text-xs">
            {failing.map((i) => (
              <li key={i.id}>
                ✗ {i.label}: {i.detail}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title={t("overview.profile")}
        actions={
          <Button variant="secondary" onClick={() => go("profiles")}>
            {t("overview.openProfiles")}
          </Button>
        }
      >
        {profile.error && <ErrorText>{profile.error}</ErrorText>}
        {profile.data && (
          <p>
            <span className="font-medium">{profile.data.here}</span>{" "}
            <Badge>
              {profile.data.here === profile.data.active
                ? t("profiles.active")
                : t("profiles.thisRepo")}
            </Badge>{" "}
            <span className="text-xs text-muted-foreground">
              {t("overview.profileCount", { n: profile.data.names.length })}
            </span>
            {!profile.data.validation.valid && (
              <Badge tone="bad" className="ms-2">
                {t("profiles.invalid")}
              </Badge>
            )}
          </p>
        )}
      </Section>
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
        <ul className="divide-y divide-border rounded-sm border border-border">
          {runs.data?.runs.slice(0, 5).map((r) => (
            <RunRow key={r.id} run={r} onOpen={() => openRun(r.id)} />
          ))}
        </ul>
      </Section>
    </div>
  );
}
