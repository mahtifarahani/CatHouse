# Phase 5 release-preparation report

Status: code-complete on macOS as of 2026-09-28; distribution is live on the VS Code Marketplace and Open VSX, while the final license and remote/native runtime verification remain owner/external decisions.

## Delivered

- Platform-specific VSIX packaging for `darwin-arm64`, `darwin-x64`, `linux-x64`, and `linux-arm64`; the installed `darwin-arm64` artifact runs the bundled Claude binary. See ADR 0008 and `packages/extension/scripts/package.mjs`.
- The extension README at `packages/extension/README.md`.
- The last eight public-surface TUI parity items. The status line and ARIA tabs are at `packages/webview/src/App.tsx:89-208`; accessible toast delivery is at `packages/webview/src/lib/toasts.tsx:8-47`; profile dirty guarding, filtering, confirmations and save handling start at `packages/webview/src/pages/ProfilesPage.tsx:37-140`; dialogs and focus trapping are at `packages/webview/src/pages/ProfilesPage.tsx:384-447,501-533`.
- A three-way profile-draft rebase. A Save uses a snapshot; edits made while the request is running are applied over the saved base (`packages/webview/src/pages/profileDraft.ts:32-42,84-88`). Submitted treat-like changes are cleared while later ones remain staged.
- Model usability no longer relies on colour: usable rungs carry `✓` (`packages/webview/src/pages/ModelsPage.tsx:143-162`).
- Fixed-name Vite assets now have a per-attach cache key (`packages/extension/src/panel/host.ts:23-48`). Without it, Extension Development Host reloads could display an old bundle.

## Accessibility and theme evidence

The installed Extension Development Host was walked with macOS accessibility inspection enabled. The dashboard exposes a named tablist and tabpanels; ArrowLeft/ArrowRight/Home/End move selection and focus; the observed ArrowRight transition selected Models from Profiles. Confirmation and save dialogs are labelled, modal, focus-trapped, initially focus Cancel, and close on Escape. Toasts use polite live regions and errors use `role=alert`. Controls expose labels in the accessibility tree.

Profiles and their form controls were visually inspected in VS Code 1.139.1 with **Light Modern**, **Dark Modern**, and **Dark High Contrast**. Text, status tones, input/card boundaries, focus borders and disabled states remained visible. All colours still come from `--vscode-*` tokens. Reduced motion remains enforced by `packages/ui/src/theme.css`.

## Verification

Copy-pasteable commands, all green on macOS arm64:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Results: 68 unit tests passed (7 opt-in/live tests skipped); default e2e run 2 passed and 3 workspace-dependent scenarios were pending. The prepared-workspace e2e evidence is documented in `docs/testing.md`.

## Invariants and traps

- CatHouse still does not write catherd files and does not call forbidden orchestrator tools.
- `beforeunload` is the only browser lifecycle hook available inside the webview; VS Code exposes no cancellable view-dispose event and not every close path guarantees a browser dialog. The exact serializable draft is therefore also persisted through `acquireVsCodeApi().setState` and restored on reopen. Profile switching and Discard use an explicit in-webview confirmation.
- Keep the query cache key on both `index.js` and `index.css`; fixed Vite filenames otherwise survive some Extension Development Host reloads.
- A live remote test must install the Linux-target VSIX on the remote extension host; running only the UI locally does not verify workspace-extension placement.

## Remaining release gates

1. Owner selects the final SPDX license; the published Marketplace/Open VSX identity is `cathouse.cathouse`, while the manifest still says `UNLICENSED`. The first GitHub release version is `0.1.0`.
2. Run the linux-x64 VSIX through Setup and a short catherd task on SSH or Dev Containers. No remote runtime was available on this machine, so this is explicitly **untested**, not silently passed.
3. `darwin-x64` and Linux artifacts are build-verified but have not been executed on native target machines.

Distribution was added after this checkpoint (`docs/release/github.md`, 2026-09-29). Version `0.1.0` is available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse), [Open VSX](https://open-vsx.org/extension/cathouse/cathouse), and as four GitHub Release VSIX files with `SHA256SUMS`. This closes the publisher/distribution gate, but not the license, remote, or native-execution gates above.
