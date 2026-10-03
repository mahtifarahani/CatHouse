import * as assert from "node:assert";
import * as vscode from "vscode";

type Resp = { ok: boolean; result?: unknown; error?: { code: string; message: string } };
const call = async (method: string, params: unknown = {}): Promise<unknown> => {
  const r = (await vscode.commands.executeCommand("cathouse._request", method, params)) as Resp;
  assert.ok(r.ok, `${method} failed: ${r.error?.code} ${r.error?.message}`);
  return r.result;
};

// Needs CATHOUSE_E2E_WORKSPACE = a git repo with at least one catherd run (e.g. the Phase 1 spike repo).
suite("CatHouse pages (real catherd)", () => {
  suiteSetup(function () {
    if (!process.env.CATHOUSE_E2E_WORKSPACE) this.skip();
  });

  test("runs list and detail", async function () {
    this.timeout(180_000);
    const list = (await call("runs.list")) as { runs: { id: string; landed?: number }[] };
    assert.ok(list.runs.length > 0, "expected a run in the workspace repo");
    const id = list.runs[0]?.id as string;
    const d = (await call("runs.get", { id })) as {
      stateMd: string;
      records: { name: string }[];
      routes: unknown[];
    };
    assert.ok(d.stateMd.startsWith("#"));
    assert.ok(d.records.length > 0);
    const reply = (await call("runs.reply", { id, name: d.records[0]?.name })) as { state: string };
    assert.strictEqual(reply.state, "finished");
    const debug = (await call("runs.debug", { id, name: d.records[0]?.name })) as unknown[];
    assert.ok(debug.length > 0);
    console.log("RUN", id, "records", d.records.length, "routes", d.routes.length);
  });

  test("workspace and repo selection", async () => {
    const ws = (await call("app.workspace")) as {
      folders: { path: string }[];
      repo: string;
      catherdVersion: string;
    };
    assert.strictEqual(ws.folders.length, 1);
    assert.strictEqual(ws.repo, ws.folders[0]?.path);
    assert.strictEqual(ws.catherdVersion, "1.5.0");
    const set = (await call("app.setRepo", { path: ws.repo })) as { repo: string };
    assert.strictEqual(set.repo, ws.repo);
  });

  test("profiles and catalog", async function () {
    this.timeout(180_000);
    const p = (await call("profiles.get")) as {
      here: string;
      profile: { roles: Record<string, unknown> };
      validation: { valid: boolean };
    };
    assert.ok(p.profile.roles.worker);
    const c = (await call("catalog.query", { role: "worker" })) as {
      total: number;
      models: unknown[];
    };
    assert.ok(c.models.length > 0);
    // Saving an unchanged draft writes nothing.
    const save = (await call("profiles.save", {
      name: p.here,
      base: p.profile,
      draft: p.profile,
    })) as { status: string };
    assert.strictEqual(save.status, "unchanged");
    console.log("PROFILE", p.here, "valid", p.validation.valid, "catalog", c.total);
  });
});
