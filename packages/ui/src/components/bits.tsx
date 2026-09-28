import { type HTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "../cn";

export function Section({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-muted-foreground uppercase tracking-wide text-xs">
          {title}
        </h3>
        {actions && <div className="ms-auto flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** A section whose body opens and closes from its header, like a dropdown. */
export function Collapsible({
  title,
  summary,
  open,
  onToggle,
  children,
  className,
}: {
  title: ReactNode;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={cn("rounded-sm border border-border", className)}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-8 w-full items-center gap-2 px-2 py-1.5 text-start hover:bg-secondary/40"
        >
          <span
            aria-hidden="true"
            className={cn("inline-block w-3 text-xs transition-transform", open && "rotate-90")}
          >
            ▸
          </span>
          <span className="font-semibold text-xs uppercase tracking-wide">{title}</span>
          {summary && (
            <span className="ms-auto min-w-0 truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
        </button>
      </h3>
      {open && (
        <div id={id} className="flex flex-col gap-1.5 border-t border-border p-2">
          {children}
        </div>
      )}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const tones = {
    neutral: "bg-badge text-badge-foreground",
    good: "border border-success text-success",
    warn: "border border-warning text-warning",
    bad: "border border-danger text-danger",
    info: "border border-info text-info",
  };
  return (
    <span
      className={cn("inline-block rounded-sm px-1.5 text-xs leading-5", tones[tone], className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-sm border border-border p-2", className)} {...props} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-danger">
      {children}
    </p>
  );
}

/** A progress bar coloured like catherd's budget bar: green < 80 %, amber < 100 %, red. */
export function Meter({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const tone = fraction >= 1 ? "bg-danger" : fraction >= 0.8 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      {/* biome-ignore lint/a11y/useSemanticElements: a styled bar; <meter> cannot take theme colours */}
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 flex-1 overflow-hidden rounded-sm bg-secondary"
      >
        <div className={cn("h-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-end text-xs tabular-nums">{Math.round(fraction * 100)}%</span>
    </div>
  );
}

export const inputClass =
  "min-h-8 rounded-sm border border-input-border bg-input px-2 py-1 text-input-foreground";
