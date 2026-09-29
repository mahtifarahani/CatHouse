# catherd 1.0.0: public-surface gaps and CatHouse workarounds

> **Baseline: catherd 1.0.0.** CatHouse now pins **1.2.0**. Where 1.1/1.2 changed something CatHouse relies on, [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) wins over this doc.

catherd's public surface is the CLI (with `--json` on reads) and the 21 MCP tools. The services are internal (no `exports` in `package.json`, Bun-only). The TUI reaches past the public surface through its `Effects` seam (`src/entry/tui/effects.ts`). This table lists what CatHouse needs but cannot get publicly, with the workaround and the proposed upstream fix. Citations are relative to catherd at `b257da7`.

| # | Gap | Where the TUI gets it | CatHouse workaround (v1) | Proposed upstream change (catherd 1.1) |
|---|---|---|---|---|
| 1 | Routes and climbs per lane | `readRoutes` reads `routes.jsonl` (`effects.ts:40,200`) | MCP `read_run_file(run, "routes.jsonl")` (verified on 1.0.0), parsed with a zod `RouteRow` schema (`src/domain/route.ts:29-46`); skip the header and a partial last line (ADR 0007) | add `routes` to `status --json` / `runs show --json` |
| 2 | `landed` and `budget` in the run list | `summarizeRun` per run | call `status <run> --json` (or MCP `status({run})`) for the visible rows only; cache by run mtime | add `landed`, `budget` to `runs list --json` |
| 3 | Validating an unsaved draft | `validate(profile, catalog)` on the draft | submit via MCP `profile_set`, which validates before writing: `saved: false` + `errors` means nothing was written; show the errors inline. Live per-keystroke validation is not available. | `profile_validate({patch})` / `profile validate --draft <json>` |
| 4 | Save preview: agent files added/removed | `agentFiles` in the save dialog | show after save from `profile_set` → `linked`, `pruned`, `newSessionNeededFor` | a `dryRun` flag on `profile_set` |
| 5 | Save only if unchanged (`expect`) | `patchProfile(name, patch, {expect})` | re-read `profile_get` right before `profile_set` and compare to the base; if it differs, show "changed on disk" and rebase | `expect` parameter on `profile_set` |
| 6 | The ladder routing would climb (`candidates()`) and per-rung enforcement | internal `candidates()`, `enforcementOf` | show the role's `rungs` in order; per-role enforcement from `profile_get.enforcement`; stand-ins from CLI `profile show --json` → `standIns` | expose `ladder` per role in `profile_get` |
| 7 | JSON from mutating CLI commands | n/a | success = exit 0; failure = parse stderr `error E_CODE: message` / `fix: …` | `--json` on `profile use/new/copy/rm/set`, `runs cancel`, `catalog treat-like` |
| 8 | No MCP tools for doctor, activate, delete, catalog refresh, treat-like | direct service calls | CLI for each | optional MCP twins |
| 9 | The verifier's current step / elapsed time | not exposed anywhere | show from the orchestrator's SDK stream (`task_progress` for the verifier subagent: duration, last tool) | a `status` field (ideas.md, verifier bottleneck idea 4) |
| 10 | Plugin marketplace source uses SSH (**fixed upstream in 1.1**) | n/a | install with the HTTPS `insteadOf` env (`catherd-known-issues.md`) | `"url": "https://github.com/47vigen/catherd.git"` in `marketplace.json` |

**Rules that follow:**
- CatHouse reads no catherd run file from disk: `read_run_file` covers routes and state.md (ADR 0007).
- Every gap workaround lives behind `CatherdGateway` (`packages/extension/src/gateway/`), so the UI never knows which path produced the data.
