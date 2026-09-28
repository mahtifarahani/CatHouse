# Architecture overview (design; update as built)

Status: **designed, not built yet.** Update this file at the end of Phase 0 with the real layout.

## Runtime processes

```
VS Code window
├─ Extension host (Node, "workspace" kind — runs on the remote host in SSH/WSL/containers)
│   ├─ SetupService ── spawns detectors/installers (bun, bunx catherd-cli@1.0.0, bundled claude)
│   ├─ CatherdGateway (per repo)
│   │    ├─ MCP client ──stdio──► `bunx catherd-cli@1.0.0 mcp` (long-lived, cwd = repo)     [ADR 0006]
│   │    ├─ CLI runner  ──spawn──► `bunx catherd-cli@1.0.0 <cmd> --json`
│   │    └─ RunFilesReader ─read─► <data>/repos/<key>/runs/<id>/routes.jsonl              [ADR 0007]
│   ├─ OrchestratorSession (per active run) ── Agent SDK query() ──► bundled Claude Code binary
│   │        └─ loads plugin catherd@1.0.0 from installPath → its own `catherd mcp` (the orchestrator's)
│   ├─ Panel host: WebviewView (sidebar) + WebviewPanel (dashboard) ── message router
│   └─ State: workspaceState {runId ↔ sessionId, repo, createdAt}, UI prefs
└─ Webview (React) ◄── postMessage protocol v1 (zod) ──► panel host
```

Note: two `catherd mcp` processes exist per active repo (the gateway's and the orchestrator's). That is safe because CatHouse never calls `wait`/`dispatch` (ADR 0005). catherd coordinates through file locks and leases.

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
- Writes: profile edits → gateway → MCP `profile_set` / CLI; cancel → MCP `cancel`, then a note to the orchestrator session.
- Orchestration: only the OrchestratorSession (the skill inside Claude) drives runs.

## Gating

1. Workspace untrusted → "trust required" screen only.
2. Bun / catherd / plugin / SDK binary missing or incompatible → Setup only.
3. Claude not logged in or a required backend not ready → dashboards visible, Start task disabled, warnings in Diagnostics.
