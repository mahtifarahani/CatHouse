import { type SessionEvent, type SessionState, SessionTopicSchema } from "@cathouse/protocol";
import { useEffect, useState } from "react";
import { onEvent, request } from "../lib/rpc";
import { parseAgentName } from "./format";

const EMPTY: SessionState = { phase: "idle", turnActive: false, events: [], prompts: [] };

/** Mirrors the host's SessionController: a snapshot on mount, then live "session" events. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(EMPTY);

  useEffect(() => {
    let alive = true;
    void request("session.state", {}).then((s) => alive && setState(s));
    const off = onEvent("session", (raw) => {
      const p = SessionTopicSchema.safeParse(raw);
      if (!p.success) return;
      const msg = p.data;
      setState((s) => {
        switch (msg.type) {
          case "state":
            return msg.state;
          case "event":
            return { ...s, events: [...s.events, msg.event].slice(-500) };
          case "prompt":
            return s.prompts.some((x) => x.id === msg.prompt.id)
              ? s
              : { ...s, prompts: [...s.prompts, msg.prompt] };
          case "prompt_resolved":
            return { ...s, prompts: s.prompts.filter((x) => x.id !== msg.id) };
        }
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return state;
}

export type TranscriptItem =
  | { type: "user"; text: string }
  | { type: "text"; text: string; nested: boolean }
  | {
      type: "tool";
      id: string;
      name: string;
      input: unknown;
      result?: { text: string; isError: boolean };
      elapsedSecs?: number;
      nested: boolean;
    }
  | { type: "run"; runId: string }
  | {
      type: "task";
      id: string;
      description: string;
      status?: string;
      durationMs?: number;
      /** Set when the sub-agent is one of catherd's native role agents. */
      agent?: { role: string; model: string; effort?: string };
    }
  | { type: "result"; subtype: string; isError: boolean; costUsd?: number; text?: string }
  | { type: "init"; ok: boolean; detail: string }
  | { type: "compacted" }
  | { type: "inbound" };

/** Folds the event stream into display items (tool calls merged with their results/progress). */
export function toTranscript(events: SessionEvent[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const tools = new Map<string, Extract<TranscriptItem, { type: "tool" }>>();
  const tasks = new Map<string, Extract<TranscriptItem, { type: "task" }>>();
  for (const e of events) {
    switch (e.kind) {
      case "user":
        items.push({ type: "user", text: e.text });
        break;
      case "init": {
        const ok =
          !!e.catherdPlugin && e.catherdMcpStatus !== "failed" && e.pluginErrors.length === 0;
        items.push({
          type: "init",
          ok,
          detail: `${e.host === "codex" ? "Codex" : `Claude Code ${e.claudeCodeVersion}`} · catherd plugin ${e.catherdPlugin?.version ?? (e.host === "codex" ? "loaded" : "missing")} · MCP ${e.catherdMcpStatus ?? "absent"}`,
        });
        break;
      }
      case "text":
        if (e.text.trim()) items.push({ type: "text", text: e.text, nested: !!e.parentToolUseId });
        break;
      case "tool_use": {
        const item = {
          type: "tool" as const,
          id: e.id,
          name: e.name,
          input: e.input,
          nested: !!e.parentToolUseId,
        };
        tools.set(e.id, item);
        items.push(item);
        break;
      }
      case "tool_result": {
        const t = tools.get(e.toolUseId);
        if (t) t.result = { text: e.text, isError: e.isError };
        break;
      }
      case "tool_progress": {
        const t = tools.get(e.toolUseId);
        if (t) t.elapsedSecs = e.elapsedSecs;
        break;
      }
      case "run_started":
        items.push({ type: "run", runId: e.runId });
        break;
      case "task": {
        let t = tasks.get(e.taskId);
        if (!t) {
          const agent = parseAgentName(e.subagentType);
          t = {
            type: "task",
            id: e.taskId,
            description: e.description ?? e.subagentType ?? "task",
            ...(agent
              ? {
                  agent: {
                    role: agent.role,
                    model: agent.model,
                    ...(agent.effort ? { effort: agent.effort } : {}),
                  },
                }
              : {}),
          };
          tasks.set(e.taskId, t);
          items.push(t);
        }
        if (e.status) t.status = e.status;
        if (e.durationMs !== undefined) t.durationMs = e.durationMs;
        break;
      }
      case "result":
        items.push({
          type: "result",
          subtype: e.subtype,
          isError: e.isError,
          ...(e.costUsd === undefined ? {} : { costUsd: e.costUsd }),
          ...(e.text ? { text: e.text } : {}),
        });
        break;
      case "inbound":
        items.push({ type: "inbound" });
        break;
      case "compacted":
        items.push({ type: "compacted" });
        break;
      default:
        break;
    }
  }
  return items;
}

/** The orchestrator's model, from the newest init event (undefined before a session starts). */
export function orchestratorModel(events: SessionEvent[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.kind === "init") return e.model;
  }
  return undefined;
}
