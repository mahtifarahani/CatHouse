import { homedir } from "node:os";
import { PINNED } from "@cathouse/compat";
import { type EventTopic, PROTOCOL_VERSION, type SetupActionId } from "@cathouse/protocol";
import * as vscode from "vscode";
import { CatherdCli } from "./gateway/cli";
import { processEnv } from "./gateway/env";
import { CatherdMcp } from "./gateway/mcp-client";
import { runProcess } from "./gateway/process";
import { DoctorReportSchema } from "./gateway/schemas";
import { CatherdGateway } from "./gateway/service";
import { type SavedLink, SessionController } from "./orchestrator/controller";
import { findCatherdPlugin } from "./orchestrator/plugin";
import { OrchestratorSession } from "./orchestrator/session";
import { Broadcaster, type MessageSink } from "./panel/host";
import { createRouter, HandlerError } from "./panel/router";
import { SidebarProvider } from "./panel/sidebar";
import type { WebviewView } from "./panel/webview-html";
import { bundledClaudePath } from "./setup/binary";
import { catherdDataDir } from "./setup/detect";
import { type ReadinessSnapshot, SetupService } from "./setup/service";

interface RequestContext {
  view: WebviewView;
}

const LINKS_KEY = "cathouse.links.v1";
const REPO_KEY = "cathouse.repo.v1";
const READINESS_KEY = "cathouse.readiness.v1";

/** The repo CatHouse works on: the requested folder, else the selected one, else the first. */
let selectedRepo: string | undefined;
function repoFor(requested?: string): string {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const pick = requested ?? selectedRepo;
  const match = (pick ? folders.find((f) => f.uri.fsPath === pick) : undefined) ?? folders[0];
  if (!match || (requested && match.uri.fsPath !== requested)) {
    throw new HandlerError("E_NO_WORKSPACE", "open a folder (a git repository) to use CatHouse");
  }
  return match.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
  const extensionVersion = String(context.extension.packageJSON.version ?? "0.0.0");
  selectedRepo = context.workspaceState.get<string>(REPO_KEY);
  const output = vscode.window.createOutputChannel("CatHouse", { log: true });
  const broadcaster = new Broadcaster();
  const publish = (topic: EventTopic, payload: unknown) =>
    broadcaster.post({ v: PROTOCOL_VERSION, kind: "event", topic, payload });
  const env = () => processEnv();

  const storedReadiness = context.workspaceState.get<Partial<ReadinessSnapshot>>(READINESS_KEY);
  const storedDoctor = DoctorReportSchema.safeParse(storedReadiness?.doctor);
  const initialReadiness =
    storedDoctor.success && typeof storedReadiness?.doctorAt === "string"
      ? { doctor: storedDoctor.data, doctorAt: storedReadiness.doctorAt }
      : undefined;

  const setup = new SetupService({
    run: runProcess,
    env,
    bundledClaude: bundledClaudePath,
    // Setup must work in an empty window too: catherd then resolves the global active profile.
    cli: () =>
      new CatherdCli({ cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? homedir(), env }),
    pin: PINNED,
    ...(initialReadiness ? { initialReadiness } : {}),
    persistReadiness: (snapshot) => context.workspaceState.update(READINESS_KEY, snapshot),
    broadcast: (payload) => publish("setup", payload),
    log: (line) => output.info(line),
    openTerminal: (name, command, termEnv) =>
      new Promise<void>((resolve) => {
        const terminal = vscode.window.createTerminal({ name, env: termEnv });
        const sub = vscode.window.onDidCloseTerminal((t) => {
          if (t === terminal) {
            sub.dispose();
            resolve();
          }
        });
        terminal.show();
        terminal.sendText(command);
      }),
  });
  void setup.check();

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
    onPromptsChanged: (count, latest) => {
      sidebar.setBadge(count);
      if (latest && !sidebar.visible) {
        const what =
          latest.kind === "question" ? "has a question" : `asks to use ${latest.toolName}`;
        void vscode.window
          .showInformationMessage(`CatHouse: the orchestrator ${what}.`, "Open")
          .then((pick) => pick && sidebar.show());
      }
    },
  });
  const sidebar = new SidebarProvider(context.extensionUri, {
    broadcaster,
    onRequest: (raw, view, webview) => sink.onRequest(raw, view, webview),
  });

  /** The plan's gate: tasks start only when Setup says so (login, readiness included). */
  const requireReady = () => {
    const s = setup.state();
    if (!s.canStart) {
      throw new HandlerError(
        "E_SETUP_REQUIRED",
        s.canStartReason ?? "finish Setup first",
        "open the Setup tab in CatHouse",
      );
    }
  };

  // One gateway per repo (ADR 0006); Phase 3 uses the first workspace folder.
  let gateway: CatherdGateway | undefined;
  const gw = (): CatherdGateway => {
    const repo = repoFor();
    if (gateway?.repo !== repo) {
      void gateway?.dispose();
      gateway = new CatherdGateway(
        repo,
        new CatherdCli({ cwd: repo, env }),
        new CatherdMcp({ repo, env, onStderr: (l) => output.debug(l.trimEnd()) }),
      );
    }
    return gateway;
  };
  const terminal = (name: string, command: string) => {
    const t = vscode.window.createTerminal({ name, cwd: repoFor() });
    t.show();
    t.sendText(command);
  };

  const requireIdleSession = () => {
    const phase = controller.snapshot().phase;
    if (phase === "starting" || phase === "running") {
      throw new HandlerError(
        "E_SESSION_ACTIVE",
        "workspace folders cannot change while an orchestrator session is running",
        "stop the session first",
      );
    }
  };

  const handle = createRouter<RequestContext>({
    "app.ping": (_params, ctx) => ({
      pong: true,
      extensionVersion,
      protocol: PROTOCOL_VERSION,
      view: ctx.view,
    }),
    "app.workspace": () => ({
      folders: (vscode.workspace.workspaceFolders ?? []).map((f) => ({
        path: f.uri.fsPath,
        name: f.name,
      })),
      repo: (vscode.workspace.workspaceFolders?.length ?? 0) > 0 ? repoFor() : null,
      catherdVersion: PINNED.catherd,
    }),
    "app.setRepo": ({ path }) => {
      const repo = repoFor(path);
      selectedRepo = repo;
      void context.workspaceState.update(REPO_KEY, repo);
      publish("app", { type: "repo", repo });
      return { repo };
    },
    "app.addFolders": async () => {
      requireIdleSession();
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: "Add to CatHouse workspace",
        title: "Choose repositories for CatHouse",
      });
      if (!picked?.length) return { changed: false };
      const folders = vscode.workspace.workspaceFolders ?? [];
      const existing = new Set(folders.map((folder) => folder.uri.toString()));
      const additions = picked
        .filter((uri) => !existing.has(uri.toString()))
        .map((uri) => ({ uri }));
      if (!additions.length) return { changed: false };
      const changed = vscode.workspace.updateWorkspaceFolders(folders.length, 0, ...additions);
      if (!changed) {
        throw new HandlerError(
          "E_WORKSPACE_UPDATE",
          "VS Code refused to add the selected folders",
          "try adding them with File → Add Folder to Workspace",
        );
      }
      selectedRepo = additions[0]?.uri.fsPath;
      await context.workspaceState.update(REPO_KEY, selectedRepo);
      publish("app", { type: "workspace" });
      return { changed: true };
    },
    "app.removeFolder": async ({ path }) => {
      requireIdleSession();
      const folders = vscode.workspace.workspaceFolders ?? [];
      const index = folders.findIndex((folder) => folder.uri.fsPath === path);
      if (index < 0) {
        throw new HandlerError("E_NO_WORKSPACE", "that folder is no longer in this workspace");
      }
      const changed = vscode.workspace.updateWorkspaceFolders(index, 1);
      if (!changed) {
        throw new HandlerError(
          "E_WORKSPACE_UPDATE",
          "VS Code refused to remove the selected folder",
          "try removing it from the Explorer workspace menu",
        );
      }
      if (selectedRepo === path || !folders.some((folder) => folder.uri.fsPath === selectedRepo)) {
        selectedRepo = folders.find((_, folderIndex) => folderIndex !== index)?.uri.fsPath;
        await context.workspaceState.update(REPO_KEY, selectedRepo);
      }
      if (gateway?.repo === path) {
        await gateway.dispose();
        gateway = undefined;
      }
      publish("app", { type: "workspace" });
      return { changed: true };
    },
    "session.setMode": async ({ mode }) => {
      await controller.setPermissionMode(mode);
      return {};
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
    "runs.list": () => gw().runsList(),
    "runs.get": ({ id }) => gw().runGet(id),
    "runs.reply": ({ id, name }) => gw().roleReply(id, name),
    "runs.debug": ({ id, name }) => gw().roleDebug(id, name),
    "runs.cancelRole": async ({ id, name }) => {
      const r = await gw().cancelRole(id, name);
      controller.noteRoleCancelled(id, name, r.status);
      return r;
    },
    "profiles.get": ({ name }) => gw().profiles(name),
    "profiles.save": (p) => gw().profileSave(p),
    "profiles.activate": async ({ name, scope }) => {
      await gw().activate(name, scope);
      return { ok: true };
    },
    "profiles.unbindRepo": async () => {
      await gw().unbindRepo();
      return { ok: true };
    },
    "profiles.create": async ({ name, from }) => {
      await gw().createProfile(name, from);
      return { ok: true };
    },
    "profiles.remove": async ({ name }) => {
      await gw().removeProfile(name);
      return { ok: true };
    },
    "catalog.query": (q) => gw().catalog(q),
    "catalog.refresh": async () =>
      (await gw().catalogRefresh()).map((r) => ({
        backend: r.backend,
        models: r.models,
        ...(r.error ? { error: r.error } : {}),
        ...(r.fix ? { fix: r.fix } : {}),
      })),
    "catalog.treatLike": async ({ rung, like }) => {
      await gw().treatLike(rung, like);
      return { ok: true };
    },
    "diagnostics.openLogs": async () => {
      await vscode.env.openExternal(vscode.Uri.file(`${catherdDataDir()}/logs`));
      return { ok: true };
    },
    "diagnostics.lock": ({ command, slots }) => {
      terminal(
        "catherd lock",
        `bunx catherd-cli@${PINNED.catherd} lock${slots ? ` --slots ${slots}` : ""} -- ${command}`,
      );
      return { ok: true };
    },
    "setup.state": () => setup.state(),
    "setup.check": ({ readiness }) => setup.check({ readiness }),
    "setup.run": ({ action }) => {
      void setup.run(action).catch((e: unknown) => output.warn(String(e)));
      return { started: true };
    },
    "session.state": () => controller.snapshot(),
    "session.start": ({ task, repo, permissionMode }) => {
      requireReady();
      return controller.start(repoFor(repo), task, permissionMode);
    },
    "session.resume": ({ repo }) => {
      requireReady();
      return controller.resume(repoFor(repo));
    },
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
    { dispose: () => void gateway?.dispose() },
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const folders = vscode.workspace.workspaceFolders ?? [];
      if (!folders.some((folder) => folder.uri.fsPath === selectedRepo)) {
        selectedRepo = folders[0]?.uri.fsPath;
        void context.workspaceState.update(REPO_KEY, selectedRepo);
      }
      if (gateway && !folders.some((folder) => folder.uri.fsPath === gateway?.repo)) {
        void gateway.dispose();
        gateway = undefined;
      }
      publish("app", { type: "workspace" });
    }),
    vscode.commands.registerCommand("cathouse.checkSetup", () => setup.check({ readiness: true })),
    // Hidden (not in package.json): e2e tests call the webview protocol through the same router.
    vscode.commands.registerCommand("cathouse._request", (method: string, params: unknown) =>
      handle(
        { v: PROTOCOL_VERSION, id: "e2e", kind: "request", method, params },
        { view: "sidebar" },
      ),
    ),
    // Hidden (not in package.json): lets e2e tests press a Setup button. Returns the new state.
    vscode.commands.registerCommand("cathouse._runSetupAction", async (action: SetupActionId) => {
      await setup.run(action);
      return setup.state();
    }),
  );
}

export function deactivate(): void {}
