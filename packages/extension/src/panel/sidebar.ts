import type * as vscode from "vscode";
import { attachWebview, type MessageSink } from "./host";

export class SidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "cathouse.sidebar";

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sink: MessageSink,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    const sub = attachWebview(view.webview, this.extensionUri, "sidebar", this.sink);
    view.onDidDispose(() => sub.dispose());
  }
}
