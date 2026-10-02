import { cn, IconButton } from "@cathouse/ui";
import {
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import {
  type Attachment,
  attachmentKey,
  INLINE_LIMIT_BYTES,
  mergeAttachments,
  pathAttachment,
  pathsFromUriList,
} from "./composer";

const URI_TYPES = ["application/vnd.code.uri-list", "text/uri-list"];

const carriesFiles = (types: readonly string[]) =>
  types.includes("Files") || URI_TYPES.some((type) => types.includes(type));

/** Paths from a VS Code / OS uri-list first; otherwise the text of small dropped files. */
async function readDrop(
  data: DataTransfer,
  onError: (message: string) => void,
): Promise<Attachment[]> {
  for (const type of URI_TYPES) {
    const paths = pathsFromUriList(data.getData(type));
    if (paths.length) return paths.map(pathAttachment);
  }
  const inline: Attachment[] = [];
  for (const file of Array.from(data.files)) {
    const text = file.size <= INLINE_LIMIT_BYTES ? await file.text() : undefined;
    if (text === undefined || text.includes("\0")) {
      onError(t("session.attachTooLarge", { name: file.name }));
      continue;
    }
    inline.push({ kind: "inline", name: file.name, text });
  }
  return inline;
}

/**
 * The chat input: one rounded box holding the textarea (it grows with its content), the attached
 * files and a footer row of actions, so every control for a message sits in one place.
 */
export function Composer({
  id,
  value,
  onChange,
  attachments,
  onAttachments,
  onKeyDown,
  onError,
  placeholder,
  footer,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  attachments: Attachment[];
  onAttachments: Dispatch<SetStateAction<Attachment[]>>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onError: (message: string) => void;
  placeholder: string;
  footer: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const onDragOver = (event: DragEvent) => {
    if (!carriesFiles(event.dataTransfer.types)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const onDrop = (event: DragEvent) => {
    setOver(false);
    if (!carriesFiles(event.dataTransfer.types)) return;
    event.preventDefault();
    void readDrop(event.dataTransfer, onError).then(
      (added) => added.length && onAttachments((prev) => mergeAttachments(prev, added)),
    );
  };
  return (
    <div
      className={cn(
        "cathouse-composer relative flex flex-col rounded-lg border border-input-border bg-input",
        over && "border-focus",
      )}
    >
      <textarea
        id={id}
        rows={2}
        className="max-h-[40vh] min-h-14 w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-base leading-6 text-input-foreground shadow-none [field-sizing:content] placeholder:text-muted-foreground focus:border-0 focus:shadow-none focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-keyshortcuts="Enter Shift+Enter"
        placeholder={placeholder}
      />
      {attachments.length > 0 && (
        <ul
          aria-label={t("session.attachments")}
          className="m-0 flex list-none flex-wrap gap-1 px-2 pb-1"
        >
          {attachments.map((a) => (
            <li
              key={attachmentKey(a)}
              title={a.kind === "path" ? a.path : a.name}
              className="flex max-w-full items-center gap-1 rounded-full bg-surface-hover ps-2 pe-1 text-xs"
            >
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                aria-label={t("session.removeAttachment", { name: a.name })}
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                onClick={() =>
                  onAttachments((prev) => prev.filter((x) => attachmentKey(x) !== attachmentKey(a)))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-w-0 items-center gap-1 px-1.5 pb-1.5">{footer}</div>
      {over && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-input/90 text-muted-foreground">
          {t("session.dropHere")}
        </div>
      )}
    </div>
  );
}

export function AttachButton({
  onAttachments,
  onError,
}: {
  onAttachments: Dispatch<SetStateAction<Attachment[]>>;
  onError: (message: string) => void;
}) {
  return (
    <IconButton
      icon="paperclip"
      label={t("session.attach")}
      onClick={() =>
        void request("app.pickFiles", {})
          .then(({ paths }) => {
            if (paths.length)
              onAttachments((prev) => mergeAttachments(prev, paths.map(pathAttachment)));
          })
          .catch((e: unknown) => onError(String(e)))
      }
    />
  );
}
