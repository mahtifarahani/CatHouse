# catherd 1.3.0 → 1.4.0: what changed for CatHouse

CatHouse now pins **catherd-cli 1.4.0** and plugin **catherd@catherd 1.4.0** (tag `v1.4.0`, commit `804682f`). Citations in this doc point into the catherd repo at `804682f`. [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) (cited at `f1422f8`) and [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) (cited at `3cee546`) are still valid. This doc only adds the 1.4.0 delta.

```bash
git clone https://github.com/47vigen/catherd.git && cd catherd && git checkout v1.4.0
```

Upstream sources: `CHANGELOG.md` (1.4.0). `MIGRATION.md` has no "From 1.3 to 1.4" section; the release is described as additive.

## 1. Summary: one contract change, the orchestration host

1.4 lets native Codex orchestrate catherd alongside Claude Code. Most of that is new surface CatHouse does not use. One change does reach CatHouse:

- **Profiles resolve architect/verifier defaults from the host.** A profile that omits `roles.architect.rungs` or `roles.verifier.rungs` now takes them from the orchestration host: Claude Code keeps the built-in native Claude rungs, Codex gets `codex:gpt-6.1-sol#high` / `#low`, and an **unknown** host throws `E_CONFIG_INVALID: roles.<role>.rungs needs an orchestration host` (`src/domain/profile.ts:278`). 1.4's `init` and `profile new` write profiles without those rungs (`hostDefaultsDoc`, `src/domain/profile.ts:257`). Profiles written by 1.3 or earlier keep their explicit rungs and are unaffected.
- **How catherd decides the host** (`src/infra/host-context.ts`): the MCP client's name (`codex-mcp-client` or `claude-code`, `src/entry/mcp/server.ts:92`), the launcher variable `CATHERD_ORCHESTRATION_HOST=codex|claude-code` (`host-context.ts:14`), Claude or Codex session variables, or the CLI flag `--host auto|codex|claude-code` (`src/entry/host-arg.ts:5`). Conflicting evidence yields host `unknown` with a `conflict` message.
- **CatHouse's problem:** the gateway's MCP client is named `cathouse`, and CatHouse strips `CLAUDE_CODE_*` from every process it starts. So catherd saw host `unknown`, and on a profile created by 1.4 `profile_get`, `profile_validate`, `status` (budget) and `doctor` would fail.
- **Fix:** `processEnv()` (`packages/extension/src/gateway/env.ts`) now sets `CATHERD_ORCHESTRATION_HOST=claude-code` for every process CatHouse spawns (gateway MCP, CLI, installers and the Agent SDK orchestrator session). That is catherd's documented launcher discriminator. It never invents a session id, and it matches the orchestrator session CatHouse runs, which is Claude Code. A unit test (`env.test.ts`) pins it. catherd scrubs the variable from its own workers (`src/infra/env.ts:10`).

Also from host-awareness: on a non-Claude host, a `claude:` rung is a profile error (`nativeClaudeIssue`, `src/domain/profile-rules.ts:337`). With the host set, CatHouse never hits it.

## 2. Additive shape changes (no CatHouse change needed)

CatHouse's zod schemas are loose objects, so new fields pass through.

| Surface | 1.4 change | CatHouse |
|---|---|---|
| MCP tools | Still 26, the same names. | allowlist and forbidden list (ADR 0005) unchanged |
| `status` | Top level gains `host` and `queue` (`src/services/summary.ts:138`); each `RunSummary` gains `delivery[]` (push delivery state per dispatch, `summary.ts:73`) | ignored for now |
| `profile_get` | Optional `raw: true` returns the stored document instead of the resolved profile (`src/entry/mcp/setup-tools.ts:79`) | not used; CatHouse shows the resolved profile |
| `doctor --json` | Top level gains `host`, `queue`, `push`. The `push` row is gone unless `--test-push` is passed (`src/entry/doctor-command.ts:40`). On a Codex host there is a `push-capability` row (`src/services/doctor.ts:271`). The `plugin` and `agents` rows become `skip` "not required" when no Claude role is used off Claude Code (`doctor.ts:223`). Fixes name `--host` when it matters. | rows keep the same shape and states; Setup shows them as before |
| `runs` CLI | `catherd runs retry-push <run> <name> --event <id> --acknowledge-possible-duplicate` (`src/entry/runs-command.ts:289`); `status` prints the host and delivery lines | not used (retrying a push is the orchestrator's call) |
| Profiles | Doctor rows for other profiles' errors drop from `fail` to `warn`; only the active (or repo-bound) profile can block readiness | Setup readiness follows doctor's `ready` |

## 3. Codex as orchestrator: out of scope

1.4 ships a native Codex plugin manifest (`plugin/.codex-plugin/plugin.json`, `.mcp-codex.json` with `CATHERD_ORCHESTRATION_HOST=codex`), a durable Codex queue for completion delivery, and optional Claude dependencies. CatHouse's orchestrator is the Claude Agent SDK session, so it stays a Claude Code host. Supporting a Codex-hosted orchestrator in CatHouse would be a separate design decision (an ADR), not part of this pin.

## 4. Upgrading a machine that ran 1.3

```bash
bunx catherd-cli@1.4.0 init --no-input --plain </dev/null
claude plugin marketplace update catherd && claude plugin update catherd@catherd
```

Setup does the same with **Install and set up catherd** ("found 1.3.0, CatHouse needs 1.4.0") and **Update plugin** (`.claude-plugin/marketplace.json` has `"ref": "v1.4.0"`). Start a new orchestrator session afterwards. After `init` and before the plugin update, doctor reports the plugin as stale and is not ready.

This machine (2026-10-02): `init` kept the existing `default` profile (explicit rungs), plugin updated 1.3.0 → 1.4.0, doctor **ready** with the usual warnings (failover stand-in to confirm, Jev off, `grok`/`agy` missing and unused).

## 5. Verification

- Biome, typecheck, 97 unit tests (2 new for `processEnv`), production build.
- Live contract 7/7 against 1.4.0 (`CATHOUSE_CONTRACT=1 CATHOUSE_RECORD=1 pnpm test`), fixtures in `packages/compat/fixtures/1.4.0/`.
- e2e 5/5 in VS Code 1.139 (`CATHOUSE_EXPECT_READY=1 CATHOUSE_E2E_WORKSPACE=~/Projects/sc-weather pnpm test:e2e`).

## 6. Not adopted yet

- Showing `status.host`, `status.queue` and each run's `delivery[]` in Runs (an "unread / collected" badge per role).
- Using `profile_get raw` to show which fields a profile leaves to host defaults.
- Everything still open in [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) §5.

## Traps

- Record CLI fixtures from a clean env and **with the host set**: `env -u CLAUDECODE -u CLAUDE_CODE_… CATHERD_ORCHESTRATION_HOST=claude-code catherd doctor --json`. Without it a 1.4-created profile fails and the fixture lies. The not-ready doctor fixture used `HOME=<empty dir> CATHERD_NO_SYNC=1` (exit 3). Redact home paths to `/Users/dev`, then `node_modules/.bin/biome format --write packages/compat/fixtures/1.4.0`.
- Don't add `--host` to individual CLI calls: the env variable covers the CLI, the MCP server and catherd's own subprocesses in one place, and a flag that disagrees with the env yields host `unknown` with a conflict.
- Don't strip `CATHERD_ORCHESTRATION_HOST` in `STRIPPED_PREFIXES`: it is CatHouse's own declaration, not a leaked host variable.
