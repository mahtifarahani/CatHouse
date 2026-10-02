import { cn, inputClass } from "@cathouse/ui";
import { type ReactNode, useEffect, useState } from "react";

/** A titled group of settings: a small label and plain rows, no box around them. */
export function Group({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="m-0 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {help && <p className="m-0 px-1 pb-1 text-xs text-muted-foreground">{help}</p>}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/** One setting: its label on the left and the control on the right; wraps when the view is narrow. */
export function Row({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1 py-1 hover:bg-surface",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-32">
        <div className="truncate">{label}</div>
        {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * A number input that keeps what the user types locally and commits only valid values, so a
 * half-typed number never reaches the auto-save. Empty commits `undefined` when `allowEmpty`.
 */
export function NumberField({
  value,
  onCommit,
  label,
  placeholder,
  allowEmpty,
  min = 1,
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  label: string;
  placeholder?: string;
  allowEmpty?: boolean;
  min?: number;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === undefined ? "" : String(value));
  }, [value, focused]);
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      aria-label={label}
      placeholder={placeholder}
      className={cn(inputClass, "w-24 text-end tabular-nums")}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === "") {
          if (allowEmpty) onCommit(undefined);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0 && n >= min) onCommit(n);
      }}
    />
  );
}
