import type { OrchestratorHost } from "@cathouse/protocol";
import { quietSelectClass } from "@cathouse/ui";
import { useState } from "react";
import { request } from "../../lib/rpc";
import { t } from "../../lib/strings";
import { toast } from "../../lib/toasts";
import { useSession } from "../../session/useSession";
import { useSetup } from "../../setup/useSetup";
import { Group, Row } from "./fields";

/** CatHouse's session host is a global preference; catherd still owns role routing. */
export function OrchestratorHostSetting() {
  const { state } = useSetup();
  const session = useSession();
  const [changing, setChanging] = useState(false);
  const busy = changing || session.phase === "running" || session.phase === "starting";
  const change = async (host: OrchestratorHost) => {
    if (!state || host === state.host) return;
    setChanging(true);
    try {
      await request("app.setHost", { host });
      toast(
        t("profiles.orchestratorChanged", { host: host === "codex" ? "Codex" : "Claude Code" }),
        "ok",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "bad");
    } finally {
      setChanging(false);
    }
  };
  return (
    <Group title={t("profiles.orchestrator")} help={t("profiles.orchestratorHelp")}>
      <Row
        label={t("profiles.orchestrator")}
        hint={busy ? t("profiles.orchestratorBusy") : undefined}
      >
        <select
          aria-label={t("profiles.orchestrator")}
          className={quietSelectClass}
          value={state?.host ?? "claude-code"}
          disabled={!state || busy}
          onChange={(event) => void change(event.target.value as OrchestratorHost)}
        >
          <option value="claude-code">Claude Code</option>
          <option value="codex">Codex</option>
        </select>
      </Row>
    </Group>
  );
}
