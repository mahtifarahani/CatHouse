// Dev-only stand-in for the VS Code webview API, so the UI can be previewed in a browser
// (`pnpm --filter @cathouse/webview dev`). Never bundled into the extension build.
import type { SessionState } from "@cathouse/protocol";

const state: SessionState = {
  phase: "running",
  repo: "/Users/dev/spike-repo",
  sessionId: "0ca9f70a-952e-42b8-8409-beffb36949a5",
  runId: "20260928-101130-spike-long-wait",
  events: [
    { kind: "user", text: "Add three string utils (slugify, titleCase, truncate) with tests" },
    {
      kind: "init",
      sessionId: "0ca9f70a",
      claudeCodeVersion: "2.1.283",
      catherdPlugin: { name: "catherd", path: "/p", version: "1.0.0" },
      catherdMcpStatus: "connected",
      pluginErrors: [],
      agents: [],
      permissionMode: "default",
    },
    { kind: "text", text: "I'll plan this as one milestone with three lanes.", parentToolUseId: null },
    { kind: "tool_use", id: "t1", name: "mcp__plugin_catherd_catherd__run_start", input: { title: "string utils" }, parentToolUseId: null },
    { kind: "tool_result", toolUseId: "t1", isError: false, text: '{"run":"20260928-101130-spike-long-wait"}', parentToolUseId: null },
    { kind: "run_started", runId: "20260928-101130-spike-long-wait", dir: "/d" },
    { kind: "task", phase: "started", taskId: "k1", description: "architect: plan milestones" },
    { kind: "task", phase: "progress", taskId: "k1", durationMs: 42000 },
    { kind: "tool_use", id: "t2", name: "mcp__plugin_catherd_catherd__dispatch", input: { name: "worker-M1.L1", rung: "codex:gpt-6-luna#high" }, parentToolUseId: null },
    { kind: "tool_result", toolUseId: "t2", isError: false, text: "{}", parentToolUseId: null },
    { kind: "tool_use", id: "t3", name: "mcp__plugin_catherd_catherd__wait", input: { run: "20260928-101130-spike-long-wait" }, parentToolUseId: null },
    { kind: "tool_progress", toolUseId: "t3", elapsedSecs: 95 },
  ],
  prompts: [
    {
      id: "q1",
      request: {
        kind: "question",
        questions: [
          {
            question: "Should truncate() count characters or grapheme clusters?",
            header: "truncate",
            multiSelect: false,
            options: [
              { label: "Graphemes", description: "Emoji and accents stay whole (Intl.Segmenter)" },
              { label: "Characters", description: "Simpler, may split emoji" },
            ],
          },
        ],
      },
    },
    {
      id: "p1",
      request: {
        kind: "permission",
        toolName: "Bash",
        input: { command: "bun test src/slugify.test.ts && bunx tsc --noEmit" },
        decisionReason: "Fast check for lane M1.L1",
        canAlwaysAllow: true,
      },
    },
  ],
};

const listeners: ((e: MessageEvent) => void)[] = [];
window.addEventListener = ((orig) =>
  function (this: Window, type: string, fn: EventListenerOrEventListenerObject, ...rest: unknown[]) {
    if (type === "message") listeners.push(fn as (e: MessageEvent) => void);
    return orig.call(this, type, fn, ...(rest as []));
  })(window.addEventListener) as typeof window.addEventListener;

function reply(id: string, result: unknown) {
  setTimeout(() => {
    for (const l of listeners)
      l(new MessageEvent("message", { data: { v: 1, id, kind: "response", ok: true, result } }));
  }, 50);
}

(window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
  getState: () => undefined,
  setState: () => {},
  postMessage: (m: { id: string; method: string; params: { id?: string } }) => {
    console.log("[mock] →", m.method, m.params);
    if (m.method === "session.state") return reply(m.id, state);
    if (m.method === "session.answer") {
      state.prompts = state.prompts.filter((p) => p.id !== m.params.id);
      for (const l of listeners)
        l(new MessageEvent("message", { data: { v: 1, kind: "event", topic: "session", payload: { type: "prompt_resolved", id: m.params.id } } }));
      return reply(m.id, { accepted: true });
    }
    return reply(m.id, {});
  },
});
