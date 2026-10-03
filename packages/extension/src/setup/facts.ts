import type { DoctorReport } from "../gateway/schemas";

/** Everything the detectors learned; evaluate() turns it into items and gates. */
export interface SetupFacts {
  bun: { version?: string; error?: string };
  /** catherd-cli@PINNED present in bunx's cache (checked with --no-install). */
  catherd: { version?: string; error?: string };
  /** catherd config.json with an active profile exists (init has run). */
  catherdConfig: { exists: boolean; path: string };
  sdkBinary: { path?: string; version?: string; error?: string };
  plugin: { version?: string; installPath?: string };
  claudeLogin: { loggedIn?: boolean; method?: string; email?: string; error?: string };
  codex: { version?: string; error?: string; loggedIn?: boolean };
  codexDaemon: { running: boolean; version?: string; error?: string };
  codexPlugin: { version?: string; installPath?: string };
  /** Whether the profile this repo runs on has claude-code: rungs (then the standalone CLI is needed). */
  needsClaudeCli: boolean;
  claudeCli: { version?: string; error?: string };
  /** Whether credentials.json holds each optional key (presence only, never the value). */
  savedKeys?: { jev: boolean; aa: boolean };
  doctor?: DoctorReport;
  doctorError?: string;
}
