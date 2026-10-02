import { Button, cn, Icon } from "@cathouse/ui";
import { useEffect, useId, useRef, useState } from "react";
import { LANGUAGES, type LanguageId, LOCALES } from "./locales";
import { viewState } from "./rpc";
import { setLocale, t } from "./strings";

// Webview-only preferences. They change presentation, never catherd data, so they live in the
// view's own state (plus localStorage as a second copy that survives a disposed view).
const KEY = "cathouse.fontScale";
export const FONT_SCALE = { min: 0.8, max: 1.6, step: 0.05, default: 1 } as const;
const PRESETS = [0.9, 1, 1.15, 1.3] as const;

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return FONT_SCALE.default;
  const stepped = Math.round(value / FONT_SCALE.step) * FONT_SCALE.step;
  return Math.min(FONT_SCALE.max, Math.max(FONT_SCALE.min, Number(stepped.toFixed(2))));
}

function readScale(): number {
  const fromView = viewState.get<Record<string, unknown>>()?.[KEY];
  if (typeof fromView === "number") return clampScale(fromView);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return clampScale(Number(raw));
  } catch {
    // Storage can be unavailable; the default size is fine.
  }
  return FONT_SCALE.default;
}

function applyScale(scale: number) {
  document.documentElement.style.setProperty("--cathouse-font-scale", String(scale));
}

/** Call before the first render so the stored size applies without a flash. */
export function applyStoredFontScale() {
  applyScale(readScale());
}

export function useFontScale() {
  const [scale, setScale] = useState(readScale);
  useEffect(() => {
    applyScale(scale);
    viewState.update({ [KEY]: scale });
    try {
      window.localStorage.setItem(KEY, String(scale));
    } catch {
      // See readScale.
    }
  }, [scale]);
  return [scale, (next: number) => setScale(clampScale(next))] as const;
}

const LANG_KEY = "cathouse.language";

function readLanguage(): LanguageId {
  const fromView = viewState.get<Record<string, unknown>>()?.[LANG_KEY];
  if (typeof fromView === "string" && LANGUAGES.some((l) => l.id === fromView))
    return fromView as LanguageId;
  try {
    const raw = window.localStorage.getItem(LANG_KEY);
    if (raw && LANGUAGES.some((l) => l.id === raw)) return raw as LanguageId;
  } catch {}
  return "en";
}

function applyLanguage(langId: LanguageId) {
  const lang = LANGUAGES.find((l) => l.id === langId) || LANGUAGES[0];
  document.documentElement.dir = lang.dir;
  document.documentElement.lang = lang.id;
  setLocale(langId, LOCALES[langId] || {});
}

export function applyStoredLanguage() {
  applyLanguage(readLanguage());
}

export function useLanguage() {
  const [lang, setLang] = useState(readLanguage);
  useEffect(() => {
    applyLanguage(lang);
    viewState.update({ [LANG_KEY]: lang });
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, [lang]);
  return [lang, setLang] as const;
}

/** The gear button beside the catherd version and its small settings popover. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useFontScale();
  const [lang, setLang] = useLanguage();
  // The slider edits a draft; the view only rescales on Apply, so the popover (and the slider
  // under the pointer) does not move while dragging.
  const [draft, setDraft] = useState(scale);
  const [draftLang, setDraftLang] = useState(lang);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const toggle = () => {
    if (!open) {
      setDraft(scale);
      setDraftLang(lang);
    }
    setOpen((o) => !o);
  };
  const apply = () => {
    setScale(draft);
    setLang(draftLang);
    setOpen(false);
    button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pct = `${Math.round(draft * 100)}%`;
  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={t("settings.open")}
        title={t("settings.open")}
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground",
          open && "bg-surface-hover text-foreground",
        )}
      >
        <Icon name="settings" />
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={t("settings.title")}
          className="absolute end-0 top-full z-30 mt-1 flex w-64 max-w-[calc(100vw-1.5rem)] flex-col gap-3 rounded-md bg-[var(--vscode-editorWidget-background,var(--vscode-editor-background))] p-3 text-foreground shadow-lg ring-1 ring-[var(--vscode-widget-border,transparent)]"
        >
          <div className="flex items-center gap-2">
            <Icon name="settings" className="text-muted-foreground" />
            <h2 className="m-0 text-sm font-semibold">{t("settings.title")}</h2>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`${id}-scale`} className="text-xs font-semibold">
                {t("settings.fontSize")}
              </label>
              <output
                htmlFor={`${id}-scale`}
                className="text-xs tabular-nums text-muted-foreground"
              >
                {pct}
              </output>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("settings.smaller")}
                onClick={() => setDraft(clampScale(draft - FONT_SCALE.step))}
                disabled={draft <= FONT_SCALE.min}
                className="inline-flex size-7 items-center justify-center rounded-md bg-surface text-xs hover:bg-surface-hover disabled:opacity-40"
              >
                A
              </button>
              <input
                id={`${id}-scale`}
                type="range"
                min={FONT_SCALE.min}
                max={FONT_SCALE.max}
                step={FONT_SCALE.step}
                value={draft}
                onChange={(e) => setDraft(clampScale(Number(e.target.value)))}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                aria-valuetext={pct}
                className="min-w-0 flex-1 accent-[var(--vscode-button-background)]"
              />
              <button
                type="button"
                aria-label={t("settings.larger")}
                onClick={() => setDraft(clampScale(draft + FONT_SCALE.step))}
                disabled={draft >= FONT_SCALE.max}
                className="inline-flex size-7 items-center justify-center rounded-md bg-surface text-base font-semibold hover:bg-surface-hover disabled:opacity-40"
              >
                A
              </button>
            </div>
            <fieldset className="m-0 grid grid-cols-4 gap-1 border-0 p-0">
              <legend className="sr-only">{t("settings.presets")}</legend>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={draft === p}
                  onClick={() => setDraft(p)}
                  className={cn(
                    "rounded-md px-1 py-0.5 text-xs tabular-nums",
                    draft === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground hover:bg-surface-hover",
                  )}
                >
                  {Math.round(p * 100)}%
                </button>
              ))}
            </fieldset>
            <div
              aria-hidden="true"
              className="flex h-12 items-center overflow-hidden rounded-md bg-surface px-2"
            >
              <span
                className="truncate"
                style={{ fontSize: `calc(var(--vscode-font-size) * ${draft})` }}
              >
                {t("settings.preview")}
              </span>
            </div>
            <p className="m-0 text-xs text-muted-foreground">{t("settings.fontSizeHelp")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-lang`} className="text-xs font-semibold">
              {t("settings.language")}
            </label>
            <select
              id={`${id}-lang`}
              value={draftLang}
              onChange={(e) => setDraftLang(e.target.value as LanguageId)}
              className="w-full rounded-md border border-input-border bg-[var(--vscode-input-background,transparent)] text-[var(--vscode-input-foreground,inherit)] px-2 py-1 text-xs"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="m-0 text-xs text-muted-foreground">{t("settings.languageHelp")}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("settings.cancel")}
            </Button>
            <Button onClick={apply} disabled={draft === scale && draftLang === lang}>
              {t("settings.apply")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
