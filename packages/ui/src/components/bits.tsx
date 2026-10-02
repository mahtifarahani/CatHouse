import { type HTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "../cn";
import { Icon } from "./icons";

// Layout primitives. Groups are drawn with spacing and soft fills, never with borders: borders are
// reserved for inputs and focus rings so the narrow sidebar stays calm.

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
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {actions && <div className="ms-auto flex flex-wrap items-center gap-1">{actions}</div>}
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
    <section className={cn("flex flex-col", className)}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-start hover:bg-hover"
        >
          <Icon
            name="chevron"
            className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          {summary && (
            <span className="ms-auto min-w-0 truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
        </button>
      </h3>
      {open && (
        <div id={id} className="flex flex-col gap-1.5 ps-5 pt-1 pb-2">
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
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | "accent";
}) {
  const tones = {
    neutral: "bg-surface-strong text-muted-foreground",
    good: "bg-good-soft text-success",
    warn: "bg-warn-soft text-warning",
    bad: "bg-bad-soft text-danger",
    info: "bg-info-soft text-info",
    accent: "bg-accent-soft text-link",
  };
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded-full px-2 text-xs leading-5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A soft, borderless surface. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface p-3 outline outline-1 -outline-offset-1 outline-outline",
        className,
      )}
      {...props}
    />
  );
}

/** A coloured dot for state; pair it with text so state is never colour-only. */
export function Dot({
  tone,
  pulse,
  className,
}: {
  tone: "good" | "warn" | "bad" | "info" | "neutral";
  pulse?: boolean;
  className?: string;
}) {
  const bg = {
    good: "bg-success",
    warn: "bg-warning",
    bad: "bg-danger",
    info: "bg-info",
    neutral: "bg-muted-foreground/50",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        bg,
        pulse && "motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 py-2 text-muted-foreground">{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 rounded-md bg-bad-soft px-2.5 py-1.5 text-danger">
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
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-end text-xs tabular-nums">{Math.round(fraction * 100)}%</span>
    </div>
  );
}

export const inputClass =
  "min-h-8 rounded-md bg-input px-2 py-1 text-input-foreground outline outline-1 -outline-offset-1 outline-input-border";

/** A select without its own box: reads as text with a caret, for inline choices in a row. */
export const quietSelectClass =
  "min-h-7 min-w-0 cursor-pointer truncate rounded-md bg-transparent px-1.5 py-0.5 text-muted-foreground hover:bg-surface hover:text-foreground";
