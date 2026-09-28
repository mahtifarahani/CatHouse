import * as vscode from "vscode";
import { attachWebview, type MessageSink } from "./host";

/** The full dashboard; one instance per window, revealed if already open. */
export class DashboardPanel {
  private static current: DashboardPanel | undefined;

  static show(extensionUri: vscode.Uri, sink: MessageSink): void {
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
    sink: MessageSink,
  ) {
    panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "cathouse.svg");
    const sub = attachWebview(panel.webview, extensionUri, "dashboard", sink);
    panel.onDidDispose(() => {
      sub.dispose();
      DashboardPanel.current = undefined;
    });
  }
}
