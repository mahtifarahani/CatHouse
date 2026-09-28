# catherd 1.0.0: CLI contract

Citations are relative to the catherd repo at commit `b257da7`. Router: `src/cli.ts`; commands: `src/entry/*-command.ts`.

## Invocation from CatHouse

- Always pin the version: `bunx catherd-cli@1.0.0 <args>`. The plugin's MCP server uses the same pin, so both sides run one version.
- The first `bunx catherd-cli` resolves about 108 packages and prints nothing for about 30 s. Show "installing catherd…" in the UI.
- Bun ≥ 1.4 is required. An older Bun prints `E_RUNTIME_TOO_OLD` and exits 1 before anything runs (`src/cli.ts:7-11`).
- Run each command with `cwd` = the repo root. Several commands resolve "the profile this repo runs on" from cwd.

## Global behaviour

- Subcommands (`cli.ts:42-55`): `init, status, watch, runs, profile, doctor, catalog, lock, capture-fixtures, mcp`, plus a hidden internal `_supervise`. A bare `catherd` opens the TUI (`:57-60`), which refuses to start without a TTY.
- `--version` or `-v` as the **only** argument prints the bare version string and exits 0 (`:116-119`).
- `--help`/`-h` works at any depth and exits 0 (`:120-124`).
- `--verbose` before `--` sets `CATHERD_LOG=debug` (`:113-115`).
- **Exit codes** (`src/entry/cli-kit.ts:6`): `0` ok, `1` error, `2` usage, `3` not ready, `130` interrupted.
  - `E_INPUT_INVALID` → 2; any other catherd error → 1 (`cli-kit.ts:24-25`).
  - A citty parse error → 2 (`cli.ts:144-152`). An unknown error → 1, printed as `E_IO_UNEXPECTED` (`:157-162`).
  - SIGINT → 130, except for `lock` (`:139`).
- **Errors are always text on stderr, never JSON, even with `--json`** (`cli-kit.ts:18-21`):

  ```
  error E_CODE: message
  fix: what to do
  ```

  CatHouse parses these two lines into `{code, message, fix}`.
- JSON output is `JSON.stringify(v, null, 2)` on stdout (`cli-kit.ts:27`). The flag is `--json` (`:30`). Every read command supports it.

## Commands

| Command | Flags | `--json` output / behaviour |
|---|---|---|
| `status [run]` (`src/entry/runs-command.ts:56-65`) | `--json` | Same as MCP `status`: `{version, runs: RunSummary[], warnings}`, redacted (`:45-53`). Read-only. |
| `watch` (`:79-115`) | `--once`, `--interval <s>`, `--plain`, `--reduced-motion`, `--json` | `--json` or `--once` prints status once and exits. Otherwise the TUI opens on Runs (TTY) or text redraws (piped). |
| `runs` / `runs list` (`:117-148,213-217`) | `--repo <path>`, `--json` | `{runs: [{id, title, repo, createdAt, live: number, roleRuns: number}], corrupt: [{id, dir, reason}]}`, newest first (`run-store.ts:122,143`). **No `landed` or `budget`.** |
| `runs show <id>` (`:150-194`) | `--debug`, `--name <role>`, `--json` | `{summary: RunSummary, records: RunRecord[], dispatches?: DispatchDebug[]}`. `dispatches` only with `--debug`. |
| DispatchDebug (`src/services/run-debug.ts:12-22,59-79`) | | `{name, dispatchId, rung, admittedAt, record\|null, exit: {code, signal, reason, endedAt}\|null, stderrTail[], eventsTail[], supervisorTail[]}`. Tails are the last 20 non-blank lines, redacted. |
| `runs cancel <id> <name>` (`:196-210`) | none | **No JSON.** Text `✓ <name> <status>` plus hint lines. `E_RUN_NOT_LIVE` → exit 1. |
| `doctor` (`src/entry/doctor-command.ts:30-45`) | `--json`, `--plain` | `{ready, version, checks: [{id, label, state: ok\|warn\|fail\|skip, word, detail, fix?}]}` (`src/services/doctor.ts:32-37,357`; `doctor-checks.ts:14-21`). **Exit 3 when `ready: false`.** Has side effects; see `catherd-doctor-setup.md`. |
| `profile list` (`src/entry/profile-command.ts:138-158`) | `--json` | Bare array `[{name, active, repos: string[]}]`. `active` = the profile this cwd runs on. |
| `profile show [name]` (`:160-178`) | `--json` | `{profile: Profile, active, enforcement, standIns: [{from, to, inferred, via}]}`. `Profile` is the full resolved type (`profile.ts:119-132`). |
| `profile diff <a> [b]` (`:275-294`) | `--json` | Bare array `[{path, before, after}]`. **`before` is `b`** (default: the cwd's profile) and **`after` is `a`** (`:286-289`). |
| `profile validate [name]` (`:296-314`) | `--json` | `{valid, errors, warnings}`. Exit 1 with errors. Validates a **saved** profile only. |
| `profile set <path> <value>` (`:249-273`) | `--profile <name>` | **No JSON.** The value is parsed as JSON, else a plain word; for `rungs`/`notify` a comma list works (`profile.ts:303-329`). Prints `✓ path: before → after` or `no change`. Invalid path/value → `E_INPUT_INVALID` (2); refused save → `E_CONFIG_INVALID` (1) (`:119-124`). Never creates a profile (`:262-265`). |
| `profile use [name]` (`:180-210`) | `--repo`, `--clear` | text only. `--repo` binds the cwd repo; `--repo --clear` unbinds it. |
| `profile new <name>` | `--from <p>` | text only |
| `profile copy <from> <to>` | | text only |
| `profile rm <name>` (`:212-247`) | | text only. Refuses the active profile and any profile bound to an existing repo. |
| `catalog list` (`src/entry/catalog-command.ts:49-80`) | `--backend`, `--role`, `--text`, `--scored`, `--json` | `{total, models: CatalogModel[]}`, limit 10 000. Uses **default billing**, unlike MCP `catalog_query`, which uses the repo profile's billing (`:66-73`). |
| `catalog refresh` (`:38-47`) | `--json` | `[{backend, models: number, fetchedAt\|null, error?, fix?}]` (`catalog-service.ts:131-138`). Exit 0 if any backend succeeded, else 1. |
| `catalog treat-like <rung> <like>` (`:82-100`) | | **No JSON.** Text `✓ <canonical> is treated like <canonical>`. Writes `catalog.override.json`. Errors: `E_CONFIG_INVALID`, `E_INPUT_INVALID` (`catalog-service.ts:241-277`). No MCP twin. |
| `init` (`src/entry/init-command.ts:89-142`) | `--no-input`, `--profile <name>`, `--plain` | Text only. **Exits 0 even when doctor reports not ready**; run `doctor --json` after it. Details in `catherd-doctor-setup.md`. |
| `lock [--slots N] -- <cmd…>` (`src/entry/lock-command.ts:91-123`) | `--slots` | Runs the command behind the machine-wide semaphore in its own session (no `/dev/tty`). Slots: `--slots`, else `CATHERD_LOCK_SLOTS`, else the profile's `lock.heavy`, else half the cores (`:14-36`). The exit code is the command's own; no command → 2. Forwards SIGINT/TERM/HUP; a second Ctrl-C within 2 s sends SIGKILL (`:46-86`). |
| `capture-fixtures` (`src/entry/capture-fixtures-command.ts:24-57`) | `--backend <b>`, `--out <dir>` | Contributor tool; text only. Exit 0 if anything was captured. Without `--out` outside a catherd source checkout → `E_INPUT_INVALID`. |
| `mcp` | | The stdio MCP server; see `catherd-mcp-contract.md`. |

## What CatHouse runs through the CLI (because no MCP tool exists)

`doctor --json`, `init --no-input [--profile]`, `profile use/new/copy/rm`, `catalog refresh --json`, `catalog treat-like`, `runs list/show --json`, `profile list/show/diff --json`, `lock`, `capture-fixtures`, `--version`.

For mutating commands without `--json`, success = exit 0. Failure = parse stderr's `error`/`fix` lines.

## Environment variables (README)

| Variable | Effect |
|---|---|
| `TYPESAFE_API_KEY` | the Jev key, instead of the one `init` saves |
| `CATHERD_HOME` | config and data under `$CATHERD_HOME/config` and `$CATHERD_HOME/data` (useful for contract tests) |
| `CATHERD_LOG` | `off`, `error`, `warn`, `info` (default), `debug` |
| `CATHERD_LOCK_SLOTS` | `lock` slot count when `--slots` is not given |
| `CATHERD_REDUCED_MOTION`, `CATHERD_NO_KITTY` | TUI only |
| `CATHERD_CLAUDE_AGENTS_DIR` | where agent links go (default `$CLAUDE_CONFIG_DIR/agents`, else `~/.claude/agents`) |
| `NO_COLOR` | drops colour |
| `CATHERD_TICK_MS` | `wait` progress interval (default 30000) |
