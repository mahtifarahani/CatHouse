import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "../cn";
import { Button } from "./button";

const focusable =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  description,
  children,
  actions,
  onClose,
  busy = false,
  size = "sm",
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  busy?: boolean;
  size?: "sm" | "md";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panel.current?.querySelector<HTMLElement>(focusable);
    (first ?? panel.current)?.focus();
    return () => previous?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = [...(panel.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
    if (!elements.length) {
      event.preventDefault();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "max-h-[85vh] w-full overflow-y-auto rounded-lg bg-popover p-4 text-popover-foreground shadow-lg outline outline-1 -outline-offset-1 outline-outline",
          size === "md" ? "max-w-md" : "max-w-sm",
        )}
      >
        <h2 id={titleId} className="m-0 text-base font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {children}
        <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  detail,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      title={title}
      description={detail}
      onClose={onCancel}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
