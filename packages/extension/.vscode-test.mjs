import { existsSync } from "node:fs";
import { defineConfig } from "@vscode/test-cli";

// Runs e2e tests in an editor that is already installed instead of downloading VS Code.
// Order: $CATHOUSE_TEST_EDITOR, then VS Code (macOS), then Cursor (macOS).
// Cursor 3.21 (VS Code 1.128 base) loads the development extension but never registers it
// ("glass mode"), so the tests fail there; use VS Code. See docs/testing.md.
const candidates = [
  process.env.CATHOUSE_TEST_EDITOR,
  "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
  "/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
  "/Applications/Cursor.app/Contents/MacOS/Cursor",
].filter(Boolean);
const editor = candidates.find((p) => existsSync(p));
if (!editor) {
  throw new Error("No editor for e2e tests: install VS Code or set CATHOUSE_TEST_EDITOR");
}

export default defineConfig({
  files: "out-test/**/*.e2e.js",
  useInstallation: { fromPath: editor },
  // CATHOUSE_E2E_EXT_PATH runs the tests against an installed VSIX folder instead of this checkout.
  ...(process.env.CATHOUSE_E2E_EXT_PATH
    ? { extensionDevelopmentPath: process.env.CATHOUSE_E2E_EXT_PATH }
    : {}),
  // CATHOUSE_E2E_WORKSPACE opens a folder (a git repo with catherd runs) for the pages test.
  ...(process.env.CATHOUSE_E2E_WORKSPACE
    ? { workspaceFolder: process.env.CATHOUSE_E2E_WORKSPACE }
    : {}),
  // The manifest declares untrustedWorkspaces.supported=false and a fresh test window is
  // untrusted; trust is disabled for the test host only.
  launchArgs: ["--disable-workspace-trust"],
  mocha: { ui: "tdd", timeout: 60_000 },
  // CATHOUSE_E2E_GREP narrows the run (e.g. "Setup") for the slow opt-in install test.
  ...(process.env.CATHOUSE_E2E_GREP ? { grep: process.env.CATHOUSE_E2E_GREP } : {}),
});
