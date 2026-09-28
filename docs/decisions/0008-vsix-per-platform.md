# 0008: Platform-specific VSIX packages

- Status: accepted (2026-09-28)

## Context
The Agent SDK's Claude Code binary is a platform optional dependency (`@anthropic-ai/claude-agent-sdk-<platform>`). v1 targets macOS and Linux.

## Decision
Build one VSIX per target with `vsce package --target darwin-arm64|darwin-x64|linux-x64|linux-arm64`. Each contains only its platform's binary. The extension resolves the bundled binary path at runtime and fails Setup with a clear message if it is missing. Windows and Marketplace publishing come after v1.
