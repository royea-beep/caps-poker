---
name: caps-poker-ops
description: CAPS Poker mobile game operations skill. Use this skill whenever Roye mentions CAPS Poker, b<number> builds (b367, b368, b369, b370, etc.), TestFlight, EAS, ios-testflight.yml workflow, BoardArrangement, stacked-only layout, card scale ladder, V21 EMBED, מסך משחק, לוחות, בורד, slots, community cards, Card.tsx V2/Classic, brown noise ambient, cups (Bronze/Silver/Gold/Platinum/Diamond), VAMOS files, github-debug EF, github-file EF, telegram-bot-handler, @caps_bug_bot, ExportArchive, Apple Provisioning, build_history table, or session_handoffs. ALWAYS read this file FIRST before answering anything CAPS-related.
---

# CAPS Poker — Operations Skill

**Project:** CAPS Poker (multi-board poker game)
**Local path:** `C:/Projects/POKER/Caps`
**Repo:** `royea-beep/caps-poker` (GitHub)
**Supabase project_id:** `gxrpunvhjcrzqnitbqah`
**Live build:** check `build_history` table; query at session start
**Tech:** React Native + Expo SDK 55, Supabase backend, EAS native build, Vercel web

---

## 🛑 STARTUP PROTOCOL — Run BEFORE answering anything

### 1. Query DB state (always)

```sql
-- Latest builds
SELECT id, build_number, status, started_at, completed_at, deployed_at, eas_build_id
FROM build_history ORDER BY id DESC LIMIT 5;

-- Open issues from last session
SELECT id, current_build_live, current_build_in_progress,
       outstanding_issues, next_session_entry_point
FROM session_handoffs WHERE id = 1;
```

If `current_build_in_progress IS NOT NULL` → check CI status before doing anything new.

### 2. Check active CI runs

```sql
SELECT net.http_get(
  url := 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/github-debug?action=runs&workflow=ios-testflight.yml&n=3',
  timeout_milliseconds := 25000
) AS request_id;
-- Then sleep 8s and read net._http_response by id
```

### 3. Don't assume — verify

- Build numbers: there are **TWO** in parallel. Always reference both `b<DB_internal>` and EAS counter.
- Layout: locked **stacked-only** since b370. Multi-column was abandoned.
- Card rendering: V2 branch active in production. Modifying Classic branch does nothing.

---

## 🎮 Game Fundamentals (verified, do not assume otherwise)

| Player count | Boards | Cards per player per board | Community per board |
|---|---|---|---|
| 2P | 4 boards | 4 | 5 |
| 3P | 3 boards | 4 | 5 |
| 4P | 2 boards | 4 | 5 |

- Single 52-card deck
- Max 4 players
- Bots adaptive, ambient brown noise 90s casino loop
- Timer: solo = free time + 30s; multiplayer = 30s free + READY button

**Layout (locked May 4, b370):**
- STACKED-ONLY for all board counts. NO multi-column ever.
- Card scale ladder: 2 boards=1.0×, 3=0.85×, 4=0.69×
- Community card height floor: 50pt (4 boards = hard max, no 5+)
- Hand area: 2 rows × 8 cards, ~180pt locked
- Player slots: ALWAYS visible as dashed gold placeholders, distinct from face-down community

**Visuals:**
- Maroon felt board: `#5C1818`
- Warm cards: `#FFFEF8`
- Red/black suits (NOT 4-color)
- Gold controls 48px
- Hex colors look PINK on screen — go 2-3× darker than picker suggests
- Use radial gradients for depth

---

## 🏗️ Build & Deploy Pipeline

### CI Workflow: `ios-testflight.yml`

**23 steps, ~7 transient failure points.** Multiple failures per build are NORMAL.

Failure points and likely causes:
| Step | Failure cause | Resolution |
|---|---|---|
| Cache restore | GitHub services down | Rerun (transient) |
| `yarn install` | DNS hiccup (registry.yarnpkg.com) | Rerun (transient) |
| Setup ASC API key | Invalid key / expired | Check Apple Developer Portal |
| Revoke oldest cert | Cert quota at limit | Wait + rerun |
| Wait for cert propagation | Race condition | Rerun |
| Register App ID via ASC | API rate-limited | Wait 5 min + rerun |
| `xcodebuild archive` | Code or pod issue | Read logs |
| `xcodebuild -exportArchive` | **Apple Portal API timeout** (most common!) | Rerun (transient) |
| Upload TestFlight | ASC stuck | Wait or rerun |
| Distribute to beta | ASC slow | Wait, IPA usually delivers anyway |

**Build numbers (CRITICAL — there are TWO):**
- `build_history.build_number` — DB internal sequential (e.g. b370)
- EAS internal CFBundleVersion — separate counter (e.g. 450, 451, 452)
- Apple TestFlight display number — what Roye sees on phone (varies, usually = EAS)

When Roye says "b369" he means the DB internal. When discussing what Apple shows, ask explicitly.

**Channel:** Always `production` in `app.json → updates.requestHeaders.expo-channel-name`. The `eas.json` channel field is IGNORED by this pipeline (uses `expo prebuild + xcodebuild`, NOT `eas build`).

---

## 🛠️ Autonomous Tools — Use these BEFORE asking Roye

### Edge Functions (verified working)

All accessible via `https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/<name>` (no auth required for these):

| EF | What it does | Key actions/params |
|---|---|---|
| `github-debug` | Read GitHub Actions state | `action=runs/jobs/logs/logs_full/cancel/rerun`. Use `filter=<keyword>` with `logs` for grep. Use `start=N&end=M` with `logs_full` for line slice. |
| `github-file` | Edit code via GitHub API | Branches, PRs, line edits. Avoid `replace_line` with multi-line `\n` literals — causes duplicate lines |
| `fix-workflow` | Auto-fix CI workflow | (read source first via `get_edge_function`) |
| `screenshot-app` | Auto-capture app screen | (read source for params) |
| `check-ota-status` | Verify OTA delivery | Compare manifest createdAt vs latest commit |
| `auto-fix-crashes` | Cron-triggered crash fixer | Runs every 30 min |
| `telegram-bot-handler` | @caps_bug_bot inbound | v20+, multi-lang Whisper, AI triage |
| `analyze-bug-report` | LLM bug triage | Returns `suggested_fix` + files |
| `crash-analyzer` | Sentry-style crash dedup | |
| `log-error` | Error sink for app | Used by app for runtime errors |

### Reading EF source before assuming behavior

```
Supabase:get_edge_function(function_slug='<name>', project_id='gxrpunvhjcrzqnitbqah')
```

Always do this if uncertain about params or capabilities. Saves time vs guessing.

### Supabase MCP

| Tool | Use |
|---|---|
| `execute_sql` | DB queries, including `net.http_get` for HTTP calls |
| `list_edge_functions` | Inventory all EFs |
| `get_edge_function` | Read EF source to discover actions |
| `deploy_edge_function` | Push new EF version |
| `apply_migration` | DB schema changes (use `SECURITY DEFINER` + explicit `GRANT EXECUTE`) |

**Pattern for HTTP calls via DB:**
```sql
SELECT net.http_get(url := '...', timeout_milliseconds := 25000) AS request_id;
-- Then:
SELECT pg_sleep(8);
SELECT id, status_code, LEFT(content::text, 8000) AS body
FROM net._http_response WHERE id = <request_id>;
```

### What Claude CANNOT do alone (still needs Roye or external bot)

- Local TypeScript/lint verification (no `tsc` access in chat)
- Visual verification on physical device (no Playwright in this env)
- Multi-file refactors requiring local dev environment
- Branch operations beyond what `github-file` supports

---

## 🤖 VAMOS Workflow (still valid for big tasks)

**ONLY use VAMOS files when:**
- Task requires local TypeScript verification
- Multi-file refactor with hooks/lint
- Long-running build orchestration

**DO NOT use VAMOS for:**
- Single-line fixes via `github-file`
- CI rerun (use `github-debug?action=rerun` directly)
- DB updates (use `execute_sql` directly)
- Reading logs (use `github-debug` directly)
- Status checks of any kind

**VAMOS file naming:** `VAMOS_YYYY-MM-DD_HHMM_<topic>.md` in Israel time (UTC+2).

**VAMOS structure:**
1. Context (what state is the bot inheriting)
2. Locked parameters (decisions already made — do not relitigate)
3. Diagnostic phase (parallel agents to map current state)
4. Edit plan (specific files + changes)
5. Verification (`tsc --noEmit`, lint)
6. Build phase (branch, commit, push, PR, squash-merge)
7. DB row insert + poll loop
8. Hard constraints
9. Stop conditions
10. Final report format

**Critical for VAMOS continuation files:** Always include Section 1 = state detection (clone fresh, grep for known symbols, build state matrix). Don't trust prior bot reports without verification.

---

## 📂 Key Code Locations

| File | Role | Notes |
|---|---|---|
| `app/game.tsx` | Main game screen | Boards + hand layout. Card scale ladder lives here. |
| `components/BoardArrangement.tsx` | Board container layout | Stacked-only since b370. |
| `components/Board.tsx` | Single board render | Has 4 slot placeholders + 5 community + chip + label. |
| `components/Card.tsx` | Card visual | THREE branches: faceDown, V2 Minimalist (~lines 350-360, ACTIVE), Classic (~lines 365-391). Always check which is active before editing. |
| `components/PlayerHand.tsx` | Hand area | 2-row 8+8 lock since b370. |

---

## 📋 Session Handoff Protocol

### When starting a session

1. Read this skill (you're doing it now)
2. Run startup queries (Section 1 above)
3. Check `userMemories` for recent updates (Roye's edits override this skill where conflict)
4. If `current_build_in_progress IS NOT NULL` → check CI status
5. State current build number (DB + EAS) at top of first response

### When ending a session

Update `session_handoffs.id=1`:
```sql
UPDATE session_handoffs
SET updated_at = NOW(),
    current_build_live = '<bNNN>',
    current_build_in_progress = '<bNNN or NULL>',
    outstanding_issues = '<jsonb array of open items>',
    next_session_entry_point = '<one-sentence what to do next>'
WHERE id = 1;
```

### When build delivered to TestFlight

Verification protocol — Roye sends 3 screenshots:
- 2P (4 boards stacked)
- 3P (3 boards stacked)  
- 4P (2 boards stacked)

If all 3 OK → flip `build_history.status` to `live`, set `deployed_at = NOW()`.
If broken → diagnose via `github-debug logs`, fix via `github-file`, push, trigger build.

---

## 🚫 Hard Rules — Never Violate

1. **NEVER suggest App Store submission** unless Roye explicitly says "prepare for App Store"
2. **NEVER commit directly to main** — always branch → PR → squash-merge
3. **NEVER use `Alert.alert` on web** — use `window.confirm` or skip and navigate
4. **NEVER touch** social media content (TikTok/Reddit/Discord/influencers) — Roye's domain
5. **NEVER assume layout is multi-column** — locked to stacked-only since b370
6. **NEVER edit only the Card.tsx Classic branch** — V2 is active, change won't render
7. **NEVER use `npx tsc`** — path issue, use `./node_modules/.bin/tsc --noEmit`
8. **NEVER re-derive locked parameters** in COUNCIL or VAMOS — they're locked for a reason

---

## 💬 Communication Patterns

- "Continue" / "GMODE" = act, don't ask
- Roye corrects bluntly — internalize, don't repeat mistakes
- Israel time (UTC+2) on all timestamps
- 100% Hebrew UI strings, Hebrew with Roye, English VAMOS files
- When Roye asks a direct question, ANSWER first, then act

---

## 🧠 Lessons Learned (recurring failure modes)

### CI / Build
- ExportArchive timeouts are Apple Portal, not code — rerun first
- yarn DNS errors are GitHub runner network, not deps — rerun
- Cache "responded with 400" is GitHub services hiccup — rerun
- Build & archive succeeds but Export IPA fails = code-signing/profile issue
- 8+ failed runs across b367-b370 — this is normal, not a regression

### Code
- Expo SDK 55 broke ALL `expo-file-system` legacy functions — use `fetch+arrayBuffer` first
- `expo-audio` `useAudioRecorder` fails silently outside React render — use `expo-av` `Audio.Recording` class
- Always add `withTimeout()` on async file/audio ops to prevent freezes
- `expo-file-system/legacy` import path doesn't exist — suppress warnings via `console.warn` filter

### Tools
- Claude Code `-p` mode prints only, doesn't edit — use `anthropics/claude-code-action@v1` or `github-file` EF
- `github-file replace_line` with `\n` literals adds without shifting — verify with `action=lines`, clean duplicates

### EAS / OTA
- `sdkVersion 55.0.0` rejected by EAS — needs stable tag or full canary string
- `auto-ota.yml` blocked since Apr 30 — fix expo version before pushing more OTAs
- Channel must be `production` in `app.json`, NOT `eas.json`
- Builds before commit `cf40fea` have Channel:- → OTA never applies

### Architecture
- Multi-column layouts cannot fit 5 community + chip + slots in half-screen cell on iPhone 16
- 3 attempts (b367/b368/b369) all failed — pivot to stacked-only in b370
- net deletion of 123 lines confirms simpler architecture is correct

---

## 📊 Outstanding Architectural Debt

1. **CI pipeline reliability** — 23 steps × 7 failure points = compounding probability of failure. Future sprint should add: retry logic per step, idempotent cert ops, pre-flight health check, Telegram notification on failure.
2. **EAS SDK 55 OTA blocker** — auto-ota.yml fails since Apr 30. Need expo version fix.
3. **Build number mapping unclear** — DB internal vs EAS vs Apple display all different. No single source of truth.

---

## 📝 Project Sprint History (recent)

| Build | Date | Outcome | Notes |
|---|---|---|---|
| b367 | May 3 | Success | Multi-col attempt #1: width constraint native cards |
| b368 | May 3 | Success → broken visually | Multi-col attempt #2: 2x2 grid + 2+1 row |
| b369 | May 4 AM | Success → broken visually | Multi-col attempt #3: cell width math fix + 3P bottom centering |
| b370 | May 4 PM | In progress (3rd attempt) | Pivot to stacked-only. Attempts 1+2 failed transient (DNS, Apple Portal) |

---

End of skill. When in doubt: query DB, read EF source, check userMemories.
