import { PROTOCOL_VERSION } from "@cathouse/protocol";
import * as vscode from "vscode";
import { DashboardPanel } from "./panel/dashboard";
import type { MessageSink } from "./panel/host";
import { createRouter } from "./panel/router";
import { SidebarProvider } from "./panel/sidebar";
import type { WebviewView } from "./panel/webview-html";

interface RequestContext {
  view: WebviewView;
}

export function activate(context: vscode.ExtensionContext): void {
  const extensionVersion = String(context.extension.packageJSON.version ?? "0.0.0");
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
  });

  const sink: MessageSink = {
    async onRequest(raw, view, webview) {
      const response = await handle(raw, { view });
      if (response) await webview.postMessage(response);
    },
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewId,
      new SidebarProvider(context.extensionUri, sink),
    ),
    vscode.commands.registerCommand("cathouse.openDashboard", openDashboard),
  );
}

export function deactivate(): void {}
