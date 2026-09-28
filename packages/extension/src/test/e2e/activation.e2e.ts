import * as assert from "node:assert";
import * as vscode from "vscode";

suite("CatHouse activation", () => {
  test("activates, registers its command and opens the dashboard webview", async () => {
    const ext = vscode.extensions.getExtension("cathouse.cathouse");
    assert.ok(ext, "extension cathouse.cathouse is not installed in the test host");
    await ext.activate();
    assert.ok(ext.isActive);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("cathouse.openDashboard"));

    await vscode.commands.executeCommand("cathouse.openDashboard");
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    assert.ok(
      tabs.some(
        (t) =>
          t.input instanceof vscode.TabInputWebview &&
          t.input.viewType.endsWith("cathouse.dashboard"),
      ),
      "no CatHouse dashboard tab after cathouse.openDashboard",
    );
  });
});
