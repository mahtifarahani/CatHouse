import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompatEntry } from "@cathouse/compat";
import type { SetupActionId, SetupState, SetupTopic } from "@cathouse/protocol";
import type { CatherdCli } from "../gateway/cli";
import type { DoctorReport } from "../gateway/schemas";
import { claudeHome } from "../orchestrator/plugin";
import { HandlerError } from "../panel/router";
import { type ActionContext, REFRESH_AFTER, type Step, stepsFor } from "./actions";
import { type DetectDeps, detect } from "./detect";
import { evaluate } from "./evaluate";
import type { SetupFacts } from "./facts";

export interface SetupDeps extends DetectDeps {
  broadcast: (payload: SetupTopic) => void;
  /** Opens an interactive command in a terminal (logins); resolves when the terminal closes. */
  openTerminal: (name: string, command: string, env: Record<string, string>) => Promise<void>;
  log: (line: string) => void;
  /** Last user-triggered doctor result for this workspace; doctor itself never runs on activation. */
  initialReadiness?: ReadinessSnapshot;
  persistReadiness?: (snapshot: ReadinessSnapshot | undefined) => PromiseLike<void> | void;
}

export interface ReadinessSnapshot {
  doctor: DoctorReport;
  doctorAt: string;
}

/** Detects, installs (on click only) and gates. vscode-free; see docs/architecture/setup.md. */
export class SetupService {
  private facts: SetupFacts | undefined;
  private checking = false;
  private running: SetupActionId | undefined;
  private checkedAt: string | undefined;
  private doctorAt: string | undefined;
  private cachedDoctor: DoctorReport | undefined;

  constructor(private readonly deps: SetupDeps) {
    this.cachedDoctor = deps.initialReadiness?.doctor;
    this.doctorAt = deps.initialReadiness?.doctorAt;
  }

  state(): SetupState {
    const base = { checking: this.checking, ...(this.running ? { running: this.running } : {}) };
    if (!this.facts) {
      return {
        ...base,
        host: this.deps.host(),
        items: [],
        gateOpen: false,
        canStart: false,
        canStartReason: "checking…",
      };
    }
    return {
      ...base,
      host: this.deps.host(),
      ...evaluate(this.facts, this.deps.pin, this.deps.host()),
      ...(this.checkedAt ? { checkedAt: this.checkedAt } : {}),
      ...(this.doctorAt ? { doctorAt: this.doctorAt } : {}),
      ...(this.facts.savedKeys ? { savedKeys: this.facts.savedKeys } : {}),
    };
  }

  private publish(): SetupState {
    const s = this.state();
    this.deps.broadcast({ type: "state", state: s });
    return s;
  }

  /** Quick, side-effect-free detection. With readiness: also catalog refresh (optional) + doctor. */
  async check(opts: { readiness?: boolean; refresh?: boolean } = {}): Promise<SetupState> {
    this.checking = true;
    this.publish();
    try {
      const doctor = this.facts?.doctor ?? this.cachedDoctor;
      this.facts = { ...(await detect(this.deps)), ...(doctor ? { doctor } : {}) };
      this.checkedAt = new Date().toISOString();
      if (opts.readiness && evaluate(this.facts, this.deps.pin, this.deps.host()).gateOpen) {
        await this.readiness(opts.refresh === true);
      }
    } finally {
      this.checking = false;
    }
    return this.publish();
  }

  async switchHost(): Promise<SetupState> {
    this.cachedDoctor = undefined;
    this.doctorAt = undefined;
    this.facts = undefined;
    await this.deps.persistReadiness?.(undefined);
    return this.check();
  }

  /** catherd doctor has side effects; it runs only here (Setup, after installs, on "Check"). */
  private async readiness(refresh: boolean): Promise<void> {
    if (!this.facts) return;
    const cli: CatherdCli = this.deps.cli();
    try {
      // After a backend install the listing is stale and the first doctor misreports the profile
      // (docs/spikes/phase1.md finding 6), so refresh the catalog first.
      if (refresh) await cli.catalogRefresh();
      this.facts.doctor = await cli.doctor();
      this.cachedDoctor = this.facts.doctor;
      delete this.facts.doctorError;
      this.doctorAt = new Date().toISOString();
      await this.deps.persistReadiness?.({ doctor: this.facts.doctor, doctorAt: this.doctorAt });
    } catch (e) {
      delete this.facts.doctor;
      this.cachedDoctor = undefined;
      this.facts.doctorError = e instanceof Error ? e.message : String(e);
      this.doctorAt = undefined;
      await this.deps.persistReadiness?.(undefined);
    }
  }

  private async marketplaceKnown(): Promise<boolean> {
    try {
      const raw = await readFile(
        join(claudeHome(this.deps.vars), "plugins", "known_marketplaces.json"),
        "utf8",
      );
      return Object.hasOwn(JSON.parse(raw) as object, "catherd");
    } catch {
      return false;
    }
  }

  private async runStep(action: SetupActionId, step: Step): Promise<void> {
    const env = await this.deps.env();
    const out = (chunk: string) => this.deps.broadcast({ type: "output", action, chunk });
    out(`\n$ ${step.label}\n`);
    if (step.kind === "terminal") {
      out("Finish it in the terminal CatHouse opened, then close that terminal.\n");
      await this.deps.openTerminal(step.name, step.command, env);
      return;
    }
    this.deps.log(`setup ${action}: ${step.cmd} ${step.args.join(" ")}`);
    const r = await this.deps.run(step.cmd, step.args, {
      env: { ...env, ...step.env },
      timeoutMs: 15 * 60_000,
      onOutput: (c) => out(c),
    });
    if (r.code !== 0) {
      throw new HandlerError(
        "E_SETUP_STEP",
        `${step.label} failed (exit ${r.code ?? r.signal ?? "?"})`,
        "read the output above; fix the cause and try again",
      );
    }
  }

  /** Send optional keys to catherd's own init prompt; catherd validates and saves them. */
  async saveKeys(jevKey?: string, aaKey?: string): Promise<void> {
    if (this.running) throw new HandlerError("E_SETUP_BUSY", `${this.running} is still running`);
    const valid = (key: string | undefined) =>
      key === undefined ||
      (key.length > 0 && key.length <= 2048 && [...key].every((ch) => ch.charCodeAt(0) > 31));
    if ((!jevKey && !aaKey) || !valid(jevKey) || !valid(aaKey)) {
      throw new HandlerError(
        "E_SETUP_KEYS",
        "Enter one or both API keys (single line, up to 2048 characters)",
      );
    }
    const action = "save-api-keys" as const;
    this.running = action;
    this.publish();
    let ok = false;
    let message: string | undefined;
    try {
      ok = (await this.deps.cli().saveApiKeys({ jevKey, aaKey }, this.deps.host())).ok;
      if (!ok)
        message =
          "catherd did not save every supplied key. Check readiness and retry the missing key.";
    } catch {
      message =
        "Could not save API keys through catherd init. Check that catherd is installed and try again.";
    } finally {
      this.running = undefined;
    }
    this.deps.broadcast({ type: "action_done", action, ok, ...(message ? { message } : {}) });
    await this.check({ readiness: true });
  }

  /** Runs one action (user click). One at a time; results stream on the "setup" topic. */
  async run(action: SetupActionId): Promise<void> {
    if (action === "save-api-keys") {
      throw new HandlerError("E_SETUP_KEYS", "Use the API key fields in Profile");
    }
    if (this.running) {
      throw new HandlerError("E_SETUP_BUSY", `${this.running} is still running`);
    }
    this.running = action;
    this.publish();
    let ok = true;
    let message: string | undefined;
    try {
      const ctx: ActionContext = {
        pin: this.deps.pin,
        host: this.deps.host(),
        claude: this.deps.bundledClaude(),
        marketplaceKnown: await this.marketplaceKnown(),
      };
      for (const step of stepsFor(action, ctx)) await this.runStep(action, step);
    } catch (e) {
      ok = false;
      message = e instanceof Error ? e.message : String(e);
      this.deps.log(`setup ${action} failed: ${message}`);
    } finally {
      this.running = undefined;
    }
    this.deps.broadcast({ type: "action_done", action, ok, ...(message ? { message } : {}) });
    const needsReadiness = action === "check-readiness" || (ok && REFRESH_AFTER.has(action));
    await this.check({ readiness: needsReadiness, refresh: ok && REFRESH_AFTER.has(action) });
  }
}

export type { CompatEntry };
