// User-facing strings live here (ADR 0004). Replace with @vscode/l10n bundles when a second
// locale is added; call sites keep using t().
const en = {
  "app.title": "CatHouse",
  "app.tagline": "herds coding agents",
  "sidebar.openDashboard": "Open dashboard",
  "dashboard.placeholder": "The dashboard arrives in Phase 3. Setup comes first (Phase 2).",
  "ping.button": "Check connection",
  "ping.ok": "Connected to extension {version} (protocol v{protocol}, {view})",
  "ping.failed": "Connection failed: {message}",
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
