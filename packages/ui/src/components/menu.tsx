import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "../cn";
import { Button } from "./button";
import { Icon, type IconName } from "./icons";
import { nextIndex } from "./menuKeys";

export type MenuEntry =
  | { kind: "separator" | "heading"; label?: string }
  | {
      label: string;
      detail?: string;
      icon?: IconName;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      confirmLabel?: string;
      onSelect: () => void;
    };

type Item = Extract<MenuEntry, { onSelect: () => void }>;
function isItem(entry: MenuEntry): entry is Item {
  return "onSelect" in entry;
}

export function MenuButton({
  label,
  ariaLabel,
  icon,
  entries,
  onTriggerClick,
  side = "bottom",
  align = "start",
  disabled,
  className,
}: {
  label: string;
  ariaLabel?: string;
  icon?: IconName;
  entries: MenuEntry[];
  onTriggerClick?: () => void;
  side?: "top" | "bottom";
  align?: "start" | "end";
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const enabled = entries.map((entry) => isItem(entry) && !entry.disabled);
  const focusAt = (index: number | null) => {
    if (index !== null) itemRefs.current[index]?.focus();
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    setArmed(null);
    if (returnFocus) queueMicrotask(() => trigger.current?.focus());
  };
  const show = (last = false) => {
    if (!entries.length && onTriggerClick) {
      onTriggerClick();
      return;
    }
    if (!entries.length) return;
    setOpen(true);
    queueMicrotask(() => focusAt(nextIndex(-1, last ? "ArrowUp" : "ArrowDown", enabled)));
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setArmed(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const activate = (entry: Item, index: number) => {
    if (entry.disabled) return;
    if (entry.confirmLabel && armed !== index) {
      setArmed(index);
      return;
    }
    entry.onSelect();
    close(true);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const next = nextIndex(current, event.key, enabled);
    if (next !== current) setArmed(null);
    focusAt(next);
  };
  return (
    <div ref={root} className="relative inline-flex min-w-0">
      <Button
        ref={trigger}
        variant="ghost"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel ?? label}
        title={ariaLabel ?? label}
        className={cn("min-w-0", className)}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp");
          }
        }}
      >
        {icon && <Icon name={icon} />}
        <span className="truncate">{label}</span>
        <Icon name="chevronDown" />
      </Button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={ariaLabel ?? label}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute z-40 max-h-[60vh] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-lg outline outline-1 -outline-offset-1 outline-outline",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {entries.map((entry, index) => {
            if (!isItem(entry))
              return entry.kind === "separator" ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: menu entries have no stable ids
                <hr key={index} className="my-1 h-px border-0 bg-surface-strong" />
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: menu entries have no stable ids
                <div key={index} className="px-2 py-1 text-xs text-muted-foreground">
                  {entry.label}
                </div>
              );
            return (
              // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-checked is used only for menuitemradio
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: menu entries have no stable ids
                key={index}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role={entry.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={entry.checked}
                aria-disabled={entry.disabled || undefined}
                tabIndex={-1}
                onFocus={() => {
                  if (armed !== index) setArmed(null);
                }}
                onClick={() => activate(entry, index)}
                className={cn(
                  "flex min-h-8 w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-start hover:bg-hover focus-visible:bg-hover",
                  entry.danger && "text-danger",
                  entry.disabled && "opacity-50",
                )}
              >
                <span className="w-4 shrink-0">
                  {entry.checked ? (
                    <Icon name="check" />
                  ) : entry.icon ? (
                    <Icon name={entry.icon} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {armed === index ? entry.confirmLabel : entry.label}
                  </span>
                  {entry.detail && (
                    <span
                      className="block truncate text-xs text-muted-foreground"
                      title={entry.detail}
                    >
                      {entry.detail}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
