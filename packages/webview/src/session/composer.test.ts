import { describe, expect, it } from "vitest";
import {
  composeMessage,
  mergeAttachments,
  pathAttachment,
  pathsFromUriList,
  shouldSubmitComposer,
} from "./composer";

describe("shouldSubmitComposer", () => {
  it("submits on Enter", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
  });

  it("keeps Shift+Enter for a new line", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
  });

  it("does not submit while an input method is composing text", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
  });
});

describe("attachments", () => {
  it("parses file URIs from a uri-list and skips comments and other schemes", () => {
    expect(
      pathsFromUriList(
        "# comment\r\nfile:///Users/me/a%20b.ts\nhttps://x.dev\nfile:///c%3A/repo/x.md",
      ),
    ).toEqual(["/Users/me/a b.ts", "c:/repo/x.md"]);
  });

  it("dedupes merged attachments", () => {
    const a = pathAttachment("/r/a.ts");
    expect(mergeAttachments([a], [pathAttachment("/r/a.ts"), pathAttachment("/r/b.ts")])).toEqual([
      a,
      { kind: "path", path: "/r/b.ts", name: "b.ts" },
    ]);
  });

  it("appends paths and inline files to the message", () => {
    expect(
      composeMessage("  fix it ", [
        pathAttachment("/r/a.ts"),
        { kind: "inline", name: "log.txt", text: "boom" },
      ]),
    ).toBe(
      'fix it\n\nAttached files:\n- /r/a.ts\n\n<attached_file name="log.txt">\nboom\n</attached_file>',
    );
    expect(composeMessage("plain", [])).toBe("plain");
  });
});
