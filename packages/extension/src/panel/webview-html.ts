// Kept free of the `vscode` module so it can be unit-tested with plain vitest.

export type WebviewView = "sidebar" | "dashboard";

export interface WebviewHtmlInput {
  /** `webview.cspSource` */
  cspSource: string;
  /** `webview.asWebviewUri(dist/webview/index.js)` as a string */
  scriptUri: string;
  /** `webview.asWebviewUri(dist/webview/index.css)` as a string */
  styleUri: string;
  nonce: string;
  view: WebviewView;
  title: string;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * The only HTML the webviews load. The CSP allows scripts only with this nonce, and styles, fonts
 * and images only from the extension's own webview resources.
 */
export function buildWebviewHtml(i: WebviewHtmlInput): string {
  const csp = [
    "default-src 'none'",
    `img-src ${i.cspSource} data:`,
    `style-src ${i.cspSource}`,
    `font-src ${i.cspSource}`,
    `script-src 'nonce-${i.nonce}'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeAttr(i.title)}</title>
<link rel="stylesheet" href="${escapeAttr(i.styleUri)}">
</head>
<body>
<div id="root" data-view="${i.view}"></div>
<script type="module" nonce="${escapeAttr(i.nonce)}" src="${escapeAttr(i.scriptUri)}"></script>
</body>
</html>`;
}
