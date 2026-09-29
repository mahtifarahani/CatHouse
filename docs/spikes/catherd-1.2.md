# catherd 1.2 spikes: push notices in a Claude Agent SDK session

Date: 2026-09-29. Machine: macOS (Darwin 27, arm64), Node 22.13.1, Bun 1.4.2, catherd-cli 1.2.0 (global, installed by `bunx catherd-cli@1.2.0 init --no-input --plain`), plugin catherd@catherd 1.2.0 (commit `3cee546`), `@anthropic-ai/claude-agent-sdk` 0.3.283 (bundled Claude Code 2.1.283), Codex CLI 0.158.0 (ChatGPT login), Claude login claude.ai (Pro).

Why: catherd 1.1 removed the blocking `wait` tool. A finished role now reaches the Claude Code session that owns the run as a message on that session's peer inbox (`<cross-session-message from-name="catherd">`). The Phase 1 design relied on `wait` blocking in the foreground (`docs/spikes/phase1.md` spike a), so CatHouse needed proof that an SDK-hosted session receives these pushes at all, and what they look like in the SDK stream.

Harness: the Phase 1 harness (`packages/extension/scripts/spike.ts`) with a new `--linger-seconds N` flag. The harness used to close the session 5 s after a `result`. Under push, the orchestrator ends its turn right after `dispatch`, so the harness must stay open until catherd's notice arrives.

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd packages/extension && node build.mjs --spike
env -u ANTHROPIC_BASE_URL node dist-spike/spike.mjs --repo <scratch repo> --task "<task>" --max-minutes 45 --linger-seconds 900
```

Run it from a clean environment: a shell inside a Claude Code session leaks `CLAUDE_CODE_*` variables. `processEnv()` strips them for the session itself, but `catherd doctor` run straight from such a shell would probe *that* session's inbox. In zsh, build the `env -u` list as an array: an unquoted `$U` string is not word-split, so `env $U` silently unsets nothing.

## Results

| # | Risk | Result | Evidence |
|---|---|---|---|
| p1 | catherd's MCP server inside an SDK session gets a messaging socket and can push | ✅ | Prompt: run `catherd doctor --json` with Bash and print the `push` row. The row was `{"id":"push","state":"ok","word":"ready","detail":"a test message reached this session"}`, and `CLAUDE_CODE_MESSAGING_SOCKET` was set in the session's Bash env. Cost $0.19. |
| p2 | A push wakes an idle SDK session and starts a new turn | ✅ | After the first `result`, the doctor's test message arrived and the session answered it on its own ("I got a message from another session called catherd…"). Cost $0.01. |
| p3 | The SDK stream shape of a pushed turn | ✅ | `command_lifecycle {state: "started", command_uuid}` → `system/init` again (same `session_id`) → `assistant` … → `result` → `command_lifecycle {state: "completed"}`. The pushed text itself is **not** in the stream (no `user` message). Turns started by CatHouse's own streaming input have no `command_lifecycle`. |
| p4 | A full catherd 1.2 run is driven by push, end to end | ✅ | Task: add `subtract(a, b)` and node:test tests (one milestone). Timeline (seconds from start): 72 first `result` right after the worker `dispatch`; 132 push (worker done) → orchestrator checked it and dispatched the reviewer → `result` at 160; 226 push (reviewer done) → native verifier (Agent tool, PASS) → `land` → `result` at 284. Run `20260929-080322-add-subtract-a-b-with-node-test-coverage`: 2 role runs (worker `codex:gpt-6-luna#high` 61 s ok, reviewer `codex:gpt-6-sol#high` 67 s ok), 2 native agent runs, M1 landed as commit `e151ab3` in about 4 min wall time. Orchestrator cost $0.88. |
| p5 | The gateway reads the run without disturbing the push flow | ✅ | Live contract with `CATHOUSE_CONTRACT_RUN_REPO` = the spike repo: `runs.list`, `runs.get` and `runs.reply` (now `read_run_file` of the record's `replyPath`) pass. The e2e `pages.e2e.ts` with `CATHOUSE_E2E_WORKSPACE` = the spike repo passes all 5 scenarios. |

## Findings

1. **Push works in SDK sessions without any CatHouse change to the session.** The bundled Claude Code gives its MCP servers `CLAUDE_CODE_MESSAGING_SOCKET`/`_TOKEN` just like the CLI does. CatHouse's `processEnv()` strips the *host's* `CLAUDE_CODE_*` variables before starting the SDK. That is required: the gateway's own `catherd mcp` must not look like a session, or it would own runs and receive notices.
2. **A pushed turn is invisible except for `command_lifecycle`.** The event mapper turns `command_lifecycle started` into a new `inbound` session event. The controller sets `turnActive` (so Interrupt works during a pushed turn) and the transcript shows a "catherd reported back" divider. Each pushed turn repeats `system/init`; the controller drops an `init` whose `session_id` it already has.
3. **The session is idle between roles.** The orchestrator ends its turn after `dispatch`, so the user can chat while roles run. The chat composer stays usable, and `turnActive` is false until the next push.
4. **Resume uses `peek`.** `RESUME_PROMPT` asks the resumed session to call `peek(run)` and read unread records with `result`. A record that finished while no session was open stays unread on disk, and `peek` or the next `run_start` shows it.
5. **`catherd doctor` from CatHouse reports `push: skip (no session)`.** That is expected: Setup runs doctor with the clean env. The row is shown as info.

## Not covered

- A reload in the middle of a pushed run (resume with `peek`) was not repeated live. It is covered by the controller unit test for `RESUME_PROMPT` and by catherd's own guarantee that unread records wait on disk.
- Linux: catherd's `doctor` says whether `crossSessionInbound` must be set there. Remote and Linux runs are still untested (see `docs/STATUS.md`).
