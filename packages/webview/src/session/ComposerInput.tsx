import { Button, cn } from "@cathouse/ui";
import {
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
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

const COMPOSER_CLASS =
  "min-h-32 w-full resize-y rounded-sm border border-input-border bg-input px-3 py-2 text-base text-input-foreground leading-6";
const URI_TYPES = ["application/vnd.code.uri-list", "text/uri-list"];

const carriesFiles = (types: readonly string[]) =>
  types.includes("Files") || URI_TYPES.some((type) => types.includes(type));

function AttachIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5.25 8.75 4.6-4.6a2.25 2.25 0 0 1 3.18 3.18l-5.3 5.3a3.25 3.25 0 0 1-4.6-4.6l5.13-5.12" />
      <path d="m6.3 10.7 4.95-4.95" />
    </svg>
  );
}

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

export function Composer({
  id,
  value,
  onChange,
  attachments,
  onAttachments,
  onKeyDown,
  onError,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  attachments: Attachment[];
  onAttachments: Dispatch<SetStateAction<Attachment[]>>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onError: (message: string) => void;
  placeholder: string;
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
    <div className="flex flex-col gap-2 px-[2px]">
      <div className="relative">
        <textarea
          id={id}
          rows={4}
          className={cn(COMPOSER_CLASS, over && "border-focus")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onDragOver={onDragOver}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          aria-keyshortcuts="Enter Shift+Enter"
          placeholder={placeholder}
        />
        {over && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm border-2 border-dashed border-focus bg-input/90 text-muted-foreground">
            {t("session.dropHere")}
          </div>
        )}
      </div>
      {attachments.length > 0 && (
        <ul aria-label={t("session.attachments")} className="flex flex-wrap gap-1">
          {attachments.map((a) => (
            <li
              key={attachmentKey(a)}
              title={a.kind === "path" ? a.path : a.name}
              className="flex max-w-full items-center gap-1 rounded-sm border border-border px-2 py-0.5 text-xs"
            >
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                aria-label={t("session.removeAttachment", { name: a.name })}
                className="text-muted-foreground hover:text-foreground"
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
    <Button
      className="min-h-9"
      variant="secondary"
      title={t("session.attachHelp")}
      onClick={() =>
        void request("app.pickFiles", {})
          .then(({ paths }) => {
            if (paths.length)
              onAttachments((prev) => mergeAttachments(prev, paths.map(pathAttachment)));
          })
          .catch((e: unknown) => onError(String(e)))
      }
    >
      <AttachIcon />
      {t("session.attach")}
    </Button>
  );
}
