import { Button, cn } from "@cathouse/ui";
import { useState } from "react";
import { request } from "./lib/rpc";
import { t } from "./lib/strings";
import { SessionPage } from "./session/SessionPage";
import { useSession } from "./session/useSession";
import { SetupPage } from "./setup/SetupPage";
import { useSetup } from "./setup/useSetup";

type View = "sidebar" | "dashboard";
type Tab = "setup" | "session";

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

function Dashboard() {
  const { state } = useSetup();
  const [tab, setTab] = useState<Tab>("session");
  // The plan's gate: until Bun, catherd, the plugin and the bundled Claude are good, only Setup.
  const gateOpen = state?.gateOpen === true;
  const active: Tab = gateOpen ? tab : "setup";
  return (
    <div className="flex flex-col gap-3">
      {gateOpen && (
        <div role="tablist" className="flex gap-1 border-b border-border">
          {(["session", "setup"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-1",
                active === id ? "border-focus" : "border-transparent text-muted-foreground",
              )}
            >
              {t(id === "setup" ? "tabs.setup" : "tabs.session")}
            </button>
          ))}
        </div>
      )}
      {active === "setup" ? (
        <SetupPage />
      ) : (
        <SessionPage canStart={state?.canStart === true} blockedReason={state?.canStartReason} />
      )}
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
