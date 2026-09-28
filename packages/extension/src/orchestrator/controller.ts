import { randomUUID } from "node:crypto";
import type {
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
  finished(): Promise<void>;
  close(): void;
}

export interface ControllerDeps {
  env: () => Promise<Record<string, string>>;
  findPluginPath: () => Promise<string | undefined>;
  links: { get(repo: string): SavedLink | undefined; set(repo: string, link: SavedLink): void };
  sessionExists: (sessionId: string) => Promise<boolean>;
  createSession: (opts: SessionOptions) => SessionLike;
  broadcast: (payload: SessionTopic) => void;
  log: (line: string) => void;
}

const MAX_EVENTS = 500;
export const RESUME_PROMPT = (runId: string | undefined) =>
  `CatHouse reconnected after a window reload. Continue${runId ? ` catherd run ${runId}` : " the catherd run"} from where it stopped: call status() first, collect any roles left running with wait before dispatching anything, then carry on following the catherd skill.`;

type Pending = { request: PromptRequest; resolve: (a: PromptAnswer) => void };

export class SessionController {
  private session: SessionLike | undefined;
  private state: Omit<SessionState, "prompts"> = { phase: "idle", events: [] };
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
    if (e.kind === "init") {
      this.state.sessionId = e.sessionId;
      this.state.phase = "running";
      if (!e.catherdPlugin || e.catherdMcpStatus === "failed") {
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
    this.push(e);
    if (e.kind === "init" || e.kind === "run_started") this.publishState();
  }

  private saveLink(repo: string): void {
    if (!this.state.sessionId) return;
    this.deps.links.set(repo, {
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
        resolve(answer);
      };
      this.prompts.set(id, { request, resolve: done });
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
  ): Promise<SessionState> {
    if (this.session) {
      throw new HandlerError(
        "E_SESSION_ACTIVE",
        "an orchestrator session is already running in this window",
        "stop it first, or keep working in it",
      );
    }
    const pluginPath = await this.deps.findPluginPath();
    if (!pluginPath) {
      throw new HandlerError(
        "E_PLUGIN_MISSING",
        "the catherd Claude plugin is not installed",
        "open CatHouse Setup and install the plugin",
      );
    }
    this.state = { phase: "starting", repo, events: first ? [first] : [] };
    if (first) this.deps.broadcast({ type: "event", event: first });
    const session = this.deps.createSession({
      repo,
      prompt,
      pluginPath,
      env: await this.deps.env(),
      ...(resume ? { resume } : {}),
      onEvent: (e) => this.onEvent(repo, e as SessionEvent),
      onPrompt: (req, signal) => this.onPrompt(req, signal),
      onStderr: (s) => this.deps.log(s.trimEnd()),
    });
    this.session = session;
    try {
      await session.start();
    } catch (e) {
      this.session = undefined;
      this.state = {
        phase: "ended",
        repo,
        events: [],
        error: { code: "E_SESSION_START", message: e instanceof Error ? e.message : String(e) },
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
        for (const p of this.prompts.values()) p.resolve({ kind: "question", answers: {} });
        this.prompts.clear();
        this.publishState();
      });
    return this.publishState();
  }

  start(repo: string, task: string): Promise<SessionState> {
    return this.launch(repo, `/catherd:catherd ${task}`, undefined, { kind: "user", text: task });
  }

  /**
   * Continues the saved run after a reload: resume the saved Claude session when its transcript
   * still exists, else start a fresh session with an empty /catherd:catherd (the skill resumes the
   * latest run). Never sends a task, so it never calls run_start again (docs/spikes/phase1.md d).
   */
  async resume(repo: string): Promise<SessionState> {
    const link = this.deps.links.get(repo);
    if (link && (await this.deps.sessionExists(link.sessionId))) {
      const state = await this.launch(repo, RESUME_PROMPT(link.runId), link.sessionId);
      if (link.runId) this.state.runId = link.runId;
      return state;
    }
    return this.launch(repo, "/catherd:catherd");
  }

  send(text: string): void {
    if (!this.session)
      throw new HandlerError("E_SESSION_IDLE", "no orchestrator session is running");
    this.push({ kind: "user", text });
    this.session.send(text);
  }

  /**
   * A role was cancelled from the dashboard. catherd's cancel hands the record to CatHouse, so the
   * orchestrator's wait will never return it: tell the live session (ADR 0005).
   */
  noteRoleCancelled(runId: string, name: string, status: string): boolean {
    if (!this.session || this.state.runId !== runId) return false;
    const text = `CatHouse: the user cancelled role ${name} from the dashboard (record status: ${status}). Its record will not come back from wait; decide the next step.`;
    this.push({ kind: "user", text });
    this.session.send(text);
    return true;
  }

  async interrupt(): Promise<void> {
    await this.session?.interrupt();
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
    for (const p of this.prompts.values()) {
      p.resolve(
        p.request.kind === "question"
          ? { kind: "question", answers: {} }
          : { kind: "permission", decision: "deny", message: "session stopped" },
      );
    }
    this.prompts.clear();
    return this.publishState();
  }

  dispose(): void {
    this.stop();
  }
}
