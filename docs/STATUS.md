# STATUS

Last updated: 2026-10-02. Update this file at the end of every section.

## Current phase

**Phase 5 (release prep): `0.1.0` is published on the VS Code Marketplace and Open VSX; GitHub Releases is at `0.3.0`; license and native gates remain.** Stable tags now automate GitHub Releases and Open VSX only. `OVSX_PAT` is configured and the four `0.3.0` packages reached Open VSX, but the registry keeps them inactive until the owner signs the one-time Open VSX Publisher Agreement. VS Code Marketplace automation was removed at the owner's request. A remote runtime was not available. Store-install smoke tests, the final SPDX license, and native execution of non-arm64 artifacts remain.

## Checklist

| Phase | What | State | Report |
|---|---|---|---|
| −1 | Record R&D knowledge base (research, ADRs, entry docs) | ✅ done | `docs/research/*`, `docs/decisions/*` |
| 0 | Skeleton: pnpm workspace, extension manifest, webview host, CSP, build, VSIX | ✅ done | `docs/architecture/{overview,protocol,webview}.md`, `docs/runbook.md`, `docs/testing.md` |
| 1 | Proof of execution + risk spikes (long `wait`, native agents, canUseTool, resume) | ✅ done | `docs/spikes/phase1.md`, `docs/architecture/orchestrator.md`, `docs/architecture/gateway.md` |
| 2 | Mandatory Setup | ✅ done | `docs/architecture/setup.md` |
| 3 | Main pages (Overview, Runs, Profiles, Models, Diagnostics) | ✅ done | `docs/architecture/webview.md`, parity checklist ticks in `docs/research/catherd-tui-parity.md` |
| 4 | Run control in UI (start, prompts, cancel, resume) | ✅ done | `docs/architecture/orchestrator.md` |
| 5 | Release prep (remote, trust, a11y, themes, VSIX per platform) | 🚧 external gates | `docs/release/phase5.md`, `docs/runbook.md`, `docs/CHANGELOG.md` |
| — | Upgrade to catherd 1.2.0 (push model, new fields, fixtures) | ✅ done (2026-09-29) | `docs/research/catherd-1.2-upgrade.md`, `docs/spikes/catherd-1.2.md`, ADR 0005 amendment |
| — | Upgrade to catherd 1.3.0 (pin, fixtures; no contract change) | ✅ done (2026-10-01) | `docs/research/catherd-1.3-upgrade.md` |
| — | Upgrade to catherd 1.4.0 (pin, orchestration host, fixtures) + release prep `0.4.0` | ✅ done (2026-10-02), not tagged | `docs/research/catherd-1.4-upgrade.md` |
| — | UI/UX rebuild (five tabs, chat, one-step profile with auto-save, Setup + diagnostics) | ✅ built (2026-10-02), owner check in VS Code pending | `docs/architecture/webview.md` |
| — | Prepare extension version `0.4.1` for the UI rebuild | ✅ version and release notes updated (2026-10-02), not tagged | `docs/CHANGELOG.md`, `docs/release/github.md` |

## UI/UX rebuild (2026-10-02)

Setup scroll follow-up (2026-10-02): the webview root is height-bound with no document scrolling, and Setup install output now grows in the page instead of opening an inner vertical scrollbar. The active tab panel is the sole page scroller. See `docs/architecture/webview.md` §Styling. Verify visually in the Extension Development Host with a long install log; other release gates remain unchanged.

Pointer cursor follow-up (2026-10-02): clickable webview controls, including top tabs and buttons, now use a pointer cursor through the base stylesheet. Disabled controls are excluded. See `docs/architecture/webview.md` §Styling. Owner visual confirmation in VS Code remains pending.

Composer focus follow-up (2026-10-02): the first pass moved the coloured focus border to the rounded wrapper, but the owner wanted no active border colour, and VS Code still drew a focused outline around the textarea. The wrapper now keeps its neutral border and a scoped webview rule suppresses the injected textarea focus outline/shadow (`docs/architecture/webview.md` §Styling). Owner visual confirmation in VS Code remains pending.

Composer mode follow-up (2026-10-02): the permission mode chevron now sits immediately after the selected label; the native select remains available for input and accessibility. See `docs/architecture/webview.md` §Styling. Owner visual pass in VS Code remains pending.

Profile settings follow-up (2026-10-02): setting labels now precede their switches in the isolation, notification, Jev and preflight rows. The duplicate visual label inside each switch is hidden while its accessible name remains. See `docs/architecture/webview.md` §Pages. Owner visual pass remains pending.

The owner found the UI hard to use: too many overlapping tabs, two-step actions, Interrupt/Stop at the top and usually disabled, borders everywhere, a confusing Setup and a poor Profiles page. The webview was rebuilt. Full description: `docs/architecture/webview.md` §Styling, §Pages, §Transcript layout.

- **Five tabs:** Chat · Runs · Profile · Models · Setup, icon-only in a narrow sidebar. Overview → Runs header; Repos → repo menu above the chat input; Diagnostics → Setup "Logs and tools". The status bar is gone.
- **Design rules:** borders only on inputs and focus; soft `bg-surface` fills; container-query responsive down to 240 px; one action in one place (no permanently disabled buttons, no select-then-activate).
- **Chat:** user bubbles on the right, catherd on the left with its avatar and the orchestrator model; a live roles strip (role · model · time) above the input; one composer box whose round button is Start / Send / Stop; End session and Resume in a `⋯` menu. Protocol: `SessionEvent.init.model` (optional, from the SDK init message).
- **Profile:** picking a profile makes it globally active in one step; edits auto-save through `profiles.save` with Undo; roles are compact rows that open in place with a searchable model picker. Owner decisions: global activation on pick, auto-save, Models stays a tab.
- **Setup:** a verdict, then only rows that need a click; passing checks and tools folded.
- **Verified:** Biome, typecheck, 102 unit tests, production build, and a throwaway mocked-host render (outside the repo) at 240 and 300 px.
- **Not done:** the owner's visual pass in the Extension Development Host (Light/Dark/High Contrast), and a live run confirming the init message carries `model`. Not committed yet.

## catherd 1.4.0 upgrade and 0.4.0 prep (2026-10-02)

catherd released 1.4.0 (npm `latest`). CatHouse now pins **catherd-cli 1.4.0 / plugin 1.4.0** (tag `v1.4.0`, commit `804682f`; `packages/compat`, adapter label `v1_4`). Full delta with citations: `docs/research/catherd-1.4-upgrade.md`.

- **One contract change:** 1.4 resolves omitted architect/verifier rungs from the orchestration host and throws `E_CONFIG_INVALID` on host `unknown`, which is what CatHouse's `cathouse` MCP client with stripped `CLAUDE_CODE_*` looked like. `processEnv()` now sets `CATHERD_ORCHESTRATION_HOST=claude-code` for every spawned process (unit-tested). Everything else (`status.host/queue`, `RunSummary.delivery`, `profile_get raw`, doctor `host/queue/push`, `runs retry-push`) is additive. Codex as orchestrator is out of scope.
- **Release 0.4.0 prepared:** `packages/extension/package.json` is `0.4.0`; `docs/CHANGELOG.md` has `## [0.4.0] - 2026-10-02`. The extension description (`package.nls.json`), keywords and both READMEs now name the Cursor, Grok Build and Antigravity worker backends (added in catherd 1.3) next to Codex, opencode and Claude Code.
- **This machine** was upgraded with `bunx catherd-cli@1.4.0 init --no-input --plain` and `claude plugin marketplace update catherd && claude plugin update catherd@catherd` (plugin 1.4.0). doctor: **ready**.
- **Verified:** Biome, typecheck, 97 unit tests, build, live contract 7/7 against 1.4.0 (fixtures re-recorded in `packages/compat/fixtures/1.4.0/`), e2e 5/5 in VS Code 1.139, `node scripts/release-notes.mjs --tag v0.4.0`, and a local `pnpm package` (`dist/cathouse-darwin-arm64-0.4.0.vsix`, 95.94 MB, manifest description and tags checked).
- **Not done:** tag `v0.4.0` is not pushed (pushing it publishes GitHub + Open VSX). Runs does not show 1.4's delivery state yet (`catherd-1.4-upgrade.md` §6).

## catherd 1.3.0 upgrade (2026-10-01)

catherd released 1.2.1 and 1.3.0 (npm `latest` = 1.3.0). CatHouse now pins **catherd-cli 1.3.0 / plugin 1.3.0** (tag `v1.3.0`, commit `f1422f8`; `packages/compat`, adapter label `v1_3`). Full delta with citations: `docs/research/catherd-1.3-upgrade.md`.

- **No contract change.** The 26 MCP tools, `RunSummary`, `runs list --json` and the doctor row shape are identical to 1.2. Gateway schemas, the allowlist and the UI code are unchanged.
- **New in catherd:** Cursor, Grok Build and Antigravity worker backends (off until a profile uses them). New doctor rows: `backend:` rows for each (`skip` when unused, shown as info), `quota:antigravity` (info), `ui-browser` (warn when `ui-reviewer` is on and `agent-browser` is missing), and a `budget.usd` warning on backends with no dollar cost. Also `catherd knowledge show|add|path`. All of this reaches Setup, Profiles and Models through catherd's own data.
- **Code:** compat pin 1.2.0 → 1.3.0. Fixtures moved to `packages/compat/fixtures/1.3.0/`; MCP, doctor ready/not-ready and profile show were re-recorded. Test expectations were updated. The Profiles "Applies to" string now names the new backends.
- **This machine** was upgraded with `bunx catherd-cli@1.3.0 init --no-input --plain` (global `catherd` 1.3.0) and `claude plugin marketplace update catherd && claude plugin update catherd@catherd` (plugin 1.3.0). doctor: **ready**. It warns about `ui-browser` (agent-browser not installed), Codex/opencode Docker access (the Docker daemon is not running) and the 1.0 profile's failover stand-in.
- **Verified:** Biome, typecheck, 95 unit tests, production build, live contract 7/7 against 1.3.0, and e2e 5/5 in VS Code 1.139 (`CATHOUSE_EXPECT_READY=1 CATHOUSE_E2E_WORKSPACE=~/Projects/sc-weather`, a repo with a catherd run).
- **Not done:** install/login buttons for `cursor-agent`/`grok`/`agy`, a Knowledge view, and the remaining 1.1/1.2 parity items (`docs/research/catherd-1.3-upgrade.md` §5).

## catherd 1.2.0 upgrade (2026-09-29)

catherd released 1.1.0, 1.1.1 and 1.2.0 after CatHouse pinned 1.0.0. CatHouse now pins **catherd-cli 1.2.0 / plugin 1.2.0** (tag `v1.2.0`, commit `3cee546`; `packages/compat`). The full delta and its citations are in `docs/research/catherd-1.2-upgrade.md`.

- **Push instead of `wait` (1.1).** A spike proved that catherd's notices reach an Agent SDK session and start a turn by themselves. A real one-milestone run (worker → reviewer → native verifier → land) was driven by push in about 4 min (`docs/spikes/catherd-1.2.md`). The event mapper turns `command_lifecycle started` into an `inbound` event. The controller keeps `turnActive` right during pushed turns and shows each repeated `init` only once. The resume prompt uses `peek`.
- **Gateway boundary (ADR 0005 amended).** `result`, `cancel` and `peek` are forbidden: they mark records read or claim the run, which would stop catherd from notifying the orchestrator. Replies come from `read_run_file(record.replyPath)` and cancel uses the CLI `catherd runs cancel`. `catalog_sync` is allowed but not used yet.
- **Contract fixes.** doctor rows can be `info`: without that, Setup's readiness check failed on 1.2 with `E_CONTRACT`. `RunSummary` and runs-list rows carry `session`, `continuedIn`, `questions` and `verifier`. Stand-ins carry `note`. Catalog values carry `confidence`, and inferred-only rungs count as unscored.
- **UI.** Runs show the starting session, parked questions and the verifier step. Profiles show catherd's stand-in note and allow adding an unscored rung without a treat-like. The transcript has a "catherd reported back" divider.
- **This machine** was upgraded with `bunx catherd-cli@1.2.0 init --no-input --plain` (global `catherd` 1.2.0 installed, default profile kept) and `claude plugin marketplace update catherd && claude plugin update catherd@catherd`. doctor: ready. It warns about the 1.0 profile's downgrading failover stand-in (`failover.codex:gpt-6-sol#high`) and about opencode and Docker, which are not installed or running here.
- **Verified:** Biome (`node_modules/.bin/biome check .`; `npx biome` dies in the agent sandbox), typecheck, 95 unit tests, production build, live contract 7/7 against 1.2.0 (fixtures re-recorded in `packages/compat/fixtures/1.2.0/`), and e2e 5/5 in VS Code 1.139 with the spike repo as workspace.
- **Not done:** a visual pass of the new Runs/Profiles/transcript bits in the Extension Development Host. The 1.1/1.2 TUI parity items (sessions grouping, milestone digests, source sync/age, rung value provenance, the treat-like suggest picker, the `network` switch) are listed as open in `docs/research/catherd-tui-parity.md`.

## Phase 0 outcome

Verified build, typecheck, lint, unit tests, VSIX (197 KB) and the e2e smoke test in VS Code 1.139. Details: `docs/testing.md`.

## Phase 1 outcome (so far)

- Machine prepared (then on 1.0.0; upgraded to 1.2.0 on 2026-09-29, see above): Bun 1.4.2, `bunx catherd-cli@1.0.0 init --no-input` (default profile, 2 native agents linked), Codex upgraded 0.142.2 → 0.158.0, plugin catherd@catherd 1.0.0 installed through the SDK's bundled Claude binary with the HTTPS workaround. `doctor --json` → ready. The Claude CLI login already existed (claude.ai Pro); it was hidden by leaked env vars.
- Built: gateway (`docs/architecture/gateway.md`), orchestrator session + controller + event mapper (`docs/architecture/orchestrator.md`), protocol `session.*` / `catherd.status`, webview Session page with prompt cards.
- Spikes (`docs/spikes/phase1.md`): plugin load ✅, native agents ✅, 178 s `wait` in the foreground ✅, resume without a duplicate run ✅, runId capture ✅. Prompt cards: live test in VS Code done by the owner (spike c).
- Tests at end of Phase 1: 44 unit + 6 live contract + 1 e2e.

## Phase 2 outcome

Setup is built and verified end to end (`docs/architecture/setup.md`): detectors, evaluator, click-only installers, the gate, and the Setup page. E2E on the prepared machine (ready), on a fresh HOME (Setup only), and the full install flow on a fresh HOME (Bun → catherd → plugin opens the gate in ~70 s).

## Phase 3 outcome

Pages built (`docs/architecture/webview.md` §Pages) on a per-repo `CatherdGateway` (`docs/architecture/gateway.md`). ADR 0007 was revised: run files are read via MCP `read_run_file`, so there are no disk reads. At the end of Phase 3, 8 public-surface parity items were still open; Phase 5 closed them. Verified then: 65 unit tests; e2e `pages.e2e.ts` against real catherd (runs list/detail/reply/debug, profiles, catalog, unchanged save), which caught two live contract details (object `treatLike`, `name: null`).

## Phase 4 outcome

Repo picker, permission modes, prompt badge + notification, cancel note, Continue from a run, compaction marker, Discard confirm (`docs/architecture/orchestrator.md` §Phase 4). 67 unit + 5 e2e green. The parity items left at this checkpoint were completed in Phase 5.

## Phase 5 outcome

All eight remaining public-surface parity items are ticked. The dashboard has a live status line and ARIA tab navigation; Profiles has help, `/` filtering, accessible activation/revert/switch dialogs, dirty-close guarding, and a tested three-way rebase for edits made during Save. Toasts use an accessible live region and model usability is not colour-only. Light Modern, Dark Modern and Dark High Contrast were inspected in the real Extension Development Host; Arrow-key tab navigation was verified through the accessibility tree. A stale-webview bug found during the pass was fixed with per-attach cache keys. Verification: lint, 68 unit tests, typecheck, build, and default e2e (2 passed, 3 workspace-dependent pending). Full report: `docs/release/phase5.md`.

Post-checkpoint UX correction: the status-only sidebar, Open Dashboard button and separate editor panel were removed. The entire app now renders directly in the CatHouse Activity Bar view, notifications reveal that view, and New Chat is the default tab for each fresh webview load. This exact layout and default selection were verified in the real Extension Development Host.

Profiles follow-up: fixed a clean-draft effect that repeatedly queued resets and made checkboxes/selects appear inert, plus the in-flight polling race that could leave New/Delete on the old profile. The unreliable browser `window.prompt` used by New Profile was replaced with a labelled, focus-trapped in-webview dialog with inline name validation and busy state. Role checkbox staging and the exact catherd CLI create command are covered by unit tests.

Role semantics are now explicit in the UI: catherd (1.0.0 through 1.3.0) accepts only its eight built-in roles, so Profiles configures that fixed set and cannot create a custom role. New Chat is a conversation with the catherd orchestrator rather than a role persona; a user can request researcher/reviewer/etc. in the task or a follow-up, but catherd remains responsible for routing and dispatch.

New Chat readability follow-up: the idle orchestrator form is now a structured composer with a larger resizable task field, separated permission controls, a visible readiness callout and clearer heading hierarchy. Dense supporting text across the dashboard has a 13 px minimum and shared inputs have a 32 px minimum height; the scale still inherits the user's VS Code base font and all colours remain theme tokens.

Dashboard chrome follow-up: repository, setup mood, current profile, dirty count and catherd version now share one responsive status bar; the duplicated version and separate repository row were removed.

Status-bar follow-up: the native VS Code title cannot reliably display dynamic view descriptions, so repository name, setup mood, profile, dirty count and catherd version remain in one non-wrapping bar below `CatHouse`. The redundant `Repository:` prefix is hidden; multi-root workspaces keep a labelled-for-accessibility picker.

New Chat density follow-up: explanatory role and permission copy moved into themed, keyboard-accessible info tooltips, the redundant subtitle and outer composer card were removed, and the active-session Send button now attaches directly to its input.

Setup readiness persistence follow-up: the last successful, explicitly requested doctor result is stored per VS Code workspace and restored after extension activation. Returning to CatHouse no longer resets a ready workspace to “not checked yet”; doctor still never runs automatically, and a later failed check clears the cached result. The cross-instance behavior is covered by a unit test.

New Chat action-row follow-up: the visible Permissions heading was removed; its info tooltip and select now stay at the far left, while Resume sits immediately left of the far-right Start button and the select retains an accessible label.

Session chat-layout follow-up: the dashboard now fills the available view height, the transcript/status region scrolls above a bottom-anchored composer in both idle and running states, and the running textarea matches the new-task composer with its primary Send button at the far right in a row below the input.

Active-session permission follow-up: the permission info and selector moved from the session header to the composer action row, matching New Chat with permissions at the far left and Send at the far right; Interrupt and Stop session remain in the header.

Chat input-spacing follow-up: both the idle task textarea and active follow-up textarea have a 2 px horizontal inset so their borders do not sit flush against the composer edges; their existing internal text padding and full responsive behavior are unchanged.

Transcript Markdown follow-up: user and orchestrator text now renders common Markdown plus GitHub-style lists, tables, task lists and strikethrough with themed typography, code and overflow handling. Raw HTML is skipped, safe link handling is retained, and focused renderer tests cover formatting and HTML suppression.

Composer keyboard/layout follow-up: Enter now submits and Shift+Enter inserts a newline in both New Chat and active-session textareas, with IME-safe handling. The Session tab no longer creates an outer scroll area; the header and composer stay fixed, only the transcript scrolls, and the extra space/scroll below the composer is removed.

Post-checkpoint documentation: the repository now has a public-facing root `README.md` modelled on catherd's concise product-first structure. It explains that CatHouse brings catherd into VS Code while catherd remains the source of truth, documents the complete UI surface and trust boundary, gives a development-VSIX path without implying a public release, and states the remaining release gates.

Workspace-management follow-up: New Chat now exposes the repository choice before a session starts. The user can add one or more folders through VS Code's native picker, select the repo for the chat, and remove the current folder from the workspace with a second-click confirmation; removal never deletes disk files. Workspace mutations are blocked during live sessions, and Start/Resume pass the selected repo explicitly. Verified with lint, 76 unit tests, typecheck, production build and default e2e (2 passed, 3 workspace-dependent pending); native picker/remove execution remains in the manual VS Code check because the automated path cannot operate a modal folder picker safely.

Prompt-placement follow-up: permission and question cards now stay in a fixed tray immediately above the New Chat input instead of scrolling away with the transcript. The tray is capped at 40% of the view height and scrolls internally when several requests are pending, so the composer remains visible and anchored. Verified with lint, 76 unit tests, typecheck and production build.

## Exact next step (Phase 5)

UI rebuild: the owner checks the new UI in the Extension Development Host (F5 "Run CatHouse") at a narrow and a wide sidebar, starts one short task to see the model header and live roles strip, and approves the commit. Then the release steps below.

Release first: `0.4.1` is prepared but not committed or tagged; run `node scripts/release-notes.mjs --tag v0.4.1`, commit the release contents, then tag and push only when the owner approves (`docs/release/github.md`). GitHub `v0.3.0` is published and the Open VSX backfill uploaded all four target packages. The owner must now log in to Open VSX with Eclipse, open **Show Publisher Agreement**, read it, and select **Agree**. Open VSX activates the already-uploaded `0.3.0` packages after that one-time legal step; do not republish or move the tag. Future stable tag pushes publish GitHub plus Open VSX automatically; prereleases stay on GitHub. VS Code Marketplace stays manual.

1. Owner chooses the final SPDX license, updates the manifest, and adds the license file. The published extension id is `cathouse.cathouse` and current release version is `0.4.1` (prepared, not tagged).
2. On an available SSH host or Dev Container, install the linux-x64 VSIX on the remote extension host and run Setup plus one short task. Docker is installed on this Mac but its daemon was not running; no SSH/Dev Container target was available, so remote remains explicitly untested.
3. Execute the darwin-x64 and Linux VSIX artifacts on native target machines. They are build-verified only.
4. After these gates, set Phase 5 to done and start the owner's bug/improvement backlog.
5. Smoke-test the VS Code Marketplace install in VS Code and the Open VSX install in Cursor. GitHub Release `v0.3.0` remains the manual/offline fallback with four platform VSIX files and `SHA256SUMS`; future releases follow `docs/release/github.md`.
6. catherd 1.2/1.3 follow-up: check the new Runs (session, parked questions, verifier), Profiles (stand-in note, Add (let catherd infer)) and "catherd reported back" transcript bits in the Extension Development Host, then pick from the 1.1/1.2 parity backlog in `docs/research/catherd-tui-parity.md` and the 1.3 backlog in `docs/research/catherd-1.3-upgrade.md` §5.

## Environment facts (planning machine, updated 2026-10-01)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.283 on PATH, Bun 1.4.2 (installed 2026-09-28 into ~/.bun), catherd-cli 1.4.0 (global `catherd` in ~/.bun/bin plus the bunx cache), Codex 0.158.0, plugin catherd@catherd 1.4.0, agent-browser not installed, opencode not installed, no Jev or Artificial Analysis key. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.287 (CatHouse stays on 0.3.283), `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.4.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

Profiles density follow-up: every Profiles setting group (Roles, Routing, Billing, Harness isolation, Budget, Failover, Timeouts & limits, Push notifications) is now a collapsible section that starts closed and shows a one-line summary in its header. Each role card's rung list collapses too, Expand all / Collapse all are available, open state persists in webview state, and filtering opens every match. Settings are stacked in one column instead of a two-column grid. Verified with lint, typecheck, 76 unit tests and build. The owner has not yet done the visual check in the Extension Development Host.

Transcript overflow and auto-scroll follow-up: tool-call details, prompt cards and Markdown code blocks now wrap long paths and JSON tokens (`overflow-wrap: anywhere`) instead of scrolling sideways, and the transcript container hides horizontal overflow. The transcript sticks to the newest content while the user is at the bottom (`session/useStickToBottom.ts`, driven by a ResizeObserver). Scrolling up releases the stick and shows a "↓ Latest" button. Sending a follow-up jumps back to the bottom. Verified with lint, typecheck, 76 unit tests and build. The owner has not yet checked it visually in the Extension Development Host.

Chat tab follow-up: the New Chat tab is renamed **Chat**. A **New chat** button in the Chat header (shown whenever the chat is not empty) calls the new `session.reset` method, which stops a running session after a second-click confirmation and returns to the empty composer. The repo's saved run ↔ session link survives, so Resume saved run still works. Verified with lint, typecheck, 77 unit tests and build; not yet checked visually in the Extension Development Host.

Chat header-action follow-up: New chat, Interrupt and Stop session now have distinct icons and stay visible with disabled styling whenever their action is unavailable. The protocol/controller tracks `turnActive` independently from the long-lived streaming session, so Interrupt is enabled only while Claude is processing a turn; Stop remains tied to a live session and New chat to existing chat state. Controller tests cover start, interrupt, duplicate interrupt, follow-up and SDK-result transitions. Verified with lint, typecheck, 81 unit tests and production build; the owner has not yet checked it visually in the Extension Development Host.

Chat composer-action follow-up: Attach files, Resume saved run, Start task and Send now have matching 16 px inline SVG icons. Send is disabled when both its text and attachment list are empty, matching the existing empty-state guard on Start task. Verified with lint, typecheck, 81 unit tests and production build; the owner has not yet checked it visually in the Extension Development Host.

Composer tooltip placement follow-up: permission help tooltips in both the idle and active composer action rows now open upward, so they remain visible above the bottom edge of the Activity Bar webview. The task-label tooltip continues to open downward. Verified with lint, typecheck, unit tests and production build; the owner has not yet checked it visually in the Extension Development Host.

Responsive composer follow-up: both composer forms are Tailwind `@container`s. Below 36rem (`@xl`), Attach files and Resume saved run collapse to icon-only buttons (with `aria-label` and `title`), while Start task and Send keep their labels. The action buttons stay together on one row. The mode select shrinks and truncates instead of pushing them onto another line, and the task label row wraps the repo chip when space is tight. Verified with typecheck, 83 unit tests and production build. Biome crashed with an out-of-memory error in the agent environment, so lint was not run. Not yet checked visually in the Extension Development Host.

Narrow-sidebar layout follow-up. Three fixes:
- **Chat header:** the title block is `flex-[1_1_auto]`, so it can no longer shrink to zero width and let New chat / Interrupt / Stop session draw over "Orchestrator". Below 28rem (`@md`), those three buttons are icon-only, with `aria-label` and `title`. New chat still shows its "Stop and start new?" text while it waits for confirmation.
- **Dashboard tabs:** the tab strip stays on one line and scrolls sideways with a hidden scrollbar instead of wrapping onto two lines. The selected tab is scrolled into view.
- **Profiles role card:** each card is a container with two rows. The first row holds the toggle, checkbox and name, rung count, and the enforcement badge at the end. The second row holds the access select and "start on" select, side by side at `@md` and wider and stacked when narrower. Both selects truncate.

Verified with typecheck, 83 unit tests, production build and `biome check packages/webview/src`. The full-repo `pnpm lint` still runs out of memory in the agent environment. Not yet checked visually in the Extension Development Host.

## Open questions / risks

- (Resolved) Long `wait` calls survived in an SDK session (Phase 1), and catherd 1.1+ push notices reach SDK sessions (`docs/spikes/catherd-1.2.md`). On Linux, catherd's doctor may ask for `crossSessionInbound`; this is untested with CatHouse.
- Upstream PRs to propose (non-blocking): `docs/research/public-surface-gaps.md`.

Composer drafts and attachments follow-up: the New Chat task, the active-session follow-up, the permission mode and their attachments are stored in VS Code webview state (`usePersistentState`), so switching dashboard tabs or hiding the view keeps the unsent input. Both composers now take files: an **Attach files** button opens VS Code's native picker through the new read-only `app.pickFiles` method, and files can be dropped onto the textarea (hold Shift when dragging into a VS Code webview). Explorer/Finder drops attach paths; plain `File` drops inline text up to 200 KB. Attachments are removable chips and are appended to the message as a path list plus inline `<attached_file>` blocks by `composeMessage` (unit-tested). Verified with lint, 80 unit tests, typecheck and production build; the Shift-drag and native picker still need a manual check in the Extension Development Host.

Overview/Repos follow-up: Overview is now an at-a-glance page of three clickable tiles (Setup, Profile, Runs) plus the five newest runs; the failing-setup list and profile detail were removed because their tabs own them. Workspace folder management moved out of New Chat into a new **Repos** tab (row list with in-use marker, click-to-select, ✕ remove with second-click confirm, Add folders…). New Chat keeps only a compact repo chip (name/select + `+` add) on the task-label row. Verified with lint, typecheck, 81 unit tests and production build; the visual pass in the Extension Development Host is still pending.

Chat readability and text-size follow-up: the Session transcript is now a chat: user bubbles, a `catherd` speaker header, tool calls grouped into steps cards with status/tool icons, server chips, readable key/value input and output, collapsed older steps, and card/divider treatments for init, run start, sub-agent tasks, turn results and compaction. A gear button beside the catherd version opens Settings with a Text size control (80–160 %) that scales the whole view relative to the VS Code font size and persists per view. Details: `docs/architecture/webview.md` §Transcript layout, §Settings. Verified with lint, typecheck, 83 unit tests and production build; a visual pass in the Extension Development Host is the next step. Follow-up: text size now changes through a draft + preview and an Apply button, so dragging the slider no longer reflows the view under the pointer.

Setup attention follow-up: whenever the dashboard status bar reports `setup needs attention`, the Setup tab now shows a theme-aware red dot. The tab's accessible name includes the same warning, so the state is not communicated by colour alone. Verified with lint, typecheck, unit tests and production build; the owner has not yet checked it visually in the Extension Development Host.

Profiles rung-disclosure follow-up: the tiny, unlabeled triangle in each role card is now a bordered 32 px control with the shared chevron icon and a visible `Rungs (n)` label. The role name and enable checkbox come first, and the control exposes state-specific “Show/Hide the model ladder” labels through both `aria-label` and the native tooltip. Verified with targeted Biome, webview typecheck and production build; the owner has not yet checked it visually in the Extension Development Host.

GitHub download follow-up: platform VSIX files are published as GitHub Release assets, not committed under `dist/` (gitignored, and a Linux VSIX exceeds GitHub's 100 MB file limit). Pushing `vX.Y.Z` runs `.github/workflows/release.yml`, which checks the tag against `packages/extension/package.json` and `docs/CHANGELOG.md` (`scripts/release-notes.mjs`), builds all four targets, uploads `SHA256SUMS`, and writes VS Code and Cursor install steps into the release body. The root README and the extension README document the same install path. The manifest and changelog are prepared for `0.1.0`; the tag is the remaining GitHub-publication step. Report: `docs/release/github.md`.

GitHub `0.1.0` release preparation: manifest and changelog were set to `0.1.0`; the incorrect documented `pnpm release:notes -- --tag ...` invocation was corrected to `pnpm release:notes --tag ...`. Verification passed: release-notes tests 4/4, typecheck, unit tests 95 passed (7 opt-in/live skipped), production build, and local darwin-arm64 VSIX packaging (95.94 MB).

GitHub `v0.1.0` publication: commit `f5c8615` and annotated tag `v0.1.0` were pushed. GitHub Actions run `36545374544` completed successfully, including four-platform packaging, checksums, and Release creation. The API confirmed a public, non-draft, non-prerelease Release containing `cathouse-darwin-arm64-0.1.0.vsix`, `cathouse-darwin-x64-0.1.0.vsix`, `cathouse-linux-arm64-0.1.0.vsix`, `cathouse-linux-x64-0.1.0.vsix`, and `SHA256SUMS`, all uploaded successfully. The released download path has not yet been installed back into VS Code or Cursor.

Store distribution follow-up: `cathouse.cathouse` is now published for VS Code at `https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse` and for Cursor at `https://open-vsx.org/extension/cathouse/cathouse`. The root README, extension README, release report, runbook, generated GitHub release notes, and status now use those stores as the primary install paths; GitHub VSIX files are documented as the manual/offline fallback. Store installation has not yet been smoke-tested locally.

Release `0.3.0` preparation (2026-10-01): `packages/extension/package.json` is `0.3.0`, and `docs/CHANGELOG.md` has a `## [0.3.0] - 2026-10-01` section with the catherd 1.3.0 pin and the store-docs change (versions 0.2.x were skipped on the owner's request). Verified: `node scripts/release-notes.mjs --tag v0.3.0` passes, release-notes tests 4/4, 95 unit tests, typecheck, Biome, and a local `pnpm package` (`dist/cathouse-darwin-arm64-0.3.0.vsix`, 95.94 MB). The tag `v0.3.0` is not pushed yet. Pushing it publishes the GitHub Release. The VS Code Marketplace and Open VSX are published separately.

GitHub `v0.3.0` publication (2026-10-01): commit `d98364b` and tag `v0.3.0` were pushed. GitHub Actions run `36880233848` completed successfully. The API confirmed a public, non-draft, non-prerelease Release with `cathouse-darwin-arm64-0.3.0.vsix`, `cathouse-darwin-x64-0.3.0.vsix`, `cathouse-linux-arm64-0.3.0.vsix`, `cathouse-linux-x64-0.3.0.vsix` and `SHA256SUMS`, all uploaded. The VS Code Marketplace and Open VSX still list `0.1.0` until `0.3.0` is published there.

Store-publishing automation (2026-10-01): `.github/workflows/release.yml` publishes the four platform VSIX files for stable tags to Open VSX (`ovsx@1.2.0`) after creating or finding the GitHub Release. `OVSX_PAT` is passed only as a masked environment variable. `workflow_dispatch` can backfill an immutable existing tag, and `--skip-duplicate` makes retrying a partial publication safe. Tags containing `-` remain GitHub-only prereleases. VS Code Marketplace automation and its Azure credential requirement were removed at the owner's request; the existing `0.1.0` listing is left untouched. `v0.3.0` needs one manual dispatch after this workflow reaches the default branch. Report and commands: `docs/release/github.md`.

Open VSX `0.3.0` backfill (2026-10-01): manual Actions run `36884876884` checked out tag `v0.3.0`, rebuilt the four platform VSIX files, retained the existing GitHub Release, and authenticated with `OVSX_PAT`. Open VSX reported every `0.3.0` target as already published but inactive and therefore invisible, so the job concluded failure. The public API still returns `0.1.0`. Per the Open VSX publishing guide, this is the unsigned Publisher Agreement state: the owner must connect the matching Eclipse account and accept the agreement in the browser. Signing activates the already-uploaded versions automatically; no new tag or upload is required.

i18n and RTL layout follow-up (2026-10-02): the CatHouse webview now supports dynamic language switching from within the app settings. A new `useLanguage` hook and a language select menu were added under Settings, persisting the choice to view state and `localStorage`. Six locales (en, zh, hi, es, fr, fa) are defined; switching locales updates translations reactively via an `App`-level re-render event and sets `document.documentElement.dir` appropriately. LTR and RTL styling relies entirely on Tailwind v4 and logical properties (`ms-`, `me-`, `ps-`, `text-start`, etc.) which were already verified and present across the codebase (no `ml-` or `mr-` utility classes exist). Verified with typecheck, lint, and a local Vite build.

Release `0.4.2` preparation (2026-10-02): `packages/extension/package.json` is bumped to `0.4.2`, and `docs/CHANGELOG.md` has a `## [0.4.2] - 2026-10-02` section detailing the new multi-language support (English, Chinese, Hindi, Spanish, French, and Persian) and dynamic RTL layouts. The README.md files for the project and extension have also been updated to reflect these languages. Verified: `node scripts/release-notes.mjs --tag v0.4.2` passes, typecheck, lint, and build succeed.
