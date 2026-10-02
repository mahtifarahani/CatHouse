import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "../cn";
import { Button } from "./button";
import { Icon, type IconName } from "./icons";

/** An icon-only button. `label` is both its accessible name and its tooltip. */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className,
  small,
  tone,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  small?: boolean;
  tone?: "danger";
}) {
  return (
    <Button
      variant="quiet"
      size={small ? "iconSm" : "icon"}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(tone === "danger" && "hover:text-danger", className)}
    >
      <Icon name={icon} />
    </Button>
  );
}

/**
 * A small popover menu. Closes on Escape, outside clicks and after an item runs. Arrow keys move
 * between items. `side` picks whether it opens below or above the trigger (above for controls that
 * sit at the bottom of the view).
 */
export function Menu({
  label,
  trigger,
  children,
  side = "bottom",
  align = "end",
  triggerClassName,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [
      ...(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []),
    ];
    if (!items.length) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  return (
    <div ref={root} className="relative inline-flex min-w-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex min-h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
          open && "bg-surface-hover text-foreground",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKey}
          className={cn(
            "absolute z-30 flex w-max min-w-44 max-w-[calc(100vw-1.5rem)] flex-col rounded-md bg-[var(--vscode-menu-background,var(--vscode-editorWidget-background))] p-1 text-[var(--vscode-menu-foreground,var(--vscode-foreground))] shadow-lg ring-1 ring-[var(--vscode-menu-border,var(--vscode-widget-border,transparent))]",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onSelect,
  children,
  icon,
  checked,
  danger,
  disabled,
  hint,
}: {
  onSelect: () => void;
  children: ReactNode;
  icon?: IconName;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is menuitemradio whenever aria-checked is set
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-7 w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-start hover:bg-[var(--vscode-menu-selectionBackground,var(--vscode-list-hoverBackground))] hover:text-[var(--vscode-menu-selectionForeground,inherit)] focus-visible:bg-[var(--vscode-menu-selectionBackground,var(--vscode-list-hoverBackground))] disabled:opacity-50",
        danger && "text-danger",
      )}
    >
      <span className="inline-flex w-4 shrink-0 justify-center">
        {checked ? <Icon name="check" /> : icon ? <Icon name={icon} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <hr className="my-1 h-px border-0 bg-surface-hover" />;
}

/** An on/off switch (a checkbox underneath, so forms and screen readers treat it as one). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center" title={label}>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        aria-checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "h-4 w-7 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-focus",
          checked ? "bg-primary" : "bg-surface-hover",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 size-3 rounded-full bg-[var(--vscode-editor-background)] shadow transition-transform",
          checked ? "translate-x-3.5" : "translate-x-0.5",
        )}
      />
    </label>
  );
}

/** A small set of mutually exclusive options shown side by side. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-surface p-0.5">
      {options.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: a styled segmented control; native radios cannot take this look
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-6 rounded-[5px] px-2.5 text-xs",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
