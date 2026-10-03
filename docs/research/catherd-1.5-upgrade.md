# catherd 1.4.0 → 1.5.0: what changed for CatHouse

CatHouse now pins **catherd-cli 1.5.0** and plugin **catherd@catherd 1.5.0** (tag `v1.5.0`, commit `2061e6e`; `packages/compat`, adapter label `v1_5`). Citations in this doc point into the catherd repo at `2061e6e`. The 1.4, 1.3 and 1.2 upgrade docs ([`catherd-1.4-upgrade.md`](catherd-1.4-upgrade.md) at `804682f`, [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) at `f1422f8`, [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) at `3cee546`) are still valid. This doc only adds the 1.5.0 delta.

```bash
git clone https://github.com/47vigen/catherd.git && cd catherd && git checkout v1.5.0
```

Upstream sources: `CHANGELOG.md` (1.5.0) and `MIGRATION.md` §"From 1.4 to 1.5". The release is large (283 files), but almost all of it is orchestration behaviour that runs inside catherd and the orchestrator session, not in CatHouse.

## 1. Summary: no breaking contract change

- **Every shape CatHouse parses is unchanged or grew optional fields.** The gateway's zod schemas are loose objects, and the live contract (7/7) and all fixtures decode against 1.5.0 without schema changes.
- **Minimum versions are unchanged:** Bun 1.4.0, Codex worker 0.157.0 (`src/adapters/codex/index.ts:27`), Claude Code 2.1.282 (`src/adapters/claude-code/index.ts:35`). CatHouse's own Codex host minimum (0.159.2) stays.
- **The plugin changed:** the native Claude agent files now forbid the coordinator tools. After `init`, doctor shows the plugin as `stale` until `claude plugin update catherd@catherd`. Upstream also says the `Claude agents` row can show `stale` with the fix `catherd profile use <profile>`. Setup shows both rows and their fixes from doctor.

## 2. Roles never own a run: `E_ROLE_SCOPE`

catherd sets `CATHERD_ROLE=<run>/<name>` in every role's environment (`src/domain/role-scope.ts:8`). A process carrying it, or whose `TMPDIR` is a role's scratch folder `…/runs/<run>/scratch/<name>` (`role-scope.ts:36`), is treated as a role. Its MCP server refuses the coordinator tools (`COORDINATOR_TOOLS`, `role-scope.ts:57`, enforced in `src/entry/mcp/server.ts:178`) with `E_ROLE_SCOPE`. `profile_set` is in that list.

- **CatHouse's exposure:** CatHouse calls `profile_set`. If VS Code were started from a role's shell, the gateway would inherit `CATHERD_ROLE` and every profile save would fail. `processEnv()` now strips `CATHERD_ROLE` (`packages/extension/src/gateway/env.ts`, unit-tested in `env.test.ts`). A role's `TMPDIR` is not stripped. That case needs VS Code itself to run inside a role's scratch folder, and changing `TMPDIR` for every child process carries more risk.
- **ADR 0005's forbidden list** (`ORCHESTRATOR_TOOLS` in `packages/extension/src/gateway/mcp-tools.ts`) now also names the 1.5 coordinator tools: `test_push`, `run_pin`, `lane_set`, `owns_add`, `workspace_start`, `workspace_contract`, `workspace_child_start`, `workspace_budget`, `workspace_pause`, `workspace_resume`. The allowlist is unchanged. The existing test proves that none of them is allowed.

## 3. Additive shape changes

| Surface | 1.5 change | CatHouse |
|---|---|---|
| MCP tools | 26 → 38. New: `test_push` (`src/entry/mcp/push-tools.ts:8`), `run_pin` (`run-tools.ts:39`), `lane_set`/`owns_add` (`lane-tools.ts:40,55`), and the workspace tools `workspace_inspect`, `workspace_start`, `workspace_contract`, `workspace_child_start`, `workspace_pause`, `workspace_resume`, `workspace_budget`, `workspace_status` (`workspace-tools.ts:30-134`). Coordinator tools' descriptions start "Orchestrator only". | coordinator ones forbidden (§2); `workspace_status`/`workspace_inspect` are read-only and not used yet |
| `status` | Top level gains `paused[]` (machine and workspace pauses, `src/services/summary.ts:161`); without a run it now shows live runs, else runs **waiting for their orchestrator**, else the newest, and hides superseded runs (`summary.ts:155-190`) | parsed; pause banner not shown yet (§7) |
| `RunSummary` | `waiting` (`{ since, seconds, stalled, unread, until }`, `summary.ts:33`, `src/services/orchestrator-wait.ts:16`), `supersededBy` (`summary.ts:37`), `pinChanges[]` (each also pushed into `warnings` as `pinned: …`, `summary.ts:77`); `verifier` gains `secs`, `open`, `closedBy` (`src/services/verifier-step.ts:10`) | `warnings` already shown in run detail, so pin drift appears there |
| `runs list --json` | Each row gains `waiting` and `supersededBy` (`src/entry/runs-command.ts:214-215`) | **adopted:** Runs rows show "N results waiting for the orchestrator" (with "stalled") and "superseded by <id>" |
| `runs` CLI | `runs clean [<id>]`, `runs supersede <id> --by <id>`, `runs pin <id>`; `pause`/`resume --machine|--workspace` | not used (orchestrator or owner decisions) |
| Profiles | `roles.<role>.timeouts.{idleMin,wallMin}` (`src/domain/profile.ts:48`), accepted by `profile_set` patches | passes through untouched; no editor field yet |
| `doctor --json` | New rows: `role-mcp:<profile>:<backend>` (info, `src/services/doctor.ts:201`), `caches` (`doctor.ts:332`), `isolation:<backend>` (warn), `credentials`; `--docker` adds Docker probes and `--thread` pairs with `--test-push`. States are still `ok/warn/fail/skip/info`. | Setup shows them as before |
| MCP handshake | Only one MCP server per machine runs the boot sync and reconcile (`server.ts:232`); the doctor's handshake server skips sync (`src/entry/mcp/handshake.ts:23`) | none: CatHouse's long-lived per-repo client (ADR 0006) may simply not lead the boot |

## 4. Codex host: delivery from where a role ends

When a role exits, its supervisor now queues the result to a Codex owner's thread with `codex queue --remote unix://…` under the same receipt as the MCP server's push (`src/services/end-push.ts:123`). Results therefore reach the Codex thread even after Codex stopped that thread's MCP server. This uses the same Unix daemon endpoint CatHouse already connects to (ADR 0009), so CatHouse needs no change. The skill's tmux advice targets terminal users; CatHouse's managed daemon outlives the chat panel. `wait` stays gone (1.4 had none, and 1.5 removed an unreleased bounded `wait`). The live Codex push/resume check from ADR 0009 is still pending.

## 5. Upgrading a machine that ran 1.4

```bash
bunx catherd-cli@1.5.0 init --no-input --plain </dev/null
claude plugin marketplace update catherd && claude plugin update catherd@catherd
```

On a Codex host, reinstall the native plugin from the marketplace (Setup's Codex plugin action) and restart the daemon. Start a new orchestrator session afterwards. In Setup, **Install and set up catherd** ("found 1.4.0, CatHouse needs 1.5.0") then **Update plugin** do the same.

This machine (2026-10-03): global `catherd` 1.4.0 → 1.5.0 and plugin 1.4.0 → 1.5.0. Doctor reported **ready** with warnings: writer has full access, `grok` is missing for a failover stand-in, the Cursor sandbox blocks probes, and Cursor/grok isolation is weak. Between `init` and the plugin update, doctor was not ready (`plugin: stale`), as expected.

## 6. Verification

- Biome, typecheck, 144 unit tests (new: runs-list `waiting`/`supersededBy` mapping, `CATHERD_ROLE` stripping), production build.
- Live contract 7/7 against 1.5.0. Every fixture in `packages/compat/fixtures/1.5.0/` was re-recorded except `gw-run-detail.json` (see Traps).
- e2e 5/5 in VS Code (`CATHOUSE_EXPECT_READY=1 CATHOUSE_E2E_WORKSPACE=~/Projects/sc-weather pnpm test:e2e`).

## 7. Not adopted yet

- A pause banner in Runs/Chat from `status.paused` (when paused, dispatch is refused with `E_ADMIT_PAUSED`; the orchestrator reports it in chat today).
- The verifier step's `open`/`closedBy`/age in run detail.
- Workspaces (`workspace_status`/`workspace_inspect`, `catherd workspace …`).
- A per-role timeouts field in Profile.
- Everything still open in [`catherd-1.4-upgrade.md`](catherd-1.4-upgrade.md) §6 and [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) §5.

## Traps

- **Record fixtures in an isolated home.** The MCP contract test reads whatever profile the environment points to. Recorded on a machine with a custom active profile, `mcp-profile_get.json` broke the gateway test that expects the shipped `default`. Use `CATHERD_HOME`, `CLAUDE_CONFIG_DIR` and `CATHERD_CLAUDE_AGENTS_DIR` in temp dirs, run `catherd init --no-input --plain` there, and set `CATHERD_NO_SYNC=1 CATHERD_ORCHESTRATION_HOST=claude-code`, with every `CLAUDECODE`/`CLAUDE_CODE_*` variable unset. Then run `CATHOUSE_CONTRACT=1 CATHOUSE_RECORD=1 pnpm --filter ./packages/extension exec vitest run src/gateway/contract.test.ts` and the CLI commands (`profile list|show default`, `runs list`, `status`, `runs show nope`, `doctor`, all `--json`). `doctor-ready.json` must come from a ready machine. Redact home and temp paths to `/Users/dev`, then run `node_modules/.bin/biome format --write packages/compat/fixtures/1.5.0`.
- **Don't build the unset list with `$(env | …)` inline in zsh.** The expanded `-u` list breaks the command ("command too long") and leaves the redirected fixture files empty. Use a bash script that `unset`s in a loop.
- Stand-in data in `profile-show-default.json` reflects the shipped catalog, not the contract. 1.5 infers the Luna stand-in (`via gpt-5.6-luna#high`), so expectations that pin catalog values move with every release.
- Don't add `TMPDIR` to `STRIPPED_PREFIXES` to defend against role detection. It would change every child's temp dir.
