# Testing

Status: strategy agreed; commands get filled in during Phase 0.

| Layer | Tool | What | Needs network / catherd |
|---|---|---|---|
| Unit | vitest | gateway adapters (raw → protocol) on recorded fixtures; stderr error parser; SDK message → event mapper; profile draft reducer and patch diff; allowlist of MCP tools (forbidden tools rejected) | no |
| Contract | vitest, tagged `contract` | real `catherd-cli@1.0.0` in an isolated env (`CATHERD_HOME`, `CLAUDE_CONFIG_DIR`, `CATHERD_CLAUDE_AGENTS_DIR` in temp dirs): `init --no-input` → `doctor --json` → MCP `profile_set` valid/invalid → `profile_validate` → `catalog_query` → `status`. Records fixtures to `packages/compat/fixtures/1.0.0/` | Bun + network on first run |
| E2E | `@vscode/test-electron` | fresh install (temp HOME) shows only Setup; old Bun / stale plugin / missing CLI / failed install each show a specific message and action; the dashboard opens after Setup passes | depends on scenario |
| Manual E2E | human + checklist | a 3-lane task on a scratch repo from the UI; live roles; answer a question and a permission card; reload mid-run → Continue the same run (verify no duplicate with `catherd runs list --json`); cancel a role; edit a profile, treat-like, refresh models, see a doctor failure | real accounts |
| Visual | manual screenshots | sidebar and panel in Light, Dark, High Contrast | no |

Fixtures are real catherd output, redacted. When catherd's version changes, re-record them under a new version folder and add an adapter entry to `compat.json`.
