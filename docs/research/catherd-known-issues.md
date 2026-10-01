# catherd 1.0.0: known issues and limits that matter to CatHouse

> **Baseline: catherd 1.0.0.** CatHouse now pins **1.3.0**. Where 1.1–1.3 changed something CatHouse relies on, [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) and [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) win over this doc.

Sources: `docs/dev/ideas.md`, `docs/dev/manual-tests.md`, `CHANGELOG.md` and `docs/superpowers/plans/2026-09-27-09-run-findings.md` in the catherd repo at commit `b257da7`.

## Blockers CatHouse must work around

1. **(Fixed in 1.1: the marketplace fetches over HTTPS.)** **The plugin install fails without GitHub SSH.** `.claude-plugin/marketplace.json` gives the plugin the source `{"source": "git-subdir", "url": "47vigen/catherd", "path": "plugin", "ref": "v1.0.0"}`. The marketplace itself clones over HTTPS, but Claude Code clones that shorthand over SSH, so `claude plugin install catherd@catherd` dies with `ssh: connect to host github.com port 22` on any machine without GitHub SSH (`ideas.md:29-34`). **Workaround (CatHouse applies it to every plugin install/update):**

   ```bash
   GIT_CONFIG_COUNT=1 \
   GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf \
   GIT_CONFIG_VALUE_0=git@github.com: \
   claude plugin install catherd@catherd
   ```

   Upstream fix: `"url": "https://github.com/47vigen/catherd.git"`.

2. **The first `bunx catherd-cli` is silent for about 30 s** while about 108 packages resolve (`ideas.md:52-54`). CatHouse shows progress ("installing catherd…") and a generous timeout.

## UI-visible quirks

- **Doctor's Codex sandbox probe is dead on current Codex.** It runs `codex sandbox macos --full-auto`, which Codex 0.157 no longer has, so `sandbox:codex` always reads "not tested" (`ideas.md:35-38`). Show it as info.
- **Doctor warns about shipped defaults** (`access:full`, `access:advisory`) the user never chose (`ideas.md:49-51`). Show them as info.
- **TUI first frame** shows "0 profiles" until profiles load (`ideas.md:55`). CatHouse shows a loading state.
- **Failover silently downgrades climbed high rungs**: `sol#high`/`#xhigh` fail over to `kimi-k3#max` "treated like sol#medium" (`ideas.md:45-48`). CatHouse can flag a stand-in whose treat-like is lower than its source.
- **Ladders that go down validate clean**, and inferred failover labels read oddly (`ideas.md:80-85`).

## Orchestration behaviour a UI must not assume away

From the headless test (`claude -p "/catherd:catherd …"`, `ideas.md:57-85`) and the platform run:
- `route` was skipped for 3 of 4 lanes, so **ROUTES may be missing**.
- No reviewer or verifier ran, so **verdicts may be missing**.
- `replyStatus: null` on every record (briefs didn't ask for the STATUS line), so **STATUS may be null**.
- Easy lanes started on the default rung, not the cheapest.
- **The verifier is the bottleneck** (about 47 of 63 min in one run). Nothing exposes the verifier's current step, so a long gate looks stuck. CatHouse shows the orchestrator's live transcript and the subagent's elapsed time from the SDK stream.
- **The skill decays after compaction** (runs after a compaction skipped route, reviewer and verifier), and **one owner question blocks the whole run** (`ideas.md:18-23`).
- **The worker sandbox blocks checks** under `workspace-write`: the locks dir, Docker, loopback, `/tmp` and DNS are denied (`ideas.md:14-17,39-44`). Expect `partial`/`blocked` replies on repos that need Docker.
- **Never run live yet:** an opencode lane, quota failover, a budget stop (`ideas.md:144-149`).

## Session and version constraints

- **MCP servers, plugins and agent files load only at session start** (`manual-tests.md:3-5`). After a profile change with `newSessionNeededFor`, the next orchestrator session must be new. Whether Claude Code picks up agent files mid-session is untested upstream; CatHouse can try the SDK's `query.reloadPlugins()`, but must not rely on it.
- **Long `wait` calls:** in Claude Code the skill relies on the call being backgrounded after about 2 min with progress ticks (S1 in `manual-tests.md:14-118`). In the Agent SDK this must be verified (CatHouse Phase 1 spike). `dispatch` returns at launch (run-findings Ruling 1).
- **No tool is marked `readOnlyHint`** (Ruling 2), so every catherd tool call hits permission checks unless allowed. CatHouse allows `mcp__plugin_catherd_catherd__*`.
- **`route` is one lane per call**, up to 25 s each on Jev (Ruling 3).
- **Version pinning:** the plugin's `.mcp.json` pins `bunx catherd-cli@1.0.0`, the skill checks `status().version`, and doctor's `plugin` row fails as `stale` when versions differ. Version 0.2.1 fixed a stale `bunx …@latest` cache (`CHANGELOG.md:22`). CatHouse always calls the same pinned version.
- **Bun ≥ 1.4 only.** Don't import catherd code into the VS Code extension host (Node); spawn the CLI.
- The TUI's copy uses OSC52 only; CatHouse uses `vscode.env.clipboard`.
