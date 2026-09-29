# 0008: Platform-specific VSIX packages

- Status: accepted (2026-09-28)

## Context
The Agent SDK's Claude Code binary is a platform optional dependency (`@anthropic-ai/claude-agent-sdk-<platform>`). v1 targets macOS and Linux.

## Decision
Build one VSIX per target with `vsce package --target darwin-arm64|darwin-x64|linux-x64|linux-arm64`. Each contains only its platform's binary. The extension resolves the bundled binary path at runtime and fails Setup with a clear message if it is missing. Windows comes after v1. The original plan also deferred Marketplace publishing, but the distribution amendment below supersedes that part.

## Distribution amendment (2026-09-29)

The platform builds are published as `cathouse.cathouse` on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse) and [Open VSX](https://open-vsx.org/extension/cathouse/cathouse). These are the normal install paths for VS Code and Cursor respectively. GitHub Releases keep all four target-specific VSIX files plus `SHA256SUMS` for manual/offline installation and release verification. This changes the channel, not the platform-specific packaging decision.

## Implementation (2026-09-28)

`packages/extension/scripts/package.mjs [--target <t>]` (`pnpm package` for this machine; `pnpm package:all` for all four) stages `packages/extension/.pkg/<target>/`:
- the manifest without dev fields, with `dependencies` set to the SDK and its platform package (so vsce's npm-based detection packs `node_modules`; `--no-dependencies` skips `node_modules` entirely);
- `dist/extension.js`, `dist/webview/index.{js,css}`, `media/`, `l10n/`, `package.nls.json`, `README.md`;
- `node_modules/@anthropic-ai/claude-agent-sdk` (its `optionalDependencies` and peers removed from the staged copy's package.json: the peers `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk` and `zod` are type-only, and the SDK loads and starts a session without them; verified) plus `claude-agent-sdk-<target>` (copied from the local install for this machine's target; fetched with `npm pack <pkg>@<sdk version>` for other targets).

Then it runs `vsce package --target <t>` → `dist/cathouse-<target>-<version>.vsix`.

Verified: darwin-arm64 VSIX 96 MB. Installed with `code --extensions-dir <tmp> --install-extension`, the binary keeps its exec bit and reports 2.1.283. The Setup e2e run against the installed folder (`CATHOUSE_E2E_EXT_PATH`) shows the bundled Claude ok and `canStart: true`. The linux-x64 VSIX (105 MB) builds, with `TargetPlatform="linux-x64"` and the linux binary inside, but was **not run** (no Linux machine). darwin-x64 and linux-arm64 are built the same way and are also unrun.
