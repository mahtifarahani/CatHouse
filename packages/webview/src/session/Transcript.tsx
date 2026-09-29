import type { SessionEvent } from "@cathouse/protocol";
import { Badge, cn, Icon, type IconName } from "@cathouse/ui";
import { type ReactNode, useMemo, useState } from "react";
import { t } from "../lib/strings";
import { type Block, type ToolItem, toBlocks } from "./blocks";
import { mmss, oneLine, toolParts } from "./format";
import { MarkdownText } from "./MarkdownText";
import { type TranscriptItem, toTranscript } from "./useSession";

const isAssistant = (b: Block) =>
  b.kind === "steps" || b.item.type === "text" || b.item.type === "run" || b.item.type === "task";

export function Transcript({ events }: { events: SessionEvent[] }) {
  const blocks = useMemo(() => toBlocks(toTranscript(events)), [events]);
  let speaker: "user" | "assistant" | undefined;
  return (
    <ol
      className="flex min-w-0 list-none flex-col gap-2.5 p-0 wrap-anywhere"
      aria-label={t("session.transcript")}
    >
      {blocks.map((b, i) => {
        const key = b.kind === "steps" ? `steps-${b.items[0]?.id ?? i}` : `${b.item.type}-${i}`;
        const next = b.kind === "item" && b.item.type === "user" ? "user" : undefined;
        const header = isAssistant(b) && speaker !== "assistant";
        if (next) speaker = "user";
        else if (isAssistant(b)) speaker = "assistant";
        return (
          <li key={key} className="flex min-w-0 flex-col gap-1.5">
            {header && <SpeakerHeader icon="cat" name={t("session.orchestrator")} />}
            {b.kind === "steps" ? (
              <StepGroup items={b.items} nested={b.nested} />
            ) : (
              <Item it={b.item} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SpeakerHeader({ icon, name }: { icon: IconName; name: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon name={icon} className="size-3" />
      </span>
      {name}
    </div>
  );
}

function Divider({ tone, icon, children }: { tone: string; icon: IconName; children: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 py-0.5 text-xs", tone)}>
      <span className="h-px flex-1 bg-border" />
      <Icon name={icon} />
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Item({ it }: { it: Exclude<TranscriptItem, ToolItem> }) {
  switch (it.type) {
    case "user":
      return (
        <div className="flex flex-col gap-1.5">
          <SpeakerHeader icon="user" name={t("session.you")} />
          <div className="ms-6 min-w-0 rounded-md border border-border bg-secondary/40 px-3 py-2">
            <MarkdownText>{it.text}</MarkdownText>
          </div>
        </div>
      );
    case "init":
      return (
        <div className="flex justify-center">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 rounded-full", it.ok ? "bg-success" : "bg-danger")}
            />
            <span className={cn("truncate", !it.ok && "text-danger")}>{it.detail}</span>
          </span>
        </div>
      );
    case "text":
      return it.nested ? (
        <div className="ms-3 border-s-2 border-border ps-3 text-muted-foreground">
          <MarkdownText>{it.text}</MarkdownText>
        </div>
      ) : (
        <MarkdownText className="ps-6">{it.text}</MarkdownText>
      );
    case "run":
      return (
        <div className="ms-6 flex items-center gap-2 rounded-md border border-link/40 bg-link/10 px-2.5 py-1.5">
          <Icon name="play" className="text-link" />
          <span className="text-xs font-semibold">{t("session.runStartedTitle")}</span>
          <code className="min-w-0 truncate font-mono text-xs text-link">{it.runId}</code>
        </div>
      );
    case "task": {
      const tone = it.status === "completed" ? "good" : it.status === "failed" ? "bad" : "info";
      return (
        <div className="ms-6 flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
          <Icon name="bot" className="text-info" />
          <span className="min-w-0 flex-1 truncate" title={it.description}>
            {it.description}
          </span>
          {it.durationMs !== undefined && (
            <span className="tabular-nums text-muted-foreground">{mmss(it.durationMs / 1000)}</span>
          )}
          {it.status && <Badge tone={tone}>{it.status}</Badge>}
        </div>
      );
    }
    case "inbound":
      return (
        <Divider tone="text-info" icon="cat">
          {t("session.inbound")}
        </Divider>
      );
    case "compacted":
      return (
        <Divider tone="text-warning" icon="layers">
          {t("session.compacted")}
        </Divider>
      );
    case "result": {
      const cost = it.costUsd === undefined ? "" : ` · $${it.costUsd.toFixed(2)}`;
      return it.isError || it.subtype !== "success" ? (
        <Divider tone="text-danger" icon="warning">
          {t("session.turnFailed", { subtype: it.subtype })}
          {cost}
        </Divider>
      ) : (
        <Divider tone="text-muted-foreground" icon="check">
          {t("session.turnDone")}
          {cost}
        </Divider>
      );
    }
  }
}

const VISIBLE = 4;

function StepGroup({ items, nested }: { items: ToolItem[]; nested: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const running = items.filter((i) => !i.result).length;
  const hidden = showAll || items.length <= VISIBLE + 1 ? 0 : items.length - VISIBLE;
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-border",
        nested ? "ms-9" : "ms-6",
      )}
    >
      {items.length > 1 && (
        <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-2.5 py-1 text-xs text-muted-foreground">
          <Icon name="wrench" />
          <span>{t("session.steps", { n: items.length })}</span>
          {running > 0 && (
            <span className="ms-auto inline-flex items-center gap-1 text-info">
              <Icon name="spinner" />
              {t("session.stepsRunning", { n: running })}
            </span>
          )}
        </div>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex w-full items-center gap-1 border-b border-border px-2.5 py-1 text-start text-xs text-link hover:bg-secondary/40"
        >
          <Icon name="chevron" className="rotate-90" />
          {t("session.showEarlier", { n: hidden })}
        </button>
      )}
      <ol className="m-0 list-none divide-y divide-border p-0">
        {items.slice(hidden).map((it) => (
          <Step key={it.id} it={it} />
        ))}
      </ol>
    </div>
  );
}

function toolIcon(name: string, server?: string): IconName {
  if (server === "catherd") return "cat";
  if (server) return "wrench";
  if (name === "Bash") return "terminal";
  if (name === "Read") return "file";
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(name)) return "pencil";
  if (["Grep", "Glob", "ToolSearch"].includes(name)) return "search";
  if (name.startsWith("Web")) return "globe";
  if (name === "Skill") return "sparkles";
  if (name === "Task" || name === "Agent") return "bot";
  return "wrench";
}

function Step({ it }: { it: ToolItem }) {
  const { server, tool } = toolParts(it.name);
  const status = !it.result ? "running" : it.result.isError ? "error" : "ok";
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 px-2.5 py-1 text-xs hover:bg-secondary/40 [&::-webkit-details-marker]:hidden">
          {status === "running" ? (
            <Icon name="spinner" className="text-info" />
          ) : status === "error" ? (
            <Icon name="x" className="text-danger" />
          ) : (
            <Icon name="check" className="text-success" />
          )}
          <Icon name={toolIcon(tool, server)} className="text-muted-foreground" />
          <span className="shrink-0 font-semibold">{tool}</span>
          {server && (
            <span className="shrink-0 rounded-sm bg-badge px-1 text-[0.85em] leading-4 text-badge-foreground">
              {server}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
            {oneLine(it.input)}
          </span>
          {status === "running" && it.elapsedSecs !== undefined && (
            <span className="shrink-0 tabular-nums text-info">{mmss(it.elapsedSecs)}</span>
          )}
          <Icon
            name="chevron"
            className="text-muted-foreground transition-transform group-open:rotate-90"
          />
        </summary>
        <div className="flex flex-col gap-2 border-t border-border bg-background/60 p-2.5 text-xs">
          <ToolInput input={it.input} />
          {it.result && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-muted-foreground">{t("session.output")}</span>
              <pre
                className={cn(
                  "m-0 max-h-64 overflow-x-hidden overflow-y-auto rounded-sm border border-border bg-background p-2 font-mono whitespace-pre-wrap wrap-anywhere",
                  it.result.isError && "border-danger text-danger",
                )}
              >
                {it.result.text.slice(0, 4000) || "—"}
              </pre>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function ToolInput({ input }: { input: unknown }) {
  const entries =
    input && typeof input === "object" && !Array.isArray(input)
      ? Object.entries(input as Record<string, unknown>)
      : undefined;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-muted-foreground">{t("session.input")}</span>
      {entries ? (
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-muted-foreground">{k}</dt>
              <dd className="m-0 min-w-0">
                <pre className="m-0 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap wrap-anywhere">
                  {typeof v === "string" ? v : JSON.stringify(v, null, 2)}
                </pre>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="m-0 font-mono whitespace-pre-wrap wrap-anywhere">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}
