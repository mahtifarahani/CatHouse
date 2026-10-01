# catherd 1.2.0 → 1.3.0: what changed for CatHouse

CatHouse now pins **catherd-cli 1.3.0** and plugin **catherd@catherd 1.3.0** (tag `v1.3.0`, commit `f1422f8`). Citations in this doc point into the catherd repo at `f1422f8`. [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) (1.0 → 1.2, cited at `3cee546`) is still valid. This doc only adds the 1.2.1 and 1.3.0 delta.

```bash
git clone https://github.com/47vigen/catherd.git && cd catherd && git checkout v1.3.0
```

Upstream sources: `CHANGELOG.md` (1.2.1, 1.3.0) and `MIGRATION.md` ("From 1.2 to 1.3").

## 1. Summary: no contract change

1.3 is additive for CatHouse. Nothing CatHouse calls or parses changed shape:

- **MCP tools:** still 26, the same list (`test/entry/mcp.test.ts:46-49`). `src/entry/mcp/` has no diff between `v1.2.0` and `v1.3.0`. The gateway allowlist and the forbidden list (ADR 0005) are unchanged.
- **`status` / `RunSummary`, `runs list --json`:** no diff in `src/services/summary.ts` or `src/entry/runs-command.ts`.
- **`doctor --json`:** the same row shape and states (`ok | warn | fail | skip | info`). There are new rows only (§2).
- **Profiles:** 1.3 reads 1.2's profiles, runs, credentials and catalog as they are. `init` asks nothing new (MIGRATION.md).

So the gateway schemas, the adapter (`v1_3`, renamed from `v1_2` only to match) and the UI code are unchanged. The work was the pin, fixtures re-recorded against the real 1.3.0, test expectations, one UI string and the docs.

## 2. New doctor rows and how Setup shows them

| Row | When | State | CatHouse |
|---|---|---|---|
| `backend:cursor`, `backend:grok`, `backend:antigravity` | always, one per adapter (`src/domain/ids.ts:15`) | `skip` when missing and no profile uses it, `warn` if only a failover stand-in uses it, `fail` if a role uses it (`src/services/doctor-backends.ts:140`) | `skip` → info and `warn` → warning, as before. `fail` blocks Start with catherd's `fix`. There is no install button for these three (`backendAction` covers only codex and opencode). |
| probe `info` rows | for example an `agent` on PATH that is not Cursor (`doctor-backends.ts:107`) | `info` | info |
| `quota:antigravity` | a signed-in `agy` (`doctor-backends.ts:134`) | `info` | info |
| `ui-browser` | a profile enables `ui-reviewer` and `agent-browser` is not on PATH (`src/services/doctor-checks.ts:158`) | `warn` | warning, with catherd's fix (`npm i -g agent-browser`, or turn the role off) |
| `profile` warning: `budget.usd` cap on a backend with no dollar cost (Codex, Cursor, Antigravity) | `src/services/profile-store.ts:206` | `warn` (also in `profile_validate`) | warning |
| backend "cannot run" | a CLI the OS cannot execute (`E_BACKEND_CANNOT_RUN`) | depends on use, as above | shown through the same row |

On the default profile, the new rows are three `skip`s plus `ui-browser: warn` (the default profile enables `ui-reviewer`). Readiness stays **ready**.

## 3. Profiles, routing and runs (no UI change needed)

- **New rung backends:** `cursor:`, `grok:` and `antigravity:` are valid rung prefixes. Profiles and Models take rungs as strings from catherd, so they appear without code changes. The Models backend filter is built from the catalog.
- **Paired failover** (`PAIRED_FAILOVER`, `src/domain/profile.ts:202`): Gemini and Grok rungs fail over between their native backend and Cursor unless the profile names a stand-in. catherd computes this; CatHouse only shows `profile show`'s `standIns`.
- **Isolation needs an API key** (`CURSOR_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`) in the environment catherd runs in. Without it, a profile that isolates one of those backends does not validate. CatHouse's `processEnv()` passes the user's env through, minus `CLAUDE_CODE_*`/`ANTHROPIC_BASE_URL`, so a key set in the login shell reaches catherd. Secrets are never logged (hard rule 6).
- **Native Antigravity cannot host a read-only role.** `profile_validate` refuses that, and CatHouse shows the error as returned.
- **Resume under another access/network grant** is refused on Grok and Antigravity with "dispatch a fresh thread" (`src/services/admission.ts:173`). That is an orchestrator concern; CatHouse does not dispatch.
- **Catalog:** new families (Grok 4.5–4.7, Composer 2.5, Gemini 3.x), `codex:gpt-6.1-sol` (GPT-6 Sol stands in until it has scores) and, in 1.2.1, `claude-sonnet-5-5`. These are data only.
- **`catherd knowledge show|add|path [--repo]`** (`src/cli.ts:50`, `src/entry/knowledge-command.ts`): a new CLI command for a repo's `knowledge.md`. CatHouse does not use it yet (see §5).

## 4. Upgrading a machine that ran 1.2

```bash
bunx catherd-cli@1.3.0 init --no-input --plain </dev/null
claude plugin marketplace update catherd && claude plugin update catherd@catherd
```

Setup does the same with **Install and set up catherd** (it shows "found 1.2.0, CatHouse needs 1.3.0") and **Update plugin** (`.claude-plugin/marketplace.json:12` has `"ref": "v1.3.0"`). Start a new orchestrator session afterwards, because the plugin's skills changed. After `init` and before the plugin update, doctor reports `plugin: stale (plugin 1.2.0, catherd 1.3.0)` and is not ready.

## 5. Not adopted yet (parity backlog)

- Install/login buttons for `cursor-agent`, `grok` and `agy`. Doctor's `fix` text already covers them.
- A Knowledge view (`catherd knowledge show/add`) on the repo.
- Showing `quota:antigravity` outside Setup.
- The 1.1/1.2 items in [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) §7 are still open.

## Traps

- `catherd doctor` run from a shell inside a Claude Code session probes that session's inbox (`push` row). Record CLI fixtures from a clean env. The not-ready doctor fixture was recorded with `env HOME=<empty dir> CATHERD_NO_SYNC=1 ~/.bun/bin/catherd doctor --json` (exit 3) and redacted to `/Users/dev`.
- Re-recorded fixtures must be Biome-formatted (`node_modules/.bin/biome format --write packages/compat/fixtures/1.3.0`), or `biome check .` fails.
