import { homedir } from "node:os";
import { join } from "node:path";
import type { PromptAnswer, PromptRequest, SessionEvent } from "@cathouse/protocol";
import WebSocket from "ws";
import type { SessionOptions } from "./session";

type Json = Record<string, unknown>;
type Pending = { resolve: (value: Json) => void; reject: (error: Error) => void };

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function textContent(value: unknown): string {
  return Array.isArray(value)
    ? value.map((part) => String(object(part).text ?? "")).join("")
    : typeof value === "string"
      ? value
      : "";
}

/** One native Codex app-server thread. The user's Codex login, plugins and config stay in use. */
export class CodexSession {
  private socket: WebSocket | undefined;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private activeTurn: string | undefined;
  private ownTurnPending = false;
  private permissionMode: NonNullable<SessionOptions["permissionMode"]>;
  private skillPath: string | undefined;
  private doneResolve!: () => void;
  private doneReject!: (reason: Error) => void;
  private done = new Promise<void>((resolve, reject) => {
    this.doneResolve = resolve;
    this.doneReject = reject;
  });
  private stopped = false;
  sessionId: string | undefined;
  runId: string | undefined;

  constructor(private readonly opts: SessionOptions) {
    this.permissionMode = opts.permissionMode ?? "default";
    // start() can fail before the controller subscribes to finished().
    void this.done.catch(() => {});
  }

  private write(message: Json): void {
    if (this.socket?.readyState !== WebSocket.OPEN)
      throw new Error("Codex app-server is not connected");
    this.socket.send(JSON.stringify(message));
  }

  private request(method: string, params: Json): Promise<Json> {
    const id = this.nextId++;
    return new Promise<Json>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.write({ id, method, params });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private emit(event: SessionEvent): void {
    if (this.stopped) return;
    if (event.kind === "run_started") this.runId = event.runId;
    this.opts.onEvent(event);
  }

  private async serverRequest(message: Json): Promise<void> {
    const id = message.id;
    const method = String(message.method);
    const params = object(message.params);
    let result: Json = {};
    const signal = this.socket ? AbortSignal.timeout(10 * 60_000) : AbortSignal.abort();
    if (
      method === "item/commandExecution/requestApproval" ||
      method === "item/fileChange/requestApproval" ||
      method === "item/permissions/requestApproval"
    ) {
      const request: PromptRequest = {
        kind: "permission",
        toolName:
          method === "item/fileChange/requestApproval"
            ? "Edit files"
            : method === "item/permissions/requestApproval"
              ? "Additional permissions"
              : "Run command",
        input: {
          ...(params.command ? { command: params.command } : {}),
          ...(params.cwd ? { cwd: params.cwd } : {}),
          ...(params.permissions ? { permissions: params.permissions } : {}),
        },
        ...(typeof params.reason === "string" ? { decisionReason: params.reason } : {}),
        canAlwaysAllow: true,
      };
      const answer = await this.opts
        .onPrompt(request, signal)
        .catch((): PromptAnswer => ({ kind: "permission", decision: "deny" }));
      const decision = answer.kind === "permission" ? answer.decision : "deny";
      if (method === "item/permissions/requestApproval") {
        result = {
          permissions: decision === "deny" ? {} : params.permissions,
          scope: decision === "always" ? "session" : "turn",
        };
      } else {
        result = {
          decision:
            decision === "deny" ? "decline" : decision === "always" ? "acceptForSession" : "accept",
        };
      }
    } else if (method === "item/tool/requestUserInput") {
      const questions = Array.isArray(params.questions)
        ? params.questions.map((raw) => {
            const q = object(raw);
            return {
              question: String(q.question ?? ""),
              header: String(q.header ?? ""),
              multiSelect: false,
              options: Array.isArray(q.options)
                ? q.options.map((rawOption) => ({
                    label: String(object(rawOption).label ?? ""),
                    description: String(object(rawOption).description ?? ""),
                  }))
                : [],
            };
          })
        : [];
      const answer = await this.opts
        .onPrompt({ kind: "question", questions }, signal)
        .catch((): PromptAnswer => ({ kind: "question", answers: {} }));
      const answers: Json = {};
      if (answer.kind === "question")
        for (const raw of params.questions as unknown[]) {
          const key = String(object(raw).id ?? "");
          const value = answer.answers[key] ?? answer.answers[String(object(raw).question ?? "")];
          answers[key] = {
            answers: value === undefined ? [] : Array.isArray(value) ? value : [value],
          };
        }
      result = { answers };
    } else {
      // Unsupported server requests are explicitly refused; never leave Codex waiting forever.
      this.write({ id, error: { code: -32601, message: `CatHouse does not support ${method}` } });
      return;
    }
    this.write({ id, result });
  }

  private notification(method: string, params: Json): void {
    if (params.threadId && params.threadId !== this.sessionId) return;
    if (method === "turn/started") {
      this.activeTurn = String(object(params.turn).id ?? "");
      if (this.ownTurnPending) this.ownTurnPending = false;
      else this.emit({ kind: "inbound" });
      return;
    }
    if (method === "turn/completed") {
      const turn = object(params.turn);
      this.activeTurn = undefined;
      const status = String(turn.status ?? "failed");
      this.emit({
        kind: "result",
        subtype: status,
        sessionId: this.sessionId ?? "",
        isError: status !== "completed",
        ...(object(turn.error).message ? { text: String(object(turn.error).message) } : {}),
      });
      return;
    }
    if (method === "thread/compacted") {
      this.emit({ kind: "compacted" });
      return;
    }
    if (method !== "item/started" && method !== "item/completed") return;
    const item = object(params.item);
    const id = String(item.id ?? "");
    const type = String(item.type ?? "");
    if (method === "item/started") {
      if (type === "mcpToolCall")
        this.emit({
          kind: "tool_use",
          id,
          name: `${item.server}.${item.tool}`,
          input: item.arguments,
          parentToolUseId: null,
        });
      if (type === "commandExecution")
        this.emit({
          kind: "tool_use",
          id,
          name: "commandExecution",
          input: { command: item.command, cwd: item.cwd },
          parentToolUseId: null,
        });
      if (type === "fileChange")
        this.emit({
          kind: "tool_use",
          id,
          name: "fileChange",
          input: item.changes,
          parentToolUseId: null,
        });
      return;
    }
    if (type === "agentMessage")
      this.emit({ kind: "text", text: String(item.text ?? ""), parentToolUseId: null });
    if (type === "mcpToolCall") {
      const result = object(item.result);
      const output = result.structuredContent ?? result.content;
      const text =
        typeof output === "string"
          ? output
          : Array.isArray(output)
            ? textContent(output)
            : JSON.stringify(output ?? object(item.error));
      const isError = item.status !== "completed" || item.error != null;
      this.emit({ kind: "tool_result", toolUseId: id, isError, text, parentToolUseId: null });
      if (item.server === "catherd" && item.tool === "run_start" && !isError) {
        try {
          const data = object(JSON.parse(text));
          if (typeof data.run === "string")
            this.emit({ kind: "run_started", runId: data.run, dir: String(data.dir ?? "") });
        } catch {
          /* non-JSON result remains visible as a tool result */
        }
      }
    }
    if (type === "commandExecution" || type === "fileChange")
      this.emit({
        kind: "tool_result",
        toolUseId: id,
        isError: item.status !== "completed",
        text: type === "commandExecution" ? String(item.aggregatedOutput ?? "") : "Files updated",
        parentToolUseId: null,
      });
  }

  private receive(line: string): void {
    let message: Json;
    try {
      message = object(JSON.parse(line));
    } catch {
      return;
    }
    if (typeof message.id === "number" && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(new Error(String(object(message.error).message ?? "Codex request failed")));
      else pending.resolve(object(message.result));
      return;
    }
    if ("id" in message && typeof message.method === "string") {
      void this.serverRequest(message).catch(() => {});
      return;
    }
    if (typeof message.method === "string")
      this.notification(message.method, object(message.params));
  }

  private approvalPolicy(): "on-request" | "never" {
    return this.permissionMode === "dontAsk" ? "never" : "on-request";
  }
  private sandbox(): "read-only" | "workspace-write" {
    return this.permissionMode === "plan" ? "read-only" : "workspace-write";
  }

  private sandboxPolicy(): Json {
    return this.sandbox() === "read-only"
      ? { type: "readOnly", networkAccess: true }
      : {
          type: "workspaceWrite",
          writableRoots: [this.opts.repo],
          networkAccess: true,
          excludeTmpdirEnvVar: false,
          excludeSlashTmp: false,
        };
  }

  private async turn(prompt: string): Promise<void> {
    if (!this.sessionId || !this.skillPath) throw new Error("Codex session is not ready");
    this.ownTurnPending = true;
    try {
      await this.request("turn/start", {
        threadId: this.sessionId,
        input: [
          { type: "skill", name: "catherd:catherd", path: this.skillPath },
          { type: "text", text: prompt, text_elements: [] },
        ],
        approvalPolicy: this.approvalPolicy(),
        sandboxPolicy: this.sandboxPolicy(),
      });
    } catch (error) {
      this.ownTurnPending = false;
      throw error;
    }
  }

  async start(): Promise<void> {
    // catherd pushes results through `codex queue --remote unix://`. Both clients must reach
    // the same managed daemon; a private stdio app-server would lose completion notices.
    const path = join(
      this.opts.env.CODEX_HOME || join(homedir(), ".codex"),
      "app-server-control",
      "app-server-control.sock",
    );
    const socket = new WebSocket(`ws+unix://${path}:/`);
    this.socket = socket;
    socket.on("message", (message) => this.receive(String(message)));
    socket.on("error", (error) => {
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
      if (!this.stopped) this.doneReject(error);
    });
    socket.on("close", () => {
      for (const p of this.pending.values()) p.reject(new Error("Codex app-server disconnected"));
      this.pending.clear();
      if (this.stopped) this.doneResolve();
      else this.doneReject(new Error("Codex app-server disconnected"));
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error("Codex app-server connection timed out"));
      }, 10_000);
      socket.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(
          new Error(
            error.message ||
              "Could not connect to the managed Codex daemon. Start it from CatHouse Setup.",
          ),
        );
      });
    });
    await this.request("initialize", {
      clientInfo: { name: "cathouse", title: "CatHouse", version: "0.4.4" },
      capabilities: null,
    });
    this.write({ method: "initialized" });
    const thread = this.opts.resume
      ? await this.request("thread/resume", {
          threadId: this.opts.resume,
          cwd: this.opts.repo,
          approvalPolicy: this.approvalPolicy(),
          sandbox: this.sandbox(),
        })
      : await this.request("thread/start", {
          cwd: this.opts.repo,
          approvalPolicy: this.approvalPolicy(),
          sandbox: this.sandbox(),
        });
    this.sessionId = String(object(thread.thread).id ?? "");
    if (!this.sessionId) throw new Error("Codex returned no thread id");
    const skills = await this.request("skills/list", { cwds: [this.opts.repo] });
    const entries = Array.isArray(skills.data) ? skills.data : [];
    const candidates = entries.flatMap((entry) =>
      Array.isArray(object(entry).skills) ? (object(entry).skills as unknown[]) : [],
    );
    const skill = candidates
      .map(object)
      .find(
        (item) =>
          item.name === "catherd:catherd" &&
          item.enabled === true &&
          item.pluginId === "catherd@catherd",
      );
    if (typeof skill?.path !== "string")
      throw new Error("catherd Codex skill is missing or disabled; install it in Setup");
    this.skillPath = skill.path;
    this.emit({
      kind: "init",
      host: "codex",
      sessionId: this.sessionId,
      claudeCodeVersion: "",
      model: typeof thread.model === "string" ? thread.model : undefined,
      catherdPlugin: { name: "catherd", path: skill.path },
      catherdMcpStatus: "pending",
      pluginErrors: [],
      agents: [],
      permissionMode: this.permissionMode,
    });
    await this.turn(this.opts.prompt);
  }

  send(text: string): void {
    void this.turn(text).catch((error) =>
      this.emit({
        kind: "result",
        subtype: "failed",
        sessionId: this.sessionId ?? "",
        isError: true,
        text: String(error),
      }),
    );
  }
  async interrupt(): Promise<void> {
    if (this.sessionId && this.activeTurn)
      await this.request("turn/interrupt", { threadId: this.sessionId, turnId: this.activeTurn });
  }
  async setPermissionMode(mode: NonNullable<SessionOptions["permissionMode"]>): Promise<void> {
    this.permissionMode = mode;
  }
  finished(): Promise<void> {
    return this.done;
  }
  close(): void {
    this.stopped = true;
    const socket = this.socket;
    if (!socket) {
      this.doneResolve();
      return;
    }
    if (this.sessionId && this.activeTurn) {
      const timer = setTimeout(() => socket.terminate(), 3_000);
      timer.unref();
      void this.request("turn/interrupt", { threadId: this.sessionId, turnId: this.activeTurn })
        .catch(() => {})
        .finally(() => {
          clearTimeout(timer);
          socket.close();
        });
    } else socket.close();
  }
}
