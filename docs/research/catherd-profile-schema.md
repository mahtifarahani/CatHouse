# catherd 1.0.0: profile schema

Citations are relative to the catherd repo at commit `b257da7`. Main files: `src/domain/profile.ts`, `src/domain/profile-rules.ts`, `src/services/profile-service.ts`.

## Documents, patches and resolution

- **Stored document** (`ProfileDocSchema`, `profile.ts:48-66`): every level keeps unknown keys, and enums are stored as plain strings. Stored values this version doesn't know are read cautiously (`STORED_FALLBACK`, `profile.ts:79-84`) and reported as warnings.
- **Patch** (`ProfilePatchSchema`, `profile.ts:251-275`, used by MCP `profile_set` and CLI `profile set`): strict at every level, merged with RFC 7396 (maps merge, arrays replace, `null` deletes). See `catherd-mcp-contract.md` §5 for the TypeScript shape.
- **Resolution** (`resolveProfile`, `profile.ts:196-241`) fills in defaults.
- **Names** match `^[a-z0-9][a-z0-9-]{0,31}$`. `default` exists even without a file.

## Keys

| Key | Type | Resolved default | What `init` writes (`defaultProfileDoc`, `:173-193`) | Unknown stored value is read as |
|---|---|---|---|---|
| `schema` | literal `1` (required) | none | 1 | newer → `E_CONFIG_NEWER_SCHEMA` |
| `name` | string? | the file name | name | none |
| `objective` | `"cost"\|"speed"` | `cost` | `cost` | `cost` |
| `jev.use` | `"auto"\|"off"` | `auto` | `auto` | `off` |
| `billing` | record BillingKey → `"chatgpt-plan"\|"claude-plan"\|"subscription"\|"metered"` | merged over `DEFAULT_BILLING`: codex chatgpt-plan; claude, claude-code claude-plan; opencode-go subscription; opencode, cursor, grok metered (`cost.ts:8-16`) | codex, claude, claude-code, opencode-go, opencode | that key's default |
| `roles.<role>` | `{enabled?, access?: "read-only"\|"workspace-write"\|"full", rungs?: string[], defaultRung?}` | a missing role takes `BUILTIN_ROLES` (`:141-155`); access from `DEFAULT_ACCESS` (`roles.ts:16-25`); `defaultRung` inherited only if `rungs` is not overridden | architect `claude:claude-opus-5-5#high`; verifier `claude:claude-opus-5-5#low`; worker `[codex:gpt-6-luna#high, codex:gpt-6-sol#medium, codex:gpt-6-sol#high, codex:gpt-6-sol#xhigh]` with defaultRung `codex:gpt-6-sol#medium`; reviewer `codex:gpt-6-sol#high`; ui-reviewer and artist `codex:gpt-6-sol#medium`; writer and researcher `codex:gpt-6-luna#high` | access → `read-only` |
| `harness.<adapter>` | `{isolated?: boolean}` | `false` | codex, claude-code, opencode all `false` | none |
| `failover` | record rung → rung | **the document's own map only** (no default merge) | luna#high → `opencode:opencode-go/gpt-6-luna#high`; sol medium/high/xhigh → `opencode:opencode-go/kimi-k3#max` (inferred) | none |
| `budget` | `{minutes?, tokens?, usd?}` (positive) | `{}` (no cap) | `{}` | none |
| `timeouts` | `{idleMin?, wallMin?}` (positive) | idle 15, wall 90 | same | none |
| `preflight.confirm` | boolean | `false` | `false` | none |
| `lock.heavy` | positive int or `"cpus/2"` | `"cpus/2"` | `"cpus/2"` | none |
| `notify` | array of `"milestone"\|"finish"\|"blocked"` | all three | all three | skipped. Only the skill reads it. |

Default access: architect, reviewer, researcher `read-only`; worker, writer, artist `workspace-write`; verifier, ui-reviewer `full`.

Rung format: `<backend>:<model>#<effort>`, backend ∈ `codex, claude-code, opencode, cursor, grok, claude` (`ids.ts:15-48`).

## Two views of the same profile

| | Source | Harness | Lock |
|---|---|---|---|
| MCP `profile_get` → `ProfileView` (`ports.ts:12-29`, `profile-service.ts:248-265`) | `{active, here, profiles, profile, enforcement}` | `isolated: {backend: bool}` | `heavy` |
| CLI `profile show --json` → `Profile` (`profile.ts:119-132`) | `{profile, active, enforcement, standIns}` | `harness: {backend: {isolated}}` | `lock: {heavy}` |

Both have every default filled in. CatHouse normalises both into one `protocol` model. `standIns: [{from, to, inferred, via}]` exists only on the CLI view.

## Writes (`profile-service.ts`)

- `patchProfile` takes the profiles lock, validates first, and writes nothing when there are errors. It saves, then relinks agents; if the relink is refused it rolls back.
- `expect` refuses the save when the file changed since it was shown (`:93-119`). **Neither the CLI nor MCP passes `expect`**; only the TUI does. CatHouse's substitute: re-read the profile right before saving and compare.
- CLI `profile set` never creates a profile. MCP `profile_set` with a new `name` creates one from the default.
- `deleteProfile` refuses the active profile and any profile bound to an existing repo (`:155-189`).
- Changes to codex/claude-code/opencode rungs, access and isolation apply at the next dispatch, even mid-run. Native Claude agent changes (`newSessionNeededFor`) apply from the next Claude session.

## Validation (`profile-rules.ts:60-205`)

**Errors (block a save):**
- `roles.worker.enabled` false ("the worker cannot be disabled").
- For each enabled role and rung: not a valid rung; backend can't run here; can't fill the role (`capableFor` / `ROLE_NEEDS`); effort not offered by the listing; unscored (fix: `catherd catalog treat-like …`).
- `defaultRung` not among the role's rungs.
- A role with no usable rung (fix: enable a rung, or `roles.X.enabled false`).
- Failover: either side invalid; stand-in backend can't run; stand-in unscored; stand-in on the same quota (`claude` and `claude-code` share one quota; `:42`).

**Warnings (don't block):** unknown stored value; access differs from the default (checked for disabled roles too); effort unchecked because no listing yet (fix: `catherd catalog refresh`); model missing from the backend's listing; a Claude rung that clears no routing bar while other rungs exist; no worker rung clears some kind/difficulty pair; a native `claude:` failover stand-in; a failover source on no enabled ladder.

## TUI profile tree (what CatHouse's Profiles page mirrors)

See `catherd-tui-parity.md` §Profiles for rows, value columns and edit actions.
