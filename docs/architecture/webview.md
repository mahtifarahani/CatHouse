# Webviews

Status: **Phase 0 shell built.** Pages come in Phases 2–4.

## Two surfaces, one app

| Surface | VS Code API | id | Source |
|---|---|---|---|
| Sidebar | `WebviewView` in the `cathouse` activity-bar container | `cathouse.sidebar` | `packages/extension/src/panel/sidebar.ts` |
| Dashboard | `WebviewPanel`, one per window, revealed if open | `cathouse.dashboard` (command `cathouse.openDashboard`) | `packages/extension/src/panel/dashboard.ts` |

Both load the same Vite build. `#root[data-view]` (`sidebar` or `dashboard`) tells the React app which surface it is (`packages/webview/src/main.tsx`). `retainContextWhenHidden` is off; per-view UI state goes in `viewState` (see `protocol.md`).

## Loading and CSP (`packages/extension/src/panel/webview-html.ts`, `host.ts`)

- The Vite build writes fixed names, `packages/extension/dist/webview/index.js` and `index.css` (no hashes; `packages/webview/vite.config.ts`), so the host can reference them.
- `localResourceRoots` = `dist/webview` only.
- CSP: `default-src 'none'; img-src <cspSource> data:; style-src <cspSource>; font-src <cspSource>; script-src 'nonce-<random>'`. No `unsafe-inline`, no `unsafe-eval` (unit-tested). React's style props go through the CSSOM, which the CSP does not block. Never inject `<style>` tags or inline `style=""` HTML strings.
- A new 16-byte base64 nonce is made for every HTML load.

## Styling (`packages/ui`)

- Tailwind v4 via `@tailwindcss/vite`. `packages/webview/src/index.css` imports `tailwindcss`, then `@cathouse/ui/theme.css`, and adds `@source "../../ui/src"` so component classes are generated.
- `theme.css` maps every colour token to a `--vscode-*` variable (`bg-primary` = `--vscode-button-background`, `text-muted-foreground` = `--vscode-descriptionForeground`, `text-danger` = `--vscode-errorForeground`, …), so Light, Dark and High Contrast work with no theme-specific CSS. **Never use literal colours.**
- Focus ring: `--vscode-focusBorder`. Reduced motion is honoured globally.
- Components follow shadcn conventions (`cva` variants + `cn()`). Today: `Button` (primary/secondary/ghost). Add shadcn components by copying them into `packages/ui/src/components/` and replacing their colour tokens with the ones above.

## Strings

`packages/webview/src/lib/strings.ts` holds every user-facing string, used through `t(key, vars)` (ADR 0004). The manifest uses `packages/extension/package.nls.json`; host-side strings will use `vscode.l10n.t` with `packages/extension/l10n/`. When a second locale arrives, switch `strings.ts` to `@vscode/l10n` bundles without touching call sites. Use logical CSS properties so RTL works.

## Next (Phase 2–3)

Pages: Setup (gate), Overview, Runs, Run detail, Profiles, Models, Diagnostics, Session. Parity checklist: `docs/research/catherd-tui-parity.md`.
