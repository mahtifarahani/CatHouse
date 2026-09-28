import { Button, cn } from "@cathouse/ui";
import { useState } from "react";
import { request, viewState } from "./lib/rpc";
import { type StringKey, t } from "./lib/strings";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { RunsPage } from "./pages/RunsPage";
import { SessionPage } from "./session/SessionPage";
import { useSession } from "./session/useSession";
import { SetupPage } from "./setup/SetupPage";
import { useSetup } from "./setup/useSetup";

type View = "sidebar" | "dashboard";
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

export function App({ view }: { view: View }) {
  return (
    <main className="flex flex-col gap-3 p-3">
      <header>
        <h1 className="text-lg font-semibold">{t("app.title")}</h1>
        <p className="text-muted-foreground">{t("app.tagline")}</p>
      </header>
      {view === "dashboard" ? <Dashboard /> : <Sidebar />}
    </main>
  );
}

interface Nav {
  tab: Tab;
  run?: string | undefined;
}

function Dashboard() {
  const { state } = useSetup();
  const [nav, setNavState] = useState<Nav>(() => viewState.get<Nav>() ?? { tab: "overview" });
  const setNav = (n: Nav) => {
    setNavState(n);
    viewState.set(n);
  };
  // The plan's gate: until Bun, catherd, the plugin and the bundled Claude are good, only Setup.
  const gateOpen = state?.gateOpen === true;
  const active: Tab = gateOpen ? nav.tab : "setup";
  return (
    <div className="flex flex-col gap-3">
      {gateOpen && (
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
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
        <RunsPage openRun={nav.run} onOpenRun={(run) => setNav({ tab: "runs", run })} />
      )}
      {active === "profiles" && <ProfilesPage />}
      {active === "models" && <ModelsPage />}
      {active === "diagnostics" && <DiagnosticsPage />}
    </div>
  );
}

function Sidebar() {
  const s = useSession();
  const { state: setup } = useSetup();
  return (
    <div className="flex flex-col gap-2">
      {setup && !setup.gateOpen ? (
        <p className="text-warning">{t("sidebar.setupRequired")}</p>
      ) : (
        <p>
          {t("sidebar.phase", { phase: s.phase })}
          {s.runId && (
            <span className="ms-1 font-mono text-xs text-muted-foreground">{s.runId}</span>
          )}
        </p>
      )}
      {s.prompts.length > 0 && (
        <p className="font-semibold text-warning">
          {t("sidebar.pending", { count: s.prompts.length })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void request("app.openDashboard", {})}>
          {setup && !setup.gateOpen ? t("sidebar.openSetup") : t("sidebar.openDashboard")}
        </Button>
      </div>
    </div>
  );
}
