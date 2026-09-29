# catherd 1.0.0: on-disk layout

> **Baseline: catherd 1.0.0.** CatHouse now pins **1.2.0**. Where 1.1/1.2 changed something CatHouse relies on, [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) wins over this doc.

Citations are relative to the catherd repo at commit `b257da7`.

**CatHouse rule:** CatHouse never writes any of these files. It may read `routes.jsonl` (no public surface exposes it; see `public-surface-gaps.md`), and it may watch files as a *refresh trigger*. All state it shows comes from CLI `--json` or read-safe MCP tools.

## 1. Root folders (`src/infra/paths.ts`)

| Folder | Resolution |
|---|---|
| Config | `$CATHERD_CONFIG_DIR`, else `$CATHERD_HOME/config`, else `$XDG_CONFIG_HOME/catherd` (default `~/.config/catherd`) (`paths.ts:4-13`) |
| Data | `$CATHERD_HOME/data`, else `$XDG_DATA_HOME/catherd` (default `~/.local/share/catherd`) (`paths.ts:7-14`) |
| Claude home | `$CLAUDE_CONFIG_DIR`, else `~/.claude` (`paths.ts:17-21`) |
| Agents dir | `$CATHERD_CLAUDE_AGENTS_DIR`, else `<claudeHome>/agents` |

**Repo key** (`paths.ts:24-32`): the git toplevel with its leading `/` removed and runs of non-alphanumerics turned into `-`, cut to 60 chars, then `-` + the first 8 hex chars of the path's sha256. Example: `Users-me-proj-1a2b3c4d`.

Derived: `repoDir = <data>/repos/<repoKey>`, `runsDir = <repoDir>/runs`, `logsDir = <data>/logs`, `discoveryDir = <data>/discovery`, `locksDir = <data>/locks` (`paths.ts:34-38`).

Permissions: folders 0700, files 0600 (`store.ts:22-23`).

**How writes happen** (matters for watchers):
- JSON and Markdown: written to `<file>.<pid>.<rand>.tmp`, then renamed (`store.ts:62-78`).
- JSONL: one `appendFileSync` per row, so only the last line can be cut short by a crash (`store.ts:152-156`).

## 2. Config folder

| Path | Format | Source |
|---|---|---|
| `profiles/<name>.json` | Profile document, `schema: 1` | `profile-store.ts:27,32`; `profile-service.ts:54` |
| `profiles.lock` | lock taken by every profile writer | `profile-service.ts:48-51` |
| `config.json` | `{schema: 1, activeProfile?}` (plus optional `keybinds` for the TUI) | `profile-store.ts:28,34` |
| `projects.json` | `{schema: 1, bindings: {<git toplevel>: <profile>}}`: per-repo binding | `profile-store.ts:29,35-38` |
| `agents/<profile>/<agent>.md` | generated native subagent files; the links in `~/.claude/agents` point here | `profile-store.ts:31`; `agent-links.ts:81-93` |
| `credentials.json` | `{schema: 1, typesafeApiKey}`, mode 600 | `jev-service.ts:28-32,77-82` |
| `catalog.override.json` | `{schema: 1, treatLike: {rung: rung}}` | `catalog-service.ts:49` |
| `0.x-backup-<stamp>/` | 0.x files moved aside by `init` | `setup.ts:28-50` |

Which profile a repo uses: its `projects.json` binding, else `config.activeProfile`, else `"default"` (`profile-store.ts:105-108`). `default` exists even without a file (`profile-store.ts:75-93`). A profile file with no `schema` field is 0.x → `E_CONFIG_INVALID`; `schema > 1` → `E_CONFIG_NEWER_SCHEMA` (`profile-store.ts:46-67`).

## 3. Data folder

- `repos/<repoKey>/runs/<runId>/`: run folders
- `repos/<repoKey>/knowledge.md`: what past runs learned (`run-store.ts:261`). `land` with `learned` appends `- YYYY-MM-DD <run title> <milestone>: <learned>` (`lane-service.ts:218-223`).
- `run-ids/<runId>/`: claims that keep run ids unique across repos (`run-store.ts:81-98`)
- `discovery/<backend>.json`, `discovery/repos/opencode-<sha16>.json`: model listings (opencode per repo) (`discovery.ts:27-41`)
- `logs/catherd-YYYY-MM-DD.jsonl`: rows `{at, level, event, pid, ...}` with secrets redacted; kept 7 days (`log.ts:53-84`)
- `locks/slot-<i>.lock`: heavy-command slots (`heavy-lock.ts:17-36`)
- `codex-home/`, `opencode-home/`: homes for isolated harness runs

## 4. Run id and run folder

- **Run id** (`run-store.ts:64-98`): `<UTC YYYYMMDD-HHMMSS>-<slug(title) ≤ 40 chars, or "run">`, with `-2`, `-3`… on a clash. Example: `20260928-141502-add-oauth-login`.
- **Dispatch id** (`ids.ts:61-85`): a ULID (10 base32 chars of ms + 16 random), monotonic within a process.
- **Id rule** for run/role/lane/dispatch ids: `^[A-Za-z0-9][\w.-]{0,127}$`, no `..`.

```
<runId>/
  meta.json        {schema:1,id,repo,title,aLines[],createdAt,catherdVersion}. Written LAST by createRun (run-store.ts:23-31,106-115)
  plan.md          architect-written (write_run_file)
  lanes/<lane>.md  lane files: "# Mx.Ly — title", Owns:, Fast check:, Kind:, Difficulty: (domain/lane.ts:50-61)
  ledger.md        header "milestone | what | commit | minutes | evidence" + one row per land (run-store.ts:62,102,256-258)
  state.md         rendered status (§6)
  state.json       {schema:1,next,lastCheck,lastLandedAt} (state.ts:14-23)
  runs.jsonl       one RunRecord per finished dispatch
  routes.jsonl     route/climb rows
  outcomes.jsonl   lane outcomes
  agents.jsonl     native Claude subagent reports
  jev.jsonl        Jev decisions
  harness.jsonl    first-turn input samples
  roles/<name>/latest           newest dispatch id of the role (dispatches.ts:131-145)
  roles/<name>/<dispatchId>/    dispatch folder (§7)
  shots/           screenshots
  admission.lock, *.lock
```

`createRun` writes JSONL headers only for `runs`, `routes` and `agents` (`run-store.ts:103-105`); the others appear on first use. Until `meta.json` exists, `listRuns` briefly reports the folder as corrupt.

## 5. JSONL shapes

Every JSONL file starts with a header line `{"schema":1,"kind":"<kind>"}` (`store.ts:172-185`). A reader skips the header, counts unparseable lines, and fails if the header schema is newer than 1 (`store.ts:205-229`). **Skip a last line that has no trailing newline.**

**`runs.jsonl`** (`RunRecordSchema`, `record.ts:41-74`, loose object):

```
schema:1, runId, dispatchId, name, role, lane|null, backend, rung, attempt (int ≥ 1),
failoverFrom|null, thread|null,
status: "ok"|"failed"|"limit"|"cli-too-old"|"timeout"|"cancelled",
startedAt, endedAt (ISO), secs, exitCode|null, signal|null, cliVersion|null,
tokens: {input, cached, output}, costUsd|null,
changedOwned: string[], violations: string[], gitUnavailable?: boolean,
replyStatus: "complete"|"partial"|"blocked"|"refused"|null, replyWhy|null,   // from the reply's last line "STATUS: x — why" (record.ts:77-84)
threadHeavy: boolean (input ≥ 8,000,000), access: "read-only"|"workspace-write"|"full",
isolated: boolean, images: string[], error: {code, message}|null, replyPath (relative to run dir)
```

Duplicate rows for one dispatch are dropped on read; the first one wins (`run-store.ts:176-190`). Built in `finalize.ts:125-219`.

**`agents.jsonl`** (`run-store.ts:227-239`): `{at, name, role, rung, agent|null, totalTokens, costUsd|null, secs|null, status: "ok"|"failed"|"cancelled", lane?: string|null}`.

**`routes.jsonl`** (`RouteRow`, `route.ts:29-46`): `{at, lane, role, rung, ladder[], source: "route"|"climb", decidedBy: "jev"|"jev-kind"|"lane"|"default", from|null, reason|null, kind|null, difficulty|null, questionSet?, jev?: {pKind, pA, pB, nouls}|null, env?: boolean}`. A lane's last row is its current route (`route.ts:53`). The TUI's CLIMBS section = rows with `source: "climb"`; ROUTES = the last row per lane.

**`outcomes.jsonl`** (`route.ts:71-88`): `{at, lane, questionSet|null, jevProbs|null, source, startRung, finalRung, climbs: [{from, to, reason, env}], landed, start_ok, min_ok_index|null, envCaused}`. The last row per lane wins.

**`jev.jsonl`** (`jev-service.ts:95-113`): `{at, call: "route-v2"|"finding"|"same-defect", lane|null, questionSet, key, stateHash, model|null, requestId|null, usage|null, latencyMs|null, attempts, cached, answers|null, derived|null, used, source, why}`.

**`harness.jsonl`** (`finalize.ts:225-247`): `{at, name, backend, isolated, firstTurnInput}`. Only for fresh threads on claude-code and opencode.

## 6. `state.md` (`domain/state.ts:11-33`)

```
# <title>

HEAD <short sha|none>

Dirty:
- <path> (<owning live role>)          | "- none"

Running:
- <name> · <rung> · thread <id|new> · since HH:MM · roles/<name>/<id>/brief.md   | "- none"

Last check: <text|none>

Next: wait for a, b; then <next>       | "Next: <next>"
```

It is rebuilt under the `state.json` lock from `git status`, the live dispatches and `state.json` (`services/state.ts:39-70`). A new run starts with `next = "plan the milestones"`. `status` returns its last 3 non-blank lines as `stateTail`; the full file is readable through MCP `read_run_file(run, "state.md")`.

## 7. Dispatch folder `roles/<name>/<dispatchId>/` (`dispatch-dir.ts:21-40`)

| File | Writer / when | Content |
|---|---|---|
| `brief.md` | admission | the brief |
| `spec.json` | admission, 0600 | `{schema:1, backend, dispatchDir, cmd, args, env (overrides + PWD), cwd, stdinPath, idleMs, wallMs, killGraceMs, graceAfterFinalMs, pollMs}` |
| `collect` | admission, before admit.json | empty marker: a `wait` still has to hand this record back |
| `admit.json` | admission, last | `{schema:1, runId, dispatchId, name, role, lane, owns[], rung, backend, thread, attempt, failoverFrom, failoverOf?, access, isolated, cliVersion, admittedAt, repo, before: {path: fingerprint}}` |
| `launch.json` | launcher | `{schema:1, supervisorPid, supervisorStartTime}` |
| `supervisor.lock` | supervisor (whole life) | `{pid, startTime}` |
| `supervisor.log` | supervisor stdout/stderr | text |
| `proc.json` | supervisor, after worker spawn | `{schema:1, pid, pgid, startTime, supervisorPid, supervisorStartTime, startedAt}` |
| `events.jsonl` | worker stdout | the backend CLI's stream JSON; **no catherd header**; decoding is per backend |
| `stderr` | worker stderr | text |
| `reply.md` | Codex (`-o`) or finalize | the role's reply; last line should be `STATUS: …` |
| `cancel` | cancel request | ISO timestamp |
| `exit.json` | supervisor at the end | `{schema:1, code, signal, reason: "exited"\|"after-final"\|"idle-timeout"\|"wall-timeout"\|"cancelled"\|"lost", endedAt}` |
| `claim` | first finalizer (exclusive create) | `{pid, startTime}` |
| `collect.lease` | the `wait`/`cancel` handing the record back | `{pid, startTime}` |

## 8. What CatHouse may watch

**As refresh triggers only** (read-only), the same set the TUI uses as its change stamp (`tui/effects.ts:145-167`):
- `<data>/repos/*/runs/*`: new runs.
- In each run: `runs.jsonl`, `routes.jsonl`, `jev.jsonl`, `agents.jsonl`, `outcomes.jsonl`, `ledger.md`, `state.md`, and `roles/**` (`admit.json` appearing = new dispatch; `exit.json` = it ended).
- `<config>/profiles/*.json`, `config.json`, `projects.json`: profile changes.

**Ignore:** `*.tmp`, `*.lock`, `*.reclaim`, `collect.lease*`, `claim`.

**Do not compute these yourself; poll `status --json` (or MCP `status`):**
- Liveness and elapsed time. `dispatchState` checks pid + start time (`/proc` on Linux, `ps -o lstart=` on macOS) with a 30 s start grace (`dispatches.ts:100-112`, `proc.ts:5-92`). A dispatch can go from "starting" to "finished" with no file change.
- Budget and live tokens (parsed from `events.jsonl` per adapter; `services/budget.ts:11-26`).
- Resolved profiles, validation and enforcement (`profile show/validate/list --json`).

The TUI polls the run list every 2 s and an open run every 1 s (`tui/providers/data.tsx:65`, `views/runs.tsx:15`). CatHouse copies that.
