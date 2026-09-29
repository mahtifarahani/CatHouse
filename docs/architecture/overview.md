# Architecture overview (design; update as built)

Status: **Phase 0 skeleton built** (protocol, ui, webview, extension shell). Gateway, setup and orchestrator are still design (Phases 1–2).

## As built (Phase 0)

```
package.json, pnpm-workspace.yaml (onlyBuiltDependencies: esbuild, @vscode/vsce-sign),
tsconfig.base.json, biome.json, vitest.config.ts, .vscode/{launch,tasks}.json
packages/protocol/src/{envelope,methods,index}.ts (+ envelope.test.ts)
packages/ui/src/{theme.css, cn.ts, components/button.tsx, index.ts}
packages/webview/{vite.config.ts, src/{main.tsx, App.tsx, index.css, lib/{rpc,strings}.ts}}
packages/extension/{package.json (VS Code manifest), package.nls.json, l10n/, media/cathouse.svg,
  build.mjs, .vscodeignore, .vscode-test.mjs,
  src/extension.ts, src/panel/{router,webview-html,host,sidebar}.ts (+ tests),
  src/test/e2e/activation.e2e.ts}
```

Workspace packages export TypeScript source (`"exports": {".": "./src/index.ts"}`). Vite and esbuild compile them, so there is no per-package build step.

Manifest facts: `engines.vscode ^1.100.0`, `extensionKind: ["workspace"]`, `untrustedWorkspaces.supported: false`, `virtualWorkspaces: false`, activation inferred from the contributed Activity Bar view. The extension id is `cathouse.cathouse`.

See `protocol.md` and `webview.md` for the details.

## Runtime processes

```
VS Code window
├─ Extension host (Node, "workspace" kind — runs on the remote host in SSH/WSL/containers)
│   ├─ SetupService ── spawns detectors/installers (bun, bunx catherd-cli@1.2.0, bundled claude)
│   ├─ CatherdGateway (per repo)
│   │    ├─ MCP client ──stdio──► `bunx catherd-cli@1.2.0 mcp` (long-lived, cwd = repo)     [ADR 0006]
│   │    ├─ CLI runner  ──spawn──► `bunx catherd-cli@1.2.0 <cmd> --json`
│   │    └─ RunFilesReader ─read─► <data>/repos/<key>/runs/<id>/routes.jsonl              [ADR 0007]
│   ├─ OrchestratorSession (per active run) ── Agent SDK query() ──► bundled Claude Code binary
│   │        └─ loads plugin catherd@1.2.0 from installPath → its own `catherd mcp` (the orchestrator's)
│   ├─ Panel host: one full WebviewView in the Activity Bar ── message router
│   └─ State: workspaceState {runId ↔ sessionId, repo, createdAt}, UI prefs
└─ Webview (React) ◄── postMessage protocol v1 (zod) ──► panel host
```

Note: two `catherd mcp` processes exist per active repo (the gateway's and the orchestrator's). That is safe because CatHouse never dispatches, claims a run (`peek`) or marks a record read (`result`, `cancel`) (ADR 0005). Only the orchestrator's server has the Claude session's messaging socket, so only it owns runs and pushes finished roles into the session (catherd 1.1+). catherd coordinates through file locks and leases.

## Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `protocol` | Message envelope, request/response/event schemas, stable domain models (RunSummary, RunRecord, Profile, CatalogModel, DoctorReport, SetupState, SessionEvent…) | zod |
| `ui` | shadcn components, tokens mapped to `--vscode-*`, icons | react |
| `webview` | Pages: Setup, Overview, Runs, Run detail, Session, Profiles, Models, Diagnostics | protocol, ui |
| `extension` | activate, commands, views, setup, gateway, orchestrator, panel, state | protocol, @anthropic-ai/claude-agent-sdk, @modelcontextprotocol/sdk, zod |
| `compat` | `compat.json` (catherd ↔ plugin ↔ SDK versions ↔ adapter id), recorded fixtures per catherd version | none |

## Data flow rules

- The UI renders only `protocol` models. Raw catherd JSON never crosses into the webview.
- Reads: polling (runs list 2 s, open run 1 s, pausable) plus FileSystemWatcher triggers; profile/catalog on demand.
- Writes: profile edits → gateway → MCP `profile_set` / CLI; cancel → CLI `catherd runs cancel` (the record stays unread, so catherd still pushes it to the orchestrator), then a note to the orchestrator session.
- Orchestration: only the OrchestratorSession (the skill inside Claude) drives runs.

## Gating

1. Workspace untrusted → "trust required" screen only.
2. Bun / catherd / plugin / SDK binary missing or incompatible → Setup only.
3. Claude not logged in or a required backend not ready → dashboards visible, Start task disabled, warnings in Diagnostics.
