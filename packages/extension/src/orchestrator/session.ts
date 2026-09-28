import type {
  CanUseTool,
  PermissionResult,
  Query,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PromptAnswer, PromptRequest } from "@cathouse/protocol";
import { CATHERD_TOOL_PREFIX, createEventMapper, type SessionEvent } from "./events";

export type { PromptAnswer, PromptRequest };

// One Claude Agent SDK session that runs the catherd skill for one repo (plan §OrchestratorSession).
// The SDK is ESM-only and resolves its platform binary relative to its own package, so it is kept
// external to the esbuild bundle and loaded with a dynamic import.

export interface SessionOptions {
  repo: string;
  /** First prompt, e.g. "/catherd:catherd <task>"; omitted when only resuming. */
  prompt: string;
  pluginPath: string;
  env: Record<string, string>;
  resume?: string;
  permissionMode?: "default" | "acceptEdits" | "plan" | "dontAsk" | "auto";
  /** Overrides the SDK's bundled binary (tests, or a packaged VSIX that ships it elsewhere). */
  claudeExecutable?: string;
  onEvent: (e: SessionEvent) => void;
  onPrompt: (req: PromptRequest, signal: AbortSignal) => Promise<PromptAnswer>;
  onRaw?: (m: unknown) => void;
  onStderr?: (s: string) => void;
}

/** A catherd `wait` can block for tens of minutes; MCP_TOOL_TIMEOUT caps a single tool call. */
export const MCP_TOOL_TIMEOUT_MS = String(4 * 60 * 60 * 1000);

class Inbox implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = [];
  private waiters: ((r: IteratorResult<SDKUserMessage>) => void)[] = [];
  private closed = false;

  push(text: string): void {
    const msg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
    };
    const w = this.waiters.shift();
    if (w) w({ value: msg, done: false });
    else this.queue.push(msg);
  }

  close(): void {
    this.closed = true;
    for (const w of this.waiters.splice(0)) w({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        const m = this.queue.shift();
        if (m) return Promise.resolve({ value: m, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((r) => this.waiters.push(r));
      },
    };
  }
}

export class OrchestratorSession {
  private readonly inbox = new Inbox();
  private query: Query | undefined;
  private done: Promise<void> | undefined;
  sessionId: string | undefined;
  runId: string | undefined;

  constructor(readonly opts: SessionOptions) {}

  private readonly canUseTool: CanUseTool = async (toolName, input, options) => {
    if (toolName === "AskUserQuestion") {
      const answer = await this.opts.onPrompt(
        { kind: "question", questions: (input as { questions: never }).questions },
        options.signal,
      );
      if (answer.kind !== "question") return { behavior: "deny", message: "no answer" };
      return {
        behavior: "allow",
        updatedInput: {
          questions: (input as { questions: unknown }).questions,
          answers: answer.answers,
          ...(answer.response ? { response: answer.response } : {}),
        },
      } satisfies PermissionResult;
    }
    const always = (options.suggestions ?? []).filter((s) => s.destination === "localSettings");
    const answer = await this.opts.onPrompt(
      {
        kind: "permission",
        toolName,
        input,
        ...(options.title ? { title: options.title } : {}),
        ...(options.decisionReason ? { decisionReason: options.decisionReason } : {}),
        canAlwaysAllow: always.length > 0 && options.suppressAlwaysAllowRule !== true,
      },
      options.signal,
    );
    if (answer.kind !== "permission" || answer.decision === "deny") {
      return {
        behavior: "deny",
        message:
          answer.kind === "permission" && answer.message ? answer.message : "The user denied this.",
      };
    }
    return {
      behavior: "allow",
      updatedInput: input,
      ...(answer.decision === "always" ? { updatedPermissions: always } : {}),
    };
  };

  async start(): Promise<void> {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const o = this.opts;
    this.inbox.push(o.prompt);
    this.query = query({
      prompt: this.inbox,
      options: {
        cwd: o.repo,
        settingSources: ["user", "project", "local"],
        plugins: [{ type: "local", path: o.pluginPath }],
        allowedTools: [`${CATHERD_TOOL_PREFIX}*`],
        canUseTool: this.canUseTool,
        permissionMode: o.permissionMode ?? "default",
        includePartialMessages: false,
        toolConfig: { askUserQuestion: { previewFormat: "markdown" } },
        env: { ...o.env, MCP_TOOL_TIMEOUT: MCP_TOOL_TIMEOUT_MS },
        ...(o.resume ? { resume: o.resume } : {}),
        ...(o.claudeExecutable ? { pathToClaudeCodeExecutable: o.claudeExecutable } : {}),
        ...(o.onStderr ? { stderr: o.onStderr } : {}),
      },
    });
    const map = createEventMapper();
    const q = this.query;
    this.done = (async () => {
      for await (const m of q) {
        o.onRaw?.(m);
        for (const e of map(m as never)) {
          if (e.kind === "init") this.sessionId = e.sessionId;
          if (e.kind === "run_started") this.runId = e.runId;
          o.onEvent(e);
        }
      }
    })();
  }

  /** Sends a follow-up user message into the running session (streaming input). */
  send(text: string): void {
    this.inbox.push(text);
  }

  async interrupt(): Promise<void> {
    await this.query?.interrupt();
  }

  /** Resolves when the SDK stream ends (after close(), or if the CLI exits). */
  finished(): Promise<void> {
    return this.done ?? Promise.resolve();
  }

  close(): void {
    this.inbox.close();
    this.query?.close();
  }
}
