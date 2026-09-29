# catherd 1.0.0 → 1.2.0: what changed for CatHouse

CatHouse now pins **catherd-cli 1.2.0** and plugin **catherd@catherd 1.2.0** (tag `v1.2.0`, commit `3cee546`). Citations in this doc point into the catherd repo at `3cee546`. The other `docs/research/catherd-*.md` docs describe the 1.0.0 baseline at `b257da7`. They stay valid except where this doc or an inline "1.1+" note says otherwise.

```bash
git clone https://github.com/47vigen/catherd.git && cd catherd && git checkout v1.2.0
```

Upstream sources for the whole delta: `CHANGELOG.md` (1.1.0, 1.1.1, 1.2.0) and `MIGRATION.md` ("From 1.0 to 1.1", "From 1.1 to 1.2").

## 1. Push replaces `wait` (1.1)

- `wait` and `CATHERD_TICK_MS` are gone. `dispatch` returns at once and the orchestrator ends its turn. When a role finishes, the MCP server that owns the run writes one frame to the owning Claude Code session's peer inbox (`src/infra/peer-inbox.ts:40`, `sendToInbox`). The session sees `<cross-session-message from-name="catherd">` and starts a new turn. The notifier is described at `src/services/notifier.ts:18-27` and started in `src/entry/mcp/server.ts:80`.
- The server learns its session from `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_HOST_SESSION_ID`, `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN` (`src/infra/claude-session.ts:12-17`). A server without them owns nothing and sends nothing.
- **Ownership:** `dispatch` and `peek` on a run make the caller's session its owner (`claim`, `src/services/dispatch-service.ts:210`; `peek` claims in `src/services/peek.ts:93`). Only the owner is notified, and only the owner's server fails roles over on a usage limit.
- **Read state:** a finished record is *unread* until `result(run, name)` reads it (`src/entry/mcp/run-tools.ts:69`: "Reading a finished record marks it read"). MCP `cancel` marks the record it returns read; the CLI `catherd runs cancel` leaves it unread, so catherd announces it to the owner (`src/services/dispatch-service.ts:589-594`).
- **Verified in the Agent SDK:** `docs/spikes/catherd-1.2.md`. The SDK stream of a pushed turn is `command_lifecycle started` → `system/init` → assistant … → `result` → `command_lifecycle completed`, and the message text itself is not in the stream.

**CatHouse consequences:**

| Before (1.0) | Now (1.2) |
|---|---|
| Gateway allowed `result` (role reply) and `cancel` | Both forbidden: they mark records read, so the orchestrator would never be told. Reply: `read_run_file(run, record.replyPath)`. Cancel: CLI `catherd runs cancel <run> <name>` (`src/entry/runs-command.ts:239-253`, no `--json`; prints `<mark> <name> <status>` and one hint per line). |
| — | `peek` forbidden too: it would make the gateway's server the run's owner. |
| `MCP_TOOL_TIMEOUT` sized for a long `wait` | Kept as a generous ceiling. No catherd tool blocks now. |
| Resume prompt: "collect roles with wait" | "call `peek(run)`, read unread records with `result`". |
| Cancel note: "its record will not come back from wait" | "catherd announces its record as usual; read it with result". |
| Every turn started by CatHouse | Pushed turns start by themselves: new `inbound` session event; `turnActive` follows it. |

## 2. New and changed MCP tools

- 1.0: 21 tools. 1.1: 25 (`wait` removed; `peek`, `gate_check`, `gate_pass`, `park`, `answer` added). 1.2: 26 (`catalog_sync`, `src/entry/mcp/setup-tools.ts:54`). The list is asserted in `test/entry/mcp.test.ts:16`.
- `peek`, `park`, `answer`, `gate_check`, `gate_pass` are orchestrator tools (the protocol loop). CatHouse lists them as forbidden.
- `catalog_sync {force}` is on the gateway allowlist (it only refreshes catherd's own source cache). CatHouse does not call it yet: every `catherd mcp` start, the gateway's included, runs a background sync at most every 12 h (`src/entry/mcp/server.ts:82`). `CATHERD_NO_SYNC=1` turns that off.
- `status` stays read-only (`src/entry/mcp/run-tools.ts:55`). `read_run_file` is unchanged (`:46`).

## 3. JSON shapes CatHouse reads

| Output | Change | CatHouse |
|---|---|---|
| `doctor --json` checks | `state` gains `"info"` (`src/services/doctor-checks.ts:13`). New rows: `sources`, `push`, `mcp`, `access:<backend>`; `access:full` and `access:advisory` are `info` by default. | `DoctorCheckSchema` accepts `info`; the evaluator shows every `info` row as info. **Without this, Setup's readiness check fails on 1.2 with E_CONTRACT.** |
| `status --json`, `status` MCP (`RunSummary`) | New `questions[{milestone, question, …}]`, `verifier {at, item, carried, commit?, milestone?} \| null`, `session {sessionId, hostSessionId, name, live} \| null`, `continuedIn`, `harness` (`src/services/summary.ts:26,31,33,45`). | Parsed and shown in run detail (parked questions, verifier step). |
| `runs list --json` rows | New `session` and `continuedIn` (`src/entry/runs-command.ts:173-174`). The human output groups runs by session; `--json` stays a flat list. | Runs list shows "session <name> (live)" and "continued in <name>". `sessionId` is not passed to the webview. |
| `profile show --json` `standIns[]` | New `note` ("scores borrowed from X"); a stand-in without its own scores has `inferred: true` and `via`. | `note` is shown in Profiles → Failover. |
| `catalog_query` rung `scores` | Each dimension is `{value, benchmark, confidence, source, date, from?}`. Confidence is one of `verified`, `measured`, `calibrated`, `adjacent`, `secondary`, `inferred`. New dimensions: `agentic`, `steer`, `frontend`. | A rung counts as *scored* only with at least one value whose confidence is not `inferred`. |
| `profile_set` | A patch that fixes at least one error and adds none saves even when errors remain (`saved: true` with `errors`). | Unchanged mapping: `saved` decides; remaining errors come back through `profile_validate`. |

## 4. Profiles and routing (1.2)

- An unscored rung is a **warning** now. It takes its nearest stand-in's values as `inferred`, and `validate`/`doctor` list it as a "stand-in to confirm". So the Profiles page no longer forces a treat-like when adding an unscored rung: **Add (let catherd infer)** adds it without one, and picking a stand-in still stages a treat-like.
- `catherd catalog treat-like --suggest <rung>`, `--clear <rung>` and `--reset` are new (not used by CatHouse yet).
- `roles.<role>.network` (1.1) is a new profile key. `RoleConfigSchema` does not model it (zod drops it on parse), and `profilePatch()` only ever sends `enabled`, `access`, `rungs` and `defaultRung` per role. A save from CatHouse therefore leaves `network` as it is on disk. There is no UI control for it yet.

## 5. Install and launch

- The marketplace fetches the plugin over **HTTPS** (`.claude-plugin/marketplace.json`: `"url": "https://github.com/47vigen/catherd.git"`, `"ref": "v1.2.0"`). The 1.0 SSH problem (`catherd-known-issues.md` item 1) is fixed upstream. CatHouse still passes the `GIT_CONFIG_*` HTTPS rewrite, which is harmless.
- The plugin starts its server through `plugin/bin/catherd-mcp`. It runs the global `catherd` when that is the plugin's version, else `bunx catherd-cli@<version>` with the bunx cache in `~/.cache/catherd/bunx`.
- `catherd init` installs the global command at its own version (`bun add -g catherd-cli@<version>`; `--no-global` skips it). CatHouse's `init-catherd` action (`bunx catherd-cli@1.2.0 init --no-input --plain`) therefore also installs `catherd` globally. Detection still uses `bunx --no-install catherd-cli@1.2.0 --version`.
- Piped `init` reads four lines now (Jev key, Artificial Analysis key, profile, replace?). CatHouse uses `--no-input`, which asks nothing and keeps an existing profile ("profile default kept as it was").
- `init` syncs the public model sources (network access; about 10 s here) and can take minutes on a cold machine.

## 6. Upgrading a machine that ran 1.0

```bash
bunx catherd-cli@1.2.0 init --no-input --plain </dev/null
claude plugin marketplace update catherd && claude plugin update catherd@catherd
```

Setup does the same with its **Install and set up catherd** and **Update plugin** buttons. 1.2 reads 1.0's profiles and runs as they are. A 1.0 profile keeps its own failover map. `validate` then warns about a downgrading stand-in (`failover.codex:gpt-6-sol#high: downgrade: …`), which CatHouse shows as a warning. Start a new orchestrator session afterwards: the plugin's skills changed.

## 7. Not adopted yet (parity backlog)

- TUI Runs grouped by session, and a milestone's digest (`<run>/digests/<milestone>.md`, readable through `read_run_file`).
- TUI Profiles `r` (sync sources, per-source age and error), `i` (a rung's values with confidence and source, plus run evidence), `t` (treat-like picker with the three nearest stand-ins).
- `route` provenance (each threshold with the value, confidence and source used).
- The `roles.<role>.network` switch.
