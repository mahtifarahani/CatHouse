import * as assert from "node:assert";
import * as vscode from "vscode";

suite("CatHouse activation", () => {
  test("activates and opens its full Activity Bar view", async () => {
    const ext = vscode.extensions.getExtension("cathouse.cathouse");
    assert.ok(ext, "extension cathouse.cathouse is not installed in the test host");
    await ext.activate();
    assert.ok(ext.isActive);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("cathouse.sidebar.focus"));
    assert.ok(!commands.includes("cathouse.openDashboard"));
    await vscode.commands.executeCommand("cathouse.sidebar.focus");
  });
});
