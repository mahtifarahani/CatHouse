import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { buildWebviewHtml, type WebviewView } from "./webview-html";

export interface MessageSink {
  onRequest(raw: unknown, view: WebviewView, webview: vscode.Webview): Promise<void>;
}

/** Every live webview, so host events reach the sidebar and the dashboard alike. */
export class Broadcaster {
  private readonly webviews = new Set<vscode.Webview>();

  add(webview: vscode.Webview): vscode.Disposable {
    this.webviews.add(webview);
    return new vscode.Disposable(() => this.webviews.delete(webview));
  }

  post(message: unknown): void {
    for (const w of this.webviews) void w.postMessage(message);
  }
}

/** Points a webview at the Vite build and wires its messages to the router. */
export function attachWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  view: WebviewView,
  sink: MessageSink & { broadcaster: Broadcaster },
): vscode.Disposable {
  const root = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const nonce = randomBytes(16).toString("base64");
  webview.options = { enableScripts: true, localResourceRoots: [root] };
  webview.html = buildWebviewHtml({
    cspSource: webview.cspSource,
    scriptUri: webview
      .asWebviewUri(vscode.Uri.joinPath(root, "index.js").with({ query: `v=${nonce}` }))
      .toString(),
    styleUri: webview
      .asWebviewUri(vscode.Uri.joinPath(root, "index.css").with({ query: `v=${nonce}` }))
      .toString(),
    nonce,
    view,
    title: "CatHouse",
  });
  return vscode.Disposable.from(
    sink.broadcaster.add(webview),
    webview.onDidReceiveMessage((raw) => sink.onRequest(raw, view, webview)),
  );
}
