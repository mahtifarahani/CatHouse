import {
  type EventEnvelope,
  type EventTopic,
  HostMessageSchema,
  type MethodName,
  type ParamsOf,
  PROTOCOL_VERSION,
  type ProtocolError,
  type RequestEnvelope,
  type ResultOf,
} from "@cathouse/protocol";

const vscode = acquireVsCodeApi();
const REQUEST_TIMEOUT_MS = 30_000;

export class RpcError extends Error {
  constructor(readonly error: ProtocolError) {
    super(error.message);
  }
}

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: number };
const pending = new Map<string, Pending>();
const listeners = new Map<EventTopic, Set<(payload: unknown) => void>>();
let nextId = 0;

window.addEventListener("message", (e: MessageEvent) => {
  const parsed = HostMessageSchema.safeParse(e.data);
  if (!parsed.success) return;
  const msg = parsed.data;
  if (msg.kind === "event") {
    for (const fn of listeners.get(msg.topic) ?? []) fn(msg.payload);
    return;
  }
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  window.clearTimeout(p.timer);
  if (msg.ok) p.resolve(msg.result);
  else p.reject(new RpcError(msg.error));
});

export function request<M extends MethodName>(
  method: M,
  params: ParamsOf<M>,
): Promise<ResultOf<M>> {
  const id = `${Date.now().toString(36)}-${nextId++}`;
  const envelope: RequestEnvelope = { v: PROTOCOL_VERSION, id, kind: "request", method, params };
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new RpcError({ code: "E_TIMEOUT", message: `${method} timed out` }));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    vscode.postMessage(envelope);
  });
}

export function onEvent(topic: EventEnvelope["topic"], fn: (payload: unknown) => void): () => void {
  let set = listeners.get(topic);
  if (!set) {
    set = new Set();
    listeners.set(topic, set);
  }
  set.add(fn);
  return () => set.delete(fn);
}

/** Per-view UI state that survives the webview being hidden (not a store for catherd data). */
export const viewState = {
  get<T>(): T | undefined {
    return vscode.getState() as T | undefined;
  },
  set<T>(state: T): void {
    vscode.setState(state);
  },
};
