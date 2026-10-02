import { mkdirSync, mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionEvent } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { CodexSession } from "./codex";

describe("Codex app-server session", () => {
  it("uses the shared Unix WebSocket, starts a skill turn and receives a queued turn", async () => {
    const home = mkdtempSync(join(tmpdir(), "cathouse-codex-test-"));
    const socketDir = join(home, "app-server-control");
    mkdirSync(socketDir);
    const server = createServer();
    const wsServer = new WebSocketServer({ server });
    wsServer.on("connection", (socket) => {
      const out = (message: object) => socket.send(JSON.stringify(message));
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw));
        if (message.method === "initialize") out({ id: message.id, result: {} });
        if (message.method === "thread/start")
          out({ id: message.id, result: { thread: { id: "thread-1" }, model: "gpt-test" } });
        if (message.method === "skills/list")
          out({
            id: message.id,
            result: {
              data: [
                {
                  skills: [
                    {
                      name: "catherd",
                      enabled: true,
                      pluginId: "catherd@catherd",
                      path: "/plugin/skills/catherd/SKILL.md",
                    },
                  ],
                },
              ],
            },
          });
        if (message.method === "turn/start") {
          expect(message.params.input[0].type).toBe("skill");
          out({ id: message.id, result: { turn: { id: "turn-1" } } });
          out({ method: "turn/started", params: { threadId: "thread-1", turn: { id: "turn-1" } } });
          out({
            method: "item/started",
            params: {
              threadId: "thread-1",
              item: {
                id: "tool-1",
                type: "mcpToolCall",
                server: "catherd",
                tool: "run_start",
                arguments: { repo: "/repo" },
              },
            },
          });
          out({
            method: "item/completed",
            params: {
              threadId: "thread-1",
              item: {
                id: "tool-1",
                type: "mcpToolCall",
                server: "catherd",
                tool: "run_start",
                status: "completed",
                result: {
                  content: [{ type: "text", text: '{"run":"run-1","dir":"/data/run-1"}' }],
                },
                error: null,
              },
            },
          });
          out({
            method: "turn/completed",
            params: { threadId: "thread-1", turn: { status: "completed" } },
          });
          setTimeout(() => {
            out({
              method: "turn/started",
              params: { threadId: "thread-1", turn: { id: "pushed-turn" } },
            });
            out({
              method: "turn/completed",
              params: { threadId: "thread-1", turn: { status: "completed" } },
            });
          }, 20);
        }
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(join(socketDir, "app-server-control.sock"), resolve),
    );
    const events: SessionEvent[] = [];
    let completed!: () => void;
    const turnDone = new Promise<void>((resolve) => {
      completed = resolve;
    });
    const session = new CodexSession({
      host: "codex",
      repo: home,
      prompt: "check the project",
      env: { CODEX_HOME: home },
      onEvent: (event) => {
        events.push(event);
        if (event.kind === "result" && events.filter((e) => e.kind === "result").length === 2)
          completed();
      },
      onPrompt: async () => ({ kind: "permission", decision: "deny" }),
    });
    try {
      await session.start();
      await turnDone;
      expect(events).toContainEqual(
        expect.objectContaining({ kind: "init", host: "codex", sessionId: "thread-1" }),
      );
      expect(events).toContainEqual({ kind: "run_started", runId: "run-1", dir: "/data/run-1" });
      expect(session.runId).toBe("run-1");
      expect(events).toContainEqual({ kind: "inbound" });
      expect(events.at(-1)).toMatchObject({ kind: "result", subtype: "completed", isError: false });
    } finally {
      session.close();
      await session.finished();
      await new Promise<void>((resolve) => wsServer.close(() => server.close(() => resolve())));
    }
  });
});
