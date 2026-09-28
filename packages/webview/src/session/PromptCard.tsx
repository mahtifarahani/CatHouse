import type { PendingPrompt, PromptAnswer } from "@cathouse/protocol";
import { Button, cn } from "@cathouse/ui";
import { useState } from "react";
import { request } from "../lib/rpc";
import { t } from "../lib/strings";
import { shortTool } from "./format";

function answer(id: string, a: PromptAnswer) {
  void request("session.answer", { id, answer: a });
}

export function PromptCard({ prompt }: { prompt: PendingPrompt }) {
  return (
    <section
      aria-live="assertive"
      className="flex flex-col gap-2 rounded-sm border border-focus bg-muted p-3"
    >
      {prompt.request.kind === "question" ? (
        <QuestionForm prompt={prompt} req={prompt.request} />
      ) : (
        <PermissionForm prompt={prompt} req={prompt.request} />
      )}
    </section>
  );
}

type QuestionReq = Extract<PendingPrompt["request"], { kind: "question" }>;
type PermissionReq = Extract<PendingPrompt["request"], { kind: "permission" }>;

function QuestionForm({ prompt, req }: { prompt: PendingPrompt; req: QuestionReq }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const toggle = (q: string, label: string, multi: boolean) =>
    setPicked((p) => {
      const cur = p[q] ?? [];
      const next = multi
        ? cur.includes(label)
          ? cur.filter((l) => l !== label)
          : [...cur, label]
        : [label];
      return { ...p, [q]: next };
    });
  const complete = req.questions.every(
    (q) => (picked[q.question]?.length ?? 0) > 0 || (other[q.question] ?? "").trim(),
  );
  const submit = () => {
    const answers: Record<string, string | string[]> = {};
    for (const q of req.questions) {
      const free = (other[q.question] ?? "").trim();
      const labels = picked[q.question] ?? [];
      answers[q.question] = free || (q.multiSelect ? labels : (labels[0] ?? ""));
    }
    answer(prompt.id, { kind: "question", answers });
  };
  return (
    <>
      <h2 className="font-semibold">{t("prompt.question.title")}</h2>
      {req.questions.map((q) => (
        <fieldset key={q.question} className="flex flex-col gap-1.5">
          <legend className="mb-1">
            <span className="mr-2 rounded-sm bg-badge px-1.5 text-badge-foreground">
              {q.header}
            </span>
            {q.question}
          </legend>
          {q.options.map((o) => {
            const on = picked[q.question]?.includes(o.label) ?? false;
            return (
              <button
                key={o.label}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(q.question, o.label, q.multiSelect)}
                className={cn(
                  "flex flex-col rounded-sm border px-2 py-1.5 text-start",
                  on ? "border-focus bg-secondary" : "border-border hover:bg-secondary",
                )}
              >
                <span className="font-medium">{o.label}</span>
                <span className="text-muted-foreground">{o.description}</span>
                {o.preview && (
                  <pre className="mt-1 overflow-x-hidden font-mono text-xs whitespace-pre-wrap wrap-anywhere">
                    {o.preview}
                  </pre>
                )}
              </button>
            );
          })}
          <input
            className="rounded-sm border border-input-border bg-input px-2 py-1 text-input-foreground"
            placeholder={t("prompt.question.other")}
            value={other[q.question] ?? ""}
            onChange={(e) => setOther((s) => ({ ...s, [q.question]: e.target.value }))}
          />
        </fieldset>
      ))}
      <div>
        <Button disabled={!complete} onClick={submit}>
          {t("prompt.question.submit")}
        </Button>
      </div>
    </>
  );
}

function PermissionForm({ prompt, req }: { prompt: PendingPrompt; req: PermissionReq }) {
  const [message, setMessage] = useState("");
  const command = typeof req.input.command === "string" ? req.input.command : undefined;
  const path = typeof req.input.file_path === "string" ? req.input.file_path : undefined;
  return (
    <>
      <h2 className="font-semibold">
        {req.title ?? t("prompt.permission.title", { tool: shortTool(req.toolName) })}
      </h2>
      {req.decisionReason && <p className="text-muted-foreground">{req.decisionReason}</p>}
      <pre className="max-h-48 overflow-x-hidden overflow-y-auto rounded-sm bg-background p-2 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
        {command ?? path ?? JSON.stringify(req.input, null, 2)}
      </pre>
      <input
        className="rounded-sm border border-input-border bg-input px-2 py-1 text-input-foreground"
        placeholder={t("prompt.permission.message")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => answer(prompt.id, { kind: "permission", decision: "allow" })}>
          {t("prompt.permission.allow")}
        </Button>
        {req.canAlwaysAllow && (
          <Button
            variant="secondary"
            onClick={() => answer(prompt.id, { kind: "permission", decision: "always" })}
          >
            {t("prompt.permission.always")}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            answer(prompt.id, {
              kind: "permission",
              decision: "deny",
              ...(message.trim() ? { message: message.trim() } : {}),
            })
          }
        >
          {t("prompt.permission.deny")}
        </Button>
      </div>
    </>
  );
}
