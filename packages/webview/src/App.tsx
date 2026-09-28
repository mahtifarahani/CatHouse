import { Button } from "@cathouse/ui";
import { useState } from "react";
import { RpcError, request } from "./lib/rpc";
import { t } from "./lib/strings";
import { SessionPage } from "./session/SessionPage";
import { useSession } from "./session/useSession";

type View = "sidebar" | "dashboard";

export function App({ view }: { view: View }) {
  return (
    <main className="flex flex-col gap-3 p-3">
      <header>
        <h1 className="text-lg font-semibold">{t("app.title")}</h1>
        <p className="text-muted-foreground">{t("app.tagline")}</p>
      </header>
      {view === "dashboard" ? <SessionPage /> : <Sidebar />}
    </main>
  );
}

function Sidebar() {
  const s = useSession();
  const [status, setStatus] = useState<string | null>(null);
  async function ping() {
    try {
      const r = await request("app.ping", {});
      setStatus(t("ping.ok", { version: r.extensionVersion, protocol: r.protocol, view: r.view }));
    } catch (e) {
      setStatus(t("ping.failed", { message: e instanceof RpcError ? e.message : String(e) }));
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <p>
        {t("sidebar.phase", { phase: s.phase })}
        {s.runId && <span className="ms-1 font-mono text-xs text-muted-foreground">{s.runId}</span>}
      </p>
      {s.prompts.length > 0 && (
        <p className="font-semibold text-warning">
          {t("sidebar.pending", { count: s.prompts.length })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void request("app.openDashboard", {})}>
          {t("sidebar.openDashboard")}
        </Button>
        <Button variant="secondary" onClick={() => void ping()}>
          {t("ping.button")}
        </Button>
      </div>
      {status && (
        <p role="status" className="text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  );
}
