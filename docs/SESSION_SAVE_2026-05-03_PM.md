# CAPS POKER — Session Save (2026-05-03 PM Architectural Fixes)

**Session goal:** Fix 2P/3P/4P layout issues where boards were rendered in vertical column on iOS, leaving 44pt per board (cards 28x20pt — illegible).

**Outcome:** 8 commits across full session, last 4 are this PM session's architectural fixes. Build b368 in progress as of save time.

---

## 1. PROJECT IDENTITY

| Item | Value |
|---|---|
| Local path | C:/Projects/POKER/Caps |
| GitHub repo | royea-beep/caps-poker (PRIVATE) |
| Supabase project | gxrpunvhjcrzqnitbqah |
| Web URL | https://caps.ftable.co.il (via Vercel) |
| iOS bundle | com.capspoker.app, App ID 6760429619 |
| Build pipeline | .github/workflows/ios-testflight.yml |
| Distribution | TestFlight (NOT App Store — never submit unless told) |
| Owner | Roye (Hebrew speaker, Israel UTC+2) |
| Test devices | iPhone 16 (390x844), iPhone 17 Pro Max (430x932) |

---

## 2. GAME RULES (NEVER FORGET)

| Players | Boards | Cards/player | Cards/board | Hand rows |
|---|---|---|---|---|
| 2P | 4 | 16 | 4 (vs 5 community) | 3 |
| 3P | 3 | 12 | 4 | 2 |
| 4P | 2 | 8 | 4 | 2 |

- 52-card deck total, max 4 players
- 5 community cards per board (revealed)
- Boards count is DYNAMIC per player count, NOT always 5
- Solo = free time + 30s timer; Multiplayer = 30s free + READY button

---

## 3. CURRENT STATE (as of save time)

### Build status
| Build | Status | Commits | What's in it |
|---|---|---|---|
| b366 | live | cf44dc3 | Earlier safe area paddingBottom fix |
| b367 | live (on Roye's phone) | d119b74, 7c42245, 447765c | Card V2 fonts, PLAYER_HAND_H dynamic, Board overflow |
| b368 | in_progress | da2e3ab, 8713845, 383de91, 6fa5af7 | Grid layout for 2P/3P, width constraint |

### Roye's feedback on b367 (received before this PM session's fixes)
- 2P (4 boards) "מלא בעיות בגדלים" — confirmed mathematically as 44pt per board
- 3P also tight (82pt per board)
- 4P working OK

### Workflow run for b368
- Run ID: 25280681009 (cancelled by next push) → 25280904576 (active)
- HEAD: 6fa5af7
- Started: 2026-05-03 13:49 UTC = 16:49 IL
- ETA build complete: ~17:35 IL
- ETA Apple delivery: ~18:00-18:30 IL

---

## 4. THE 4 ARCHITECTURAL FIXES (THIS PM SESSION)

### Fix #1 — `da2e3ab` — BoardArrangement.tsx line 86
```diff
- <View style={isWeb ? baStyles.boardsGrid : baStyles.boardsColumn}>
+ <View style={(isWeb || boardCount >= 3) ? baStyles.boardsGrid : baStyles.boardsColumn}>
```
**Why:** iOS now uses grid container when boardCount>=3. Web behavior unchanged.

### Fix #2 — `8713845` — BoardArrangement.tsx line 91
```diff
- isWeb ? (boardCount === 3 ? baStyles.boardCellThird : baStyles.boardCellHalf) : baStyles.boardCellFull,
+ isWeb ? (boardCount === 3 ? baStyles.boardCellThird : baStyles.boardCellHalf) : (boardCount >= 3 ? baStyles.boardCellHalf : baStyles.boardCellFull),
```
**Why:** iOS uses Half (50%) cell width for 3+ boards. Web 3-board still uses Third (33%).

### Fix #3 — `383de91` — game.tsx lines 143-154
```js
// Visual rows: how boards arrange in 2D layout
const _isWeb = Platform.OS === 'web';
const _visualRows = _isWeb
  ? (boardCount === 3 ? 1 : Math.ceil(boardCount / 2))
  : (boardCount >= 3 ? Math.ceil(boardCount / 2) : boardCount);
const BOARD_GAPS = Math.max(0, _visualRows - 1) * 4;
const boardSpace = (safeH - TOP_BAR_H - BOT_STATUS_H - PLAYER_HAND_H - FLOATING_ACTIONS_H - HINT_H - BOARD_GAPS) / _visualRows - BOARD_CHROME;
```
**Why:** boardSpace was dividing by `boardCount` (total boards) but with grid we have only `_visualRows` (2 or 1). Without this, cards inside boards were sized for cramped vertical-stack space.

### Fix #4 — `6fa5af7` — game.tsx lines 175-186
```js
const CARD_ROW_PAD = 4;
const maxNativeCardH = Math.max(28, Math.floor((boardSpace - CARD_ROW_PAD) / (communityScale + 0.7)));
// Width constraint: in grid mode, 5 community cards must fit in narrower board column.
const _boardColWNative = _isWeb && boardCount === 3
  ? Math.max(80, Math.floor(screenW / 3) - 16)
  : (_isWeb || boardCount >= 3)
    ? Math.max(80, Math.floor(screenW / 2) - 16)
    : screenW - 32;
const _maxCommWNative = Math.max(18, Math.floor((_boardColWNative - 31) / 5));
const _maxNativeCardHFromWidth = Math.round(_maxCommWNative / 0.7 / communityScale);
const nativeCardH = isLandscape
  ? nativeCardDims.cardHeight
  : Math.min(nativeCardDims.cardHeight, maxNativeCardH, _maxNativeCardHFromWidth);
```
**Why:** Without width constraint, 62pt cards (43pt wide) overflowed 195pt grid columns. Now capped at 36pt height (25pt wide) so 5 community cards fit.

---

## 5. MATHEMATICAL PROOFS (iPhone 16, 390x844, safeH=763)

### Before fixes (b367 actual)
| Mode | Layout | boardSpace | Card |
|---|---|---|---|
| 2P (4 boards) | Column vertical | 44pt | 28x20pt 🚨 BROKEN |
| 3P (3 boards) | Column vertical | 82pt | 50x36pt ⚠️ TIGHT |
| 4P (2 boards) | Column vertical | 145pt | 65x46pt ✅ OK |

### After all 4 fixes (b368 expected)
| Mode | Layout | boardSpace | Card |
|---|---|---|---|
| 2P (4 boards) | Grid 2x2 | 132pt | 36x25pt ✅ |
| 3P (3 boards) | Grid 2+1 | 145pt | 38x27pt ✅ |
| 4P (2 boards) | Column (unchanged) | 145pt | 65x46pt ✅ |

### iPhone 17 Pro Max (430x932, safeH=839)
| Mode | boardSpace | Card |
|---|---|---|
| 2P | 170pt | 41x29pt |
| 3P | 183pt | 43x30pt |
| 4P | 183pt | 65x46pt |

### iPhone SE (375x667, safeH=586) — STILL BROKEN, OUT OF SCOPE
All modes have boardSpace < 60pt. Roye doesn't test on SE.

---

## 6. KEY CONSTANTS USED IN MATH

```js
// game.tsx layout chrome (DO NOT CHANGE without recalculating all modes)
TOP_BAR_H = 44
BOT_STATUS_H = 24
FLOATING_ACTIONS_H = 68
HINT_H = 26
BOARD_CHROME = 40 (subtracted PER board)

// Hand sizing (PLAYER_HAND_H formula at game.tsx:140)
playerHandCardCount = nP===2 ? 16 : nP===3 ? 12 : 8
playerHandRows = count > 14 ? 3 : count > 7 ? 2 : 1
handCardCapPt = rows===3 ? 48 : 64
handCardHeightPt = round(cap / 0.72)
PLAYER_HAND_H = 22 + 3 + (iOS?20:8) + (cardH*rows) + (4*max(0,rows-1))
// Result: 2P=254pt, 3P/4P=227pt
```

```js
// CARD_SCALE in constants/gameConfig.ts
2: { cardHeight: 60, communityScale: 1.15 }  // 4 boards
3: { cardHeight: 66, communityScale: 1.10 }  // 3 boards  
4: { cardHeight: 74, communityScale: 1.10 }  // 2 boards
```

```js
// getCardDimensions in constants/gameConfig.ts
overhead = 120  // boardsColumn padding + pressableInner + label + gaps + separator
commW = min(50, max(28, floor((screenW - 120) / 5)))
commH = round(commW / 0.7)
cardH = max(38, min(88, round(commH / communityScale)))
```

---

## 7. KEY FILES & LINE NUMBERS

| File | Lines | Purpose |
|---|---|---|
| app/game.tsx | 130-186 | Layout calculations: PLAYER_HAND_H, boardSpace, nativeCardH |
| app/game.tsx | 113 | useLocalSearchParams for autoSim |
| app/game.tsx | 194 | `const isWeb = Platform.OS === 'web'` (later than my `_isWeb` at 149 — TWO variables coexist, harmless duplication) |
| components/BoardArrangement.tsx | 86 | Container: column vs grid |
| components/BoardArrangement.tsx | 91 | Cell width: Full vs Half vs Third |
| components/BoardArrangement.tsx | 205-234 | baStyles (boardsColumn, boardsGrid, boardCellFull/Half/Third) |
| components/Card.tsx | ~349-363 | V2 active branch with width-based fonts (after d119b74) |
| components/Card.tsx | ~365-391 | Classic branch (NOT used currently per cardConfig.card_layout=='v2') |
| components/Board.tsx | 514-532 | Container with overflow:visible (after 447765c) |
| constants/gameConfig.ts | 44-48 | getBoardCount(numberOfPlayers) |
| constants/gameConfig.ts | 51-55 | getCardsPerPlayer(numberOfPlayers) |
| constants/gameConfig.ts | 66-70 | CARD_SCALE per player count |
| constants/gameConfig.ts | 83-93 | getCardDimensions function |
| .github/workflows/ios-testflight.yml | 18-30 | Path filters (READ THIS BEFORE PUSHING NO-OP TRIGGERS) |
| .github/workflows/ios-testflight.yml | 240 | CURRENT_PROJECT_VERSION xcodebuild override |
| .github/workflows/ios-testflight.yml | 278 | TARGET_BUILD_VERSION for ASC distribute polling |
| app.json | 18 | "buildNumber": "329" (overridden at build time, ignore) |

---

## 8. WORKFLOW PATH FILTERS — CRITICAL

The iOS build workflow ONLY triggers on these paths:
- `ios/**`, `android/**`, `app.json`, `eas.json`, `package.json`, `package-lock.json`
- `plugins/**`, `.github/workflows/ios-testflight.yml`
- `assets/**`, `app/**`, `components/**`, `lib/**`

**README.md, BUILD_NOTES.md, /docs/*** at root will NOT trigger workflow.** Tested mistake during this session — wasted 5 min.

If you need a no-op trigger, add a comment to `components/Card.tsx` or any file in the allowed paths.

---

## 9. APPLE / EAS PIPELINE BEHAVIOR

### Build number translation
- Workflow `BUILD_NUMBER` env (e.g., 450) is set from EAS `eas build:version:get` + 1
- xcodebuild gets `CURRENT_PROJECT_VERSION=450` override
- IPA uploaded with CFBundleVersion=450
- **BUT** Apple gives the IPA whatever build number sequence is next on TestFlight (e.g., b367, b368)
- DB `build_history.build_number` tracks Apple's number (what user sees), NOT workflow internal
- ALWAYS lead with Apple build# in user comms; never guess — verify via DB or ask Roye

### Apple processing timeline
- altool upload: 1-2 min for ~32MB IPA
- Apple ASC processing: 5-30 min normally, sometimes 60+ min
- Workflow polls every 60s for 45 min max
- After 45 min: WARNING (not error), workflow concludes "success"
- Build can still arrive AFTER polling timeout (just not auto-distributed to beta groups)
- If silent rejection: Apple sends email to dev account (no API visibility)

### One real example from this session
- Pushed 447765c at 11:05 UTC
- altool UPLOAD SUCCEEDED at 11:18 UTC with Delivery UUID 62810657-968d-4fcf-8f59-1315123ea201
- Polling 11:18-12:03 UTC: Apple never showed b450, only 357-366
- Workflow completed 12:03 UTC with WARNING
- BUT Apple eventually processed and Roye received as b367 ~1 hour later

---

## 10. EDGE FUNCTIONS AVAILABLE (for ops)

### github-file (id: 0cd46cc4-8847-4663-a978-dc7f2cce583c)
Quick file edits via GitHub API. Actions:
- `search?path=X&q=Y` — text search; AVOID spaces in query (use single tokens)
- `lines?path=X&start=N&end=M` — read line range
- POST `replace` body: `{path, old, new, message}` — exact-match replace
- POST `replace_line` body: `{path, line, new, message}`
- POST `replace_lines` body: `{path, edits: [{line, new}], message}`
- POST `create_file` body: `{path, content, message}`
- POST `dispatch` body: `{workflow, ref, inputs}`

### github-debug (id: fe0c2482-3cfe-486a-b36f-6b73b59cca14)
Debug GitHub Actions runs:
- `runs?workflow=X&n=N` — list workflow runs
- `jobs?run_id=X` — jobs in run with steps
- `logs?run_id=X&filter=Y` — filtered logs (max 80 lines, can timeout on 80K+ logs)
- `logs_full?run_id=X&start=N&end=M` — line range slice (use this for big logs)
- `cancel?run_id=X` — cancel run
- `rerun?run_id=X` — rerun run

### screenshot-app (id: ed1af975-fe1c-4c83-848c-12ec06ac6292)
Thum.io free tier wrapper. Takes web URL screenshot.
- URL: `https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/screenshot-app?url=X`
- LIMITATION: Doesn't wait for JS render. Caps app shows loading screen only (4-5KB result).
- LIMITATION 2: Web layout uses GRID (different from iOS column). Even working web screenshot doesn't reproduce iOS layout bugs.
- USE: math diagnostics > screenshot service for layout issues

### check-ota-status (id: 1e5c1ebf-f874-48ee-8016-f047de4d21a3)
Checks OTA delivery status.

### telegram-bot-handler v20 (dc455c55-...)
@caps_bug_bot. AI triage, multi-language Whisper, suggested_fix files.

---

## 11. SUPABASE MCP USAGE PATTERNS

### Calling Edge Functions via SQL
```sql
SELECT net.http_post(
  url := 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/github-file?action=replace',
  body := jsonb_build_object('path', 'X.tsx', 'old', '...', 'new', '...', 'message', 'commit msg'),
  headers := jsonb_build_object('Content-Type', 'application/json')
) AS r1;
-- Returns: an integer ID for net._http_response

-- Then retrieve:
SELECT pg_sleep(5);
SELECT id, content::text AS body FROM net._http_response WHERE id = <returned_id>;
```

### For large responses (logs)
Use `substring(content::text, 1, 9000)` — display truncates around 9KB.

For base64-encoded binary, chunk: `substring(content::jsonb->>'base64' from N for 3000)`

### Sandbox limitation
bash_tool curl CANNOT reach `*.supabase.co` (Anthropic egress allowlist blocks). Use SQL via Supabase tools.

---

## 12. ROYE COMMUNICATION PATTERNS

### He expects:
- Hebrew responses (he writes Hebrew)
- Israel time UTC+2 on all timestamps  
- "Continue" / "GMODE" = autonomous forward action, NO permission asking
- Concrete actions over investigation
- Math/diagnostics over screenshot requests
- Verified build numbers (never guessed)
- Direct push via tools — NEVER manual chat instructions
- Never excessive apologies or self-abasement (per constitution)

### He gets frustrated when:
- Claude apologizes too much
- Claude pushes without verifying
- Claude asks too many questions before acting
- Claude treats him as fragile
- Claude forgets prior session context

### Triggers blunt feedback:
- "מפגר" / "סנילי" — frustration markers, NOT permission to grovel
- Response: deliver the work, maintain professional tone, don't apologize excessively

### NEVER do:
- Suggest App Store submission unless he says "prepare for App Store"
- Create TikTok/Reddit/Discord content (his domain)
- Onboarding work without verifying current state
- Claim something is done without verifying via DB or workflow logs

---

## 13. STILL OUTSTANDING (FUTURE SESSIONS)

### Within scope:
- Cards 36-38pt in 2P/3P grid still smaller than ideal. Options:
  - Horizontal scroll within boards (3 visible, scroll to see 4-5)
  - Tap-to-focus board mode (board expands to fullscreen)
  - Landscape orientation support
- Spacing inconsistency: rs(2/4/6/8) used inconsistently. Need 4pt grid system.
- Auto-place chip vs long-press gesture (UX preference)
- Removing placeholder slots when community not yet dealt

### Out of scope (unless escalated):
- iPhone SE support (375pt screen — out of test devices)
- App Store submission
- Marketing content (Roye's domain)

### Council previously rejected:
- PostHog/Sentry/OpenReplay (not now)
- Bot v21 with auto-Council (not now)

---

## 14. NEXT SESSION ENTRY POINT

```
1. Read this file: docs/SESSION_SAVE_2026-05-03_PM.md
2. Check b368 status:
   SELECT * FROM build_history ORDER BY id DESC LIMIT 5;
3. If b368 still in_progress: check workflow run via github-debug runs?workflow=ios-testflight.yml&n=1
4. If b368 live: ask Roye for symptom report on 2P/3P/4P
5. If Roye sees issues: run the math first, ONLY ask for screenshot if math diagnostic disagrees with what he describes
6. Push fixes via github-file Edge Function
7. Update build_history
```

---

## 15. SESSION HISTORY (this PM session order of events)

1. Loaded compaction summary — earlier session's 4 commits (d119b74, 7c42245, 447765c, 54acc8c)
2. Roye reports "367 הגיע" (b367 delivered) but 2P 4-board layout still broken, 3P also problematic, doesn't want to send screenshots
3. Claude attempted screenshot-app Edge Function — got loading screen only (4KB)
4. Claude pivoted to MATH-BASED diagnostic — proved 2P boardSpace = 44pt mathematically
5. Council 5/5 voted: push grid layout fix
6. Pushed da2e3ab (BoardArrangement container) and 8713845 (cell width)
7. Roye says "Continue" — Claude continued autonomously
8. Identified second bug: game.tsx still divides by boardCount → cards still small
9. Pushed 383de91 (visualRows-based boardSpace)
10. Identified third bug: cards width-overflow grid columns
11. Pushed 6fa5af7 (width constraint for nativeCardH)
12. Verified math across all iPhones — iPhone 16/Pro Max all OK, SE still broken (out of scope)
13. Updated build_history table
14. Created test plan markdown
15. Roye demands comprehensive save state — THIS FILE

---

*End of session save. Push: this file via github-file create_file. Verify in repo at docs/SESSION_SAVE_2026-05-03_PM.md*
