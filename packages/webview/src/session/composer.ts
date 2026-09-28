export interface ComposerKey {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}

export function shouldSubmitComposer({ key, shiftKey, isComposing }: ComposerKey) {
  return key === "Enter" && !shiftKey && !isComposing;
}

/** A file handed to the orchestrator: a path it can read, or text read from a dropped OS file. */
export type Attachment =
  | { kind: "path"; name: string; path: string }
  | { kind: "inline"; name: string; text: string };

export const INLINE_LIMIT_BYTES = 200_000;

export function attachmentKey(a: Attachment) {
  return a.kind === "path" ? `path:${a.path}` : `inline:${a.name}:${a.text.length}`;
}

export function mergeAttachments(current: Attachment[], added: Attachment[]) {
  const seen = new Set(current.map(attachmentKey));
  return [
    ...current,
    ...added.filter((a) => !seen.has(attachmentKey(a)) && seen.add(attachmentKey(a))),
  ];
}

export function pathAttachment(path: string): Attachment {
  return { kind: "path", path, name: path.split(/[\\/]/).filter(Boolean).pop() ?? path };
}

/** Local paths from a `text/uri-list` (or VS Code's `application/vnd.code.uri-list`) payload. */
export function pathsFromUriList(list: string): string[] {
  return list
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("file://"))
    .map((line) => {
      const path = decodeURIComponent(new URL(line).pathname);
      // file:///c%3A/x → c:/x on Windows.
      return /^\/[a-zA-Z]:/.test(path) ? path.slice(1) : path;
    });
}

/** The message sent to the orchestrator: the typed text followed by the attached files. */
export function composeMessage(text: string, attachments: Attachment[]) {
  const body = text.trim();
  if (!attachments.length) return body;
  const paths = attachments.filter((a) => a.kind === "path");
  const inline = attachments.filter((a) => a.kind === "inline");
  const parts = [body];
  if (paths.length) parts.push(`Attached files:\n${paths.map((a) => `- ${a.path}`).join("\n")}`);
  for (const a of inline)
    parts.push(`<attached_file name="${a.name}">\n${a.text}\n</attached_file>`);
  return parts.filter(Boolean).join("\n\n");
}
