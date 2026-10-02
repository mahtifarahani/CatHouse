// Maps Agent SDK messages to CatHouse session events (protocol SessionEvent). Pure (no SDK import
// at runtime) so it is unit-testable; the SDK message types are structural here on purpose.
import type { SessionEvent } from "@cathouse/protocol";

export type { SessionEvent };

export const CATHERD_TOOL_PREFIX = "mcp__plugin_catherd_catherd__";

type Block = { type: string; [k: string]: unknown };
type Msg = { type: string; subtype?: string; [k: string]: unknown };

function blocks(message: unknown): Block[] {
  const content = (message as { content?: unknown } | undefined)?.content;
  return Array.isArray(content) ? (content as Block[]) : [];
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && typeof c === "object" && "text" in c ? String(c.text) : ""))
      .join("");
  }
  return "";
}

/**
 * Stateful mapper: remembers tool_use ids of catherd's run_start so its tool_result can be turned
 * into a run_started event (the link between a Claude session and a catherd run).
 */
export function createEventMapper() {
  const runStartIds = new Set<string>();

  return function map(m: Msg): SessionEvent[] {
    const parent = (m.parent_tool_use_id as string | null | undefined) ?? null;
    switch (m.type) {
      case "system": {
        if (m.subtype === "init") {
          const plugins = (m.plugins as { name: string; path: string; version?: string }[]) ?? [];
          const servers = (m.mcp_servers as { name: string; status: string }[]) ?? [];
          return [
            {
              kind: "init",
              sessionId: String(m.session_id),
              claudeCodeVersion: String(m.claude_code_version ?? ""),
              ...(typeof m.model === "string" && m.model ? { model: m.model } : {}),
              catherdPlugin: plugins.find((p) => p.name === "catherd"),
              catherdMcpStatus: servers.find((s) => s.name.includes("catherd"))?.status,
              pluginErrors: (m.plugin_errors as { plugin: string }[] | undefined) ?? [],
              agents: (m.agents as string[] | undefined) ?? [],
              permissionMode: String(m.permissionMode ?? ""),
            },
          ];
        }
        if (typeof m.subtype === "string" && m.subtype.startsWith("task_")) {
          const usage = m.usage as { duration_ms?: number } | undefined;
          const patch = m.patch as { status?: string } | undefined;
          return [
            {
              kind: "task",
              phase: m.subtype.slice(5) as "started" | "progress" | "updated" | "notification",
              taskId: String(m.task_id),
              description: m.description as string | undefined,
              subagentType: m.subagent_type as string | undefined,
              status: (m.status as string | undefined) ?? patch?.status,
              durationMs: usage?.duration_ms,
              lastTool: m.last_tool_name as string | undefined,
            },
          ];
        }
        if (m.subtype === "compact_boundary") return [{ kind: "compacted" }];
        return [{ kind: "status", subtype: String(m.subtype) }];
      }
      case "assistant": {
        const out: SessionEvent[] = [];
        for (const b of blocks(m.message)) {
          if (b.type === "text")
            out.push({ kind: "text", text: String(b.text), parentToolUseId: parent });
          else if (b.type === "thinking") out.push({ kind: "thinking", parentToolUseId: parent });
          else if (b.type === "tool_use") {
            const name = String(b.name);
            if (name === `${CATHERD_TOOL_PREFIX}run_start`) runStartIds.add(String(b.id));
            out.push({
              kind: "tool_use",
              id: String(b.id),
              name,
              input: b.input,
              parentToolUseId: parent,
            });
          }
        }
        return out;
      }
      case "user": {
        const out: SessionEvent[] = [];
        for (const b of blocks(m.message)) {
          if (b.type !== "tool_result") continue;
          const toolUseId = String(b.tool_use_id);
          const text = resultText(b.content);
          const isError = b.is_error === true;
          out.push({ kind: "tool_result", toolUseId, isError, text, parentToolUseId: parent });
          if (runStartIds.has(toolUseId) && !isError) {
            try {
              const r = JSON.parse(text) as { run?: unknown; dir?: unknown };
              if (typeof r.run === "string") {
                out.push({ kind: "run_started", runId: r.run, dir: String(r.dir ?? "") });
              }
            } catch {
              // not JSON: leave it as a plain tool_result
            }
          }
        }
        return out;
      }
      case "command_lifecycle":
        // A turn the session starts by itself: catherd 1.1+ pushes a finished role into the peer
        // inbox, and the CLI runs it as a queued command (docs/spikes/catherd-1.2.md). Only
        // "started" matters; the turn ends with its own `result`.
        return m.state === "started" ? [{ kind: "inbound" }] : [];
      case "tool_progress":
        // Progress heartbeats of a long tool call; parent_tool_use_id is the real tool call
        // (docs/spikes/phase1.md finding 1).
        return [
          {
            kind: "tool_progress",
            toolUseId: String(m.parent_tool_use_id ?? m.tool_use_id),
            elapsedSecs: Number(m.elapsed_time_seconds ?? 0),
          },
        ];
      case "result":
        return [
          {
            kind: "result",
            subtype: String(m.subtype),
            sessionId: String(m.session_id),
            isError: m.is_error === true,
            costUsd: m.total_cost_usd as number | undefined,
            text: m.result as string | undefined,
          },
        ];
      default:
        return [];
    }
  };
}
