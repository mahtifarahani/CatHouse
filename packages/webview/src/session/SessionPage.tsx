import { Badge, Button, inputClass } from "@cathouse/ui";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { onEvent, RpcError, request } from "../lib/rpc";
import { t } from "../lib/strings";
import { usePersistentState } from "../lib/usePersistentState";
import { FolderIcon } from "../pages/RepositoriesPage";
import { AttachButton, Composer } from "./ComposerInput";
import { type Attachment, composeMessage, shouldSubmitComposer } from "./composer";
import { PromptCard } from "./PromptCard";
import { Transcript } from "./Transcript";
import { useSession } from "./useSession";
import { useStickToBottom } from "./useStickToBottom";

const MODES = ["default", "acceptEdits", "plan", "auto"] as const;
const loadWorkspace = () => request("app.workspace", {});

function NewChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 3.5h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6l-3.5 2v-7a2 2 0 0 1 2-2Z" />
      <path d="M12.5 1.5v4M10.5 3.5h4" />
    </svg>
  );
}

function InterruptIcon() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2.5" width="3.5" height="11" rx="0.75" />
      <rect x="9.5" y="2.5" width="3.5" height="11" rx="0.75" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5.5h3.5V2" />
      <path d="M3.5 5a5.5 5.5 0 1 1-.45 5" />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.75v10.5a.75.75 0 0 0 1.14.64l8.25-5.25a.75.75 0 0 0 0-1.28L5.14 2.11A.75.75 0 0 0 4 2.75Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13V3M4.5 6.5 8 3l3.5 3.5" />
    </svg>
  );
}

function InfoTip({ text, side = "bottom" }: { text: string; side?: "top" | "bottom" }) {
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
        className={`invisible absolute start-0 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-sm border border-border bg-muted px-2 py-1.5 text-xs text-foreground opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          side === "top" ? "bottom-full mb-1" : "top-full mt-1"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

/** Compact repo chip for New Chat; full folder management lives in the Repos tab. */
function RepoPicker({
  workspace,
  busy,
  onSelect,
  onAdd,
}: {
  workspace: Awaited<ReturnType<typeof loadWorkspace>> | undefined;
  busy: boolean;
  onSelect: (path: string) => void;
  onAdd: () => void;
}) {
  const folders = workspace?.folders ?? [];
  return (
    <div
      className="ms-auto flex min-w-0 items-center rounded-sm border border-border text-xs"
      title={workspace?.repo ?? undefined}
    >
      <div className="flex min-w-0 items-center gap-1.5 ps-2 text-muted-foreground">
        <FolderIcon className="size-3.5" />
        {folders.length > 1 ? (
          <select
            aria-label={t("workspace.repo")}
            className="min-h-6 min-w-0 max-w-48 truncate bg-transparent py-0.5 pe-1 text-foreground outline-offset-0"
            value={workspace?.repo ?? ""}
            disabled={busy}
            onChange={(e) => onSelect(e.target.value)}
          >
            {folders.map((f) => (
              <option key={f.path} value={f.path}>
                {f.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={`truncate py-0.5 pe-2 ${folders.length ? "text-foreground" : ""}`}>
            {folders[0]?.name ?? t("workspace.none")}
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onAdd}
        aria-label={t("workspace.add")}
        title={t("workspace.add")}
        className="border-s border-border px-1.5 py-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        +
      </button>
    </div>
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
  // Drafts live in webview state so switching tabs or hiding the view keeps them.
  const [task, setTask] = usePersistentState("sessionTask", "");
  const [taskFiles, setTaskFiles] = usePersistentState<Attachment[]>("sessionTaskFiles", []);
  const [mode, setMode] = usePersistentState<(typeof MODES)[number]>("sessionMode", "default");
  const [followUp, setFollowUp] = usePersistentState("sessionFollowUp", "");
  const [followUpFiles, setFollowUpFiles] = usePersistentState<Attachment[]>(
    "sessionFollowUpFiles",
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof loadWorkspace>>>();
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const active = s.phase === "starting" || s.phase === "running";
  const { scrollRef, contentRef, atBottom, jump } = useStickToBottom<
    HTMLDivElement,
    HTMLDivElement
  >();

  useEffect(() => {
    let alive = true;
    const refresh = () => void loadWorkspace().then((next) => alive && setWorkspace(next));
    refresh();
    const off = onEvent("app", refresh);
    return () => {
      alive = false;
      off();
    };
  }, []);

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

  const changeWorkspace = async (fn: () => Promise<unknown>) => {
    setWorkspaceBusy(true);
    try {
      await call(fn);
      setWorkspace(await loadWorkspace());
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const ready = canStart && !!workspace?.repo;
  const hasChat = s.phase !== "idle" || s.events.length > 0 || !!s.error;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="@container flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-[1_1_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-tight">{t("session.title")}</h2>
            <Badge>{s.phase}</Badge>
          </div>
          {s.runId && (
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{s.runId}</p>
          )}
        </div>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!hasChat}
            onClick={() => {
              if (active && !confirmNew) {
                setConfirmNew(true);
                return;
              }
              setConfirmNew(false);
              setFollowUp("");
              setFollowUpFiles([]);
              void call(() => request("session.reset", {}));
            }}
            onBlur={() => setConfirmNew(false)}
            aria-label={t(confirmNew ? "session.newConfirm" : "session.new")}
            title={t("session.new")}
          >
            <NewChatIcon />
            {/* The confirm prompt always shows its text; otherwise icon-only when narrow. */}
            <span className={confirmNew ? undefined : "hidden @md:inline"}>
              {t(confirmNew ? "session.newConfirm" : "session.new")}
            </span>
          </Button>
          <Button
            variant="secondary"
            disabled={!active || !s.turnActive}
            onClick={() => void call(() => request("session.interrupt", {}))}
            aria-label={t("session.interrupt")}
            title={t("session.interrupt")}
          >
            <InterruptIcon />
            <span className="hidden @md:inline">{t("session.interrupt")}</span>
          </Button>
          <Button
            variant="secondary"
            disabled={!active}
            onClick={() => void call(() => request("session.stop", {}))}
            aria-label={t("session.stop")}
            title={t("session.stop")}
          >
            <StopIcon />
            <span className="hidden @md:inline">{t("session.stop")}</span>
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        >
          <div ref={contentRef} className="flex min-w-0 flex-col gap-3 pe-3">
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

            <Transcript events={s.events} />
          </div>
        </div>
        {!atBottom && (
          <Button variant="secondary" className="absolute end-2 bottom-2 shadow" onClick={jump}>
            ↓ {t("session.jumpLatest")}
          </Button>
        )}
      </div>

      {s.prompts.length > 0 && (
        <section
          className="flex max-h-[40vh] shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain pe-3 [scrollbar-gutter:stable]"
          aria-label={t("session.pendingPrompts")}
        >
          {s.prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </section>
      )}

      {!active && (
        <form
          className="@container flex shrink-0 flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const message = composeMessage(task, taskFiles);
            if (message && ready)
              void call(async () => {
                await request("session.start", {
                  task: message,
                  repo: workspace?.repo ?? undefined,
                  permissionMode: mode,
                });
                setTask("");
                setTaskFiles([]);
              });
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="catherd-task" className="font-semibold">
                {t("session.taskLabel")}
              </label>
              <InfoTip text={t("session.roleGuide")} />
              <RepoPicker
                workspace={workspace}
                busy={workspaceBusy}
                onSelect={(path) => void changeWorkspace(() => request("app.setRepo", { path }))}
                onAdd={() => void changeWorkspace(() => request("app.addFolders", {}))}
              />
            </div>
            <Composer
              id="catherd-task"
              value={task}
              onChange={setTask}
              attachments={taskFiles}
              onAttachments={setTaskFiles}
              onKeyDown={submitOnEnter}
              onError={setError}
              placeholder={t("session.taskPlaceholder")}
            />
          </div>

          {!ready && (
            <p
              role="status"
              className="rounded-sm border border-warning px-3 py-2 text-warning leading-relaxed"
            >
              {t("session.blocked", {
                reason: workspace?.repo ? (blockedReason ?? "") : t("workspace.required"),
              })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
              <InfoTip text={t("session.modeHelp")} side="top" />
              <select
                aria-label={t("session.mode")}
                className={`${inputClass} min-w-0 max-w-full truncate`}
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
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <AttachButton onAttachments={setTaskFiles} onError={setError} />
              <Button
                className="min-h-9"
                variant="secondary"
                disabled={!ready}
                aria-label={t("session.resume")}
                title={t("session.resume")}
                onClick={() =>
                  void call(() => request("session.resume", { repo: workspace?.repo ?? undefined }))
                }
              >
                <ResumeIcon />
                <span className="hidden @xl:inline">{t("session.resume")}</span>
              </Button>
              <Button
                className="min-h-9"
                type="submit"
                disabled={(!task.trim() && !taskFiles.length) || !ready}
              >
                <StartIcon />
                {t("session.start")}
              </Button>
            </div>
          </div>
        </form>
      )}

      {active && (
        <form
          className="@container flex shrink-0 flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = composeMessage(followUp, followUpFiles);
            if (!text) return;
            setFollowUp("");
            setFollowUpFiles([]);
            jump();
            void call(() => request("session.send", { text }));
          }}
        >
          <Composer
            value={followUp}
            onChange={setFollowUp}
            attachments={followUpFiles}
            onAttachments={setFollowUpFiles}
            onKeyDown={submitOnEnter}
            onError={setError}
            placeholder={t("session.followUp")}
          />
          <div className="flex w-full items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <InfoTip text={t("session.modeHelp")} side="top" />
              <select
                aria-label={t("session.mode")}
                className={`${inputClass} min-w-0 max-w-full truncate`}
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
            <AttachButton onAttachments={setFollowUpFiles} onError={setError} />
            <Button
              className="min-h-9 min-w-20 shrink-0"
              type="submit"
              disabled={!followUp.trim() && !followUpFiles.length}
            >
              <SendIcon />
              {t("session.send")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
