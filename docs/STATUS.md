# STATUS

Last updated: 2026-09-29. Update this file at the end of every section.

## Current phase

**Phase 5 (release prep): code-complete on macOS; external/owner gates remain.** Platform VSIX, extension README, the eight open parity items, accessibility and Light/Dark/High Contrast checks are done. A remote runtime was not available. Waiting on publisher/license/version decisions and native execution of non-arm64 artifacts.

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

Role semantics are now explicit in the UI: catherd (1.0.0 through 1.2.0) accepts only its eight built-in roles, so Profiles configures that fixed set and cannot create a custom role. New Chat is a conversation with the catherd orchestrator rather than a role persona; a user can request researcher/reviewer/etc. in the task or a follow-up, but catherd remains responsible for routing and dispatch.

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

1. Owner chooses the publisher id, SPDX license, and whether to publish as `0.1.0`; update the manifest and generate the license file.
2. On an available SSH host or Dev Container, install the linux-x64 VSIX on the remote extension host and run Setup plus one short task. Docker is installed on this Mac but its daemon was not running; no SSH/Dev Container target was available, so remote remains explicitly untested.
3. Execute the darwin-x64 and Linux VSIX artifacts on native target machines. They are build-verified only.
4. After these gates, set Phase 5 to done and start the owner's bug/improvement backlog.
5. To publish downloadable VSIX files, cut a GitHub Release with `docs/release/github.md`: choose the version (the open `0.1.0` decision), move `docs/CHANGELOG.md` `## Unreleased` under `## [X.Y.Z] - YYYY-MM-DD`, tag `vX.Y.Z`, and push the tag. The workflow attaches the four platform VSIX files. No tag has been pushed yet, so the Releases page is still empty.
6. catherd 1.2 follow-up: check the new Runs (session, parked questions, verifier), Profiles (stand-in note, Add (let catherd infer)) and "catherd reported back" transcript bits in the Extension Development Host, then pick from the 1.1/1.2 parity backlog in `docs/research/catherd-tui-parity.md`.

## Environment facts (planning machine, updated 2026-09-29)

macOS (Darwin 27), VS Code 1.139.1 and Cursor 3.21.18 installed, Node 22.13.1 via nvm, pnpm present, `claude` 2.1.283 on PATH, Bun 1.4.2 (installed 2026-09-28 into ~/.bun), catherd-cli 1.2.0 (global `catherd` in ~/.bun/bin plus the bunx cache), Codex 0.158.0, plugin catherd@catherd 1.2.0, opencode not installed, no Jev or Artificial Analysis key. npm latest: `@anthropic-ai/claude-agent-sdk` 0.3.283, `@anthropic-ai/claude-code` 2.1.283, `catherd-cli` 1.0.0, `@vscode/vsce` 4.0.0, `@vscode/test-electron` 3.1.0.

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

GitHub download follow-up: platform VSIX files are published as GitHub Release assets, not committed under `dist/` (gitignored, and a Linux VSIX exceeds GitHub's 100 MB file limit). Pushing `vX.Y.Z` runs `.github/workflows/release.yml`, which checks the tag against `packages/extension/package.json` and `docs/CHANGELOG.md` (`scripts/release-notes.mjs`), builds all four targets, uploads `SHA256SUMS`, and writes VS Code and Cursor install steps into the release body. The root README and the extension README document the same install path. The manifest version is still `0.0.1` and no tag has been pushed, so nothing is downloadable until the owner cuts the first release. Report: `docs/release/github.md`.
