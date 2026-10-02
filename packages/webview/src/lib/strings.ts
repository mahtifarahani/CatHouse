// User-facing strings live here (ADR 0004). Replace with @vscode/l10n bundles when a second
// locale is added; call sites keep using t().

import * as activity from "./strings/activity";
import * as chat from "./strings/chat";
import * as common from "./strings/common";
import * as models from "./strings/models";
import * as profileSettings from "./strings/profileSettings";
import * as profiles from "./strings/profiles";
import * as prompt from "./strings/prompt";
import * as repo from "./strings/repo";
import * as roles from "./strings/roles";
import * as runDetail from "./strings/runDetail";
import * as runs from "./strings/runs";
import * as setup from "./strings/setup";
import * as transcript from "./strings/transcript";

export const AREAS = {
  common,
  chat,
  repo,
  transcript,
  activity,
  runs,
  runDetail,
  setup,
  profiles,
  roles,
  profileSettings,
  models,
  prompt,
} as const;

const en = {
  ...common.STRINGS,
  ...chat.STRINGS,
  ...repo.STRINGS,
  ...transcript.STRINGS,
  ...activity.STRINGS,
  ...runs.STRINGS,
  ...runDetail.STRINGS,
  ...setup.STRINGS,
  ...profiles.STRINGS,
  ...roles.STRINGS,
  ...profileSettings.STRINGS,
  ...models.STRINGS,
  ...prompt.STRINGS,
} as const;

export type StringKey = keyof typeof en;

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
