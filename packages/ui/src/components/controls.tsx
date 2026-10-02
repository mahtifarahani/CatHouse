import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "../cn";
import { Button, type ButtonProps } from "./button";
import { Icon, type IconName } from "./icons";

/** An icon-only button. `label` is both its accessible name and its tooltip. */
export function IconButton({
  icon,
  label,
  labelClassName,
  small,
  tone,
  variant,
  className,
  ...props
}: ButtonProps & {
  icon: IconName;
  label: string;
  labelClassName?: string;
  small?: boolean;
  tone?: "danger";
}) {
  return (
    <Button
      variant={variant ?? (tone === "danger" ? "danger" : "ghost")}
      size="iconSm"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        labelClassName ? "min-h-7 min-w-7 px-1.5" : "size-7",
        small && "size-7",
        className,
      )}
    >
      <Icon name={icon} />
      <span className={labelClassName ?? "sr-only"}>{label}</span>
    </Button>
  );
}

export function ConfirmButton({
  confirmLabel,
  onConfirm,
  windowMs = 4000,
  children,
  onClick,
  onBlur,
  variant,
  ...props
}: ButtonProps & {
  confirmLabel: string;
  onConfirm: () => void;
  windowMs?: number;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), windowMs);
    return () => window.clearTimeout(timer);
  }, [armed, windowMs]);
  return (
    <Button
      {...props}
      variant={armed ? "danger" : variant}
      onBlur={(event) => {
        setArmed(false);
        onBlur?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      <span aria-live={armed ? "polite" : undefined}>{armed ? confirmLabel : children}</span>
    </Button>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as string[]).includes(event.key))
      return;
    event.preventDefault();
    const next =
      (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + options.length) %
      options.length;
    const option = options[next];
    if (option) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-grid max-w-full grid-flow-col auto-cols-fr rounded-md bg-surface p-0.5",
        className,
      )}
    >
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: button supports roving focus in this segmented radio group
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={cn(
            "min-h-7 min-w-0 truncate rounded-sm px-2 text-xs text-muted-foreground hover:bg-hover",
            value === option.value && "bg-background font-medium text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: "good" | "warn" | "bad" | "idle" | "busy";
  label: string;
  className?: string;
}) {
  const bg = {
    good: "bg-success",
    warn: "bg-warning",
    bad: "bg-danger",
    idle: "bg-muted-foreground",
    busy: "bg-info motion-safe:animate-pulse",
  }[tone];
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", bg)} />
      <span className="sr-only">{label}</span>
    </span>
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
            "absolute z-30 flex w-max min-w-44 max-w-[calc(100vw-1.5rem)] flex-col rounded-md bg-popover p-1 text-popover-foreground shadow-lg outline outline-1 -outline-offset-1 outline-outline",
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
  // biome-ignore lint/a11y/useSemanticElements: spacing separator uses a tinted block instead of the native hr border
  return <div role="separator" className="my-1 h-px bg-surface-strong" />;
}

/** An on/off switch (a checkbox underneath, so forms and screen readers treat it as one). */
export function Switch({
  checked,
  onChange,
  label,
  ariaLabel,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  ariaLabel?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel ?? label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-7 min-w-0 items-center gap-2 text-start disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </button>
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
