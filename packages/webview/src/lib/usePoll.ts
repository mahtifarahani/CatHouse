import { useCallback, useEffect, useRef, useState } from "react";
import { RpcError } from "./rpc";

export interface Poll<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  updatedAt: number | undefined;
  refresh: () => void;
}

export function errorText(e: unknown): string {
  if (e instanceof RpcError) return `${e.error.message}${e.error.fix ? ` — ${e.error.fix}` : ""}`;
  return e instanceof Error ? e.message : String(e);
}

/**
 * Loads now and every `intervalMs` (0 = once) while not paused. Keeps the last good data when a
 * refresh fails, like catherd's TUI keeps a stale read (src/entry/tui/views/profiles.tsx:47-58).
 */
export function usePoll<T>(
  load: () => Promise<T>,
  intervalMs: number,
  key: string,
  paused = false,
): Poll<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setData(await loadRef.current());
      setError(undefined);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` restarts polling on purpose
  useEffect(() => {
    setLoading(true);
    void run();
    if (!intervalMs || paused) return;
    const id = window.setInterval(() => void run(), intervalMs);
    return () => window.clearInterval(id);
  }, [key, intervalMs, paused, run]);

  return { data, error, loading, updatedAt, refresh: () => void run() };
}
