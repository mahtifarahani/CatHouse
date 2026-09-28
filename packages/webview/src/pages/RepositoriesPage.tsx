import { Button, Empty, ErrorText, Section } from "@cathouse/ui";
import { useEffect, useState } from "react";
import { onEvent, RpcError, request } from "../lib/rpc";
import { t } from "../lib/strings";

const loadWorkspace = () => request("app.workspace", {});

export function FolderIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} shrink-0`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
    >
      <path d="M1.5 4a1 1 0 0 1 1-1h3.6l1.5 1.5h5.9a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

/** Workspace folders: pick the repo catherd works in, add folders, remove them from the workspace. */
export function RepositoriesPage() {
  const [ws, setWs] = useState<Awaited<ReturnType<typeof loadWorkspace>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => void loadWorkspace().then((next) => alive && setWs(next));
    refresh();
    const off = onEvent("app", refresh);
    return () => {
      alive = false;
      off();
    };
  }, []);

  const change = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof RpcError
          ? `${e.error.message}${e.error.fix ? ` — ${e.error.fix}` : ""}`
          : String(e),
      );
    } finally {
      setWs(await loadWorkspace());
      setBusy(false);
    }
  };

  return (
    <Section
      title={t("workspace.title")}
      actions={
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void change(() => request("app.addFolders", {}))}
        >
          {t("workspace.add")}
        </Button>
      }
    >
      <p className="text-xs text-muted-foreground">{t("workspace.help")}</p>
      {error && <ErrorText>{error}</ErrorText>}
      {ws && ws.folders.length === 0 && <Empty>{t("app.noFolder")}</Empty>}
      <ul className="divide-y divide-border rounded-sm border border-border empty:hidden">
        {ws?.folders.map((f) => {
          const current = f.path === ws.repo;
          return (
            <li key={f.path} className="group flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                disabled={busy || current}
                aria-current={current}
                onClick={() => void change(() => request("app.setRepo", { path: f.path }))}
                className="flex min-w-0 flex-1 items-center gap-2 text-start disabled:cursor-default"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${current ? "bg-focus" : "border border-border"}`}
                />
                <span className="min-w-0">
                  <span className={`block truncate ${current ? "font-medium" : ""}`}>{f.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {f.path}
                  </span>
                </span>
                {current && (
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {t("workspace.current")}
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={t("workspace.removeNamed", { name: f.name })}
                title={t("workspace.removeHint")}
                onBlur={() => setConfirm(null)}
                onClick={() => {
                  if (confirm !== f.path) {
                    setConfirm(f.path);
                    return;
                  }
                  setConfirm(null);
                  void change(() => request("app.removeFolder", { path: f.path }));
                }}
                className={
                  confirm === f.path
                    ? "shrink-0 rounded-sm px-1.5 text-xs text-danger"
                    : "shrink-0 rounded-sm px-1.5 text-muted-foreground opacity-60 hover:text-danger hover:opacity-100 focus-visible:opacity-100"
                }
              >
                {confirm === f.path ? t("workspace.removeConfirm") : "✕"}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
