import { Badge, Button, inputClass } from "@cathouse/ui";
import { type KeyboardEvent, useId, useState } from "react";
import { RpcError, request } from "../lib/rpc";
import { t } from "../lib/strings";
import { shouldSubmitComposer } from "./composer";
import { PromptCard } from "./PromptCard";
import { Transcript } from "./Transcript";
import { useSession } from "./useSession";

const MODES = ["default", "acceptEdits", "plan", "auto"] as const;
const COMPOSER_CLASS =
  "min-h-32 w-full resize-y rounded-sm border border-input-border bg-input px-3 py-2 text-base text-input-foreground leading-6";

function InfoTip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={t("common.info")}
        aria-describedby={id}
        className="inline-flex size-5 items-center justify-center rounded-full border border-border text-xs text-muted-foreground hover:text-foreground"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="invisible absolute top-full start-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-sm border border-border bg-muted px-2 py-1.5 text-xs text-foreground opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function SessionPage({
  canStart,
  blockedReason,
}: {
  canStart: boolean;
  blockedReason?: string | undefined;
}) {
  const s = useSession();
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<"default" | "acceptEdits" | "plan" | "auto">("default");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const active = s.phase === "starting" || s.phase === "running";

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !shouldSubmitComposer({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    )
      return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-tight">{t("session.title")}</h2>
            <Badge>{s.phase}</Badge>
          </div>
          {s.runId && (
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{s.runId}</p>
          )}
        </div>
        {active && (
          <div className="ms-auto flex flex-wrap gap-2">
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
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
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
      </div>

      {!active && (
        <form
          className="flex shrink-0 flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (task.trim() && canStart)
              void call(() =>
                request("session.start", { task: task.trim(), permissionMode: mode }),
              );
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="catherd-task" className="font-semibold">
                {t("session.taskLabel")}
              </label>
              <InfoTip text={t("session.roleGuide")} />
            </div>
            <div className="px-[2px]">
              <textarea
                id="catherd-task"
                rows={4}
                className={COMPOSER_CLASS}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={submitOnEnter}
                aria-keyshortcuts="Enter Shift+Enter"
                placeholder={t("session.taskPlaceholder")}
              />
            </div>
          </div>

          {!canStart && (
            <p
              role="status"
              className="rounded-sm border border-warning px-3 py-2 text-warning leading-relaxed"
            >
              {t("session.blocked", { reason: blockedReason ?? "" })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="me-auto flex items-center gap-2">
              <InfoTip text={t("session.modeHelp")} />
              <select
                aria-label={t("session.mode")}
                className={inputClass}
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`session.mode.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="min-h-9"
              variant="secondary"
              onClick={() => void call(() => request("session.resume", {}))}
            >
              {t("session.resume")}
            </Button>
            <Button className="min-h-9" type="submit" disabled={!task.trim() || !canStart}>
              {t("session.start")}
            </Button>
          </div>
        </form>
      )}

      {active && (
        <form
          className="flex shrink-0 flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = followUp.trim();
            if (!text) return;
            setFollowUp("");
            void call(() => request("session.send", { text }));
          }}
        >
          <div className="w-full px-[2px]">
            <textarea
              rows={4}
              className={COMPOSER_CLASS}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={submitOnEnter}
              aria-keyshortcuts="Enter Shift+Enter"
              placeholder={t("session.followUp")}
            />
          </div>
          <div className="flex w-full items-center gap-2">
            <div className="me-auto flex items-center gap-2">
              <InfoTip text={t("session.modeHelp")} />
              <select
                aria-label={t("session.mode")}
                className={inputClass}
                value={s.permissionMode ?? "default"}
                onChange={(e) =>
                  void call(() =>
                    request("session.setMode", { mode: e.target.value as typeof mode }),
                  )
                }
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`session.mode.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button className="min-h-9 min-w-20" type="submit">
              {t("session.send")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
