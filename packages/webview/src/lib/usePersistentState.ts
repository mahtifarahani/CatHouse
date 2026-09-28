import { useEffect, useState } from "react";
import { viewState } from "./rpc";

/** `useState` that survives tab switches and the view being hidden (VS Code webview state). */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(
    () => (viewState.get<Record<string, unknown>>()?.[key] as T | undefined) ?? initial,
  );
  useEffect(() => viewState.update({ [key]: value }), [key, value]);
  return [value, setValue] as const;
}
