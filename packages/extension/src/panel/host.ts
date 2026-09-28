import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { buildWebviewHtml, type WebviewView } from "./webview-html";

export interface MessageSink {
  onRequest(raw: unknown, view: WebviewView, webview: vscode.Webview): Promise<void>;
}

/** Points a webview at the Vite build and wires its messages to the router. */
export function attachWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  view: WebviewView,
  sink: MessageSink,
): vscode.Disposable {
  const root = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  webview.options = { enableScripts: true, localResourceRoots: [root] };
  webview.html = buildWebviewHtml({
    cspSource: webview.cspSource,
    scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(root, "index.js")).toString(),
    styleUri: webview.asWebviewUri(vscode.Uri.joinPath(root, "index.css")).toString(),
    nonce: randomBytes(16).toString("base64"),
    view,
    title: "CatHouse",
  });
  return webview.onDidReceiveMessage((raw) => sink.onRequest(raw, view, webview));
}
