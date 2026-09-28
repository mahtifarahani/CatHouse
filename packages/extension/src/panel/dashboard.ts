import * as vscode from "vscode";
import { attachWebview, type Broadcaster, type MessageSink } from "./host";

type Sink = MessageSink & { broadcaster: Broadcaster };

/** The full dashboard; one instance per window, revealed if already open. */
export class DashboardPanel {
  private static current: DashboardPanel | undefined;

  static get visible(): boolean {
    return DashboardPanel.current?.panel.visible === true;
  }

  static show(extensionUri: vscode.Uri, sink: Sink): void {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "cathouse.dashboard",
      "CatHouse",
      vscode.ViewColumn.Active,
    );
    DashboardPanel.current = new DashboardPanel(panel, extensionUri, sink);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    sink: Sink,
  ) {
    panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "cathouse.svg");
    const sub = attachWebview(panel.webview, extensionUri, "dashboard", sink);
    panel.onDidDispose(() => {
      sub.dispose();
      DashboardPanel.current = undefined;
    });
  }
}
