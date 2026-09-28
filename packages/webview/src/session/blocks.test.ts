import { describe, expect, it } from "vitest";
import { toBlocks } from "./blocks";
import type { TranscriptItem } from "./useSession";

const tool = (id: string, nested = false): TranscriptItem => ({
  type: "tool",
  id,
  name: "Bash",
  input: {},
  nested,
});

describe("toBlocks", () => {
  it("groups consecutive tool calls at the same depth into one steps block", () => {
    const blocks = toBlocks([
      { type: "user", text: "hi" },
      tool("a"),
      tool("b"),
      tool("c", true),
      { type: "text", text: "done", nested: false },
      tool("d"),
    ]);
    expect(
      blocks.map((b) => (b.kind === "steps" ? b.items.map((i) => i.id).join("") : b.item.type)),
    ).toEqual(["user", "ab", "c", "text", "d"]);
  });
});
