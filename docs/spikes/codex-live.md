# Codex host startup in Cursor (2026-10-02)

## Environment and result

Cursor ran CatHouse 0.4.3 with native Codex selected. Codex CLI and the managed app-server daemon were 0.160.0; `catherd@catherd` 1.4.0 was installed and enabled. Setup showed Ready to go, but starting a chat cleared the composer and displayed no transcript. The CatHouse output log recorded no session error.

A read-only JSON-RPC probe against `~/.codex/app-server-control/app-server-control.sock` confirmed that `initialize` and `skills/list` worked. The daemon reported the plugin skill as `name: "catherd:catherd"`, `pluginId: "catherd@catherd"`, `enabled: true`. CatHouse had required `name: "catherd"`, so it rejected the installed skill before `turn/start`. The mocked app-server test had repeated the wrong short name and missed the incompatibility.

CatHouse now selects the qualified skill name and sends that name in the native skill input. The contract test uses the daemon's observed shape. A failed `session.start` also leaves the user's draft and attachments in the composer for retry and displays the returned error. Verification: targeted Codex test, typecheck, targeted Biome and production build passed. A direct live `CodexSession.start` and `SessionController.start` probe against the managed daemon accepted the corrected skill input and reached a running turn. The fixed VSIX was installed in Cursor, but concurrent reinstall/reload activity interrupted the panel check. A full chat response and catherd role completion push are not yet verified in the panel.

## Invariants and traps

- The native skill name is qualified (`catherd:catherd`); the plugin ID is `catherd@catherd`. Check both fields and `enabled` before using the returned path.
- Setup readiness checks installation and daemon availability, but does not prove `skills/list` selection or `turn/start` behavior.
- A start failure returns a session state with `error`; the composer must keep the draft so a retry does not lose the task.
- CatHouse connects to the managed daemon's Unix WebSocket. Do not start a private stdio app-server for push tests.

## Reproduce and verify

```sh
codex --version
codex plugin list
pnpm exec vitest run packages/extension/src/orchestrator/codex.test.ts
pnpm typecheck
pnpm exec biome check packages/extension/src/orchestrator/codex.ts packages/extension/src/orchestrator/codex.test.ts packages/webview/src/session/SessionPage.tsx
pnpm build
```

## Remaining work

Load the fixed build in Cursor, start a short Codex chat and confirm the response appears. Then run a real catherd role, verify its queued completion is pushed into the same chat, reload Cursor and resume it. Record that evidence here.
