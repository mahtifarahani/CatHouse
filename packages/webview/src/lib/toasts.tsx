import { cn, Icon } from "@cathouse/ui";
import { useEffect, useState } from "react";

type Tone = "ok" | "bad" | "info";
type Action = { label: string; run: () => void };
type Toast = { id: number; tone: Tone; text: string; key?: string; action?: Action };
const EVENT = "cathouse:toast";

/**
 * Shows a short message. A toast with a `key` replaces the visible one with the same key, so
 * repeated events (every auto-save) show one toast instead of a stack.
 */
export function toast(
  text: string,
  tone: Tone = "info",
  opts: { key?: string; action?: Action } = {},
): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone, ...opts } }));
}

export function ToastRegion() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Toast, "id">>).detail;
      const id = Date.now() + Math.random();
      setItems((old) => [
        ...old.filter((x) => !detail.key || x.key !== detail.key).slice(-2),
        { id, ...detail },
      ]);
      window.setTimeout(() => setItems((old) => old.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  const dismiss = (id: number) => setItems((old) => old.filter((x) => x.id !== id));
  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-11 z-50 flex flex-col items-center gap-1.5"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "bad" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-full items-center gap-2 rounded-md bg-[var(--vscode-editorWidget-background,var(--vscode-editor-background))] px-3 py-1.5 text-xs shadow-lg ring-1 ring-[var(--vscode-widget-border,transparent)]"
        >
          <Icon
            name={item.tone === "bad" ? "warning" : item.tone === "ok" ? "check" : "cat"}
            className={cn(
              item.tone === "bad"
                ? "text-danger"
                : item.tone === "ok"
                  ? "text-success"
                  : "text-info",
            )}
          />
          <span className="min-w-0 [overflow-wrap:anywhere]">{item.text}</span>
          {item.action && (
            <button
              type="button"
              className="shrink-0 font-semibold text-link hover:underline"
              onClick={() => {
                item.action?.run();
                dismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
