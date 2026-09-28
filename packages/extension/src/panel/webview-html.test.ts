import { describe, expect, it } from "vitest";
import { buildWebviewHtml } from "./webview-html";

const html = buildWebviewHtml({
  cspSource: "vscode-resource:",
  scriptUri: "vscode-resource:/dist/webview/index.js",
  styleUri: "vscode-resource:/dist/webview/index.css",
  nonce: "abc123",
  view: "dashboard",
  title: "CatHouse",
});

describe("webview html", () => {
  it("locks scripts to the nonce and everything else to the extension", () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-abc123'");
    expect(html).toContain("style-src vscode-resource:");
    expect(html).not.toContain("unsafe-inline");
    expect(html).not.toContain("unsafe-eval");
  });

  it("tags the script with the nonce and the root with the view", () => {
    expect(html).toContain('nonce="abc123" src="vscode-resource:/dist/webview/index.js"');
    expect(html).toContain('data-view="dashboard"');
  });
});
