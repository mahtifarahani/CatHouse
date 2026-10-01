# catherd 1.0.0: doctor, init, backends, agent links

> **Baseline: catherd 1.0.0.** CatHouse now pins **1.3.0**. Where 1.1–1.3 changed something CatHouse relies on, [`catherd-1.2-upgrade.md`](catherd-1.2-upgrade.md) and [`catherd-1.3-upgrade.md`](catherd-1.3-upgrade.md) win over this doc.

Citations are relative to the catherd repo at commit `b257da7`. This is the basis for CatHouse's Setup screen.

## 1. `doctor` checks

Each check is `{id, label, state: "ok"|"warn"|"fail"|"skip", word, detail, fix?}` (`doctor-checks.ts:11-21`). `ready` = no check failed (`doctor.ts:357`). The CLI exits 3 when not ready (`doctor-command.ts:43`).

| id | States / words | Fix | Source |
|---|---|---|---|
| `bun` | ok / fail "too old" (< 1.4.0) | `bun upgrade` | `doctor.ts:60-71` |
| `config` | ok / fail invalid | the error's fix, else `catherd init` | `doctor.ts:76-97` |
| `binding:<repo>` | fail missing (bound profile gone) | `cd <repo> && catherd profile use --repo --clear` | `doctor.ts:107-120` |
| `profile` (active), `profile:<name>` (repo-bound) | ok / warn / fail invalid / fail unreadable | first issue's fix with `--profile <name>`, else `catherd profile validate <name>` | `doctor.ts:123-145` |
| `backend:codex`, `backend:claude-code`, `backend:opencode` | ok (detail: version · login · N models) / warn billing (login mode ≠ profile billing) / warn "no listing" / problem → **fail** if a role uses it, **warn** if only failover uses it, else **skip**; words missing, too old, not logged in, not ready | the probe's fix (install/update/login); `catherd profile set billing.<id> <mode> --profile <p>`; `catherd catalog refresh`. A "missing" fail also lists `profile set` commands that move roles to a ready backend (the artist is turned off when moved off Codex) | `doctor-backends.ts:47-185` |
| `discovery` | fail unreadable | `catherd catalog refresh --verbose` | `doctor-backends.ts:159-171` |
| `jev` | skip off / warn "no key" / ok / warn "no answer" | `catherd init, or export TYPESAFE_API_KEY=<key>` | `doctor.ts:150-184` |
| `plugin` | fail missing / fail **stale** (installed version ≠ catherd version) / ok. Reads `<claudeHome>/plugins/installed_plugins.json` | `claude plugin marketplace add 47vigen/catherd && claude plugin install catherd@catherd`; the update command | `doctor-checks.ts:23-25,39-67` |
| `agents` | ok "N linked" / fail missing or stale / skip none / fail unreadable | `catherd profile use <active>` | `doctor.ts:188-198`; `doctor-checks.ts:88-103` |
| `mcp` | ok (`tools/list` contains `status`) / fail "no answer" (20 s timeout) | `run catherd mcp to see why it does not start` | `doctor.ts:200-220`; `mcp/handshake.ts:18-48` |
| `locks` | ok / fail "not writable" | `chmod -R u+w <locks>` | `doctor-checks.ts:69-86` |
| `sandbox:<id>` (Codex only) | skip "not tested" / ok / warn "not writable" | add the locks folder to `writable_roots` in `~/.codex/config.toml` | `doctor.ts:223-251` |
| `access:full` | warn: roles with full access | none | `doctor.ts:253-276` |
| `access:advisory` | warn: roles on backends that can't enforce access | none | `doctor.ts:277-284` |
| `isolation:<id>` | warn weak (no adapter defines it today) | none | `doctor.ts:285-295` |
| `credentials` (only if the file exists) | fail "readable by others" / warn unreadable / ok "mode 600" | `chmod 600 …` | `doctor.ts:297-323` |
| `bunx` | warn missing | put `~/.bun/bin` on PATH | `doctor.ts:325-333` |
| `runs` | fail/warn unreadable run folders | `fix or delete <dir>` | `doctor.ts:334-355` |

**Side effects (important):** doctor rewrites the model listings for ready backends, writes a probe file in the locks folder, and starts `catherd mcp`, which reconciles every run (`doctor.ts:55-57`). Each backend probe can take up to 15 s. **CatHouse runs doctor only in Setup, after an install, and on "Re-check", never on a timer.**

**Known noise:** `access:full` and `access:advisory` warn about the shipped defaults, which the user did not choose. CatHouse shows them as info. The `sandbox:codex` probe is dead on Codex 0.157 (see `catherd-known-issues.md`).

## 2. Backends (adapters)

Registered adapters: `codex`, `claude-code`, `opencode` (`adapters/all.ts:6-8`). `cursor` and `grok` are declared rung backends with no adapter. CLI probes time out after 15 s each (`adapters/cli.ts:29-64`).

| Backend | Minimum | Version check | Missing / old fix | Login check | Login fix | Enforcement |
|---|---|---|---|---|---|---|
| Codex | `0.157.0` (`codex/index.ts:24`) | `codex --version` | `npm i -g @openai/codex` / `npm i -g @openai/codex@latest` | `codex login status` exit code (text tells ChatGPT plan vs API key) | `codex login` | enforced (sandbox) for every mode |
| claude-code | `2.1.282` (`claude-code/index.ts:28`) | `claude --version` | `npm i -g @anthropic-ai/claude-code` / `claude update` | `claude auth status --json` → `loggedIn === true` | `claude auth login` | advisory; `graceAfterFinalMs` 30 s |
| opencode | `2.0.16` (`opencode/index.ts:36`); v1 gets a specific message | `opencode --version` | `curl -fsSL https://opencode.ai/v2/install \| bash` (npm `opencode-ai` is v1, unsupported) | `opencode auth list --format json` (provider `opencode` or `opencode-go`) | not required: free Zen models run without a key | advisory |

Listings are written by `refreshDiscovery` from `init`, `doctor` and `catalog refresh`. An empty listing keeps the previous one. `route` refreshes listings older than a day, waiting at most 5 s.

## 3. `init`, step by step (`init-command.ts:89-142`)

Flags: `--no-input`, `--profile <name>`, `--plain`.

1. A bad `--profile` is refused before anything is asked.
2. A prompter is made unless `--no-input`.
3. On a TTY: mascot and the config folder.
4. **Jev** (`:35-64`): with `TYPESAFE_API_KEY` set or a saved key, use it. Otherwise ask for the key without echo (Enter skips), test it with `GET /models`, and save it to `credentials.json` (mode 600). This step never stops `init`.
5. **Profile name**: `--profile`, else `Profile to set up [default]:`.
6. Moves 0.x files aside into `0.x-backup-<stamp>/` under the profiles lock.
7. If the profile file exists: `Replace profile X with the default profile? [y/N]`.
8. **`initSetup`** (`setup.ts:71-87`): with no file (or replace confirmed), `resetProfile` validates `defaultProfileDoc` against this machine's catalog and writes it only if it has no errors. If the file exists now: `activate` (writes `config.activeProfile`, rebuilds agent files and links). Then it refreshes model listings for every adapter.
9. Prints what moved, profile lines, linked agents and listing results.
10. Runs the full doctor report. **The exit code stays 0 even when not ready.**
11. Prints the plugin install steps.

**Input modes** (`prompt.ts:75-103`):
- **TTY:** readline; the secret prompt uses raw mode; Ctrl-C exits 130.
- **Piped stdin:** reads **all of stdin until EOF**, one line per question in order: Jev key, profile name, replace y/N. A question this machine skips still consumes its line. An empty line takes the default.
- **`--no-input`:** asks nothing. No Jev key unless it is in env or saved; profile = `default` or `--profile`; an existing profile is kept.

**CatHouse flow:** run `bunx catherd-cli@1.0.0 init --no-input [--profile <p>]`, stream its output, then run `doctor --json` for the real verdict. To set a Jev key from the UI, run `init` with piped stdin (`"<key>\n<profile>\nn\n"`), or pass `TYPESAFE_API_KEY` in env, which init then saves. Never log the key.

## 4. Claude agent links (`services/agent-links.ts`)

- Linked profiles: the active one plus every repo-bound one (`:37-40`).
- One file per enabled role with a native `claude:` rung, including native stand-ins (`domain/agents.ts:42-60`).
  - Name: `catherd-<profile>-<role>-<slug(model)>-<slug(effort)>` (`profile.ts:244-247`).
  - Frontmatter: `name`, `description`, `model`, `effort`, `disallowedTools`; the body is the role prompt (`agents.ts:16-36`).
- The file lives in `<config>/agents/<profile>/`; a symlink `<claudeAgentsDir>/<name>.md` points to it.
- It refuses (`E_CONFIG_INVALID`) before writing if a file catherd doesn't own sits at a link path (`:59-65`).
- It prunes catherd links that are no longer planned and returns `{linked, pruned, newSessionNeededFor}` (`:78-122`).
- **Claude Code reads agent files only when a session starts.** A profile change that returns a non-empty `newSessionNeededFor` means the next orchestrator session must be a fresh one. The skill says `Agent type … not found` means the profile changed after the session started.

## 5. Secrets

`TYPESAFE_API_KEY` is removed from every process catherd starts (`env.ts:2-9`). The log redactor scrubs env vars whose names contain KEY, TOKEN, SECRET, PASSWORD or CREDENTIAL, plus key-shaped strings (`domain/secrets.ts:5-47`). CatHouse must likewise never log secrets in its OutputChannel.
