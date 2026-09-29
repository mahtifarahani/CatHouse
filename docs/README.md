# CatHouse docs map

| Doc | What it holds |
|---|---|
| [`../README.md`](../README.md) | Public project overview, features, requirements, getting started, development and release status |
| [`../AGENTS.md`](../AGENTS.md) | Entry point for any agent: goal, rules, stack, layout |
| [`STATUS.md`](STATUS.md) | Live checklist of phases, the exact next step, environment facts, open risks |
| [`plan.md`](plan.md) | The approved execution plan (Persian with English identifiers) |
| [`runbook.md`](runbook.md) | Setting up a dev machine from zero, running against real catherd, building VSIX, common problems |
| [`testing.md`](testing.md) | Test layers and how to run them |
| [`release/phase5.md`](release/phase5.md) | Release-prep implementation, accessibility/theme evidence, verification and remaining external gates |
| [`release/github.md`](release/github.md) | Distribution: VS Code Marketplace, Open VSX for Cursor, GitHub Release artifacts, version tags and changelog notes |
| **research/** | The catherd docs below describe the **1.0.0 baseline**; CatHouse pins **1.2.0**, and the upgrade doc lists every change that matters |
| [`research/catherd-1.2-upgrade.md`](research/catherd-1.2-upgrade.md) | **catherd 1.0.0 → 1.2.0 for CatHouse:** push instead of `wait`, read/ownership rules, new tools and JSON fields, install changes, parity backlog |
| [`research/catherd-overview.md`](research/catherd-overview.md) | What catherd is: roles, rungs, ladders, Jev, the skill's sequence, surfaces |
| [`research/catherd-mcp-contract.md`](research/catherd-mcp-contract.md) | The 21 MCP tools of 1.0.0: inputs, outputs, error envelope, codes, `wait` single-delivery rule (superseded in 1.1: see the upgrade doc) |
| [`research/catherd-cli-contract.md`](research/catherd-cli-contract.md) | Every CLI command, flags, `--json` shapes, exit codes, stderr error format |
| [`research/catherd-data-layout.md`](research/catherd-data-layout.md) | Config/data paths, run folder, JSONL shapes, state.md, dispatch dir, what to watch |
| [`research/catherd-lifecycle.md`](research/catherd-lifecycle.md) | Admission, supervisor, liveness, finalize, wait, cancel, reconcile, budget, failover |
| [`research/catherd-doctor-setup.md`](research/catherd-doctor-setup.md) | Every doctor check, backend minimums and fixes, `init` step by step, agent links |
| [`research/catherd-profile-schema.md`](research/catherd-profile-schema.md) | Profile keys, defaults, patch rules, validation, the two views |
| [`research/catherd-tui-parity.md`](research/catherd-tui-parity.md) | Feature-parity checklist vs the TUI, with the source for each feature |
| [`research/catherd-known-issues.md`](research/catherd-known-issues.md) | 1.0.0 bugs and limits that affect CatHouse (SSH plugin install fixed in 1.1, …) |
| [`research/claude-agent-sdk.md`](research/claude-agent-sdk.md) | Agent SDK options, plugins, canUseTool/AskUserQuestion, sessions, messages, risks |
| [`research/public-surface-gaps.md`](research/public-surface-gaps.md) | What catherd doesn't expose publicly, CatHouse workarounds, upstream PR list |
| **decisions/** (ADRs) | |
| [`decisions/0001-claude-cli-conditional.md`](decisions/0001-claude-cli-conditional.md) | Standalone claude CLI only for `claude-code:` rungs |
| [`decisions/0002-permission-policy.md`](decisions/0002-permission-policy.md) | catherd tools allowed; user settings; UI prompt cards |
| [`decisions/0003-pnpm-workspaces.md`](decisions/0003-pnpm-workspaces.md) | Toolchain |
| [`decisions/0004-ui-language.md`](decisions/0004-ui-language.md) | English, i18n-ready, RTL-safe CSS |
| [`decisions/0005-gateway-single-boundary.md`](decisions/0005-gateway-single-boundary.md) | Gateway is the only boundary; forbidden orchestrator tools |
| [`decisions/0006-long-lived-mcp-per-repo.md`](decisions/0006-long-lived-mcp-per-repo.md) | One MCP process per repo |
| [`decisions/0007-run-files-reader.md`](decisions/0007-run-files-reader.md) | Run files via MCP `read_run_file`, never from disk |
| [`decisions/0008-vsix-per-platform.md`](decisions/0008-vsix-per-platform.md) | One VSIX per platform |
| **architecture/** | |
| [`architecture/overview.md`](architecture/overview.md) | Packages, data flow, runtime processes |
| [`architecture/protocol.md`](architecture/protocol.md) | Webview⇄host protocol v1, methods table, router error cases, how to add a method |
| [`architecture/webview.md`](architecture/webview.md) | Full Activity Bar surface, CSP, theming via `--vscode-*`, strings |
| [`architecture/gateway.md`](architecture/gateway.md) | CLI/MCP gateway, env, allowlist, schemas, CatHouse error codes, contract tests |
| [`architecture/orchestrator.md`](architecture/orchestrator.md) | Agent SDK session, controller, prompts, start/resume |
| [`architecture/setup.md`](architecture/setup.md) | Setup gate: detectors, evaluator, installers, UI, e2e evidence |
| [`spikes/phase1.md`](spikes/phase1.md) | Phase 1 spike results and the design findings they produced |
| [`spikes/catherd-1.2.md`](spikes/catherd-1.2.md) | catherd 1.2 push notices in an Agent SDK session: proof, SDK message shape, a full pushed run |
