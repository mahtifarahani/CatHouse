import { t } from "./strings";

export function ago(iso: string | number | undefined): string {
  if (iso === undefined) return "";
  const secs = Math.max(0, (Date.now() - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000);
  if (secs < 60) return t("time.secs", { n: Math.round(secs) });
  if (secs < 3600) return t("time.mins", { n: Math.round(secs / 60) });
  if (secs < 86400) return t("time.hours", { n: Math.round(secs / 3600) });
  return t("time.days", { n: Math.round(secs / 86400) });
}
