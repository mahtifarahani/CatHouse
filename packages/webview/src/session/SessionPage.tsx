import { Button, cn, Icon, IconButton, Menu, MenuItem, MenuSeparator } from "@cathouse/ui";
import { type KeyboardEvent, useEffect, useState } from "react";
import { onEvent, RpcError, request } from "../lib/rpc";
import { t } from "../lib/strings";
import { usePersistentState } from "../lib/usePersistentState";
import { usePoll } from "../lib/usePoll";
import { AttachButton, Composer } from "./ComposerInput";
import { type Attachment, composeMessage, shouldSubmitComposer } from "./composer";
import { LiveRoles } from "./LiveRoles";
import { PromptCard } from "./PromptCard";
import { Transcript } from "./Transcript";
import { orchestratorModel, useSession } from "./useSession";
import { useStickToBottom } from "./useStickToBottom";

const MODES = ["default", "acceptEdits", "plan", "auto"] as const;
type Mode = (typeof MODES)[number];
const loadWorkspace = () => request("app.workspace", {});
type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;

/** The repo chip above the input: switch, add or remove workspace folders in one menu. */
function RepoMenu({
  workspace,
  locked,
  change,
}: {
  workspace: Workspace | undefined;
  locked: boolean;
  change: (fn: () => Promise<unknown>) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const folders = workspace?.folders ?? [];
  const current = folders.find((f) => f.path === workspace?.repo);
  return (
    <Menu
      label={t("workspace.repo")}
      side="top"
      align="start"
      triggerClassName="max-w-full"
      trigger={
        <>
          <Icon name="folder" />
          <span className={cn("truncate", !current && "text-warning")}>
            {current?.name ?? t("workspace.none")}
          </span>
          <Icon name="chevronDown" className="size-3 opacity-70" />
        </>
      }
    >
      {(close) => (
        <>
          {folders.map((f) => (
            <MenuItem
              key={f.path}
              checked={f.path === workspace?.repo}
              disabled={locked}
              hint={<span className="hidden @[24rem]:inline">{f.path}</span>}
              onSelect={() => {
                close();
                if (f.path !== workspace?.repo)
                  change(() => request("app.setRepo", { path: f.path }));
              }}
            >
              {f.name}
            </MenuItem>
          ))}
          {folders.length > 0 && <MenuSeparator />}
          <MenuItem
            icon="plus"
            disabled={locked}
            onSelect={() => {
              close();
              change(() => request("app.addFolders", {}));
            }}
          >
            {t("workspace.add")}
          </MenuItem>
          {current && (
            <MenuItem
              icon="x"
              danger
              disabled={locked}
              onSelect={() => {
                if (!confirmRemove) return setConfirmRemove(true);
                setConfirmRemove(false);
                close();
                change(() => request("app.removeFolder", { path: current.path }));
              }}
            >
              {confirmRemove
                ? t("workspace.removeConfirm")
                : t("workspace.removeNamed", { name: current.name })}
            </MenuItem>
          )}
          {locked && (
            <p className="m-0 px-2 py-1 text-xs text-muted-foreground">{t("workspace.locked")}</p>
          )}
        </>
      )}
    </Menu>
  );
}

export interface SessionPageProps {
  canStart: boolean;
  blockedReason?: string | undefined;
  profile?: string | undefined;
  onOpenRun?: ((id: string) => void) | undefined;
  onGoSetup?: (() => void) | undefined;
  onGoProfiles?: (() => void) | undefined;
}

export function SessionPage({ canStart, blockedReason }: SessionPageProps) {
  const s = useSession();
  // One draft for both "new task" and "follow-up"; it lives in webview state so switching tabs
  // or hiding the view keeps it.
  const [draft, setDraft] = usePersistentState("sessionDraft", "");
  const [files, setFiles] = usePersistentState<Attachment[]>("sessionDraftFiles", []);
  const [startMode, setStartMode] = usePersistentState<Mode>("sessionMode", "default");
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>();
  const [confirmNew, setConfirmNew] = useState(false);
  const active = s.phase === "starting" || s.phase === "running";
  const { scrollRef, contentRef, atBottom, jump } = useStickToBottom<
    HTMLDivElement,
    HTMLDivElement
  >();
  const profile = usePoll(
    () => (workspace?.repo ? request("profiles.get", {}) : Promise.resolve(undefined)),
    10_000,
    `chat-profile-${workspace?.repo ?? "none"}`,
  );
  const run = usePoll(
    () => (s.runId ? request("runs.get", { id: s.runId }) : Promise.resolve(undefined)),
    2000,
    `chat-run-${s.runId ?? "none"}`,
    !s.runId || !active,
  );

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
  const changeWorkspace = (fn: () => Promise<unknown>) =>
    void call(fn).then(() => loadWorkspace().then(setWorkspace));

  const ready = canStart && !!workspace?.repo;
  const hasChat = s.phase !== "idle" || s.events.length > 0 || !!s.error;
  const message = composeMessage(draft, files);
  const model = orchestratorModel(s.events);
  const mode = (active ? (s.permissionMode ?? "default") : startMode) as Mode;
  // The one primary button: Start a task, Send a follow-up, or Stop the turn that is running.
  const primary: "start" | "send" | "stop" = !active
    ? "start"
    : s.turnActive && !message
      ? "stop"
      : "send";

  const submit = () => {
    if (!message) return;
    if (!active) {
      if (!ready) return;
      void call(async () => {
        await request("session.start", {
          task: message,
          repo: workspace?.repo ?? undefined,
          permissionMode: startMode,
        });
        setDraft("");
        setFiles([]);
      });
      return;
    }
    setDraft("");
    setFiles([]);
    jump();
    void call(() => request("session.send", { text: message }));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !shouldSubmitComposer({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    )
      return;
    event.preventDefault();
    submit();
  };
  const resume = () =>
    void call(() => request("session.resume", { repo: workspace?.repo ?? undefined }));
  const newChat = () => {
    if (active && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    setConfirmNew(false);
    void call(() => request("session.reset", {}));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 [scrollbar-gutter:stable]"
        >
          <div ref={contentRef} className="flex min-w-0 flex-col gap-2 pt-1 pb-3">
            {!hasChat && (
              <Welcome
                ready={ready}
                reason={workspace?.repo ? blockedReason : t("workspace.required")}
                onResume={resume}
              />
            )}
            <Transcript events={s.events} model={model} />
            {error && (
              <p role="alert" className="m-0 rounded-md bg-danger/10 px-3 py-2 text-danger">
                {error}
              </p>
            )}
            {s.error && (
              <p role="alert" className="m-0 rounded-md bg-danger/10 px-3 py-2 text-danger">
                {s.error.message}
                {s.error.fix && <span className="block text-xs opacity-80">{s.error.fix}</span>}
              </p>
            )}
            {s.turnActive && (
              <p className="m-0 flex items-center gap-1.5 ps-7 text-xs text-muted-foreground">
                <Icon name="spinner" />
                {t("session.working")}
              </p>
            )}
          </div>
        </div>
        {!atBottom && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full shadow"
            onClick={jump}
          >
            <Icon name="chevronDown" />
            {t("session.jumpLatest")}
          </Button>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 px-2 pt-1 pb-2">
        {s.prompts.length > 0 && (
          <section
            className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto overscroll-contain"
            aria-label={t("session.pendingPrompts")}
          >
            {s.prompts.map((p) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </section>
        )}
        {run.data && <LiveRoles run={run.data} />}

        {/* Context: where the task runs, which profile routes it, which model orchestrates. */}
        <div className="flex min-w-0 items-center gap-0.5 text-xs">
          <div className="min-w-0 shrink">
            <RepoMenu workspace={workspace} locked={active} change={changeWorkspace} />
          </div>
          {profile.data && (
            <span
              className="hidden min-w-0 shrink items-center gap-1 truncate px-1.5 text-muted-foreground @[18rem]:inline-flex"
              title={t("session.profileHint", { name: profile.data.here })}
            >
              <Icon name="sliders" />
              <span className="truncate">{profile.data.here}</span>
            </span>
          )}
          {model && (
            <span
              className="hidden min-w-0 shrink items-center gap-1 truncate px-1.5 text-muted-foreground @[24rem]:inline-flex"
              title={t("session.modelHint", { model })}
            >
              <Icon name="cat" />
              <span className="truncate">{model}</span>
            </span>
          )}
          <span className="ms-auto flex shrink-0 items-center">
            {hasChat &&
              (confirmNew ? (
                <Button
                  variant="quiet"
                  size="sm"
                  className="text-warning"
                  onClick={newChat}
                  onBlur={() => setConfirmNew(false)}
                >
                  {t("session.newConfirm")}
                </Button>
              ) : (
                <IconButton small icon="newChat" label={t("session.new")} onClick={newChat} />
              ))}
            {(active || (ready && !hasChat)) && (
              <Menu label={t("session.more")} side="top" trigger={<Icon name="more" />}>
                {(close) => (
                  <>
                    {!active && (
                      <MenuItem
                        icon="resume"
                        onSelect={() => {
                          close();
                          resume();
                        }}
                      >
                        {t("session.resume")}
                      </MenuItem>
                    )}
                    {active && (
                      <MenuItem
                        icon="stop"
                        danger
                        onSelect={() => {
                          close();
                          void call(() => request("session.stop", {}));
                        }}
                      >
                        {t("session.stop")}
                      </MenuItem>
                    )}
                  </>
                )}
              </Menu>
            )}
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Composer
            id="catherd-task"
            value={draft}
            onChange={setDraft}
            attachments={files}
            onAttachments={setFiles}
            onKeyDown={onKeyDown}
            onError={setError}
            placeholder={active ? t("session.followUp") : t("session.taskPlaceholder")}
            footer={
              <>
                <label
                  className="relative flex min-h-7 min-w-0 shrink items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-within:outline focus-within:outline-1 focus-within:outline-focus"
                  title={t("session.modeHelp")}
                >
                  <span className="sr-only">{t("session.mode")}</span>
                  <span aria-hidden="true" className="truncate">
                    {t(`session.mode.${mode}`)}
                  </span>
                  <select
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    value={mode}
                    onChange={(e) => {
                      const next = e.target.value as Mode;
                      if (active) void call(() => request("session.setMode", { mode: next }));
                      else setStartMode(next);
                    }}
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {t(`session.mode.${m}`)}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" className="pointer-events-none size-3 shrink-0" />
                </label>
                <span className="ms-auto flex shrink-0 items-center gap-1">
                  <AttachButton onAttachments={setFiles} onError={setError} />
                  {primary === "stop" ? (
                    <Button
                      size="icon"
                      className="rounded-full"
                      aria-label={t("session.interrupt")}
                      title={t("session.interrupt")}
                      onClick={() => void call(() => request("session.interrupt", {}))}
                    >
                      <Icon name="stop" className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-full"
                      disabled={!message || (primary === "start" && !ready)}
                      aria-label={t(primary === "start" ? "session.start" : "session.send")}
                      title={t(primary === "start" ? "session.start" : "session.send")}
                    >
                      <Icon name="arrowUp" />
                    </Button>
                  )}
                </span>
              </>
            }
          />
        </form>
      </div>
    </div>
  );
}

/** The empty chat: what catherd does, and why it can't start yet if something is missing. */
function Welcome({
  ready,
  reason,
  onResume,
}: {
  ready: boolean;
  reason: string | undefined;
  onResume: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 pt-[12vh] text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon name="cat" className="size-5" />
      </span>
      <h2 className="m-0 text-base font-semibold">{t("session.welcome")}</h2>
      <p className="m-0 max-w-80 text-xs text-muted-foreground">{t("session.roleGuide")}</p>
      {ready ? (
        <button type="button" className="text-xs text-link hover:underline" onClick={onResume}>
          {t("session.resumeLink")}
        </button>
      ) : (
        <p
          role="status"
          className="m-0 max-w-80 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          {t("session.blocked", { reason: reason ?? "" })}
        </p>
      )}
    </div>
  );
}
