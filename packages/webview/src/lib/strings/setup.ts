export const PREFIXES = ["setup.", "diag."] as const;

export const STRINGS = {
  "diag.openLogs": "Open logs folder",
  "diag.logsHelp":
    "catherd keeps 7 days of logs with secrets redacted. CatHouse's own log is in the Output panel (CatHouse).",
  "diag.lock": "Run a heavy command behind catherd's lock",
  "diag.lockHelp":
    "Runs the command in a terminal through `catherd lock`, sharing the machine-wide slots with running roles.",
  "diag.runLocked": "Run in terminal",
  "setup.checking": "Checking your machine…",
  "setup.checkingShort": "Checking…",
  "setup.recheck": "Re-check",
  "setup.copy": "Copy",
  "setup.running": "Running…",
  "setup.readyTitle": "Ready to go",
  "setup.toFixTitle": "{n} to fix before you start",
  "setup.checkedAgo": "checked {ago}",
  "setup.toFix": "Needs your click",
  "setup.recommended": "Recommended",
  "setup.allChecks": "Other checks ({n})",
  "setup.tools": "Logs and tools",
  "setup.copied": "Copied",
  "setup.jevKey": "Jev (TypeSafe) API key",
  "setup.aaKey": "Artificial Analysis API key",
  "setup.keysError": "Could not start saving the keys",
} as const;
