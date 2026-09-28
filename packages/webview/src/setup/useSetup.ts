import { type SetupActionId, type SetupState, SetupTopicSchema } from "@cathouse/protocol";
import { useEffect, useState } from "react";
import { onEvent, request } from "../lib/rpc";

export interface SetupView {
  state: SetupState | undefined;
  /** Live installer output per action (kept until the next run of that action). */
  output: Partial<Record<SetupActionId, string>>;
  lastDone: { action: SetupActionId; ok: boolean; message?: string } | undefined;
}

export function useSetup(): SetupView {
  const [view, setView] = useState<SetupView>({
    state: undefined,
    output: {},
    lastDone: undefined,
  });
  useEffect(() => {
    let alive = true;
    void request("setup.state", {}).then((state) => alive && setView((v) => ({ ...v, state })));
    const off = onEvent("setup", (raw) => {
      const p = SetupTopicSchema.safeParse(raw);
      if (!p.success) return;
      const m = p.data;
      setView((v) => {
        if (m.type === "state") {
          const startedNew = m.state.running && m.state.running !== v.state?.running;
          return {
            ...v,
            state: m.state,
            ...(startedNew && m.state.running
              ? { output: { ...v.output, [m.state.running]: "" }, lastDone: undefined }
              : {}),
          };
        }
        if (m.type === "output") {
          const prev = v.output[m.action] ?? "";
          return { ...v, output: { ...v.output, [m.action]: (prev + m.chunk).slice(-20_000) } };
        }
        return {
          ...v,
          lastDone: { action: m.action, ok: m.ok, ...(m.message ? { message: m.message } : {}) },
        };
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return view;
}
