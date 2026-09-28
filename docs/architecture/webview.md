# Webviews

Status: **pages built in Phases 1–3** (Setup, Orchestrator, Overview, Runs, Profiles, Models, Diagnostics).

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

## Pages (`packages/webview/src/pages/`, `session/`, `setup/`)

Navigation (`App.tsx`): tabs Overview · Orchestrator · Runs · Profiles · Models · Diagnostics · Setup, remembered with `viewState`. **Only Setup is shown until `gateOpen`** (docs/architecture/setup.md). The sidebar shows the session phase, pending prompts, and one button (Open dashboard / Open Setup).

| Page | Data (protocol → gateway) | Behaviour |
|---|---|---|
| Overview | `setup.state`, `profiles.get`, `runs.list` (2 s) | setup summary, the profile this repo runs on (active / this repo, invalid badge), newest 5 runs, New task |
| Orchestrator | `session.*` | see `orchestrator.md`; Start/Resume disabled with the Setup reason until `canStart` |
| Runs list | `runs.list` (2 s, pausable) | live/idle, title, role runs, landed, budget %, age; newest 10 get landed/budget from `status(run)` |
| Run detail | `runs.get` (1 s, pausable), `runs.reply`, `runs.debug`, `runs.cancelRole` | budget meter (green < 80 %, amber < 100 %, red), totals + Jev line, LIVE with **double-click cancel within 5 s** (the host then notes it to the live orchestrator), CLIMBS, ROUTES (last row per lane), LANDED, role runs with reply + debug tails (exit, stderr, events, supervisor), full `state.md`, warnings |
| Profiles | `profiles.get`, `catalog.query`, `profiles.save/activate/unbindRepo/create/remove` | profile picker (active / this repo), Make active / Use for this repo / Unbind / New (copy) / Delete (double click; hidden for active or bound profiles); saved-profile validation box; editor: roles (enabled, access + enforced/advisory, ordered rungs ↑↓✕, add rung from the catalog for that role; an unscored rung asks for a treat-like, staged with the edit), start-on rung, routing, billing, harness isolation, budget, failover (+ inferred marks), timeouts, preflight confirm, heavy slots, notify; staged draft (`profileDraft.ts`: 100-step undo/redo, dirty count), **Save… opens a diff preview** (`describePatch`) with Save / Save & make active / Save & use for this repo; results: saved (+ warnings, new-session agents, "applies to"), refused (catherd's errors; nothing written), conflict (changed on disk → reload), unchanged |
| Models | `catalog.query` (filters), `catalog.refresh`, `catalog.treatLike` | role/backend/text/scored filters; per model: backend, not-listed badge, roles, notes, rung chips (green usable, ≈ treated like, ? unscored → click to map), cost tier |
| Diagnostics | `setup.state` doctor rows, `setup.run check-readiness`, `diagnostics.openLogs`, `diagnostics.lock` | doctor rows with fixes + Copy; open catherd's logs folder; run a command through `catherd lock` in a terminal |

Shared: `lib/usePoll.ts` (interval polling, pause, keeps the last good data on error), `ui` bits (`Section`, `Badge`, `Card`, `Meter`, `Empty`, `ErrorText`, `inputClass`).
