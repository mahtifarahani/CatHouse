import type { CompatEntry } from "@cathouse/compat";
import type { SetupActionId } from "@cathouse/protocol";

// Installer steps, run only after the user clicks (plan: "installers only on click").

export type Step =
  | { kind: "run"; cmd: string; args: string[]; env?: Record<string, string>; label: string }
  /** Interactive (logins): opened in a VS Code terminal so the user completes it. */
  | { kind: "terminal"; name: string; command: string; label: string };

/** catherd's marketplace source clones over SSH; force HTTPS (docs/research/catherd-known-issues.md). */
export const GIT_HTTPS_ENV = {
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "url.https://github.com/.insteadOf",
  GIT_CONFIG_VALUE_0: "git@github.com:",
};

export interface ActionContext {
  pin: CompatEntry;
  claude: string | undefined;
  /** Marketplace "catherd" already registered in Claude (known_marketplaces.json). */
  marketplaceKnown: boolean;
  host: "claude-code" | "codex";
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function stepsFor(action: SetupActionId, ctx: ActionContext): Step[] {
  const bunx = (args: string[], label: string): Step => ({
    kind: "run",
    cmd: "bunx",
    args: [`catherd-cli@${ctx.pin.catherd}`, ...args],
    label,
  });
  const claude = (args: string[], label: string): Step[] =>
    ctx.claude ? [{ kind: "run", cmd: ctx.claude, args, env: GIT_HTTPS_ENV, label }] : [];
  switch (action) {
    case "install-bun":
      return [
        {
          kind: "run",
          cmd: "bash",
          args: ["-c", "curl -fsSL https://bun.sh/install | bash"],
          label: "Install Bun",
        },
      ];
    case "upgrade-bun":
      return [{ kind: "run", cmd: "bun", args: ["upgrade"], label: "Upgrade Bun" }];
    case "init-catherd":
      return [
        bunx(
          ["init", "--no-input", "--plain", "--host", ctx.host],
          `Install and set up catherd ${ctx.pin.catherd}`,
        ),
      ];
    case "install-plugin":
      return [
        ...(ctx.marketplaceKnown
          ? claude(["plugin", "marketplace", "update", "catherd"], "Update the catherd marketplace")
          : claude(
              ["plugin", "marketplace", "add", "47vigen/catherd"],
              "Add the catherd marketplace",
            )),
        ...claude(["plugin", "install", "catherd@catherd"], "Install catherd@catherd"),
      ];
    case "update-plugin":
      return [
        ...claude(["plugin", "marketplace", "update", "catherd"], "Update the catherd marketplace"),
        ...claude(["plugin", "update", "catherd@catherd"], "Update catherd@catherd"),
      ];
    case "install-codex-plugin":
      return [
        {
          kind: "run",
          cmd: "codex",
          args: ["plugin", "marketplace", "add", "47vigen/catherd"],
          label: "Add the catherd marketplace",
        },
        {
          kind: "run",
          cmd: "codex",
          args: ["plugin", "add", "catherd@catherd"],
          label: "Install catherd for Codex",
        },
      ];
    case "update-codex-plugin":
      return [
        {
          kind: "run",
          cmd: "codex",
          args: ["plugin", "marketplace", "upgrade", "catherd"],
          label: "Update the catherd marketplace",
        },
        {
          kind: "run",
          cmd: "codex",
          args: ["plugin", "remove", "catherd@catherd"],
          label: "Remove old catherd plugin",
        },
        {
          kind: "run",
          cmd: "codex",
          args: ["plugin", "add", "catherd@catherd"],
          label: "Install current catherd plugin",
        },
      ];
    case "login-claude":
      return ctx.claude
        ? [
            {
              kind: "terminal",
              name: "Claude login",
              command: `${quote(ctx.claude)} auth login`,
              label: "Log in to Claude",
            },
          ]
        : [];
    case "install-claude-cli":
      return [
        {
          kind: "run",
          cmd: "npm",
          args: ["i", "-g", "@anthropic-ai/claude-code@latest"],
          label: "Install the claude CLI",
        },
      ];
    case "install-codex":
      return [
        {
          kind: "run",
          cmd: "npm",
          args: ["i", "-g", "@openai/codex@latest"],
          label: "Install Codex",
        },
      ];
    case "login-codex":
      return [
        { kind: "terminal", name: "Codex login", command: "codex login", label: "Log in to Codex" },
      ];
    case "start-codex-daemon":
      return [
        {
          kind: "run",
          cmd: "codex",
          args: ["app-server", "daemon", "start"],
          label: "Start Codex app-server daemon",
        },
      ];
    case "restart-codex-daemon":
      return [
        {
          kind: "run",
          cmd: "codex",
          args: ["app-server", "daemon", "stop"],
          label: "Stop outdated Codex app-server daemon",
        },
        {
          kind: "run",
          cmd: "codex",
          args: ["app-server", "daemon", "start"],
          label: "Start current Codex app-server daemon",
        },
      ];
    case "install-opencode":
      return [
        {
          kind: "run",
          cmd: "bash",
          args: ["-c", "curl -fsSL https://opencode.ai/v2/install | bash"],
          label: "Install opencode v2",
        },
      ];
    case "check-readiness":
      return [];
  }
}

/** Actions after which the backend listings may be stale: refresh them before doctor. */
export const REFRESH_AFTER = new Set<SetupActionId>([
  "init-catherd",
  "install-codex",
  "install-codex-plugin",
  "update-codex-plugin",
  "install-opencode",
  "install-claude-cli",
  "login-codex",
  "start-codex-daemon",
  "restart-codex-daemon",
]);
