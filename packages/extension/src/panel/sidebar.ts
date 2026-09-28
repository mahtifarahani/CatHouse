import type * as vscode from "vscode";
import { attachWebview, type Broadcaster, type MessageSink } from "./host";

type Sink = MessageSink & { broadcaster: Broadcaster };

export class SidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "cathouse.sidebar";

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sink: Sink,
  ) {}

  private view: vscode.WebviewView | undefined;
  private badge = 0;

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.setBadge(this.badge);
    const sub = attachWebview(view.webview, this.extensionUri, "sidebar", this.sink);
    view.onDidDispose(() => {
      sub.dispose();
      this.view = undefined;
    });
  }

  /** Pending prompt cards, shown on the activity-bar icon. */
  setBadge(count: number): void {
    this.badge = count;
    if (this.view) {
      this.view.badge =
        count > 0 ? { value: count, tooltip: `${count} waiting for you` } : undefined;
    }
  }
}
