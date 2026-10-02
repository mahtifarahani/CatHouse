export const PREFIXES = ["workspace.", "repo."] as const;

export const STRINGS = {
  "workspace.repo": "Repository for this chat",
  "workspace.none": "No repository selected",
  "workspace.add": "Add folders…",
  "workspace.removeNamed": "Remove {name} from workspace",
  "workspace.removeConfirm": "Remove from workspace?",
  "workspace.required": "Choose or add a repository before starting a task.",
  "workspace.locked": "Stop the session to change repositories.",
} as const;
