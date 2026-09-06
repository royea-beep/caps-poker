# 📚 CAPS Poker — Master Index

**Last updated:** 2026-07-15
**Maintainer:** Claude (auto-updated each session)

---

## 🗂️ Knowledge Files (read these at session start)

| File | Audience | When to read |
|---|---|---|
| `CAPS_POKER_SKILL.md` | Claude (chat) | Auto-loaded as skill on any CAPS message |
| `CLAUDE_CODE_RULES.md` | Claude Code (terminal) | Place at repo root as `CLAUDE.md` — auto-loaded each session |
| `MASTER_INDEX.md` (this file) | Both | Reference for "what tool/file/protocol exists" |

---

## 🛠️ Tools Inventory (EF LIVE reconcile 2026-07-15)

### Edge Functions — LIVE ACTIVE **11** (`https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/<name>`)

Source: `supabase functions list` · Atlas Sheet 46 Part A. All 11 dual = on disk under `supabase/functions/` (6 pulled from cloud 2026-07-15).

| EF | Mark | On disk | What |
|---|---|---|---|
| `whatsapp-bot-handler` | dual | ✅ | WhatsApp inbound · multi-project router |
| `telegram-bot-handler` | dual | ✅ | @caps_bug_bot inbound · multi-lang Whisper |
| `crash-analyzer` | dual | ✅ | Sentry-style crash dedup |
| `auto-fix-crashes` | dual | ✅ | Cron-triggered crash fixer (~30 min) |
| `sync-bugs-to-drive` | dual | ✅ | Sync bug DB to Google Drive |
| `log-error` | dual | ✅ (pulled 2026-07-15) | Error sink for app runtime |
| `analyze-bug-report` | dual | ✅ (pulled 2026-07-15) | LLM bug triage |
| `flush-outbound` | dual | ✅ (pulled 2026-07-15) | Outbound message queue flush |
| `retriage-pending` | dual | ✅ (pulled 2026-07-15) | Re-triage pending bugs |
| `legal` | dual | ✅ (pulled 2026-07-15) | Privacy/terms pages |
| `anthropic-proxy` | dual | ✅ (pulled 2026-07-15) | Anthropic API proxy |

### Retired May→Jul 2026 (HIST 2026-07-15 — not in LIVE)

`github-debug` · `github-file` · `fix-workflow` · `screenshot-app` · `check-ota-status` · `design-panel` · `upload-chunked` · `setup-heroes-deploy` · `get-api-key-temp` · `wire-phoenix-temp` · `read-sms-temp` · `env-probe-temp` · `env-probe-vercel` · `github-probe-temp`

### Supabase MCP tools

- `Supabase:execute_sql` — runs SQL including `net.http_get`
- `Supabase:list_edge_functions`
- `Supabase:get_edge_function` — read EF source code
- `Supabase:deploy_edge_function`
- `Supabase:apply_migration`
- `Supabase:list_tables`, `list_extensions`, `list_migrations`
- Branch ops: `create_branch`, `delete_branch`, `merge_branch`, etc.
- Logs: `get_logs` (service: api/postgres/edge-function/auth/storage/realtime)

### Vercel MCP tools

- `Vercel:get_runtime_logs` — useful for web (caps.ftable.co.il) debugging
- `Vercel:list_deployments`
- `Vercel:get_deployment_build_logs`

### Other

- `web_search`, `web_fetch` (URL only — no auth)
- `image_search`
- `bash_tool` (sandboxed, network-allowed for npm/pip/github/etc.)
- `view`, `str_replace`, `create_file`
- `present_files` (deliver downloads)

---

## 📁 Repo Structure (key files)

| File | Purpose | Edit caution |
|---|---|---|
| `app/game.tsx` | Main game screen, card scale ladder | High — central |
| `components/BoardArrangement.tsx` | Stacked-only board container | Medium |
| `components/Board.tsx` | Single board (community + slots + chip) | Medium |
| `components/Card.tsx` | Card visual — **V2 branch active** (lines ~350-360), Classic dead | High — easy to edit wrong branch |
| `components/PlayerHand.tsx` | 2-row 8+8 hand layout | Medium — drag/drop handlers |
| `app.json` | Expo config + OTA channel | High — channel must stay `production` |
| `eas.json` | EAS build profiles | Low — channel field IGNORED by pipeline |
| `.github/workflows/ios-testflight.yml` | CI pipeline (23 steps) | VERY HIGH — fragile, do not casually edit |
| `.github/workflows/auto-ota.yml` | OTA workflow | BLOCKED since Apr 30 (SDK 55 issue) |
| `package.json` | npm deps | Medium |

---

## 🗄️ Database Tables (key ones)

| Table | Use |
|---|---|
| `build_history` | Each build attempt with status/eas_build_id/notes |
| `session_handoffs` | Cross-session state — `id=1` is the active row |
| `bug_status_log` | Bug lifecycle tracking |
| `clubgg_*` | ClubGG ops (separate skill) |

**Key columns in `build_history`:**
- `id` (PK)
- `build_number` (DB internal, e.g. 370)
- `version` (e.g. '2.7.0')
- `platform` ('ios')
- `profile` ('production')
- `status` ('in_progress' / 'live' / 'failed')
- `eas_build_id` (GitHub workflow run ID)
- `git_branch`
- `started_at`, `completed_at`, `deployed_at`
- `notes` (long text, append with `||` for history)

**Key columns in `session_handoffs`:**
- `current_build_live` (text — current TestFlight build)
- `current_build_in_progress` (text or NULL)
- `outstanding_issues` (jsonb array)
- `next_session_entry_point` (one-sentence)

---

## 🎮 Game Constants (locked)

```
Board count by player count:
  2P → 4 boards
  3P → 3 boards
  4P → 2 boards

Per board:
  4 cards per player
  5 community cards
  4 player slot placeholders (always visible since b370)

Single 52-card deck. Max 4 players.

Layout (locked May 4 b370):
  All board counts STACKED vertically
  Card scale: 2=1.0×, 3=0.85×, 4=0.69×
  Community card height floor: 50pt
  Hand: 2 rows × 8 cards = 180pt locked
  Slots: dashed gold borders, transparent

Visuals:
  Maroon felt #5C1818
  Warm cards #FFFEF8
  Red/black suits (NOT 4-color)
  Gold controls 48px
  Hex looks pink — go 2-3× darker

Ambient: brown noise 90s casino loop
Timer: solo = free + 30s; multi = 30s free + READY button
```

---

## 🚨 CI Failure Lookup Table

| Symptom | Probable cause | Action |
|---|---|---|
| `ENOTFOUND registry.yarnpkg.com` | DNS hiccup | Rerun (transient) |
| `Cache service responded with 400` | GitHub Cache down | Rerun (transient) |
| `exportArchive The request timed out` | Apple Portal slow | Rerun (transient) |
| `No profiles for 'com.capspoker.app'` | Apple Portal didn't deliver | Rerun (transient) |
| `cert quota exceeded` | Real cert issue | Manual cert revoke needed |
| `xcodebuild` compile error | Real code issue | Read logs, fix code |
| `Cannot find module '@expo/...'` | npm install failed | Check yarn.lock conflicts |
| `Pod install failed` | CocoaPods issue | Check `ios/Podfile.lock` |
| `Workflow failed at step 7` | Setup EAS | Check fnm, Node version |
| `Build & archive` succeeds but later fails | NOT code | Investigate code-signing/profile |

---

## 📋 Recurring Workflows

### "Build a new build"

1. Branch from main: `fix/auto-b<NNN>-<topic>`
2. Edit files
3. Verify (`tsc --noEmit`)
4. Commit + push + PR + squash-merge
5. Workflow auto-triggers on push to main
6. Insert `build_history` row with status `in_progress`
7. Poll CI every ~3 min until `conclusion=success`
8. Update `completed_at`, leave `status=in_progress`
9. Wait for Roye visual confirm
10. Flip to `status=live, deployed_at=NOW()`

### "Build CI failed"

1. Get failure step: `github-debug?action=jobs&run_id=<X>`
2. Find first step with `conclusion=failure`
3. Get logs: `github-debug?action=logs&run_id=<X>&filter=<keyword>`
4. Cross-reference with CI Failure Lookup Table above
5. If transient → `github-debug?action=rerun&run_id=<X>` and update DB
6. If real → fix code, push to existing branch, new workflow run

### "Roye reports visual bug"

1. Look at screenshots
2. Identify which file likely owns the rendering (use Repo Structure table)
3. CHECK V2 vs Classic branch in Card.tsx if applicable
4. Plan fix (small if possible)
5. Decide: VAMOS file (if multi-file refactor) or direct `github-file` edit
6. Execute via chosen path

### "Session ending"

```sql
UPDATE session_handoffs
SET updated_at = NOW(),
    current_build_live = '<bNNN>',
    current_build_in_progress = '<bNNN or NULL>',
    outstanding_issues = '<jsonb>',
    next_session_entry_point = '<sentence>'
WHERE id = 1;
```

---

## 📜 Recent History (auto-updated)

| Date | Build | Outcome |
|---|---|---|
| May 3 | b367 | ✅ Success — multi-col attempt #1 |
| May 3 | b368 | ✅ Success → broken visually (multi-col grid issues) |
| May 4 AM | b369 | ✅ Success → broken visually (3P bottom left, grid clipping) |
| May 4 PM | b370 attempt #1 | ❌ Failed — yarn DNS transient |
| May 4 PM | b370 attempt #2 | ❌ Failed — exportArchive Apple Portal timeout |
| May 4 PM | b370 attempt #3 | 🟡 In progress (rerun triggered 21:45 IL) |

---

## 🔮 Known Open Issues

1. **CI fragility** — 23 steps × ~7 transient failure points compound to ~30% per-build fail rate
2. **EAS SDK 55 OTA blocker** — `auto-ota.yml` fails since Apr 30 due to canary version string
3. **Build number mapping** — DB internal vs EAS vs Apple display inconsistency

---

## 🔑 Critical Identities

- Telegram bot: `@caps_bug_bot` — credentials live ONLY in the Supabase vault
  (`TELEGRAM_BOT_TOKEN`, `CAPS_BUG_CHAT_ID`), read through `get_caps_bug_telegram_config()`.
  ⚠️ 2026-09-06 SECURITY INCIDENT: the previous token, and the chat id, were written out in
  full on this line and in `supabase/functions/retriage-pending/index.ts`. This repository is
  PUBLIC. A third party used the token to rewrite the bot's display name and description, and
  could equally have read every bug report submitted through it. Roye revoked that token via
  BotFather; the revoke is what protects. **Never write a credential — or the chat id — into
  this file again. Names and read paths only.**
- Supabase project: `gxrpunvhjcrzqnitbqah`
- GitHub repo: `royea-beep/caps-poker`
- App bundle ID: `com.capspoker.app`
- Web URL: `caps.ftable.co.il` (Vercel)
- OAuth client: `133353581092` in GCP project `9Soccer-Mascots`
- Supabase CLI token: Windows Credential Manager `'Supabase CLI:supabase'`

---

End of master index. Update this file when:
- New EF added/removed
- New table added
- Architecture decision locked
- Recurring workflow refined
- New failure mode discovered
