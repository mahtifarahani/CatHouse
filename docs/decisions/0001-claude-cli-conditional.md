# 0001: The standalone `claude` CLI is a Setup requirement only for `claude-code:` rungs

- Status: accepted (2026-09-28, user decision)

## Context
catherd needs Claude in two ways: (1) the orchestrator session that runs the `/catherd` skill, and (2) the `claude-code` worker backend, which spawns `claude` headless and needs ≥ 2.1.282 (`src/adapters/claude-code/index.ts:28` in catherd). The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) bundles its own Claude Code binary; SDK 0.3.N ships CLI 2.1.N. The machine this was planned on has `claude` 2.1.168 on PATH.

## Decision
- The orchestrator runs on the SDK's bundled binary (SDK pinned ≥ 0.3.282; currently 0.3.283).
- Plugin install/update and `auth status --json` / `auth login` also run through the bundled binary.
- The standalone `claude` CLI ≥ 2.1.282 appears in Setup only when the active or repo-bound profile has a `claude-code:` rung (or failover stand-in). Then it is a blocking item for starting tasks.

## Rejected
- Always requiring the standalone CLI (original plan): it forces an install most users don't need.

## Consequences
- Each VSIX is platform-specific (ADR 0008).
- Setup must resolve the bundled binary path from the platform package.
