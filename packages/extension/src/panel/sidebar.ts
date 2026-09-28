import * as vscode from "vscode";
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
    // Clear any dynamic title left by an older extension-host instance.
    view.title = "CatHouse";
    view.description = undefined;
    this.setBadge(this.badge);
    const sub = attachWebview(view.webview, this.extensionUri, this.sink);
    view.onDidDispose(() => {
      sub.dispose();
      this.view = undefined;
    });
  }

  get visible(): boolean {
    return this.view?.visible === true;
  }

  /** Reveal the one CatHouse surface in the Activity Bar. */
  async show(): Promise<void> {
    await vscode.commands.executeCommand("cathouse.sidebar.focus");
    this.view?.show(false);
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
