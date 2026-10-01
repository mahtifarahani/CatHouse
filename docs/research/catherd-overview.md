# catherd: overview

> **Baseline: catherd 1.0.0.** CatHouse now pins **1.3.0**. Where 1.1–1.3 changed something CatHouse relies on, [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) and [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) win over this doc.

Upstream: https://github.com/47vigen/catherd. This doc describes **catherd 1.0.0** (tag `v1.0.0`; docs read at commit `b257da7`). The npm package is `catherd-cli` and the command is `catherd`. License: MIT.

All `path:line` citations in `docs/research/` point into the catherd repo at `b257da7`. To read them locally:

```bash
git clone https://github.com/47vigen/catherd.git && cd catherd && git checkout b257da7
```

## What catherd is

catherd runs **autopilot builds from the user's own Claude Code session**. Claude plans and verifies; Codex, opencode or headless Claude Code workers write the code; and Jev (a TypeSafe decision model, optional) picks the model and effort for each piece of work.

- **The orchestrator is the user's main Claude session.** It runs the `catherd` skill (`plugin/skills/catherd/SKILL.md`), started by `/catherd <task>`. The orchestrator never edits product files itself.
- **Roles:**

| Role | How it runs | Job | Default access |
|---|---|---|---|
| architect | native Claude subagent (`Agent(subagent_type: <agent>)`) | decisions, milestones, lane files; no code | read-only |
| verifier | native Claude subagent | independent PASS/FAIL of a milestone by running it | full |
| worker | `dispatch` (Codex/opencode/claude-code process) | one lane: code + tests | workspace-write |
| reviewer | `dispatch` | review of a milestone diff | read-only |
| ui-reviewer | `dispatch` | screenshots with `agent-browser` | full |
| artist | `dispatch` | images with Codex's image tool | workspace-write |
| writer | `dispatch` | README, docs, changelog, MR body | workspace-write |
| researcher | `dispatch` | the dossier, or one factual question | read-only |

- **Rungs** are written `backend:model#effort`, for example `codex:gpt-6-sol#high` or `claude:claude-opus-5-5#high`. Backends: `codex`, `claude-code`, `opencode`, `cursor`, `grok` (declared, no adapter yet), and `claude` (native subagent). A `claude:` rung runs as a native subagent; any other rung runs as a detached process through the MCP `dispatch` tool.
- **Ladders:** a lane starts on the lowest rung that can do it and climbs one rung when it shows it cannot (check fails twice, BLOCKER, same defect, refused/blocked/unchanged). Default profile ladders:
  - Track A (`copy`/`build`): `codex:gpt-6-luna#high → codex:gpt-6-sol#medium → #high → #xhigh`
  - Track B (`logic`/`hard`/terminal): `codex:gpt-6-sol#medium → #high → #xhigh`
- **Jev** picks the starting rung (`route`), with fallback to the lane file's `Kind:`/`Difficulty:`, then the profile default. It is never the judge of "done".
- **Profiles** (`~/.config/catherd/profiles/<name>.json`) say which rungs each role may use, access mode, billing, failover, budget, timeouts, harness isolation, lock slots and notify moments. A repo can be bound to a profile.
- **Runs** live outside the repo, in `~/.local/share/catherd/repos/<repoKey>/runs/<runId>/`, and survive restarts. Workers are detached processes that write straight to disk.

## Surfaces

| Surface | What | Used by |
|---|---|---|
| Claude Code plugin `catherd@catherd` | `plugin/` dir: skills `catherd` and `catherd-setup`, commands `/catherd` and `/catherd-setup`, `.mcp.json` that starts `bunx catherd-cli@1.0.0 mcp` | the user's Claude session |
| MCP server `catherd mcp` (stdio) | 21 tools; see `catherd-mcp-contract.md` | the orchestrator skill (and CatHouse, read-mostly) |
| CLI `catherd …` | init, doctor, status, watch, runs, profile, catalog, lock, capture-fixtures, mcp; see `catherd-cli-contract.md` | humans, CatHouse |
| TUI `catherd` (no args) | OpenTUI dashboard: Status, Profiles, Runs; see `catherd-tui-parity.md` | humans (CatHouse replaces it) |

Inside Claude Code, the plugin's MCP tools appear as `mcp__plugin_catherd_catherd__<tool>`. The namespaced slash command is `/catherd:catherd <task>` (used by catherd's own headless test: `claude -p "/catherd:catherd ..."`).

## Install (upstream README)

Requirements: Bun ≥ 1.4; Claude Code; at least one worker backend logged in (Codex CLI ≥ 0.157.0, opencode **v2** ≥ 2.0.16, or `claude` ≥ 2.1.282 for `claude-code:` rungs); optional `TYPESAFE_API_KEY` for Jev.

```bash
bunx catherd-cli init
claude plugin marketplace add 47vigen/catherd
claude plugin install catherd@catherd
# start a new Claude Code session, then:
bunx catherd-cli doctor
```

The plugin install currently fails without GitHub SSH; see `catherd-known-issues.md` for the workaround CatHouse must apply.

## The orchestration sequence (from the skill)

The orchestrator's first call is `status()`, and its `version` must equal the plugin pin `catherd-cli@1.0.0` (`plugin/skills/catherd/SKILL.md:26`).

**Once per project:**
1. **A-lines.** Write the request as numbered observable lines A1…An, ask every open product question now, then `run_start(repo, title, a_lines)`. A `plan: <path>` A-line means "plan in hand": no dossier, and the architect translates the plan.
2. **Dossier.** One researcher (`researcher-dossier`) maps the code, reading `read_knowledge(repo)` first.
3. **Architect**, once. Writes `plan.md` and every `lanes/Mx.Ly.md` with `write_run_file`. Each lane header has `# Mx.Ly — title`, `Owns: <paths>`, `Fast check: <cmd>`, `Kind: repo_code|terminal|ui|prose|research`, `Difficulty: copy|build|logic|hard`. Polish/fix runs skip the dossier and architect.
4. **Route and preflight.** `route(run, lane_file)` per lane (up to 25 s on Jev each), then `preflight(run)` once: each lane comes back `pass`, `fails-as-expected`, `skipped` or `cannot-start` (only the last one blocks). `needsConfirmation: true` means the user must see the commands first.

**Per milestone:**
5. **Lanes.** Dispatch every lane one after another (each `dispatch` returns in about 1 s), then `wait(run)`. After each worker returns: check STATUS, `changedOwned`, `hints`, and run the fast check once.
6. **Writer**, when docs change.
7. **Reviewer**, once over the milestone diff, plus a UI pass when screens changed.
8. **One fix round.** `ask(run, "finding")` and `ask(run, "same-defect")` decide design vs worker, and whether to climb.
9. **Verifier**, with the full check on a frozen tree.
10. **Land.** Commit (only the orchestrator commits), then `land(run, milestone, what, commit, evidence, next, learned?)`.

**Finish:** run the final gate with the verifier in the foreground, then report per milestone, commits, role runs, time/token sums (`runs_summary`), Jev decisions, harness cost, budget and open items.

**Waiting:** `dispatch` and `wait` are called only from the main thread. `wait` blocks until a role finishes. The skill says that after about 2 minutes Claude Code backgrounds the call and its notification wakes the session. Never sleep or poll.

**Pause:** dispatch nothing new, cancel live roles the user wants stopped, then `set_next(run, "paused: <why>; resume with <step>")`.

**Resume:** `status()` names the run. Before dispatching anything, call `wait(run)` repeatedly while `running` is not empty, to collect the roles the last session left running. Continue each role on its own thread with `dispatch(…, thread)`.

**Push notifications** (`PushNotification`) fire only at the moments in the profile's `notify`: `milestone`, `finish`, `blocked`.

## The setup skill (`/catherd-setup`)

The setup skill tunes the profile in conversation, one question at a time. It reads `catalog_query`, `runs_summary` and `profile_get`, and writes only through `profile_set` (then `profile_validate`). There is no MCP tool for `treat-like`; the user runs `catherd catalog treat-like <rung> <scored rung>`. Codex/claude-code/opencode changes apply at the next dispatch. Native Claude agent changes (`newSessionNeededFor`) apply from the next Claude Code session.

## Why this matters for CatHouse

- CatHouse must run the **skill** in a Claude session (via the Agent SDK). It must not re-implement orchestration.
- CatHouse reads state through CLI `--json` and the read-safe MCP tools, and writes profiles only through `profile_set` or the CLI.
- See `public-surface-gaps.md` for what the public surface does not cover.
