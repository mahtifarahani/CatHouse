import { randomUUID } from "node:crypto";
import type {
  OrchestratorHost,
  PendingPrompt,
  PromptAnswer,
  PromptRequest,
  SessionEvent,
  SessionState,
  SessionTopic,
} from "@cathouse/protocol";
import { HandlerError } from "../panel/router";
import type { SessionOptions } from "./session";

// Owns the one orchestrator session of a window: start / resume / send / answer / stop, the
// pending prompt cards, a bounded transcript for webview reloads, and the run ↔ session link.
// Kept free of `vscode`; the extension injects storage, broadcasting and the session factory.

export interface SavedLink {
  host?: OrchestratorHost;
  runId?: string;
  sessionId: string;
  savedAt: string;
}

export interface SessionLike {
  sessionId: string | undefined;
  runId: string | undefined;
  start(): Promise<void>;
  send(text: string): void;
  interrupt(): Promise<void>;
  setPermissionMode?(mode: NonNullable<SessionOptions["permissionMode"]>): Promise<void>;
  finished(): Promise<void>;
  close(): void;
}

export interface ControllerDeps {
  host: () => OrchestratorHost;
  env: () => Promise<Record<string, string>>;
  findPluginPath: () => Promise<string | undefined>;
  links: { get(repo: string): SavedLink | undefined; set(repo: string, link: SavedLink): void };
  sessionExists: (sessionId: string, host: OrchestratorHost) => Promise<boolean>;
  createSession: (opts: SessionOptions) => SessionLike;
  broadcast: (payload: SessionTopic) => void;
  log: (line: string) => void;
  /** Called whenever the number of pending prompt cards changes (badge, notification). */
  onPromptsChanged?: (count: number, latest?: PromptRequest) => void;
}

const MAX_EVENTS = 500;
export const RESUME_PROMPT = (runId: string | undefined) =>
  `CatHouse reconnected after a window reload. Continue${runId ? ` catherd run ${runId}` : " the catherd run"} from where it stopped: call peek(${runId ? `"${runId}"` : "run"}) first to see live roles, unread records and the next protocol step, read each unread record with result before dispatching anything, then carry on following the catherd skill.`;

type Pending = { request: PromptRequest; resolve: (a: PromptAnswer) => void };

export class SessionController {
  private session: SessionLike | undefined;
  private state: Omit<SessionState, "prompts"> = {
    phase: "idle",
    turnActive: false,
    events: [],
  };
  private readonly prompts = new Map<string, Pending>();

  constructor(private readonly deps: ControllerDeps) {}

  snapshot(): SessionState {
    const prompts: PendingPrompt[] = [...this.prompts].map(([id, p]) => ({
      id,
      request: p.request,
    }));
    return { ...this.state, events: [...this.state.events], prompts };
  }

  private publishState(): SessionState {
    const state = this.snapshot();
    this.deps.broadcast({ type: "state", state });
    return state;
  }

  private push(event: SessionEvent): void {
    this.state.events.push(event);
    if (this.state.events.length > MAX_EVENTS) this.state.events.splice(0, 100);
    this.deps.broadcast({ type: "event", event });
  }

  private onEvent(repo: string, e: SessionEvent): void {
    // Every turn the session starts by itself (a catherd push) re-sends `init`; show it once.
    if (e.kind === "init" && this.state.sessionId === e.sessionId) return;
    if (e.kind === "inbound") {
      this.state.turnActive = true;
      this.push(e);
      this.publishState();
      return;
    }
    if (e.kind === "init") {
      this.state.sessionId = e.sessionId;
      this.state.phase = "running";
      if (
        this.deps.host() === "claude-code" &&
        (!e.catherdPlugin || e.catherdMcpStatus === "failed")
      ) {
        this.deps.log(
          `catherd plugin missing or its MCP server failed (${e.catherdMcpStatus ?? "absent"})`,
        );
      }
      this.saveLink(repo);
    }
    if (e.kind === "run_started") {
      this.state.runId = e.runId;
      this.saveLink(repo);
    }
    if (e.kind === "result") this.state.turnActive = false;
    this.push(e);
    if (e.kind === "init" || e.kind === "run_started" || e.kind === "result") {
      this.publishState();
    }
  }

  private saveLink(repo: string): void {
    if (!this.state.sessionId) return;
    this.deps.links.set(repo, {
      host: this.deps.host(),
      sessionId: this.state.sessionId,
      ...(this.state.runId ? { runId: this.state.runId } : {}),
      savedAt: new Date().toISOString(),
    });
  }

  private onPrompt(request: PromptRequest, signal: AbortSignal): Promise<PromptAnswer> {
    const id = randomUUID();
    return new Promise((resolve) => {
      const done = (answer: PromptAnswer) => {
        if (!this.prompts.delete(id)) return;
        this.deps.broadcast({ type: "prompt_resolved", id });
        this.deps.onPromptsChanged?.(this.prompts.size);
        resolve(answer);
      };
      this.prompts.set(id, { request, resolve: done });
      this.deps.onPromptsChanged?.(this.prompts.size, request);
      signal.addEventListener("abort", () =>
        done(
          request.kind === "question"
            ? { kind: "question", answers: {} }
            : { kind: "permission", decision: "deny", message: "cancelled" },
        ),
      );
      this.deps.broadcast({ type: "prompt", prompt: { id, request } });
    });
  }

  private async launch(
    repo: string,
    prompt: string,
    resume?: string,
    first?: SessionEvent,
    permissionMode: NonNullable<SessionOptions["permissionMode"]> = "default",
  ): Promise<SessionState> {
    if (this.session) {
      throw new HandlerError(
        "E_SESSION_ACTIVE",
        "an orchestrator session is already running in this window",
        "stop it first, or keep working in it",
      );
    }
    const host = this.deps.host();
    const pluginPath = host === "claude-code" ? await this.deps.findPluginPath() : undefined;
    if (host === "claude-code" && !pluginPath) {
      throw new HandlerError(
        "E_PLUGIN_MISSING",
        "the catherd Claude plugin is not installed",
        "open CatHouse Setup and install the plugin",
      );
    }
    this.state = {
      phase: "starting",
      turnActive: true,
      repo,
      permissionMode,
      events: first ? [first] : [],
    };
    if (first) this.deps.broadcast({ type: "event", event: first });
    const session = this.deps.createSession({
      host,
      repo,
      prompt,
      ...(pluginPath ? { pluginPath } : {}),
      env: await this.deps.env(),
      ...(resume ? { resume } : {}),
      permissionMode,
      onEvent: (e) => this.onEvent(repo, e as SessionEvent),
      onPrompt: (req, signal) => this.onPrompt(req, signal),
      onStderr: (s) => this.deps.log(s.trimEnd()),
    });
    this.session = session;
    try {
      await session.start();
    } catch (e) {
      session.close();
      this.session = undefined;
      const detail = e instanceof Error ? e.message.trim() || e.name : String(e);
      this.state = {
        phase: "ended",
        turnActive: false,
        repo,
        events: [...this.state.events],
        error: { code: "E_SESSION_START", message: detail || "Could not start the session" },
      };
      return this.publishState();
    }
    void session
      .finished()
      .catch((e: unknown) => {
        this.state.error = {
          code: "E_SESSION_FAILED",
          message: e instanceof Error ? e.message : String(e),
        };
      })
      .finally(() => {
        if (this.session !== session) return;
        this.session = undefined;
        this.state.phase = "ended";
        this.state.turnActive = false;
        for (const p of this.prompts.values()) p.resolve({ kind: "question", answers: {} });
        this.prompts.clear();
        this.deps.onPromptsChanged?.(0);
        this.publishState();
      });
    return this.publishState();
  }

  start(
    repo: string,
    task: string,
    permissionMode: NonNullable<SessionOptions["permissionMode"]> = "default",
  ): Promise<SessionState> {
    return this.launch(
      repo,
      this.deps.host() === "codex" ? task : `/catherd:catherd ${task}`,
      undefined,
      { kind: "user", text: task },
      permissionMode,
    );
  }

  async setPermissionMode(mode: NonNullable<SessionOptions["permissionMode"]>): Promise<void> {
    if (!this.session?.setPermissionMode)
      throw new HandlerError("E_SESSION_IDLE", "no orchestrator session is running");
    await this.session.setPermissionMode(mode);
    this.state.permissionMode = mode;
    this.publishState();
  }

  /**
   * Continues the saved run after a reload: resume the saved Claude session when its transcript
   * still exists, else start a fresh session with an empty /catherd:catherd (the skill resumes the
   * latest run). Never sends a task, so it never calls run_start again (docs/spikes/phase1.md d).
   */
  async resume(repo: string): Promise<SessionState> {
    const link = this.deps.links.get(repo);
    if (link && (link.host ?? "claude-code") !== this.deps.host()) {
      throw new HandlerError(
        "E_HOST_MISMATCH",
        `the saved run belongs to ${link.host ?? "claude-code"}`,
        "switch back to that orchestrator in Profile, or start a new chat",
      );
    }
    if (!link && this.deps.host() === "codex") {
      throw new HandlerError(
        "E_NO_SAVED_RUN",
        "there is no saved Codex session for this repository",
        "start a new chat",
      );
    }
    if (link && (await this.deps.sessionExists(link.sessionId, this.deps.host()))) {
      const state = await this.launch(repo, RESUME_PROMPT(link.runId), link.sessionId);
      if (link.runId) this.state.runId = link.runId;
      return state;
    }
    return this.launch(
      repo,
      this.deps.host() === "codex" ? "Resume the latest catherd run." : "/catherd:catherd",
    );
  }

  send(text: string): void {
    if (!this.session)
      throw new HandlerError("E_SESSION_IDLE", "no orchestrator session is running");
    this.push({ kind: "user", text });
    this.state.turnActive = true;
    this.session.send(text);
    this.publishState();
  }

  /**
   * A role was cancelled from the dashboard. catherd pushes the cancelled record to the session
   * that owns the run; this note tells the live session it was the user's choice (ADR 0005).
   */
  noteRoleCancelled(runId: string, name: string, status: string): boolean {
    if (!this.session || this.state.runId !== runId) return false;
    const text = `CatHouse: the user cancelled role ${name} from the dashboard (record status: ${status}). catherd announces its record as usual; read it with result, then decide the next step.`;
    this.push({ kind: "user", text });
    this.session.send(text);
    return true;
  }

  async interrupt(): Promise<void> {
    if (!this.session || !this.state.turnActive) return;
    await this.session.interrupt();
    this.state.turnActive = false;
    this.publishState();
  }

  answer(id: string, answer: PromptAnswer): boolean {
    const p = this.prompts.get(id);
    if (!p || p.request.kind !== answer.kind) return false;
    p.resolve(answer);
    return true;
  }

  stop(): SessionState {
    const s = this.session;
    this.session = undefined;
    s?.close();
    this.state.phase = "ended";
    this.state.turnActive = false;
    for (const p of this.prompts.values()) {
      p.resolve(
        p.request.kind === "question"
          ? { kind: "question", answers: {} }
          : { kind: "permission", decision: "deny", message: "session stopped" },
      );
    }
    this.prompts.clear();
    this.deps.onPromptsChanged?.(0);
    return this.publishState();
  }

  /**
   * "New chat": stops any live session and clears the transcript back to the empty composer.
   * The run ↔ session link stays saved, so "Resume saved run" can still reopen the old chat.
   */
  reset(): SessionState {
    if (this.session) this.stop();
    this.state = { phase: "idle", turnActive: false, events: [] };
    return this.publishState();
  }

  dispose(): void {
    this.stop();
  }
}
