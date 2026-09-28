# Changelog

## Unreleased

- Phase 5: platform VSIX packaging, extension README, dashboard status line, complete public-surface TUI parity, profile help/filter/confirmations, save-race rebase, accessible tabs/dialogs/toasts, Light/Dark/High Contrast verification, and webview cache busting.
- Phase 4: repo picker, permission modes, prompt badge/notification, cancel note to the live orchestrator, Continue from a run, compaction marker.
- Phase 3: Overview, Runs (list + detail with cancel, climbs, routes, records, debug), Profiles editor (staged draft, undo/redo, diff preview, treat-like), Models, Diagnostics; per-repo gateway; run files via MCP `read_run_file`.
- Phase 2: mandatory Setup (detectors, click-only installers, gate, Setup page, `CatHouse: Check Setup`); verified on a fresh HOME end to end.
- Phase 1: catherd gateway (CLI + MCP, allowlist, compat pins, fixtures, live contract tests); orchestrator session on the Agent SDK with prompt cards, run↔session links and resume; Session page; spikes a/b/d green.
- Phase 0 skeleton: pnpm workspace; protocol v1 (zod envelope, `app.ping`, `app.openDashboard`); VS Code theme tokens + Button; React webview (sidebar + dashboard) with a strict CSP; extension host with a typed router; unit tests; e2e smoke test (runs in an installed editor); VSIX packaging.
- docs: R&D knowledge base for catherd 1.0.0 and the Claude Agent SDK, ADRs 0001–0008, plan, status, runbook, testing strategy.
