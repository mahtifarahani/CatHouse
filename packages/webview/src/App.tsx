import { Button } from "@cathouse/ui";
import { useState } from "react";
import { RpcError, request } from "./lib/rpc";
import { t } from "./lib/strings";

type View = "sidebar" | "dashboard";

export function App({ view }: { view: View }) {
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
    <main className="flex flex-col gap-3 p-3">
      <header>
        <h1 className="text-lg font-semibold">{t("app.title")}</h1>
        <p className="text-muted-foreground">{t("app.tagline")}</p>
      </header>
      {view === "dashboard" && <p>{t("dashboard.placeholder")}</p>}
      <div className="flex flex-wrap gap-2">
        {view === "sidebar" && (
          <Button onClick={() => void request("app.openDashboard", {})}>
            {t("sidebar.openDashboard")}
          </Button>
        )}
        <Button variant="secondary" onClick={() => void ping()}>
          {t("ping.button")}
        </Button>
      </div>
      {status && (
        <p role="status" className="text-muted-foreground">
          {status}
        </p>
      )}
    </main>
  );
}
