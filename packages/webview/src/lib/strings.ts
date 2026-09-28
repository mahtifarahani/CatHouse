// User-facing strings live here (ADR 0004). Replace with @vscode/l10n bundles when a second
// locale is added; call sites keep using t().
const en = {
  "app.title": "CatHouse",
  "app.tagline": "herds coding agents",
  "sidebar.openDashboard": "Open dashboard",
  "session.title": "Orchestrator",
  "session.taskLabel": "Task for catherd",
  "session.taskPlaceholder":
    "Describe what catherd should build. It plans, dispatches roles and reports back.",
  "session.start": "Start task",
  "session.resume": "Resume saved run",
  "session.interrupt": "Interrupt",
  "session.stop": "Stop session",
  "session.followUp": "Message the orchestrator…",
  "session.send": "Send",
  "session.transcript": "Session transcript",
  "session.runStarted": "catherd run {run} started",
  "session.turnEnded": "turn ended: {subtype} · {cost}",
  "sidebar.phase": "Session: {phase}",
  "sidebar.setupRequired": "Setup needed before CatHouse can run catherd.",
  "sidebar.openSetup": "Open Setup",
  "tabs.setup": "Setup",
  "tabs.session": "Orchestrator",
  "setup.title": "Setup",
  "setup.checking": "Checking your machine…",
  "setup.checkingShort": "Checking…",
  "setup.recheck": "Re-check",
  "setup.ready": "ready",
  "setup.almost": "almost ready",
  "setup.required": "setup required",
  "setup.level.gate": "Required to use CatHouse",
  "setup.level.start": "Required to start tasks",
  "setup.level.optional": "Optional",
  "setup.copy": "Copy",
  "setup.running": "Running…",
  "setup.done": "{action} finished",
  "setup.output": "Output",
  "session.blocked": "Tasks can't start yet: {reason}",
  "sidebar.pending": "{count} waiting for you",
  "prompt.question.title": "The orchestrator asks",
  "prompt.question.other": "Other (type your own answer)",
  "prompt.question.submit": "Answer",
  "prompt.permission.title": "Allow {tool}?",
  "prompt.permission.message": "Optional note for Claude (sent when you deny)",
  "prompt.permission.allow": "Allow once",
  "prompt.permission.always": "Always allow",
  "prompt.permission.deny": "Deny",
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
