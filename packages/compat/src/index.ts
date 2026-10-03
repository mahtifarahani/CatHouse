/**
 * The versions CatHouse is built and tested against. A catherd, plugin or SDK version outside
 * this table shows the Upgrade screen instead of running commands with an unverified contract.
 * To support a new catherd version: add an entry, record fixtures under fixtures/<version>/,
 * and add an adapter in packages/extension/src/gateway if any shape changed.
 */
export interface CompatEntry {
  /** npm `catherd-cli` version, used as `bunx catherd-cli@<catherd>` */
  catherd: string;
  /** Claude plugin `catherd@catherd` version from installed_plugins.json */
  plugin: string;
  /** Claude Agent SDK version bundled into CatHouse */
  sdk: string;
  /** Minimum Bun */
  bun: string;
  /** Minimum standalone `claude` for `claude-code:` rungs (catherd's adapter minimum) */
  claudeCode: string;
  /** Minimum native Codex CLI verified for the app-server/queue orchestration host. */
  codexHost: string;
  /** Which gateway adapter maps this version's shapes */
  adapter: "v1_5";
}

export const SUPPORTED: readonly CompatEntry[] = [
  {
    catherd: "1.5.0",
    plugin: "1.5.0",
    sdk: "0.3.283",
    bun: "1.4.0",
    claudeCode: "2.1.282",
    codexHost: "0.159.2",
    adapter: "v1_5",
  },
];

/** The entry CatHouse installs and pins. */
export const PINNED: CompatEntry = SUPPORTED[0] as CompatEntry;

export function findCompat(catherdVersion: string): CompatEntry | undefined {
  return SUPPORTED.find((e) => e.catherd === catherdVersion);
}

/** Compares dotted numeric versions ("1.4.2" vs "1.4.0"); ignores pre-release suffixes. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

export function atLeast(version: string, minimum: string): boolean {
  return compareVersions(version, minimum) >= 0;
}
