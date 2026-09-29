> Reference copy of the approved plan (2026-09-28). Plan changes are recorded here and in docs/decisions/.

# CatHouse — پلن اجرایی افزونهٔ VS Code برای catherd 1.0.0

## Context

`catherd` (npm: `catherd-cli@1.0.0`, Bun ≥ 1.4) یک orchestrator است: Claude در جلسهٔ خود کاربر نقش orchestrator را بازی می‌کند (skill `/catherd`)، نقش‌های architect/verifier به‌صورت subagent بومی Claude و worker/reviewer/… به‌صورت پردازه‌های جدا (Codex، opencode، claude-code headless) از طریق MCP server خود catherd اجرا می‌شوند. داشبورد فعلی آن یک TUI ترمینالی (OpenTUI) است. CatHouse آن را به یک افزونهٔ VS Code تبدیل می‌کند: Setup اجباری، اجرای کامل `/catherd` از داخل پنل، و داشبورد Runs/Profiles/Models/Diagnostics — بدون کپی‌کردن منطق orchestration؛ `catherd` منبع حقیقت می‌ماند.

ریپوی CatHouse خالی است (فقط `.vscode/settings.json`). روی این دستگاه: Node 22.13، pnpm موجود، `claude` 2.1.168، Bun نصب نیست.

### یافته‌های R&D که پلن اولیه را تغییر می‌دهند

1. **SDK باینری خودش را دارد.** `@anthropic-ai/claude-agent-sdk@0.3.283` باینری Claude Code 2.1.283 را bundle می‌کند (نسخهٔ SDK = 0.3.N ⇔ CLI 2.1.N). پس orchestrator به `claude` روی PATH نیاز ندارد. **تصمیم کاربر:** CLI مستقل فقط وقتی شرط Setup است که profile فعال rung از نوع `claude-code:` داشته باشد. نصب پلاگین هم با همان باینری bundle‌شده (`<bundled> plugin …`) انجام می‌شود.
2. **SDK پلاگین marketplace را نصب نمی‌کند.** پلاگین باید با `claude plugin marketplace add 47vigen/catherd` + `claude plugin install catherd@catherd` نصب شود؛ مسیر نصب از `~/.claude/plugins/installed_plugins.json` (`installPath`, `version`) خوانده و به‌صورت `plugins: [{type:"local", path}]` به SDK داده می‌شود (ایمن‌تر از اتکا به `enabledPlugins`). دستور اجرا: prompt `"/catherd:catherd <task>"` (نسخهٔ namespaced؛ در تست headless خود catherd کار کرده).
3. **باگ blocker نصب پلاگین:** `marketplace.json` منبع `git-subdir` با `"url":"47vigen/catherd"` دارد که Claude Code آن را روی SSH کلون می‌کند؛ بدون کلید SSH گیت‌هاب شکست می‌خورد. Setup باید نصب را با env `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com:` اجرا کند (docs/dev/ideas.md).
4. **`wait` و `cancel` تحویل تک‌مصرفی دارند.** هر record فقط به یک caller داده می‌شود (lease روی دیسک). Gateway **هرگز** `wait` صدا نمی‌زند. `cancel` از UI مجاز است ولی بعدش باید به session زندهٔ orchestrator یک پیام اطلاع داده شود (record برنمی‌گردد به `wait` او).
5. **سطح عمومی ناقص است.** این‌ها فقط در سرویس‌های داخلی‌اند و از CLI/MCP در دسترس نیستند: `routes.jsonl` (CLIMBS/ROUTES)، `landed`/`budget` در `runs list --json`، اعتبارسنجی draft پروفایل، پیش‌نمایش agent files، ذخیرهٔ شرطی (`expect`)، خروجی JSON فرمان‌های mutating. راه‌حل: (الف) `status --json` و `runs show --json` پوشش اصلی را می‌دهند؛ (ب) یک `RunFilesReader` فقط‌خواندنی برای `routes.jsonl` با اعتبارسنجی zod، پشت Gateway و نسخه‌بندی‌شده؛ (ج) اعتبارسنجی draft از طریق `profile_set` که قبل از نوشتن validate می‌کند (`saved:false` + `errors`)؛ (د) فهرست PRهای upstream (پیوست) برای catherd 1.1.
6. **خروجی MCP:** نتیجهٔ موفق فقط `content[0].text` = JSON است (بدون `structuredContent`)؛ خطا `isError:true` + `structuredContent:{code,message,fix}`. خطاهای CLI همیشه متنی روی stderr: `error E_CODE: message` + `fix: …`؛ exit codes: 0/1/2/3/130.
7. **هر پردازهٔ `catherd mcp` در startup روی همهٔ runها `reconcileAll` می‌نویسد** ← Gateway یک پردازهٔ MCP بلندمدت per workspace-folder نگه می‌دارد، نه per-call. `cwd` آن = ریشهٔ repo، و همیشه `repo` صریح پاس می‌شود.
8. **`wait` تایم‌اوت ندارد** و فقط با `progressToken` هر ۳۰s progress می‌فرستد. در SDK، MCP call طولانی باید زنده بماند ← `env.MCP_TOOL_TIMEOUT` بزرگ در OrchestratorSession + spike اثبات در مرحلهٔ ۱.
9. **catherd agent فایل‌ها را در `~/.claude/agents` لینک می‌کند** و Claude فقط در شروع session آن‌ها را می‌خواند (`newSessionNeededFor`). CatHouse بعد از تغییر profile که `newSessionNeededFor` برگرداند، session بعدی را تازه می‌سازد (و `query.reloadPlugins()` را امتحان می‌کند).
10. **Bun لازم است** (CLI فقط روی Bun اجرا می‌شود) ← سرویس‌های catherd را در extension host (Node) import نمی‌کنیم؛ فقط spawn.
11. **`doctor` بی‌اثر نیست:** listingهای مدل را بازنویسی می‌کند، probe در locks می‌نویسد و `catherd mcp` را اجرا می‌کند (reconcile همهٔ runها). ← هرگز روی تایمر؛ فقط در Setup، بعد از هر نصب و با دکمهٔ Re-check. gate اولیه با detectorهای ارزان (`bun --version`، `catherd --version`، `installed_plugins.json`).
12. **وضعیت live فقط با polling درست است:** liveness با pid/start-time تعیین می‌شود و بدون تغییر فایل عوض می‌شود. ← `status` (فقط‌خواندنی) poll شود؛ FileSystemWatcher فقط trigger است. فیلتر: `*.tmp`, `*.lock`, `collect.lease*`, `claim`؛ خط آخر ناقص JSONL نادیده.
13. **`init` حتی وقتی not ready است exit 0 می‌دهد** ← بعد از `init` همیشه `doctor --json` اجرا شود.
14. **باینری SDK وابستهٔ پلتفرم است** (`@anthropic-ai/claude-agent-sdk-darwin-arm64` و …) ← VSIX جدا per target (`vsce package --target darwin-arm64|darwin-x64|linux-x64|linux-arm64`)؛ مسیر باینری bundle‌شده برای `plugin …` و `auth status --json` هم استفاده می‌شود.
15. **حداقل نسخهٔ backendها (از adapterها):** Codex 0.157.0 (`npm i -g @openai/codex`، login: `codex login`)، claude-code 2.1.282 (login: `claude auth status --json` → `loggedIn`)، opencode 2.0.16 (v1 پشتیبانی نمی‌شود).

## تصمیم‌های تثبیت‌شده

- macOS + Linux با buildهای جداگانه؛ نصب عادی از VS Code Marketplace و Open VSX و نصب دستی/آفلاین از VSIXهای GitHub Releases. Windows هنوز پشتیبانی نمی‌شود. (Marketplace/Open VSX در نسخهٔ `0.1.0` زودتر از برنامهٔ اولیهٔ «بعد از v1» منتشر شدند.)
- Monorepo با **pnpm workspaces**؛ extension host با esbuild، webview با Vite + React 19 + shadcn/ui + Tailwind v4؛ بستهٔ `ui` مشترک.
- رنگ‌ها فقط از متغیرهای `--vscode-*` (روشن/تیره/high-contrast).
- UI انگلیسی، i18n-ready با `@vscode/l10n` (webview) و `package.nls.json` (manifest).
- **مجوزها:** ابزارهای `mcp__plugin_catherd_catherd__*` در `allowedTools`؛ بقیه از تنظیمات Claude خود کاربر (`settingSources: ["user","project","local"]`)؛ هر چیز حل‌نشده → کارت تأیید در UI با Allow once / Always (از `suggestions` با `localSettings`) / Deny.
- Pin: `catherd-cli@1.0.0`، plugin `catherd@1.0.0`، `@anthropic-ai/claude-agent-sdk@0.3.283` (≥0.3.282).

## معماری

```
cathouse/
  package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json (lint/format)
  packages/
    protocol/      # قرارداد نسخه‌دار webview⇄host (zod) + مدل‌های پایدار CatHouse
    ui/            # shadcn components + tokens نگاشته به --vscode-*
    webview/       # React app (Vite) — صفحه‌ها
    extension/     # extension host
      src/extension.ts            # activate: register views/commands, Workspace Trust
      src/setup/                  # SetupService: detectors + installers + gate
      src/gateway/                # CatherdGateway (تنها مرز upstream)
        mcp-client.ts             # @modelcontextprotocol/sdk Client over stdio, long-lived
        cli.ts                    # spawn `bunx catherd-cli@1.0.0 …`, parse --json / stderr errors
        run-files.ts              # read-only routes.jsonl reader (zod, versioned)
        adapters/v1_0.ts          # map raw → protocol models; compat matrix
      src/orchestrator/           # OrchestratorSession (Agent SDK)
      src/panel/                  # WebviewView host + message router
      src/state/                  # workspaceState: {runId ↔ sessionId}, UI prefs
    compat/        # compat.json: catherd↔plugin↔SDK matrix + contract fixtures
  test/            # contract tests (live catherd), e2e (@vscode/test-electron)
```

### CatherdGateway (`packages/extension/src/gateway/`)
- **MCP (long-lived, per repo):** `status`, `result`, `runs_summary`, `read_run_file`, `read_knowledge`, `profile_get`, `profile_validate`, `profile_set`, `catalog_query`, `cancel`. **ممنوع:** `wait`، `dispatch`، `run_start`، `route`، `climb`، `land`، … (فقط orchestrator).
- **CLI:** `doctor --json` (exit 3 = not ready)، `runs list/show --json [--debug --name]`، `profile list/show/diff --json`، `profile use [--repo|--clear]`، `profile new/copy/rm`، `catalog list/refresh --json`، `catalog treat-like`، `init --no-input [--profile]`، `lock`، `capture-fixtures`، `--version`.
- هر پاسخ با zod اعتبارسنجی و به مدل پایدار `protocol` نگاشته می‌شود؛ رکوردها `looseObject` (فیلد ناشناخته نادیده). خطا → `CatherdError {code, message, fix}` یکسان برای MCP و CLI.
- Version handshake: `serverInfo.version` + `tools/list` (feature detection). نسخهٔ خارج از `compat.json` → صفحهٔ Upgrade، هیچ فرمانی اجرا نمی‌شود.
- Live updates: polling مثل TUI (runs هر 2s، run باز هر 1s، مکث با دکمه) + `FileSystemWatcher` روی `<data>/repos/*/runs/*/state.md` و `runs.jsonl` فقط به‌عنوان trigger برای refresh (نه منبع داده).

### OrchestratorSession (`packages/extension/src/orchestrator/`)
- یک `query()` در streaming-input mode per run فعال: `cwd` = repo، `settingSources` کامل، `plugins:[{type:"local", path: installPath}]`، `allowedTools:["mcp__plugin_catherd_catherd__*"]`، `canUseTool` → UI، `includePartialMessages:true`، `env:{MCP_TOOL_TIMEOUT: ...}`، `toolConfig.askUserQuestion.previewFormat:"markdown"`.
- `env` همان `CLAUDE_CONFIG_DIR`/`CATHERD_HOME` محیط کاربر را نگه می‌دارد تا agent linkها (`~/.claude/agents/catherd-*`) و `installed_plugins.json` با session یکی باشند.
- init message را چک می‌کند: `plugins` شامل catherd، `mcp_servers` وضعیت catherd، `plugin_errors` ← در صورت خطا بازگشت به Setup.
- prompt اول: `/catherd:catherd <task>`؛ ادامه: `/catherd:catherd` خالی (resume آخرین run) یا متن آزاد در همان session.
- استخراج `runId`: tool_result فراخوانی `run_start` (`{run, dir}`) از stream؛ ذخیرهٔ `{runId, sessionId, repo, createdAt}` در `workspaceState`.
- پیام‌ها → رویدادهای protocol: text/thinking/tool_use/tool_result، `task_started/progress/notification`، `background_tasks_changed`، result (cost/usage).
- کنترل: `interrupt()`، `setPermissionMode()`، `streamInput()` برای پیام کاربر، `close()`.
- Resume بعد از reload: `resume: sessionId` + prompt «CatHouse reconnected; continue run <runId> from its state.md». اگر transcript نبود: session تازه با `/catherd:catherd` + A-line «resume run <runId>» (skill خودش `status()` → `wait` برای جمع‌کردن نقش‌های باقی‌مانده را انجام می‌دهد) — هرگز `run_start` تکراری (گارد: اگر run ذخیره‌شده هست، prompt شروع را قفل کن).

### قرارداد webview ⇄ host (`packages/protocol`)
- `{v:1, id, kind:"request", method, params}` → `{v:1, id, kind:"response", ok, result|error}`؛ رویدادها `{v:1, kind:"event", topic, payload}` با topicهای `setup`, `session`, `run`, `profile`, `catalog`.
- همهٔ schemaها zod؛ `acquireVsCodeApi().setState` برای حفظ tab/filter.

## مستندسازی دانش پروژه (الزامی، در طول کل اجرا)

هدف: هر agent روی هر سیستمی فقط با خواندن ریپو بتواند پروژه را ادامه دهد، بدون نیاز به این گفتگو یا حافظهٔ محلی.

**قاعده:** بعد از کامل‌شدن هر بخش (هر مرحله، هر spike، هر زیرسیستم مثل Gateway یا Setup) قبل از رفتن به بخش بعد، گزارش md آن در ریپو نوشته یا به‌روز می‌شود و همراه کد همان بخش commit می‌شود. کار «تمام» حساب نمی‌شود تا گزارشش نوشته شده باشد.

ساختار:
```
AGENTS.md                      # نقطهٔ ورود هر agent: هدف، وضعیت فعلی، قواعد، نقشهٔ docs، فرمان‌های build/test
CLAUDE.md                      # فقط: "Read AGENTS.md first" + قواعد مخصوص Claude
docs/
  README.md                    # فهرست همهٔ اسناد با یک خط توضیح
  STATUS.md                    # چک‌لیست زندهٔ مراحل ۰–۵: done / in-progress / next، آخرین commit هر بخش، قدم بعدی دقیق
  plan.md                      # همین پلن (نسخهٔ مرجع، هر تغییر پلن اینجا ثبت شود)
  decisions/NNNN-<slug>.md     # ADRها: context، تصمیم، گزینه‌های ردشده، پیامد (هر تصمیم تثبیت‌شده بالا یک ADR)
  research/
    catherd-overview.md        # catherd چیست، نقش‌ها، ladder، Jev، جریان skill
    catherd-mcp-contract.md    # ۲۱ ابزار MCP با input/output، envelope خطا، کدهای خطا، قاعدهٔ تک‌مصرفی wait/cancel
    catherd-cli-contract.md    # همهٔ فرمان‌ها، فلگ‌ها، شکل --json، exit codeها، شکل خطای stderr
    catherd-data-layout.md     # مسیرهای config/data، ساختار run folder، شکل هر jsonl، state.md، dispatch dir، چه چیزی watch شود
    catherd-lifecycle.md       # admission/supervisor/finalize/wait/cancel/reconcile/budget/failover
    catherd-doctor-setup.md    # همهٔ checkهای doctor، init گام‌به‌گام، حداقل نسخهٔ backendها، agent links
    catherd-profile-schema.md  # کلیدها، پیش‌فرض‌ها، قواعد validate، دو شکل ProfileView/Profile
    catherd-tui-parity.md      # چک‌لیست کامل TUI (صفحه‌ها، commandها، دیالوگ‌ها، edit flow) و نگاشت به CLI/MCP
    catherd-known-issues.md    # باگ‌ها و محدودیت‌های 1.0.0 مرتبط با UI (SSH plugin install، …)
    claude-agent-sdk.md        # گزینه‌های query، plugins، canUseTool/AskUserQuestion، sessions/resume، پیام‌ها، Query methods، باینری bundle
    public-surface-gaps.md     # شکاف‌های سطح عمومی + راه‌حل موقت + PRهای upstream
  architecture/
    overview.md                # نمودار بسته‌ها و جریان داده
    gateway.md, orchestrator.md, protocol.md, setup.md, webview.md   # هرکدام بعد از پیاده‌سازی: API، invariantها، خطاها، تست‌ها
  spikes/phase1.md             # نتیجهٔ هر spike با شواهد (لاگ/دستور) و راه‌حل
  testing.md                   # نحوهٔ اجرای unit/contract/e2e، ساخت محیط catherd موقت، fixtureها
  runbook.md                   # راه‌اندازی dev از صفر روی ماشین تازه (Bun، catherd، plugin، SDK)، ساخت VSIX، مشکلات رایج
  CHANGELOG.md
```

قواعد نوشتن گزارش:
- مستقل و کامل: بدون ارجاع به «این گفتگو»؛ مسیر فایل‌ها با `path:line` (هم در CatHouse هم در catherd با commit `b257da7`)، نسخه‌ها دقیق، فرمان‌ها قابل کپی.
- هر گزارش بخش شامل: چه ساخته شد، چرا (لینک ADR)، چطور تست می‌شود، invariantها و تله‌ها، کارهای باقی‌مانده، قدم بعدی.
- `docs/STATUS.md` و `AGENTS.md` در پایان هر بخش به‌روز شوند.
- حافظهٔ Claude هم یک feedback memory می‌گیرد: «در این پروژه بعد از هر بخش گزارش md در docs/ بنویس».

### مرحلهٔ −۱ — ثبت دانش R&D (اولین کار اجرا، قبل از هر کدی)
- `git init` موجود است؛ ساخت `AGENTS.md`، `CLAUDE.md`، `docs/README.md`، `docs/STATUS.md`، `docs/plan.md` (کپی این پلن).
- نوشتن کامل همهٔ فایل‌های `docs/research/*` از یافته‌های R&D (سه گزارش تحقیق catherd + مستندات SDK + `sdk.d.ts` نسخهٔ 0.3.283)، با ارجاع file:line به catherd@`b257da7`.
- ADRهای 0001–0008: Claude CLI شرطی، مجوزها، pnpm، زبان UI، Gateway تنها مرز + ممنوعیت `wait`، MCP بلندمدت per repo، RunFilesReader فقط‌خواندنی، VSIX per platform.
- commit: `docs: record R&D knowledge base`.

## مراحل پیاده‌سازی

### مرحلهٔ ۰ — اسکلت (۱–۲ روز)
- pnpm workspace، tsconfig، biome، esbuild برای extension، Vite برای webview، `@vscode/vsce` برای بسته‌بندی.
- `package.json` افزونه: `engines.vscode`، `activationEvents` (onView/onCommand)، view container در activity bar (آیکن گربه) و یک `WebviewView` شامل کل داشبورد (بدون صفحهٔ واسط یا `WebviewPanel` جدا)، `capabilities.untrustedWorkspaces: {supported:false}`، `extensionKind:["workspace"]`.
- CSP سخت در webview (nonce، فقط `webview.cspSource`).

### مرحلهٔ ۱ — اثبات اجرا (spike؛ پیش‌نیاز بقیه)
دستی روی ماشین توسعه (Bun + catherd + plugin نصب شده):
1. Gateway: اتصال MCP، `status`، `doctor --json`، handshake نسخه.
2. OrchestratorSession: اجرای `/catherd:catherd` روی یک repo اسکرچ (سه util مستقل مثل تست headless خود catherd) از دکمهٔ پنل؛ گرفتن `runId` از `run_start`؛ نمایش stream.
3. **Spike‌های ریسک:** (الف) `wait` بیش از ۲ دقیقه در SDK بدون timeout زنده بماند (با `MCP_TOOL_TIMEOUT`)؛ (ب) native subagentهای catherd (`~/.claude/agents`) در session SDK ثبت شوند؛ (ج) `canUseTool` + AskUserQuestion از UI پاسخ داده شود؛ (د) reload پنجره → `resume: sessionId` → ادامهٔ همان run بدون run تکراری.
- خروجی: یادداشت spike در `docs/spikes/phase1.md` با نتیجه/راه‌حل هر ریسک. اگر (الف) شکست خورد: fallback = `wait` در background task و بیدارشدن با notification (رفتار خود Claude Code).

### مرحلهٔ ۲ — Setup اجباری
`SetupService` با detectorهای بدون side-effect و installerهای فقط-با-کلیک:

| مورد | تشخیص | نصب/ارتقا (بعد از کلیک، خروجی زنده در UI) |
|---|---|---|
| Bun ≥ 1.4 | `bun --version` (+ `~/.bun/bin` اگر PATH ناقص است) | `curl -fsSL https://bun.sh/install \| bash` |
| catherd-cli 1.0.0 | `bunx catherd-cli@1.0.0 --version` (نمایش «installing catherd…» چون bunx اول ~30s ساکت است) | `bun add -g catherd-cli@1.0.0` (اختیاری) + `bunx catherd-cli@1.0.0 init --no-input [--profile]` |
| Plugin catherd 1.0.0 | `installed_plugins.json` → `catherd@catherd` نسخه = 1.0.0 | `<claude> plugin marketplace add 47vigen/catherd` و `plugin install catherd@catherd` با env HTTPS-insteadOf؛ نسخهٔ ناهم‌خوان: `marketplace update` + `plugin update` |
| Claude login | `<bundled-claude> auth status --json` → `loggedIn` | دکمهٔ «Sign in» که ترمینال VS Code با `<bundled-claude> auth login` باز می‌کند |
| Claude CLI ≥ 2.1.282 | فقط اگر profile rung `claude-code:` دارد: `claude --version` | `npm i -g @anthropic-ai/claude-code@latest` یا installer رسمی |
| Backends | ردیف‌های `backend:<id>` در `doctor --json` (fail فقط وقتی roleی از آن استفاده کند) | نمایش `fix` هر ردیف + دکمه‌های نصب Codex (`npm i -g @openai/codex` + `codex login` در ترمینال) / opencode v2 (`curl -fsSL https://opencode.ai/v2/install \| bash`) + فرمان‌های `profile set` پیشنهادی doctor برای انتقال roleها به backend آماده |

- Gate: تا وقتی Bun/catherd/plugin/SDK-compat سبز نشده‌اند فقط Setup دیده می‌شود. بعد از ورود، مشکلات login/backend فقط دکمهٔ Start task را غیرفعال می‌کنند و در Diagnostics هشدار دارند.
- همهٔ فرمان‌ها از طریق `ProcessRunner` (spawn با PATH غنی‌شده از login shell، لغو‌پذیر، لاگ در OutputChannel «CatHouse»).
- ردیف‌های doctor که به پیش‌فرض‌ها مربوط‌اند (`access:full`, `access:advisory`) به‌صورت info نمایش داده شوند.

### مرحلهٔ ۳ — صفحه‌های اصلی (برابری با TUI)
چک‌لیست از `src/entry/tui/commands.ts` و `docs/tui-frames.md`:
- **Overview:** وضعیت Setup خلاصه، profile فعلی (active / this repo)، ۵ run اخیر (live/idle، title، repo، live count، role runs، landed، budget %).
- **Runs:** فهرست (`runs list --json` + `status --json` برای landed/budget) با فیلتر repo؛ جزئیات: header، budget bar (سبز <80٪، کهربایی <100٪، قرمز)، totals، LIVE (name/rung/زمان)، CLIMBS و ROUTES (از `RunFilesReader`)، LANDED، STATE tail، رکوردها (`runs show --json`)، Debug (`--debug --name`: exit، stderr/events/supervisor tail)، reply هر نقش (`result`)، `runs_summary`. لغو role با تأیید دوبل.
- **Profiles:** درخت مثل TUI (Roles: enabled/access/default rung/models/efforts؛ Routing؛ Harness؛ Budget؛ Failover؛ Timeouts؛ Notify)؛ draft staged با undo/redo؛ Save → دیالوگ diff (محاسبهٔ client-side patch بین base و draft) → `profile_set` (اگر `saved:false`، errorها inline) → `newSessionNeededFor` toast؛ Save & make active → `profile use [--repo]`؛ new/copy/rm؛ re-read قبل از ذخیره برای تشخیص تغییر روی دیسک.
- **Models:** `catalog_query` با فیلتر backend/role/text/scored؛ Refresh (`catalog refresh --json`)؛ `treat-like` برای rung بدون امتیاز (CLI).
- **Diagnostics:** `doctor --json` با کپی `fix`؛ `lock` (اجرای فرمان در ترمینال با `catherd lock --`)؛ `capture-fixtures`؛ لاگ‌ها (`<data>/logs/`).

### مرحلهٔ ۴ — کنترل اجرا در UI
- **Start task:** فرم (task، repo انتخابی از workspace folders، profile نمایشی، permission mode)؛ دکمهٔ «Resume latest run».
- **Session view:** transcript استریم (markdown، tool calls جمع‌شونده، subagentها با `parent_tool_use_id`)، ورودی پیام آزاد (`streamInput`)، Interrupt.
- **Prompt cards:** AskUserQuestion (۱–۴ سؤال، multiSelect، گزینهٔ Other متنی، preview)، Permission (نام ابزار، command/diff، Allow once/Always/Deny + پیام)؛ badge روی Activity Bar و notification VS Code وقتی نمای CatHouse مخفی است. **پیش‌نمایش preflight** (`needsConfirmation`) هم به‌صورت سؤال عادی orchestrator می‌آید.
- **Cancel role:** Gateway `cancel` → اگر session زنده است، `streamInput`: «CatHouse: user cancelled role <name>; record: <status>».
- **بازسازی پس از reload:** فهرست run از catherd؛ نگاشت run→session از `workspaceState`؛ دکمهٔ Continue طبق منطق resume بالا.
- یک session فعال per repo (قفل)؛ چند repo در یک پنجره = چند session مستقل.

### مرحلهٔ ۵ — آماده‌سازی انتشار
- Remote (SSH/WSL/Dev Containers): `extensionKind: workspace` ← همه‌چیز روی میزبان remote؛ Setup همان‌جا.
- چند workspace folder، Workspace Trust (در untrusted فقط صفحهٔ «trust required»).
- دسترس‌پذیری: ناوبری کیبورد، ARIA، focus ring با `--vscode-focusBorder`، reduced motion.
- `vsce package --target <platform>` → `cathouse-<platform>-<v>.vsix` برای darwin-arm64، darwin-x64، linux-x64، linux-arm64 (هرکدام فقط باینری SDK همان پلتفرم)؛ CHANGELOG؛ README با پیش‌نیازها.

## آزمون و معیار پذیرش

- **Unit (vitest):** mapping adapterها با fixtureهای واقعی (`doctor --json`, `status --json`, `runs show --json`, `profile show --json`, `catalog list --json`, خطاهای stderr)، parser پیام SDK، reducer draft پروفایل و patch-diff.
- **Contract (مقابل catherd 1.0.0 واقعی، `CATHERD_HOME` موقت):** `init --no-input` → `doctor --json` → `profile_set` معتبر/نامعتبر → `profile_validate` → `catalog_query` → `status`؛ fixtureها در `packages/compat/fixtures/1.0.0/` ذخیره و در CI بدون شبکه replay شوند.
- **E2E (`@vscode/test-electron`):** نصب تازه (HOME موقت) → فقط Setup دیده شود؛ نسخهٔ قدیمی Bun/plugin ناهم‌نسخه/CLI خارج از PATH/نصب ناموفق هر کدام پیام و اقدام مشخص دارند.
- **دستی end-to-end:** task سه-lane روی repo اسکرچ از UI؛ run و roleها زنده؛ پاسخ به سؤال و permission از UI؛ reload پنجره وسط run → Continue همان run بدون run تکراری (بررسی با `catherd runs list --json`)؛ لغو role؛ ویرایش profile + treat-like + refresh مدل‌ها + خطای doctor.
- **تصویری:** نمای کامل Activity Bar در Light / Dark / High Contrast (اسکرین‌شات دستی چک‌لیستی).

## پیوست — PRهای پیشنهادی upstream (catherd 1.1، غیرمسدودکننده)
1. `routes` و `landed`/`budget` در `status --json` / `runs list --json`.
2. `profile validate --draft <json>` / MCP `profile_validate({patch})` و `expect` در `profile_set`.
3. `--json` برای `profile use/new/copy/rm/set`, `runs cancel`, `catalog treat-like`.
4. اصلاح `marketplace.json` به `https://github.com/47vigen/catherd.git`.
