import type { StringKey } from "./strings";

export const LANGUAGES = [
  { id: "en", label: "English", dir: "ltr" },
  { id: "zh", label: "中文 (Chinese)", dir: "ltr" },
  { id: "hi", label: "हिन्दी (Hindi)", dir: "ltr" },
  { id: "es", label: "Español (Spanish)", dir: "ltr" },
  { id: "fr", label: "Français (French)", dir: "ltr" },
  { id: "fa", label: "فارسی (Persian)", dir: "rtl" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

import { es } from "./locales/es";
import { fa } from "./locales/fa";
import { fr } from "./locales/fr";
import { hi } from "./locales/hi";
import { zh } from "./locales/zh";

export const LOCALES: Record<string, Partial<Record<StringKey, string>>> = {
  en: {},
  zh,
  hi,
  es,
  fr,
  fa,
};
