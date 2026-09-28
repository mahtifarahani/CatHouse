import * as assert from "node:assert";
import type { SetupState } from "@cathouse/protocol";
import * as vscode from "vscode";

// Runs the real detectors and catherd doctor in the extension host of the machine under test.
// On a machine prepared per docs/runbook.md §1 the gate must be open.
suite("CatHouse Setup (real machine)", () => {
  test("detects Bun, catherd, the plugin and the bundled Claude", async function () {
    this.timeout(process.env.CATHOUSE_E2E_INSTALL === "1" ? 1_200_000 : 240_000);
    const state = (await vscode.commands.executeCommand("cathouse.checkSetup")) as SetupState;
    const byId = Object.fromEntries(state.items.map((i) => [i.id, i]));
    console.log(
      "SETUP",
      JSON.stringify(state.items.map((i) => `${i.id}=${i.state}`)),
      "gate",
      state.gateOpen,
      "canStart",
      state.canStart,
      state.canStartReason ?? "",
    );
    for (const id of ["bun", "claude-bundled", "catherd", "plugin", "claude-login", "readiness"]) {
      assert.ok(byId[id], `missing setup item ${id}`);
    }
    if (process.env.CATHOUSE_EXPECT_FRESH === "1") {
      // Fresh machine (temp HOME, minimal PATH): Setup only, with installers offered.
      assert.strictEqual(state.gateOpen, false);
      assert.strictEqual(state.canStart, false);
      assert.strictEqual(byId.bun?.state, "missing");
      assert.strictEqual(byId.bun?.action?.id, "install-bun");
      assert.strictEqual(byId.plugin?.state, "missing");
      assert.strictEqual(byId.plugin?.action?.id, "install-plugin");
      assert.strictEqual(byId["claude-bundled"]?.state, "ok");
    }
    if (process.env.CATHOUSE_E2E_INSTALL === "1") {
      // Presses the Setup buttons in order on a fresh HOME and expects the gate to open.
      for (const action of ["install-bun", "init-catherd", "install-plugin"] as const) {
        const after = (await vscode.commands.executeCommand(
          "cathouse._runSetupAction",
          action,
        )) as SetupState;
        console.log("AFTER", action, JSON.stringify(after.items.map((i) => `${i.id}=${i.state}`)));
      }
      const final = (await vscode.commands.executeCommand("cathouse.checkSetup")) as SetupState;
      console.log(
        "FINAL gate",
        final.gateOpen,
        "canStart",
        final.canStart,
        final.canStartReason ?? "",
      );
      assert.strictEqual(final.gateOpen, true, "gate should open after the installers");
    }
    if (process.env.CATHOUSE_EXPECT_READY === "1") {
      assert.strictEqual(state.gateOpen, true, "gate should be open on a prepared machine");
    }
  });
});
