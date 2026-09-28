# 0004: English UI, i18n-ready

- Status: accepted (2026-09-28, user decision)

## Decision
All UI strings are English, kept in a strings table: `@vscode/l10n` bundles for the extension and webview, `package.nls.json` for the manifest. No hard-coded user-facing strings in components. Layout uses logical CSS properties (`margin-inline-start` etc.) so an RTL locale (Persian) can be added later without rework.
