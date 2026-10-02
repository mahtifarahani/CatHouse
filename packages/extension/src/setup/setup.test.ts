import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PINNED } from "@cathouse/compat";
import type { SetupTopic } from "@cathouse/protocol";
import { describe, expect, it } from "vitest";
import { CatherdCli } from "../gateway/cli";
import type { RunOptions, RunResult } from "../gateway/process";
import { GIT_HTTPS_ENV, stepsFor } from "./actions";
import { type DetectDeps, detect } from "./detect";
import { evaluate } from "./evaluate";
import type { SetupFacts } from "./facts";
import { type ReadinessSnapshot, SetupService } from "./service";

const ready: SetupFacts = {
  bun: { version: "1.4.2" },
  catherd: { version: "1.4.0" },
  catherdConfig: { exists: true, path: "/c/config.json" },
  sdkBinary: { path: "/sdk/claude", version: "2.1.283" },
  plugin: { version: "1.4.0", installPath: "/p" },
  claudeLogin: { loggedIn: true, method: "claude.ai", email: "a@b" },
  codex: {},
  codexDaemon: { running: false },
  codexPlugin: {},
  needsClaudeCli: false,
  claudeCli: {},
  doctor: {
    ready: true,
    version: "1.4.0",
    checks: [
      { id: "bun", label: "Bun", state: "ok", word: "ready", detail: "1.4.2" },
      {
        id: "access:full",
        label: "full access",
        state: "info",
        word: "default",
        detail: "verifier",
      },
      {
        id: "access:custom",
        label: "custom access",
        state: "info",
        word: "default",
        detail: "a row catherd marks info itself",
      },
      {
        id: "backend:opencode",
        label: "opencode",
        state: "warn",
        word: "missing",
        detail: "not on PATH",
        fix: "curl …",
      },
    ],
  },
};

describe("evaluate", () => {
  it("uses Codex readiness without requiring Claude login or plugin", () => {
    const r = evaluate(
      {
        ...ready,
        sdkBinary: {},
        plugin: {},
        claudeLogin: { loggedIn: false },
        codex: { version: "0.159.2", loggedIn: true },
        codexDaemon: { running: true, version: "0.159.2" },
        codexPlugin: { version: "1.4.0" },
      },
      PINNED,
      "codex",
    );
    expect(r.canStart).toBe(true);
    expect(r.items.find((item) => item.id === "codex-daemon")?.state).toBe("ok");
    expect(r.items.some((item) => item.id === "claude-login" || item.id === "plugin")).toBe(false);
    const missing = evaluate(
      { ...ready, codex: { version: "0.158.0", loggedIn: false }, codexPlugin: {} },
      PINNED,
      "codex",
    );
    expect(missing.gateOpen).toBe(false);
    expect(missing.items.find((item) => item.id === "codex-host")?.action?.id).toBe(
      "install-codex",
    );
    expect(missing.items.find((item) => item.id === "codex-plugin")?.action?.id).toBe(
      "install-codex-plugin",
    );
    const stopped = evaluate(
      {
        ...ready,
        codex: { version: "0.159.2", loggedIn: true },
        codexPlugin: { version: "1.4.0" },
      },
      PINNED,
      "codex",
    );
    expect(stopped.items.find((item) => item.id === "codex-daemon")?.action?.id).toBe(
      "start-codex-daemon",
    );
  });
  it("fresh machine: gate closed, installers offered in order", () => {
    const r = evaluate(
      {
        bun: { error: "bun is not on PATH" },
        catherd: {},
        catherdConfig: { exists: false, path: "/c/config.json" },
        sdkBinary: { path: "/sdk/claude" },
        plugin: {},
        claudeLogin: { loggedIn: false },
        codex: {},
        codexDaemon: { running: false },
        codexPlugin: {},
        needsClaudeCli: false,
        claudeCli: {},
      },
      PINNED,
    );
    expect(r.gateOpen).toBe(false);
    expect(r.canStart).toBe(false);
    const byId = Object.fromEntries(r.items.map((i) => [i.id, i]));
    expect(byId.bun?.action?.id).toBe("install-bun");
    expect(byId.catherd?.action).toBeUndefined(); // needs Bun first
    expect(byId.plugin?.action?.id).toBe("install-plugin");
    expect(byId["claude-login"]?.action?.id).toBe("login-claude");
    expect(byId.readiness?.state).toBe("unknown");
  });

  it("ready machine: gate open and can start; default-warning rows are info", () => {
    const r = evaluate(ready, PINNED);
    expect(r.gateOpen).toBe(true);
    expect(r.canStart).toBe(true);
    expect(r.items.find((i) => i.id === "doctor:access:full")?.state).toBe("info");
    expect(r.items.find((i) => i.id === "doctor:access:custom")?.state).toBe("info");
    expect(r.items.find((i) => i.id === "doctor:bun")).toBeUndefined();
    expect(r.items.find((i) => i.id === "doctor:backend:opencode")).toMatchObject({
      state: "warn",
      level: "optional",
      action: { id: "install-opencode" },
    });
  });

  it("stale plugin and old Bun close the gate with update actions", () => {
    const r = evaluate(
      { ...ready, plugin: { version: "0.2.1" }, bun: { version: "1.3.9" } },
      PINNED,
    );
    expect(r.gateOpen).toBe(false);
    expect(r.items.find((i) => i.id === "plugin")?.action?.id).toBe("update-plugin");
    expect(r.items.find((i) => i.id === "bun")?.action?.id).toBe("upgrade-bun");
  });

  it("login and a failing backend block only starting tasks", () => {
    const r = evaluate(
      {
        ...ready,
        claudeLogin: { loggedIn: false },
        codex: {},
        codexPlugin: {},
        doctor: {
          ready: false,
          version: "1.4.0",
          checks: [
            {
              id: "backend:codex",
              label: "codex",
              state: "fail",
              word: "too old",
              detail: "0.142.2",
              fix: "npm i -g @openai/codex@latest",
            },
          ],
        },
      },
      PINNED,
    );
    expect(r.gateOpen).toBe(true);
    expect(r.canStart).toBe(false);
    expect(r.items.find((i) => i.id === "doctor:backend:codex")?.action?.id).toBe("install-codex");
  });

  it("asks for the standalone claude CLI only with claude-code rungs (ADR 0001)", () => {
    expect(evaluate(ready, PINNED).items.some((i) => i.id === "claude-cli")).toBe(false);
    const r = evaluate(
      { ...ready, needsClaudeCli: true, claudeCli: { version: "2.1.168" } },
      PINNED,
    );
    expect(r.items.find((i) => i.id === "claude-cli")).toMatchObject({
      state: "outdated",
      level: "start",
    });
    expect(r.canStart).toBe(false);
  });
});

describe("actions", () => {
  const ctx = {
    pin: PINNED,
    claude: "/sdk/claude",
    marketplaceKnown: false,
    host: "claude-code" as const,
  };
  it("installs the plugin with the bundled binary over HTTPS", () => {
    const steps = stepsFor("install-plugin", ctx);
    expect(steps.map((s) => (s.kind === "run" ? s.args.join(" ") : s.command))).toEqual([
      "plugin marketplace add 47vigen/catherd",
      "plugin install catherd@catherd",
    ]);
    for (const s of steps) expect(s.kind === "run" && s.env).toEqual(GIT_HTTPS_ENV);
    expect(stepsFor("install-plugin", { ...ctx, marketplaceKnown: true })[0]).toMatchObject({
      args: ["plugin", "marketplace", "update", "catherd"],
    });
  });
  it("pins catherd and opens logins in a terminal", () => {
    expect(stepsFor("init-catherd", ctx)[0]).toMatchObject({
      cmd: "bunx",
      args: ["catherd-cli@1.4.0", "init", "--no-input", "--plain", "--host", "claude-code"],
    });
    expect(stepsFor("login-claude", ctx)[0]).toMatchObject({
      kind: "terminal",
      command: "'/sdk/claude' auth login",
    });
  });
  it("installs the native Codex plugin only after its Setup action", () => {
    expect(
      stepsFor("install-codex-plugin", { ...ctx, host: "codex" }).map((step) =>
        step.kind === "run" ? step.args.join(" ") : step.command,
      ),
    ).toEqual(["plugin marketplace add 47vigen/catherd", "plugin add catherd@catherd"]);
    expect(stepsFor("start-codex-daemon", { ...ctx, host: "codex" })[0]).toMatchObject({
      args: ["app-server", "daemon", "start"],
    });
    expect(stepsFor("restart-codex-daemon", { ...ctx, host: "codex" })).toMatchObject([
      { args: ["app-server", "daemon", "stop"] },
      { args: ["app-server", "daemon", "start"] },
    ]);
  });
});

type Call = { cmd: string; args: string[] };
function fakeRun(responses: (c: Call) => Partial<RunResult>, calls: Call[] = []) {
  return async (cmd: string, args: string[], opts: RunOptions): Promise<RunResult> => {
    calls.push({ cmd, args });
    const r = {
      code: 0,
      stdout: "",
      stderr: "",
      signal: null,
      timedOut: false,
      ...responses({ cmd, args }),
    };
    if (r.stdout) opts.onOutput?.(r.stdout, "stdout");
    return r as RunResult;
  };
}

function detectDeps(run: DetectDeps["run"], home: string): DetectDeps {
  return {
    host: () => "claude-code",
    run,
    env: async () => ({}),
    bundledClaude: () => "/sdk/claude",
    cli: () =>
      ({
        profileShow: async () => ({ profile: { roles: {}, failover: {} } }),
      }) as unknown as CatherdCli,
    pin: PINNED,
    vars: { CATHERD_HOME: join(home, "catherd"), CLAUDE_CONFIG_DIR: join(home, "claude") },
  };
}

describe("detect", () => {
  it("never installs: catherd is probed with --no-install and reported missing", async () => {
    const home = mkdtempSync(join(tmpdir(), "cathouse-setup-"));
    const calls: Call[] = [];
    const run = fakeRun(({ cmd, args }) => {
      if (cmd === "bun") return { stdout: "1.4.2\n" };
      if (cmd === "bunx")
        return {
          code: 1,
          stderr:
            "error: Could not find an existing 'catherd-cli' binary to run. Stopping because --no-install was passed.",
        };
      if (args.includes("auth")) return { stdout: '{"loggedIn":false,"authMethod":"none"}' };
      return { stdout: "2.1.283 (Claude Code)\n" };
    }, calls);
    const f = await detect(detectDeps(run, home));
    expect(calls.find((c) => c.cmd === "bunx")?.args).toEqual([
      "--no-install",
      "catherd-cli@1.4.0",
      "--version",
    ]);
    expect(f.catherd).toEqual({});
    expect(f.catherdConfig.exists).toBe(false);
    expect(f.plugin).toEqual({});
    expect(f.claudeLogin.loggedIn).toBe(false);
    expect(f.sdkBinary.version).toBe("2.1.283");
  });

  it("reads config.json and installed_plugins.json", async () => {
    const home = mkdtempSync(join(tmpdir(), "cathouse-setup-"));
    mkdirSync(join(home, "catherd", "config"), { recursive: true });
    writeFileSync(
      join(home, "catherd", "config", "config.json"),
      '{"schema":1,"activeProfile":"default"}',
    );
    mkdirSync(join(home, "claude", "plugins"), { recursive: true });
    writeFileSync(
      join(home, "claude", "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: { "catherd@catherd": [{ scope: "user", installPath: "/p", version: "1.4.0" }] },
      }),
    );
    const run = fakeRun(({ cmd, args }) =>
      cmd === "bunx"
        ? { stdout: "1.4.0\n" }
        : args.includes("auth")
          ? { stdout: '{"loggedIn":true,"authMethod":"claude.ai"}' }
          : { stdout: "1.4.2" },
    );
    const f = await detect(detectDeps(run, home));
    expect(f.catherd.version).toBe("1.4.0");
    expect(f.catherdConfig.exists).toBe(true);
    expect(f.plugin).toEqual({ installPath: "/p", version: "1.4.0" });
    expect(f.claudeLogin).toMatchObject({ loggedIn: true, method: "claude.ai" });
  });
});

describe("SetupService", () => {
  it("passes both API keys only on stdin and never broadcasts or logs them", async () => {
    const events: SetupTopic[] = [];
    const logs: string[] = [];
    let initOptions: RunOptions | undefined;
    let initArgs: string[] | undefined;
    const run = async (cmd: string, args: string[], opts: RunOptions): Promise<RunResult> => {
      if (cmd === "bunx" && args.includes("init")) {
        initOptions = opts;
        initArgs = args;
        return {
          code: 0,
          signal: null,
          timedOut: false,
          stdout:
            "ok Jev: the key answers; saved with mode 600\nok Artificial Analysis: the key answers; saved with mode 600\nupstream diagnostic jev-secret aa-secret\n",
          stderr: "",
        };
      }
      return {
        code: 0,
        signal: null,
        timedOut: false,
        stdout: cmd === "bunx" ? "1.4.0" : "1.4.2",
        stderr: "",
      };
    };
    const svc = new SetupService({
      ...detectDeps(run, mkdtempSync(join(tmpdir(), "cathouse-keys-"))),
      env: async () => ({ TYPESAFE_API_KEY: "old-env-key", ARTIFICIAL_ANALYSIS_API_KEY: "old-aa" }),
      cli: () =>
        new CatherdCli({
          cwd: "/repo",
          env: async () => ({
            TYPESAFE_API_KEY: "old-env-key",
            ARTIFICIAL_ANALYSIS_API_KEY: "old-aa",
          }),
          runner: run,
        }),
      broadcast: (event) => events.push(event),
      log: (line) => logs.push(line),
      openTerminal: async () => {},
    });
    await svc.saveKeys("jev-secret", "aa-secret");
    expect(initOptions?.stdin).toBe("jev-secret\naa-secret\n\nn\n");
    expect(initOptions?.env.TYPESAFE_API_KEY).toBeUndefined();
    expect(initOptions?.env.ARTIFICIAL_ANALYSIS_API_KEY).toBeUndefined();
    expect(initArgs).toContain("--no-global");
    expect(initArgs).toContain("--no-install");
    expect(events).toContainEqual({ type: "action_done", action: "save-api-keys", ok: true });
    expect(JSON.stringify(events) + logs.join(" ")).not.toMatch(/jev-secret|aa-secret/);
  });

  it("restores the last user-triggered readiness result without running doctor on activation", async () => {
    const home = mkdtempSync(join(tmpdir(), "cathouse-setup-"));
    mkdirSync(join(home, "catherd", "config"), { recursive: true });
    writeFileSync(
      join(home, "catherd", "config", "config.json"),
      '{"schema":1,"activeProfile":"default"}',
    );
    mkdirSync(join(home, "claude", "plugins"), { recursive: true });
    writeFileSync(
      join(home, "claude", "plugins", "installed_plugins.json"),
      JSON.stringify({
        version: 2,
        plugins: {
          "catherd@catherd": [{ scope: "user", installPath: "/p", version: "1.4.0" }],
        },
      }),
    );
    const run = fakeRun(({ cmd, args }) =>
      cmd === "bunx"
        ? { stdout: "1.4.0\n" }
        : args.includes("auth")
          ? { stdout: '{"loggedIn":true,"authMethod":"claude.ai"}' }
          : { stdout: "1.4.2" },
    );
    let doctorCalls = 0;
    let saved: ReadinessSnapshot | undefined;
    const base = {
      ...detectDeps(run, home),
      cli: () =>
        ({
          profileShow: async () => ({ profile: { roles: {}, failover: {} } }),
          doctor: async () => {
            doctorCalls += 1;
            return ready.doctor;
          },
        }) as unknown as CatherdCli,
      broadcast: () => {},
      openTerminal: async () => {},
      log: () => {},
    };
    const first = new SetupService({
      ...base,
      persistReadiness: (snapshot) => {
        saved = snapshot;
      },
    });
    await first.check({ readiness: true });
    expect(first.state().canStart).toBe(true);
    expect(doctorCalls).toBe(1);
    expect(saved?.doctor.ready).toBe(true);

    const restored = new SetupService({ ...base, initialReadiness: saved });
    await restored.check();
    expect(restored.state()).toMatchObject({ canStart: true, doctorAt: saved?.doctorAt });
    expect(doctorCalls).toBe(1);
  });

  it("runs one action at a time, streams output, rechecks", async () => {
    const home = mkdtempSync(join(tmpdir(), "cathouse-setup-"));
    const events: SetupTopic[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const run = async (cmd: string, _args: string[], opts: RunOptions): Promise<RunResult> => {
      if (cmd === "bash") {
        opts.onOutput?.("bun installed\n", "stdout");
        await gate;
      }
      return {
        code: cmd === "bunx" ? 1 : 0,
        stdout: cmd === "bun" ? "1.4.2" : "",
        stderr: "",
        signal: null,
        timedOut: false,
      };
    };
    const svc = new SetupService({
      ...detectDeps(run, home),
      broadcast: (p) => events.push(p),
      openTerminal: async () => {},
      log: () => {},
    });
    const first = svc.run("install-bun");
    await expect(svc.run("install-codex")).rejects.toMatchObject({ code: "E_SETUP_BUSY" });
    release();
    await first;
    expect(events.some((e) => e.type === "output" && e.chunk.includes("bun installed"))).toBe(true);
    expect(events.find((e) => e.type === "action_done")).toMatchObject({
      action: "install-bun",
      ok: true,
    });
    expect(svc.state().items.find((i) => i.id === "bun")?.state).toBe("ok");
  });
});
