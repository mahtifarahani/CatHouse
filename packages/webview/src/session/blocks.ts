import type { TranscriptItem } from "./useSession";

export type ToolItem = Extract<TranscriptItem, { type: "tool" }>;
export type Block =
  | { kind: "item"; item: Exclude<TranscriptItem, ToolItem> }
  | { kind: "steps"; items: ToolItem[]; nested: boolean };

/** Consecutive tool calls at the same depth read as one "steps" card instead of loose lines. */
export function toBlocks(items: TranscriptItem[]): Block[] {
  const blocks: Block[] = [];
  for (const it of items) {
    if (it.type === "tool") {
      const last = blocks.at(-1);
      if (last?.kind === "steps" && last.nested === it.nested) last.items.push(it);
      else blocks.push({ kind: "steps", items: [it], nested: it.nested });
    } else {
      blocks.push({ kind: "item", item: it });
    }
  }
  return blocks;
}
