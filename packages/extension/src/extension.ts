import { type EventTopic, PROTOCOL_VERSION } from "@cathouse/protocol";
import * as vscode from "vscode";
import { CatherdCli } from "./gateway/cli";
import { processEnv } from "./gateway/env";
import { type SavedLink, SessionController } from "./orchestrator/controller";
import { findCatherdPlugin } from "./orchestrator/plugin";
import { OrchestratorSession } from "./orchestrator/session";
import { DashboardPanel } from "./panel/dashboard";
import { Broadcaster, type MessageSink } from "./panel/host";
import { createRouter, HandlerError } from "./panel/router";
import { SidebarProvider } from "./panel/sidebar";
import type { WebviewView } from "./panel/webview-html";

interface RequestContext {
  view: WebviewView;
}

const LINKS_KEY = "cathouse.links.v1";

/** Phase 1: the first workspace folder is the repo. Multi-root selection arrives in Phase 4. */
function repoFor(requested?: string): string {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const match = requested ? folders.find((f) => f.uri.fsPath === requested) : folders[0];
  if (!match) {
    throw new HandlerError("E_NO_WORKSPACE", "open a folder (a git repository) to use CatHouse");
  }
  return match.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
  const extensionVersion = String(context.extension.packageJSON.version ?? "0.0.0");
  const output = vscode.window.createOutputChannel("CatHouse", { log: true });
  const broadcaster = new Broadcaster();
  const publish = (topic: EventTopic, payload: unknown) =>
    broadcaster.post({ v: PROTOCOL_VERSION, kind: "event", topic, payload });
  const env = () => processEnv();

  const controller = new SessionController({
    env,
    findPluginPath: async () => (await findCatherdPlugin())?.installPath,
    links: {
      get: (repo) => context.workspaceState.get<Record<string, SavedLink>>(LINKS_KEY)?.[repo],
      set: (repo, link) => {
        const all = context.workspaceState.get<Record<string, SavedLink>>(LINKS_KEY) ?? {};
        void context.workspaceState.update(LINKS_KEY, { ...all, [repo]: link });
      },
    },
    sessionExists: async (id) => {
      const { getSessionInfo } = await import("@anthropic-ai/claude-agent-sdk");
      return (await getSessionInfo(id)) !== undefined;
    },
    createSession: (opts) => new OrchestratorSession(opts),
    broadcast: (payload) => publish("session", payload),
    log: (line) => output.info(line),
  });

  const openDashboard = () => DashboardPanel.show(context.extensionUri, sink);

  const handle = createRouter<RequestContext>({
    "app.ping": (_params, ctx) => ({
      pong: true,
      extensionVersion,
      protocol: PROTOCOL_VERSION,
      view: ctx.view,
    }),
    "app.openDashboard": () => {
      openDashboard();
      return { opened: true };
    },
    "catherd.status": async () => {
      const cli = new CatherdCli({ cwd: repoFor(), env });
      const s = await cli.status();
      return {
        version: s.version,
        runs: s.runs.map((r) => ({
          id: r.id,
          title: r.title,
          repo: r.repo,
          live: r.live.length,
          roleRuns: r.totals.runs,
          stateTail: r.stateTail,
        })),
      };
    },
    "session.state": () => controller.snapshot(),
    "session.start": ({ task, repo }) => controller.start(repoFor(repo), task),
    "session.resume": ({ repo }) => controller.resume(repoFor(repo)),
    "session.send": ({ text }) => {
      controller.send(text);
      return {};
    },
    "session.interrupt": async () => {
      await controller.interrupt();
      return {};
    },
    "session.stop": () => controller.stop(),
    "session.answer": ({ id, answer }) => ({ accepted: controller.answer(id, answer) }),
  });

  const sink: MessageSink & { broadcaster: Broadcaster } = {
    broadcaster,
    async onRequest(raw, view, webview) {
      const response = await handle(raw, { view });
      if (response && !response.ok)
        output.warn(`${response.error.code}: ${response.error.message}`);
      if (response) await webview.postMessage(response);
    },
  };

  context.subscriptions.push(
    output,
    { dispose: () => controller.dispose() },
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewId,
      new SidebarProvider(context.extensionUri, sink),
    ),
    vscode.commands.registerCommand("cathouse.openDashboard", openDashboard),
  );
}

export function deactivate(): void {}
