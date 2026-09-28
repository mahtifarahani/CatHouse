// Phase 1 spike harness: runs OrchestratorSession outside VS Code and logs everything.
//   node dist-spike/spike.js --repo <scratch git repo> --task "<task>" [--resume <sessionId>]
// Questions get the first option; permissions are allowed (the repo must be a scratch repo).
// Logs: <repo>/../spike-<ts>/{events.jsonl,raw.jsonl,prompts.jsonl,summary.json}
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { processEnv } from "../src/gateway/env";
import { findCatherdPlugin } from "../src/orchestrator/plugin";
import { OrchestratorSession, type PromptAnswer } from "../src/orchestrator/session";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    task: { type: "string", default: "" },
    resume: { type: "string" },
    prompt: { type: "string" },
    "max-minutes": { type: "string", default: "60" },
  },
});
if (!values.repo) throw new Error("--repo is required");
const repo = values.repo;
const out = join(dirname(repo), `spike-${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(out, { recursive: true });
const log = (file: string, v: unknown) =>
  appendFileSync(join(out, file), `${JSON.stringify({ t: Date.now(), ...(v as object) })}\n`);

const plugin = await findCatherdPlugin();
if (!plugin) throw new Error("catherd@catherd is not installed");
const env = await processEnv();
// When launched from inside a Claude session, drop its API routing so the child uses the CLI login.
for (const k of Object.keys(env)) if (k.startsWith("ANTHROPIC_")) delete env[k];

const started = Date.now();
const toolStarts = new Map<string, { name: string; at: number }>();
const longTools: { name: string; secs: number }[] = [];
let init: unknown;

const session = new OrchestratorSession({
  repo,
  prompt: values.prompt ?? (values.resume ? "/catherd:catherd" : `/catherd:catherd ${values.task}`),
  pluginPath: plugin.installPath,
  env,
  ...(values.resume ? { resume: values.resume } : {}),
  onRaw: (m) => log("raw.jsonl", { m }),
  onStderr: (s) => log("stderr.jsonl", { s }),
  onEvent: (e) => {
    log("events.jsonl", { e });
    if (e.kind === "init") init = e;
    if (e.kind === "tool_use") toolStarts.set(e.id, { name: e.name, at: Date.now() });
    if (e.kind === "tool_result") {
      const s = toolStarts.get(e.toolUseId);
      if (s) {
        const secs = Math.round((Date.now() - s.at) / 1000);
        if (secs >= 60) longTools.push({ name: s.name, secs });
        console.log(
          `[${new Date().toISOString()}] ${s.name} → ${secs}s${e.isError ? " ERROR" : ""}`,
        );
      }
    }
    if (e.kind === "run_started") console.log(`RUN ${e.runId}`);
    if (e.kind === "text" && !e.parentToolUseId) console.log(`> ${e.text.slice(0, 300)}`);
    if (e.kind === "result") console.log(`RESULT ${e.subtype} $${e.costUsd}`);
  },
  onPrompt: async (req): Promise<PromptAnswer> => {
    log("prompts.jsonl", { req });
    if (req.kind === "question") {
      const answers: Record<string, string> = {};
      for (const q of req.questions) answers[q.question] = q.options[0]?.label ?? "";
      console.log(`QUESTION auto-answered: ${JSON.stringify(answers)}`);
      return { kind: "question", answers };
    }
    console.log(`PERMISSION allow ${req.toolName}`);
    return { kind: "permission", decision: "allow" };
  },
});

// In streaming mode the session never ends on its own. Stop after a `result` only when no
// background task (e.g. a backgrounded catherd `wait`) is still live; a finishing background task
// starts a new turn, which produces another result later.
const liveTasks = new Set<string>();
let closeTimer: NodeJS.Timeout | undefined;
const origRaw = session.opts.onRaw;
session.opts.onRaw = (m: unknown) => {
  origRaw?.(m);
  const msg = m as {
    type?: string;
    subtype?: string;
    tasks?: { task_id: string; ambient?: boolean }[];
  };
  if (msg.type === "system" && msg.subtype === "background_tasks_changed") {
    liveTasks.clear();
    for (const t of msg.tasks ?? []) if (!t.ambient) liveTasks.add(t.task_id);
    console.log(`background tasks: ${liveTasks.size}`);
  }
  if (msg.type === "result") {
    clearTimeout(closeTimer);
    if (liveTasks.size === 0) closeTimer = setTimeout(() => session.close(), 5_000);
  } else if (msg.type === "assistant" || msg.type === "user") {
    clearTimeout(closeTimer);
  }
};

await session.start();
const deadline = setTimeout(() => {
  console.log("max minutes reached: closing");
  session.close();
}, Number(values["max-minutes"]) * 60_000);
await session.finished();
clearTimeout(deadline);
clearTimeout(closeTimer);
writeFileSync(
  join(out, "summary.json"),
  JSON.stringify(
    {
      sessionId: session.sessionId,
      runId: session.runId,
      minutes: (Date.now() - started) / 60000,
      longTools,
      init,
    },
    null,
    2,
  ),
);
console.log(`logs: ${out}`);
