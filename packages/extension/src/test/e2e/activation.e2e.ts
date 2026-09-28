import * as assert from "node:assert";
import * as vscode from "vscode";

/** Tabs appear asynchronously after a command resolves. */
async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return check();
}

suite("CatHouse activation", () => {
  test("activates, registers its command and opens the dashboard webview", async () => {
    const ext = vscode.extensions.getExtension("cathouse.cathouse");
    assert.ok(ext, "extension cathouse.cathouse is not installed in the test host");
    await ext.activate();
    assert.ok(ext.isActive);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("cathouse.openDashboard"));

    await vscode.commands.executeCommand("cathouse.openDashboard");
    const found = await waitFor(() =>
      vscode.window.tabGroups.all
        .flatMap((g) => g.tabs)
        .some(
          (t) =>
            t.input instanceof vscode.TabInputWebview &&
            t.input.viewType.endsWith("cathouse.dashboard"),
        ),
    );
    const seen = vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .map((t) => (t.input instanceof vscode.TabInputWebview ? t.input.viewType : t.label));
    assert.ok(found, `no CatHouse dashboard tab; tabs: ${JSON.stringify(seen)}`);
  });
});
