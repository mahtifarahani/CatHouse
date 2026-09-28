import { Button } from "@cathouse/ui";
import { useState } from "react";
import { RpcError, request } from "../lib/rpc";
import { t } from "../lib/strings";
import { PromptCard } from "./PromptCard";
import { Transcript } from "./Transcript";
import { useSession } from "./useSession";

export function SessionPage() {
  const s = useSession();
  const [task, setTask] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const active = s.phase === "starting" || s.phase === "running";

  const call = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof RpcError
          ? `${e.error.message}${e.error.fix ? ` — ${e.error.fix}` : ""}`
          : String(e),
      );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{t("session.title")}</h2>
        <span className="rounded-sm bg-badge px-1.5 text-badge-foreground">{s.phase}</span>
        {s.runId && <span className="font-mono text-xs text-muted-foreground">{s.runId}</span>}
        {active && (
          <span className="ms-auto flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void call(() => request("session.interrupt", {}))}
            >
              {t("session.interrupt")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void call(() => request("session.stop", {}))}
            >
              {t("session.stop")}
            </Button>
          </span>
        )}
      </header>

      {!active && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (task.trim()) void call(() => request("session.start", { task: task.trim() }));
          }}
        >
          <label className="flex flex-col gap-1">
            <span>{t("session.taskLabel")}</span>
            <textarea
              rows={4}
              className="rounded-sm border border-input-border bg-input p-2 text-input-foreground"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={t("session.taskPlaceholder")}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!task.trim()}>
              {t("session.start")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void call(() => request("session.resume", {}))}
            >
              {t("session.resume")}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {s.error && (
        <p role="alert" className="text-danger">
          {s.error.code}: {s.error.message}
        </p>
      )}

      {s.prompts.map((p) => (
        <PromptCard key={p.id} prompt={p} />
      ))}

      <Transcript events={s.events} />

      {active && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = followUp.trim();
            if (!text) return;
            setFollowUp("");
            void call(() => request("session.send", { text }));
          }}
        >
          <input
            className="flex-1 rounded-sm border border-input-border bg-input px-2 py-1 text-input-foreground"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder={t("session.followUp")}
          />
          <Button type="submit" variant="secondary">
            {t("session.send")}
          </Button>
        </form>
      )}
    </div>
  );
}
