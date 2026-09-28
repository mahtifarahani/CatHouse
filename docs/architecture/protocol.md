# Webview ⇄ extension-host protocol (v1)

Status: **built in Phase 0**. Source: `packages/protocol/src/`.

## Envelope (`packages/protocol/src/envelope.ts`)

| Direction | Shape |
|---|---|
| webview → host (request) | `{v: 1, id, kind: "request", method, params}` |
| host → webview (response) | `{v: 1, id, kind: "response", ok: true, result}` or `{v: 1, id, kind: "response", ok: false, error: {code, message, fix?}}` |
| host → webview (event) | `{v: 1, kind: "event", topic, payload}`, where topic ∈ `setup, session, run, profile, catalog, app` |

`PROTOCOL_VERSION` (= 1) changes only on a breaking change to the envelope or to an existing method's schema. Adding a method is not breaking.

## Methods table (`packages/protocol/src/methods.ts`)

Every method is one entry in `methods` with zod `params` and `result` schemas. The host router and the webview client are both typed from this table (`ParamsOf<M>`, `ResultOf<M>`).

| Method | Params | Result | Since |
|---|---|---|---|
| `app.ping` | `{}` | `{pong: true, extensionVersion, protocol: 1, view: "sidebar"}` | Phase 0 |

**To add a method:** (1) add it to `methods`; (2) add its handler in `packages/extension/src/extension.ts`. `Handlers<Ctx>` is exhaustive, so typecheck fails until the handler exists. (3) Call it from the webview with `request("x.y", params)`. (4) Add a router test if it has error paths. (5) Add a row to this table.

## Host router (`packages/extension/src/panel/router.ts`)

`createRouter(handlers)` returns `handle(raw, ctx) → Promise<ResponseEnvelope | undefined>`. It does not import `vscode`, so vitest can test it.

| Case | Response |
|---|---|
| not a request and no string `id` | `undefined` (ignored) |
| malformed envelope with an `id` | `E_PROTOCOL` |
| unknown method (incl. prototype keys like `toString`; checked with `Object.hasOwn`) | `E_METHOD_UNKNOWN`, fix "reload the window…" |
| params fail the schema | `E_INPUT_INVALID` |
| handler throws `HandlerError(code, message, fix?)` | passed through as-is (this is how catherd `{code,message,fix}` errors will reach the UI) |
| handler throws anything else | `E_INTERNAL` with the message |
| handler result fails the result schema | `E_INTERNAL` (a host bug, caught before it reaches the UI) |

`ctx` carries per-request context. Today that is `{view}`, which says which webview sent the request.

## Webview client (`packages/webview/src/lib/rpc.ts`)

- `request(method, params)`: posts the envelope, resolves with the typed result or rejects with `RpcError` (carrying `{code, message, fix?}`). Timeout 30 s (`E_TIMEOUT`).
- `onEvent(topic, fn)`: subscribes to host events and returns an unsubscribe function.
- `viewState.get/set/update`: `vscode.getState/setState` for disposable UI state only (currently the staged profile draft), never catherd data.
- Incoming messages are validated with `HostMessageSchema`. Anything else is ignored.

## Invariants

- The webview only renders `protocol` models; raw catherd JSON never crosses the boundary (see `overview.md`).
- The host never trusts webview input: every request is validated before a handler runs.
