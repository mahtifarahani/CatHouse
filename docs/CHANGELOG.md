# Changelog

GitHub Release notes are the version sections below. Keep unfinished work under `## Unreleased`. When cutting a release, move those notes to `## [x.y.z] - YYYY-MM-DD`, set the same version in `packages/extension/package.json`, and tag `vX.Y.Z`. The heading must match the manifest exactly. See `docs/release/github.md`.

## Unreleased

- **catherd 1.2.0.** CatHouse now pins `catherd-cli@1.2.0` and plugin `catherd@1.2.0`; Setup offers the upgrade on a 1.0 machine. Since catherd 1.1, roles report back by push instead of a blocking `wait`: the chat goes idle after a dispatch, and a "catherd reported back" divider marks each turn catherd starts (Interrupt works during it). The dashboard no longer marks role records as read. Role replies are read from the reply file, and Cancel role uses `catherd runs cancel`, so catherd still tells the orchestrator. Setup accepts doctor's new `info` rows (without that, readiness failed on 1.2). Runs show the Claude session that started each run, plus parked owner questions and the verifier's latest step. Profiles show catherd's stand-in notes and let you add an unscored rung without a treat-like (catherd 1.2 infers it). Resume asks the orchestrator to `peek`. Fixtures were re-recorded against 1.2.0.
- Release: a version tag publishes the four platform VSIX files on GitHub Releases, with VS Code and Cursor install steps and SHA256 checksums. The release notes are this changelog's matching version section.
- Reworked New Chat and running sessions into a full-height chat layout with scrollable content above a bottom composer; the running textarea now matches the new-task size and keeps a primary Send button immediately beside it.
- Moved the compact permission info/select controls to the right side of the Start/Resume row and removed their redundant visible heading.
- Kept repository name, setup, profile, dirty-count and catherd status in one non-wrapping bar below the native CatHouse title; the redundant `Repository:` prefix is omitted and multi-root workspaces retain their picker.
- Persisted the last user-triggered catherd readiness report per workspace, preventing New Chat from returning to “not checked yet” after VS Code reloads without running doctor automatically.
- Reduced New Chat density by moving role and permission guidance into accessible info tooltips, removing redundant chrome, and attaching Send directly to the follow-up input.
- Combined the repository and dashboard status rows into one responsive bar and removed the duplicated catherd version.
- Improved New Chat's visual hierarchy and spacing with a structured task composer, readable permission controls and a prominent readiness status; raised dense supporting text to a 13 px minimum and shared input height to 32 px across the dashboard.
- docs: add a public GitHub README covering CatHouse's relationship to catherd, feature set, requirements, development install, architecture boundary, and pre-release status.
- Fixed Profiles controls being immediately overwritten by a clean-draft synchronization loop, fixed profile switching after New/Delete when a refresh was already in flight, and replaced the unsupported `window.prompt` New Profile flow with an accessible in-webview dialog.
- Clarified in Profiles and New Chat that catherd owns a fixed eight-role vocabulary: profiles configure those roles, while chat talks to the orchestrator and can only request role involvement through the task or a follow-up.
- UX: the complete dashboard now lives directly in the CatHouse Activity Bar view; the intermediary Open Dashboard screen and separate editor panel were removed, and New Chat is the default tab on each fresh view load.
- Phase 5: platform VSIX packaging, extension README, dashboard status line, complete public-surface TUI parity, profile help/filter/confirmations, save-race rebase, accessible tabs/dialogs/toasts, Light/Dark/High Contrast verification, and webview cache busting.
- Phase 4: repo picker, permission modes, prompt badge/notification, cancel note to the live orchestrator, Continue from a run, compaction marker.
- Phase 3: Overview, Runs (list + detail with cancel, climbs, routes, records, debug), Profiles editor (staged draft, undo/redo, diff preview, treat-like), Models, Diagnostics; per-repo gateway; run files via MCP `read_run_file`.
- Phase 2: mandatory Setup (detectors, click-only installers, gate, Setup page, `CatHouse: Check Setup`); verified on a fresh HOME end to end.
- Phase 1: catherd gateway (CLI + MCP, allowlist, compat pins, fixtures, live contract tests); orchestrator session on the Agent SDK with prompt cards, run↔session links and resume; Session page; spikes a/b/d green.
- Phase 0 skeleton: pnpm workspace; protocol v1 (zod envelope and `app.ping`); VS Code theme tokens + Button; React webview with a strict CSP; extension host with a typed router; unit tests; e2e smoke test (runs in an installed editor); VSIX packaging.
- docs: R&D knowledge base for catherd 1.0.0 and the Claude Agent SDK, ADRs 0001–0008, plan, status, runbook, testing strategy.
