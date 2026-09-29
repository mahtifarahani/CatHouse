import { atLeast, type CompatEntry } from "@cathouse/compat";
import type { SetupActionId, SetupItem } from "@cathouse/protocol";
import type { SetupFacts } from "./facts";

// Pure: facts → Setup items and gates (docs/architecture/setup.md). The plan's rule: Setup-only
// until Bun, catherd, the plugin and the bundled Claude are good; login and backends block only
// starting tasks.

const act = (id: SetupActionId, label: string) => ({ id, label });

/** Doctor rows whose "fail" is about a backend CatHouse can install or log in. */
function backendAction(id: string, word: string): SetupItem["action"] {
  if (id === "backend:codex") {
    return word === "not logged in"
      ? act("login-codex", "Log in to Codex")
      : act("install-codex", word === "too old" ? "Update Codex" : "Install Codex");
  }
  if (id === "backend:opencode" && word !== "not logged in") {
    return act("install-opencode", word === "too old" ? "Update opencode" : "Install opencode v2");
  }
  return undefined;
}

/**
 * Doctor rows about the shipped defaults: shown as info, not warnings. catherd 1.1+ marks them
 * `info` itself; the ids stay listed for a `sandbox:codex` warning, which is still advisory.
 */
const INFO_ROWS = new Set(["access:full", "access:advisory", "sandbox:codex"]);
/** Doctor rows CatHouse already shows as its own items. */
const COVERED_ROWS = new Set(["bun", "plugin"]);

export function evaluate(
  f: SetupFacts,
  pin: CompatEntry,
): {
  items: SetupItem[];
  gateOpen: boolean;
  canStart: boolean;
  canStartReason?: string;
} {
  const items: SetupItem[] = [];

  // Bun
  if (!f.bun.version) {
    items.push({
      id: "bun",
      label: "Bun",
      state: "missing",
      level: "gate",
      detail: f.bun.error ?? "bun is not on PATH",
      action: act("install-bun", "Install Bun"),
    });
  } else if (!atLeast(f.bun.version, pin.bun)) {
    items.push({
      id: "bun",
      label: "Bun",
      state: "outdated",
      level: "gate",
      detail: `${f.bun.version} is older than ${pin.bun}`,
      action: act("upgrade-bun", "Upgrade Bun"),
    });
  } else {
    items.push({ id: "bun", label: "Bun", state: "ok", level: "gate", detail: f.bun.version });
  }

  // Bundled Claude (the SDK's binary): nothing to install, it ships with CatHouse.
  items.push(
    f.sdkBinary.path
      ? {
          id: "claude-bundled",
          label: "Claude Code (bundled)",
          state: "ok",
          level: "gate",
          detail: f.sdkBinary.version ?? f.sdkBinary.path,
        }
      : {
          id: "claude-bundled",
          label: "Claude Code (bundled)",
          state: "error",
          level: "gate",
          detail: f.sdkBinary.error ?? "the Claude binary for this platform is missing",
          fix: "reinstall the CatHouse VSIX built for this platform",
        },
  );

  // catherd CLI + init
  const bunOk = !!f.bun.version && atLeast(f.bun.version, pin.bun);
  if (f.catherd.version !== pin.catherd || !f.catherdConfig.exists) {
    const detail =
      f.catherd.version === undefined
        ? `catherd-cli@${pin.catherd} is not installed yet`
        : f.catherd.version !== pin.catherd
          ? `found ${f.catherd.version}, CatHouse needs ${pin.catherd}`
          : `not set up yet (no ${f.catherdConfig.path})`;
    items.push({
      id: "catherd",
      label: `catherd ${pin.catherd}`,
      state: f.catherd.version === undefined ? "missing" : "outdated",
      level: "gate",
      detail,
      ...(bunOk ? { action: act("init-catherd", "Install and set up catherd") } : {}),
    });
  } else {
    items.push({
      id: "catherd",
      label: `catherd ${pin.catherd}`,
      state: "ok",
      level: "gate",
      detail: "installed and set up",
    });
  }

  // Claude plugin
  if (!f.plugin.version) {
    items.push({
      id: "plugin",
      label: "catherd plugin for Claude",
      state: "missing",
      level: "gate",
      detail: "catherd@catherd is not installed",
      ...(f.sdkBinary.path ? { action: act("install-plugin", "Install plugin") } : {}),
    });
  } else if (f.plugin.version !== pin.plugin) {
    items.push({
      id: "plugin",
      label: "catherd plugin for Claude",
      state: "outdated",
      level: "gate",
      detail: `installed ${f.plugin.version}, catherd ${pin.catherd} needs ${pin.plugin}`,
      ...(f.sdkBinary.path ? { action: act("update-plugin", "Update plugin") } : {}),
    });
  } else {
    items.push({
      id: "plugin",
      label: "catherd plugin for Claude",
      state: "ok",
      level: "gate",
      detail: f.plugin.version,
    });
  }

  // Claude login
  items.push(
    f.claudeLogin.loggedIn
      ? {
          id: "claude-login",
          label: "Claude account",
          state: "ok",
          level: "start",
          detail:
            [f.claudeLogin.method, f.claudeLogin.email].filter(Boolean).join(" · ") || "logged in",
        }
      : {
          id: "claude-login",
          label: "Claude account",
          state: f.claudeLogin.error ? "unknown" : "missing",
          level: "start",
          detail: f.claudeLogin.error ?? "not logged in",
          ...(f.sdkBinary.path ? { action: act("login-claude", "Log in") } : {}),
        },
  );

  // Standalone claude, only for claude-code: rungs (ADR 0001)
  if (f.needsClaudeCli) {
    const v = f.claudeCli.version;
    items.push(
      v && atLeast(v, pin.claudeCode)
        ? {
            id: "claude-cli",
            label: "claude CLI (claude-code rungs)",
            state: "ok",
            level: "start",
            detail: v,
          }
        : {
            id: "claude-cli",
            label: "claude CLI (claude-code rungs)",
            state: v ? "outdated" : "missing",
            level: "start",
            detail: v
              ? `${v} is older than ${pin.claudeCode}`
              : "your profile uses claude-code: rungs, which need the claude CLI",
            action: act("install-claude-cli", v ? "Update claude CLI" : "Install claude CLI"),
          },
    );
  }

  // Readiness (catherd doctor)
  if (!f.doctor) {
    items.push({
      id: "readiness",
      label: "catherd readiness",
      state: f.doctorError ? "error" : "unknown",
      level: "start",
      detail: f.doctorError ?? "not checked yet",
      action: act("check-readiness", "Check readiness"),
    });
  } else {
    for (const c of f.doctor.checks) {
      if (COVERED_ROWS.has(c.id)) continue;
      if (c.state === "ok") continue;
      const info = c.state === "info" || INFO_ROWS.has(c.id);
      const action =
        c.state === "fail" || c.state === "warn" ? backendAction(c.id, c.word) : undefined;
      items.push({
        id: `doctor:${c.id}`,
        label: c.label,
        state: info || c.state === "skip" ? "info" : c.state === "fail" ? "error" : "warn",
        level: c.state === "fail" ? "start" : "optional",
        detail: `${c.word} — ${c.detail}`,
        ...(c.fix ? { fix: c.fix } : {}),
        ...(action ? { action } : {}),
      });
    }
    items.push({
      id: "readiness",
      label: "catherd readiness",
      state: f.doctor.ready ? "ok" : "error",
      level: "start",
      detail: f.doctor.ready ? "ready" : "not ready: fix the rows marked as errors",
      action: act("check-readiness", "Check again"),
    });
  }

  const gateOpen = items.filter((i) => i.level === "gate").every((i) => i.state === "ok");
  const blocker = items.find((i) => i.level === "start" && i.state !== "ok");
  const canStart = gateOpen && !blocker;
  return {
    items,
    gateOpen,
    canStart,
    ...(canStart
      ? {}
      : {
          canStartReason: gateOpen ? `${blocker?.label}: ${blocker?.detail}` : "finish Setup first",
        }),
  };
}
