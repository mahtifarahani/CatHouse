# Runbook (dev machine from zero)

Status: prerequisites are known; build/run commands get filled in during Phase 0.

## 1. Prerequisites (macOS or Linux)

```bash
# Node 22+ and pnpm
node --version
pnpm --version
```

```bash
# Bun >= 1.4 (catherd runs on Bun)
curl -fsSL https://bun.sh/install | bash
```

```bash
# catherd 1.0.0: first run is silent ~30 s while bunx resolves packages
bunx catherd-cli@1.0.0 init --no-input
```

```bash
# Claude plugin, with the HTTPS workaround for the SSH-only marketplace source
claude plugin marketplace add 47vigen/catherd
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com: claude plugin install catherd@catherd
```

```bash
# Default worker backend (Codex >= 0.157.0), then log in
npm i -g @openai/codex
codex login
```

```bash
# Verify: exit 3 means not ready; read each failing row's fix
bunx catherd-cli@1.0.0 doctor
```

Once CatHouse's Setup screen exists, it performs these steps from buttons. Use the manual commands above only to prepare a dev machine or to debug Setup.

## 2. Isolated catherd environment for tests

`CATHERD_HOME=$(mktemp -d)` puts catherd's config and data under that folder. The Claude side (`~/.claude/agents`, plugins) is still shared unless `CLAUDE_CONFIG_DIR` and `CATHERD_CLAUDE_AGENTS_DIR` also point to temp dirs. Use all three for contract tests.

## 3. Build, run, package

Filled in at the end of Phase 0 (`pnpm install`, `pnpm build`, F5 "Run CatHouse", `pnpm package --target <platform>`).

## 4. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `ssh: connect to host github.com port 22` on plugin install | marketplace `git-subdir` source uses SSH | use the `GIT_CONFIG_*` HTTPS env above |
| `error E_RUNTIME_TOO_OLD` | Bun < 1.4 | `bun upgrade` |
| doctor `plugin` row "stale" | plugin version ≠ catherd version | `claude plugin marketplace update catherd && claude plugin update catherd@catherd`, then a new session |
| `Agent type … not found` in a run | profile agents changed after the session started | start a new orchestrator session |
| doctor `sandbox:codex` "not tested" | dead probe on Codex 0.157 (upstream bug) | ignore |
| `bunx` seems hung on first run | resolving ~108 packages | wait ~30 s |
