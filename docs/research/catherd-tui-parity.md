# catherd 1.0.0 TUI: feature-parity checklist for CatHouse

> Status 2026-09-28 (Phase 3): ticked items are implemented (`docs/architecture/webview.md` §Pages); unticked items are still open (Phase 4). Known differences from the TUI: live per-keystroke draft validation is not possible (public-surface gap 3; errors appear on Save); the ladder column shows the role's rungs in order, not catherd's computed `candidates()` (gap 6); agent-file changes appear after save, not in the preview (gap 4).

Citations are relative to the catherd repo at commit `b257da7`. TUI code: `src/entry/tui/` (23 files). Every screen as text: `docs/tui-frames.md` (generated, checked in CI).

**Key fact:** every TUI action goes through one seam, the `Effects` interface (`src/entry/tui/effects.ts:90-135`), which `liveEffects()` fills by calling services directly (`effects.ts:229-270`). The package has no `exports`, only `bin`. So CatHouse can only use the CLI and the 21 MCP tools. Mirror `Effects` as CatHouse's service layer (`CatherdGateway`). Use the `commands.ts` table as the feature manifest.

Legend for the "CatHouse source" column: **MCP** = tool on the long-lived gateway MCP connection; **CLI** = `bunx catherd-cli@1.0.0 …`; **FILE** = read-only `RunFilesReader`; **GAP** = no public surface (see `public-surface-gaps.md`).

## Chrome (every screen)

- [ ] (open: no header mood/version; the profile and unsaved count show on the Profiles page) Header: version, the profile shown with "(active)" or "(this repo)", total unsaved count, mood (failed if doctor not ready; working if any run is live; else good) (`views/app.tsx:163-185`).
- [x] Tabs: Status, Profiles, Runs (`state.ts:12`). CatHouse: Overview, Runs, Profiles, Models, Diagnostics, plus Setup and Session.
- [ ] (partial: inline status lines, no VS Code notifications yet) Toasts (success/info/warning/error) → VS Code notifications or in-webview toasts.
- [x] "Kept lines", e.g. "start a new Claude Code session to use: …" (`profile-actions.ts:166-173`) → a persistent banner.
- [x] Polling: doctor once and on `r`; runs every 2 s (pausable); profiles every 2 s; open run every 1 s (`providers/data.tsx:65,117,119`; `views/runs.tsx:15,138`). Change detection by file mtimes (`effects.ts:145-184`).
- [x] Avoid the first-frame flash of "0 profiles" (a known TUI bug): show a loading state.

## Status tab (`views/status.tsx`; frame `docs/tui-frames.md:6-34`)

| Feature | Detail | CatHouse source |
|---|---|---|
| SETUP rows | glyph + word, label — detail, `fix:` below; "checked Ns ago" | CLI `doctor --json` |
| PROFILE row | profile this dir runs on, active / this repo, profile count | MCP `profile_get` (or CLI `profile list --json`) |
| RECENT RUNS | newest 5: live/idle · title · repo · N live · role runs · landed · budget % · age | CLI `runs list --json` + `status --json`/MCP `status(run)` for landed & budget |
| `enter` | on a profile check → Profiles; on a run → that run | UI |
| `y` | copy the fix command | `vscode.env.clipboard` |
| `r` | re-run doctor | CLI |

## Profiles tab (`views/profiles.tsx`, `profile-tree.ts`, `profile-edits.ts`)

Top line: `PROFILE <name> (active) · N unsaved · switch · new`.

| Section | Row | Value shown | Action | CatHouse source |
|---|---|---|---|---|
| ROLES | role `[x]` | the ladder routing would climb (`candidates()`), "off", or "no usable rung" | toggle `enabled`; expand | patch `roles.<r>.enabled`; ladder is GAP (approximate from rungs) |
| | access | `<mode> · enforced/advisory/no rung` | cycle read-only → workspace-write → full | patch; enforcement from `profile_get.enforcement` / `profile show` |
| | default rung | short rung, or "the cheapest that clears the bar" | picker | patch `defaultRung` |
| | billing group (claude native, claude-code headless, codex, opencode-go, opencode, cursor, grok) | billing mode | heading | `profile.billing` |
| | model | `k of n` · not listed · unscored | expand | MCP `catalog_query({role})` |
| | effort `[x]` | treated like X · unsaved / unscored · inferred | tick rung; unscored → treat-like picker | patch `rungs`; CLI `catalog treat-like` |
| ROUTING | objective, Jev | cost/speed, auto/off | toggle | patch |
| HARNESS | one per adapter `[x]` | isolated / "your own config" | toggle | patch `harness.<a>.isolated` |
| BUDGET | minutes, tokens, usd | number or "no cap" | number prompt; empty clears (null) | patch |
| FAILOVER | each non-claude rung on an enabled ladder, plus existing keys | `→ stand-in (inferred)` / none | picker (other quota only) | patch `failover`; `standIns` from CLI `profile show --json` |
| TIMEOUTS | idle, wall | number | prompt (cannot be cleared) | patch |
| NOTIFY | milestone/finish/blocked `[x]` | none | toggle | patch `notify` |

- [x] Per-row validation error/warning inline, with message + fix (`profiles.tsx:339-350`). Source: MCP `profile_validate` (saved profile) and `profile_set` → `saved: false` errors (draft). Live draft validation is a GAP.
- [ ] (open) Help line per row type (`profiles.tsx:28-41`).
- [ ] (open) Filter `/` across parent path, label and value (`profile-tree.ts:401-419`).
- [x] Error states: profiles/profile/catalog unreadable → error + fix + retry; a failed later poll keeps the last good read with a "stale" line (`profiles.tsx:47-58,134-159`).

### Edit flow (`state.ts`, `views/save-dialog.tsx`)

- [x] Staged draft per profile `{base, doc, treatLikes, past, future}`, 100 undo steps; nothing touches disk before Save (`state.ts:23-29,114`).
- [x] Dirty count = changed fields + staged treat-likes.
- [x] Undo/redo; a treat-like and the rung tick it brings are one step.
- [x] Save dialog (only from an explicit Save; Enter never saves): field diff before → after, staged treat-likes, validation errors/warnings, agent files added/removed (GAP), note "Applies to: native Claude agents in new Claude Code sessions; codex, claude-code and opencode from the next dispatch". Buttons Save / Save & make active / Cancel; any error leaves only Cancel.
- [x] Re-read the file before writing; if it changed on disk, ask again (TUI uses `expect`, which is a GAP; CatHouse re-reads and compares).
- [x] Write order: each staged treat-like (CLI `catalog treat-like`), then the patch (MCP `profile_set`). Show `newSessionNeededFor` as a banner.
- [x] Save & make active = save, then CLI `profile use <name> [--repo]`.
- [ ] (open: the draft is rebased on the saved doc) Edits made during a save stay staged over the new base.

### Dialogs

- [x] Profile list (current, active, this repo, N unsaved); delete with double confirmation → CLI `profile rm` (refuses active/bound).
- [x] New / copy (name must match `PROFILE_NAME`; duplicates refused inline) → CLI `profile new <n> [--from]` / `profile copy`.
- [ ] (partial: no confirm dialog; unsaved-changes warning only on profile switch) Activate confirm (global vs repo binding; warns unsaved changes aren't included; re-reads the binding first) → CLI `profile use <n> [--repo]`.
- [ ] (partial: Discard has no confirm and does not re-read) Revert confirm (re-reads the file; "changed on disk" warning).
- [ ] (partial: only on profile switch, not on panel close) Quit/close with unsaved changes → keep editing / discard.
- [x] Pickers: default rung, failover stand-in (other quota only), treat-like; number prompt.

## Runs tab (`views/runs.tsx`; frames `docs/tui-frames.md:276-334`)

| Feature | Detail | CatHouse source |
|---|---|---|
| List | "updated Ns ago"/"paused", rows as above, up to 2 corrupt-run warnings; empty state "No runs yet. Start one…" | CLI `runs list --json` (+ `status`) |
| Run header | title · repo · started · updated | `RunSummary` |
| Budget bar | green < 80 %, amber < 100 %, red; caps min/tokens/$ | `RunSummary.budget` |
| Totals | role runs, ok, input/output tokens, $ | `RunSummary.totals` |
| LIVE | name, rung, mm:ss, running/starting | `RunSummary.live` |
| CLIMBS | lane, from → to, reason, "(environment)" | FILE `routes.jsonl` (`source: "climb"`) |
| ROUTES | lane, role, source, kind/difficulty, rung | FILE `routes.jsonl` (last row per lane) |
| LANDED | milestone lines | `RunSummary.milestones` |
| STATE | state.md tail | `RunSummary.stateTail`; full via MCP `read_run_file` |
| Cancel live role | double confirm within 5 s | MCP `cancel` (or CLI `runs cancel`), then notify the orchestrator session |
| Refresh / pause | `r` / `p` | UI |

Extra in CatHouse beyond the TUI: records table (`runs show --json`), per-role debug (`runs show --debug --name`), role reply (MCP `result`), `runs_summary`, knowledge (`read_knowledge`), lane files and plan (`read_run_file`).

## Commands (`src/entry/tui/commands.ts:56-404`)

| id | Title | CLI twin |
|---|---|---|
| profile.new | New profile… | `catherd profile new <name>` |
| profile.list | Switch profile… | `catherd profile list` |
| status.recheck | Re-check setup | `catherd doctor` |
| status.copy | Copy the fix command | none |
| profile.save | Save profile… | `catherd profile set <path> <value>` |
| profile.activate | Make this profile active… | `catherd profile use <name> [--repo]` |
| profile.copy | Copy this profile… | `catherd profile copy <from> <name>` |
| profile.revert | Discard unsaved changes… | none |
| catalog.refresh | Refresh the model catalog | `catherd catalog refresh` |
| edit.undo / edit.redo | Undo / Redo | none |
| runs.refresh / runs.pause | Refresh / Pause updates | none |
| runs.cancel | Cancel the selected role | `catherd runs cancel <run> <name>` |
| app.palette, app.help, tab.*, list.*, tree.*, dialog.* | navigation | none |

CatHouse registers the meaningful ones as VS Code commands (`cathouse.*`) so they appear in the Command Palette.
