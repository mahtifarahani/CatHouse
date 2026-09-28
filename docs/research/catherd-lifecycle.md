# catherd 1.0.0: run lifecycle

Citations are relative to the catherd repo at commit `b257da7`. This explains what happens behind the MCP tools, so CatHouse can display it correctly and avoid interfering.

## 1. Start (`run-service.ts:23-42`)

`run_start(repo, title, a_lines)` resolves the git toplevel (`E_IO_PATH` outside git), calls `createRun` (writes the run folder, `meta.json` last), then `refreshState` (failures only produce hints). It returns `{run, dir}`. **CatHouse captures `run` from this tool result in the orchestrator's stream** to link the run to its Claude session.

## 2. Dispatch (`dispatch-service.ts:152-168`)

`dispatch` = admit → launch → watch. It refreshes `state.md` and returns `{dispatched: {name, role, rung, dispatchId, admittedAt}, hints}` right away (about 1 s).

**Admission** (`admission.ts:112-253`):
1. Checks ids. Refuses when the role is off (`E_ADMIT_RUNG`), the rung is native `claude:` (`E_ADMIT_RUNG`, with a hint to use `Agent(subagent_type)`), or the rung is not on the role's ladder or stand-ins.
2. `readyAdapter` probes the backend; a ready probe is cached 10 min (`backends.ts:7-31`). Checks the thread (`E_ADMIT_THREAD`) and the lane's `Owns:` (`E_LANE_INVALID`).
3. Adapter `prepare` (60 s cap), then `plan`.
4. Finalizes any finished dispatch that has no record yet.
5. Under `admission.lock`: `E_ADMIT_DUPLICATE` (same name pending), `E_ADMIT_OVERLAP` (owned paths overlap a pending dispatch), `E_RUN_BUDGET` (spent fraction ≥ 1).
6. Writes `brief.md`, `spec.json`, `collect`, then `admit.json`; updates `roles/<name>/latest`.

**Launch** (`launch.ts:12-25`): starts `process.execPath src/entry/supervise-bin.ts <spec.json>` detached (stdin ignored, output to `supervisor.log`, catherd secrets stripped from env), then `unref`. It writes `launch.json`; a failed spawn writes `exit.json` with reason `lost`.

**Supervisor** (`supervisor.ts:112-257`):
1. Takes `supervisor.lock`. If a live supervisor holds it, it exits.
2. Builds the worker env from its own env plus `spec.json` overrides. Credentials are never written to disk.
3. Starts the worker CLI in its own process group: stdin from `brief.md`, stdout → `events.jsonl`, stderr → `stderr`. Writes `proc.json`.
4. Polls every 250 ms: `cancel` file → `cancelled`; `wallMs` passed → `wall-timeout`; final event seen + `graceAfterFinalMs` (claude-code: 30 s) → `after-final`; idle for `idleMs` with no open tool call → `idle-timeout`.
5. Stop: adapter `interrupt` (opencode), SIGTERM to the group, 10 s grace, SIGKILL.
6. Writes `exit.json`, exits 0.

**Liveness per dispatch** (`dispatches.ts:100-112`):
- `exit.json` present → `finished`.
- no `proc.json` and a live `supervisor.lock` holder → `starting`.
- `proc.json` → `running` while the supervisor or worker is alive (pid + start time), else `finished`.
- `launch.json` only → `starting` while the supervisor is alive.
- nothing yet → `starting` for 30 s after `admittedAt`, then `finished`.

**Live roles** = dispatches with no record in `runs.jsonl` whose state is not `finished` (`dispatches.ts:117-129`). They feed `state.md` "Running:", `status.live`, budget spend and admission.

**Gap:** a dispatch that finished but has no record yet is in neither `live` nor `records`. This happens if the MCP server died before finalizing. The next reconcile, `wait` or admission records it. CatHouse should not assume records appear instantly.

## 3. Finalize (`finalize.ts:259-322`)

- One finalizer only: an in-process map plus an exclusive `claim` file across processes. A stale claim is taken over when its owner is dead or it is older than 45 s.
- `compute` (`finalize.ts:125-219`): reads `exit.json` (or infers `cancelled`/`lost`), runs the adapter's `finalize` and `settle` (opencode asks its session API; 20 s cap), writes `reply.md`, snapshots git to compute `changedOwned` and `violations`, and parses `replyStatus` from the reply's last line.
- `appendRecord` dedups by `dispatchId` under the `runs.jsonl` lock, then `harness.jsonl` is written.
- **Hints per record** (`domain/hints.ts:4-22`): `limit:`, `cli-too-old:`, `failed: read <dir>/stderr`, `git-unavailable:`, `climb: refused|blocked|unchanged`, `violation:`, `thread-heavy`.

## 4. Wait (`dispatch-service.ts:212-304`)

- Targets uncollected dispatches (a `collect` mark, or a lease whose owner died), optionally filtered by `names`.
- Each poll finalizes finished targets, then `tryCollect` hands each record out through the lease, to **one caller only**. It returns after the first record, or after all of them with `all: true`. Progress every `tickMs`.
- Returns `{records (sorted by endedAt), started (failover stand-ins), running (uncollected names not returned), hints}`.
- Nothing to wait for → returns immediately with a hint.
- Aborted → puts back what it collected. Leases end only after `state.md` is refreshed, so a crash lets the next `wait` collect the same record again.

The MCP server's own watchers finalize dispatches as they end (`dispatch-service.ts:134-146`), but only `wait` and `cancel` **collect**.

## 5. Cancel (`dispatch-service.ts:461-479`)

1. Finds the live dispatch by name, else `E_RUN_NOT_LIVE`.
2. Writes the `cancel` file.
3. `stopOrphan`: if the supervisor is dead but the worker is alive, it signals the worker's group (SIGTERM, then SIGKILL, guarded by pid and start time) and writes `exit.json` with reason `cancelled`.
4. Waits for the dispatch to finish, finalizes it, and **collects the record itself**. If a `wait` got there first, it adds the hint "a wait in flight also returned this record".

CLI twin: `catherd runs cancel <run> <name>`. **CatHouse consequence:** after a UI cancel, tell the orchestrator session (a `streamInput` note), because its `wait` will not return that record.

## 6. Reconcile (`reconcile.ts:56-101`)

Runs only when `catherd mcp` starts. For every run it scrubs old world-readable `spec.json` files, finalizes finished dispatches with no record, and watches live ones. An unreadable run becomes a warning. `doctor` also starts `catherd mcp`, so it reconciles too.

## 7. Budget

- **Spend** (`services/budget.ts:32-43`): minutes = wall-clock time since `createdAt`; tokens = records' input+output + agents' `totalTokens` + live tokens parsed from `events.jsonl`; usd = records + agents.
- `budgetStatus` → `{fraction, minutes?, tokens?, usd?}` or `null` when no cap (`domain/budget.ts:25-37`).
- Fraction ≥ 1 refuses admission, including stand-ins. At ≥ 0.8, `route` switches to the `cost` objective.
- TUI colours: green < 80 %, amber < 100 %, red at 100 %.

## 8. Failover (`dispatch-service.ts:189-201,343-414`)

- Only when `wait` collects a record with status `limit`.
- Stand-in: `profile.failover[rung]`, else the adapter's own choice (opencode maps `opencode-go/X` → `opencode/X` when listed).
- A native `claude:` stand-in → a hint tells the orchestrator to run it as an Agent; no dispatch.
- Otherwise it is admitted again with `failoverFrom`/`failoverOf` on a fresh thread, launched, and returned in `started`; its name stays in `running`.
- The run pauses (`next = "paused: …"`) when there is no stand-in, the stand-in is refused, or a second limit hits.

## 9. Status summary (`services/summary.ts`)

See the `RunSummary` shape in `catherd-mcp-contract.md` §6. `status(run?)` returns `{version, runs, warnings}`. Without a run id: every run with a live role, else only the newest. `runs_summary` gives per-rung stats and harness cost. `result(run, name)` gives the capped reply and record.
