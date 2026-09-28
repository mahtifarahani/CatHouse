import { cn, inputClass } from "@cathouse/ui";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { onEvent, request } from "./lib/rpc";
import { type StringKey, t } from "./lib/strings";
import { ToastRegion } from "./lib/toasts";
import { usePoll } from "./lib/usePoll";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { RunsPage } from "./pages/RunsPage";
import { SessionPage } from "./session/SessionPage";
import { SetupPage } from "./setup/SetupPage";
import { useSetup } from "./setup/useSetup";

const TABS = ["overview", "session", "runs", "profiles", "models", "diagnostics", "setup"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, StringKey> = {
  overview: "tabs.overview",
  session: "tabs.session",
  runs: "tabs.runs",
  profiles: "tabs.profiles",
  models: "tabs.models",
  diagnostics: "tabs.diagnostics",
  setup: "tabs.setup",
};

export function App() {
  return (
    <main className="flex h-screen min-h-0 flex-col gap-3 overflow-hidden p-3">
      <Dashboard />
      <ToastRegion />
    </main>
  );
}

interface Nav {
  tab: Tab;
  run?: string | undefined;
}

const loadWs = () => request("app.workspace", {});

function ViewChrome({ gateOpen, setupReady }: { gateOpen: boolean; setupReady: boolean }) {
  const [ws, setWs] = useState<Awaited<ReturnType<typeof loadWs>>>();
  const profiles = usePoll(
    () => (gateOpen && ws?.repo ? request("profiles.get", {}) : Promise.resolve(undefined)),
    5000,
    `chrome-profiles-${gateOpen}-${ws?.repo ?? "none"}`,
  );
  const runs = usePoll(
    () => (gateOpen && ws?.repo ? request("runs.list", {}) : Promise.resolve(undefined)),
    2000,
    `chrome-runs-${gateOpen}-${ws?.repo ?? "none"}`,
  );
  const [dirty, setDirty] = useState(0);
  useEffect(() => {
    void loadWs().then(setWs);
    return onEvent("app", () => void loadWs().then(setWs));
  }, []);
  useEffect(() => {
    const onDirty = (e: Event) => setDirty((e as CustomEvent<number>).detail);
    window.addEventListener("cathouse:dirty", onDirty);
    return () => window.removeEventListener("cathouse:dirty", onDirty);
  }, []);
  const working = runs.data?.runs.some((r) => r.live > 0) ?? false;
  const mood = !setupReady ? t("status.failed") : working ? t("status.working") : t("status.good");
  if (!ws) return null;
  return (
    <div
      className="flex flex-nowrap items-center gap-3 overflow-x-auto whitespace-nowrap border border-border px-2 py-1 text-xs text-muted-foreground"
      role="status"
    >
      {ws.folders.length > 1 ? (
        <label className="flex shrink-0 items-center">
          <span className="sr-only">{t("app.repo")}</span>
          <select
            className={inputClass}
            value={ws.repo ?? ""}
            onChange={(e) =>
              void request("app.setRepo", { path: e.target.value }).then(() => loadWs().then(setWs))
            }
          >
            {ws.folders.map((f) => (
              <option key={f.path} value={f.path}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        ws.folders[0]?.name && <span className="shrink-0">{ws.folders[0].name}</span>
      )}
      {ws.folders.length === 0 && (
        <span className="shrink-0 text-warning">{t("app.noFolder")}</span>
      )}
      <span
        className={`shrink-0 ${
          !setupReady ? "text-danger" : working ? "text-warning" : "text-success"
        }`}
      >
        ● {mood}
      </span>
      {profiles.data && (
        <span className="shrink-0">
          {profiles.data.here}
          {profiles.data.here === profiles.data.active
            ? ` (${t("profiles.active")})`
            : ` (${t("profiles.thisRepo")})`}
        </span>
      )}
      {dirty > 0 && (
        <span className="shrink-0 text-warning">{t("profiles.unsaved", { n: dirty })}</span>
      )}
      <span className="order-last ms-auto shrink-0">catherd {ws.catherdVersion}</span>
    </div>
  );
}

function Dashboard() {
  const { state } = useSetup();
  const [nav, setNav] = useState<Nav>({ tab: "session" });
  // The plan's gate: until Bun, catherd, the plugin and the bundled Claude are good, only Setup.
  const gateOpen = state?.gateOpen === true;
  const active: Tab = gateOpen ? nav.tab : "setup";
  const tabs = useRef<HTMLDivElement>(null);
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!gateOpen || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = TABS.indexOf(active);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setNav({ tab: TABS[next] as Tab });
    requestAnimationFrame(() =>
      tabs.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus(),
    );
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ViewChrome gateOpen={gateOpen} setupReady={state?.canStart === true} />
      {gateOpen && (
        <div
          ref={tabs}
          role="tablist"
          aria-label={t("tabs.label")}
          onKeyDown={onTabKey}
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {TABS.map((id) => (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active === id}
              aria-controls={`panel-${id}`}
              tabIndex={active === id ? 0 : -1}
              onClick={() => setNav({ tab: id })}
              className={cn(
                "-mb-px border-b-2 px-3 py-1",
                active === id ? "border-focus" : "border-transparent text-muted-foreground",
              )}
            >
              {t(LABEL[id])}
            </button>
          ))}
        </div>
      )}
      <div
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className={cn("min-h-0 flex-1", active === "session" ? "overflow-hidden" : "overflow-auto")}
      >
        {active === "setup" && <SetupPage />}
        {active === "overview" && (
          <OverviewPage
            go={(tab) => setNav({ tab })}
            openRun={(run) => setNav({ tab: "runs", run })}
          />
        )}
        {active === "session" && (
          <SessionPage canStart={state?.canStart === true} blockedReason={state?.canStartReason} />
        )}
        {active === "runs" && (
          <RunsPage
            openRun={nav.run}
            onOpenRun={(run) => setNav({ tab: "runs", run })}
            onContinue={() => setNav({ tab: "session" })}
            canStart={state?.canStart === true}
          />
        )}
        {active === "profiles" && <ProfilesPage />}
        {active === "models" && <ModelsPage />}
        {active === "diagnostics" && <DiagnosticsPage />}
      </div>
    </div>
  );
}
