# VAMOS CAPS FULL-UI-AUDIT
**Date:** 2026-03-21 15:01 IST
**Priority:** 🔴 Final QA — verify EVERY screen, EVERY button, EVERY label on ALL devices

## ROLE
QA Lead — methodical, no shortcuts, test everything

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
```

## DO NOT change any code. ONLY audit and report.

## DEVICE MATRIX — ALL 8 UNIQUE WIDTHS
Test all layouts at EVERY width. Simulate by checking code math, not just 3 devices.

| Width (pt) | Height (pt) | Devices | Group | Priority |
|-----------|------------|---------|-------|----------|
| 375 | 667 | iPhone SE 3 | XS | 🔴 HARDEST |
| 375 | 812 | iPhone 12 mini, 13 mini, X, XS, 11 Pro | XS | 🔴 HARDEST |
| 380 | 824 | iPhone 16e | S | 🟡 NEW BUDGET |
| 390 | 844 | iPhone 12, 12 Pro, 13, 13 Pro, 14 | M | ✅ COMMON |
| 393 | 852 | iPhone 14 Pro, 15, 15 Pro, 16, 16 Pro, 17e | M | ✅ MOST COMMON |
| 402 | 874 | iPhone 17, 17 Pro, 17 Air | M | ✅ NEWEST |
| 414 | 896 | iPhone XR, 11, XS Max, 11 Pro Max | L | ✅ OLDER LARGE |
| 428 | 926 | iPhone 12 Pro Max, 13 Pro Max, 14 Plus | L | ✅ |
| 430 | 932 | iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus/Pro Max | L | ✅ |
| 440 | 956 | iPhone 17 Pro Max | XL | ✅ BIGGEST |

**Critical breakpoints to verify:**
- **375pt** — smallest. If it works here, it works everywhere. SE 3 + mini + X/XS.
- **380pt** — iPhone 16e. New budget phone, will be VERY common.
- **390-393pt** — the mainstream. Most iPhones sold in 2023-2025.
- **402pt** — iPhone 17 series. The NEW mainstream.
- **440pt** — iPhone 17 Pro Max. Biggest screen ever.

**Height matters too:**
- 667pt (SE 3) — SHORTEST. Vertical space is extremely tight.
- 812pt (mini/X) — short but modern.
- 852-874pt — standard.
- 932-956pt — tallest, most room.

═══════════════════════════════════════════════════════════
SCREEN 1 — HOME (app/index.tsx)
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\index.tsx
```

Check EVERY element:

| Element | What to check | Report |
|---------|--------------|--------|
| CAPS logo | fontSize, letterSpacing, color, visible? | |
| POKER subtitle | fontSize, visible, not clipped? | |
| Card fan hero | 5 cards visible, not overflowing? | |
| Suit particles | pointerEvents none? not blocking taps? | |
| Chip balance | visible, gold, correct position? | |
| NEW HAND button | height ≥56px, text readable, press anim? | |
| Multiplayer buttons | visible, not cramped? | |
| ProQuoteBanner | glass container, disclaimer visible? | |
| Links row (LEADERBOARD · HAND HISTORY · HOW TO PLAY · SETTINGS) | ALL 4 present? fit in one row on 375pt? text readable? | |
| Version badge | visible, not overlapping? | |
| Tutorial trigger | shows on first launch? | |

**Card size simulation — run getCardDimensions() for ALL widths × ALL player counts:**
```
const WIDTHS = [375, 380, 390, 393, 402, 414, 428, 430, 440];
const PLAYERS = [2, 3, 4];
const HEIGHTS = [667, 812, 824, 844, 852, 874, 896, 926, 932, 956];

for (const w of WIDTHS) {
  for (const p of PLAYERS) {
    const dims = getCardDimensions(w, p);
    const readable = dims.board.rankSize >= 10 && dims.board.width >= 28;
    console.log(`${w}pt × ${p}p: card ${dims.board.width}×${dims.board.height}, rank ${dims.board.rankSize}px — ${readable ? 'OK' : 'FAIL'}`);
  }
}
```
Report the FULL table. EVERY cell must show OK. Any FAIL = must fix.

**Height simulation — for SE 3 (375×667) with 4 boards:**
This is the WORST case. 667pt is very short. Check:
- Do all 4 boards + player hand + timer + header fit vertically?
- Is anything clipped or overlapping?
- Calculate: `(board_height × 4) + hand_height + timer_height + header_height + gaps ≤ 667 - safe_area`

**375pt (SE3) check:** Do all buttons fit? Is text truncated? Does card fan overflow? SE3 has 667pt height — SHORTEST screen.
**380pt (16e) check:** New budget iPhone — verify nothing breaks at 380pt.
**440pt (17 Pro Max) check:** Biggest screen — verify nothing looks stretched or has too much whitespace.

═══════════════════════════════════════════════════════════
SCREEN 2 — GAME (app/game.tsx)
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\game.tsx | head -100
grep -n "style\|fontSize\|width\|height\|padding\|margin" C:\Projects\Caps\app\game.tsx | head -50
```

Check for EACH player count (2/3/4 players = 4/3/2 boards):

| Element | What to check | Report |
|---------|--------------|--------|
| Board containers | colored borders (gold/blue/green/orange) visible? | |
| Board labels (B1, B2...) | visible, correct color? | |
| Community cards (5 per board) | fit in one row? readable? rank ≥10px? | |
| Player cards on board (4 per board) | fit? readable? | |
| Player hand (bottom) | 1.3x bigger than board cards? scrollable if overflow? | |
| Selected card highlight | gold border + scale visible? | |
| Timer bar | visible? green→yellow→red working? | |
| Timer text | readable? | |
| "ARRANGE X CARDS" header | correct count? synced with button? | |
| "X left" button text | synced with header? | |
| Ready button | visible, tappable, correct size? | |
| UNDO button | visible, text readable? | |
| AUTO button | visible? | |
| In-game hint (first 3 games) | visible, not overlapping? | |
| ProQuoteBanner (tutorial context) | visible during arranging? not blocking? | |
| Hand preview ghost text | shows when 4 cards placed? readable? | |

**375pt + 4 boards:** This is the HARDEST layout. Cards minimum 28px wide? Rank minimum 10px? All boards fit without scrolling?

**375pt + 2 boards:** Cards not too big / overlapping?

═══════════════════════════════════════════════════════════
SCREEN 3 — REVEAL SEQUENCE
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\hooks\useRevealSequence.ts
```

| Element | What to check | Report |
|---------|--------------|--------|
| Card flip animation | rotateY exists? triggered on turn+river? | |
| Card back design | navy + diamond lattice + CAPS logo? | |
| Hand name overlay | slides in after reveal? gold for win? | |
| Floating chips +/- | visible after board resolves? gold/red? | |
| Board win/loss indicator | clear which board won/lost? | |
| COMPLETE overlay | flash + 40 particles + gold pulse + haptics? | |
| COMPLETE text | 58px? gold? | |
| COMPLETE duration | 3 seconds minimum? | |

═══════════════════════════════════════════════════════════
SCREEN 4 — RESULTS (app/results.tsx)
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\results.tsx
```

| Element | What to check | Report |
|---------|--------------|--------|
| Board replay cards | show BOTH hands (player + opponent)? | |
| Mini card components | visible, readable at small size? | |
| Hand names per side | gold for winner, gray for loser? | |
| Result label per board | "YOU WIN" / "YOU LOSE" / "TIE"? | |
| +/- chips per board | gold for positive, red for negative? | |
| COMPLETE section | gold double border? bonus shown? | |
| Best hand highlight | "⭐ Best hand: X on Board Y"? | |
| Stats row | boards won / net chips / games today? | |
| ProQuoteBanner (summary) | visible? | |
| Share buttons (📸) | per board + Share Game + Copy Link? | |
| DEAL ME IN button | height 64px? gold glow pulse? visible at bottom? | |
| Back to Home link | visible below DEAL ME IN? | |
| FadeInDown stagger | boards animate in sequentially? | |

**375pt check:** Do replay cards fit? Mini cards readable? Share buttons not cramped?

═══════════════════════════════════════════════════════════
SCREEN 5 — SETTINGS (app/settings.tsx)
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\settings.tsx
```

| Element | What to check | Report |
|---------|--------------|--------|
| All section headers | readable, consistent style? | |
| Toggle switches | all functional? correct default values? | |
| 🎭 Pro Quotes toggle | present? default ON? | |
| 🔊 Pro Voice Clips toggle | present? grayed when quotes OFF? | |
| 📖 Show Tutorial Again | present? works? | |
| 🐛 Bug Reporter toggle | present? | |
| Card theme picker | all 3 themes visible? | |
| Sound toggle | present? default ON? | |
| Credits section | at bottom? includes AI voice disclaimer? | |
| Version badge | visible? | |
| All text | not truncated on 375pt? | |

═══════════════════════════════════════════════════════════
SCREEN 6 — MULTIPLAYER LOBBY
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\lobby\host.tsx
cat C:\Projects\Caps\app\lobby\internet-join.tsx
```

| Element | What to check | Report |
|---------|--------------|--------|
| Room code display | readable? | |
| Player list | visible? | |
| Start button | correct size? | |
| ProQuoteBanner (waiting) | visible? rotating? | |
| All text | not clipped on 375pt? | |

═══════════════════════════════════════════════════════════
SCREEN 7 — HAND HISTORY
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\hand-history.tsx
```

| Element | What to check | Report |
|---------|--------------|--------|
| Hand list | scrollable? | |
| Each hand entry | date, result, chips visible? | |
| 📸 Share button per hand | visible? functional? | |
| Empty state | message when no history? | |

═══════════════════════════════════════════════════════════
SCREEN 8 — TUTORIAL OVERLAY
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\components\Tutorial.tsx
```

| Element | What to check | Report |
|---------|--------------|--------|
| 4 steps | all render correctly? | |
| Step dots (● ● ○ ○) | visible? | |
| Next button | visible, tappable? | |
| "Let's Play" on step 4 | visible? | |
| Text | readable on 375pt? | |

═══════════════════════════════════════════════════════════
SCREEN 9 — WEB (caps.ftable.co.il)
═══════════════════════════════════════════════════════════

```
curl -s https://caps.ftable.co.il -o /dev/null -w "%{http_code}"
curl -s https://caps.ftable.co.il/bugs/ -o /dev/null -w "%{http_code}"
curl -s https://caps.ftable.co.il/hand/ -o /dev/null -w "%{http_code}"
```

| URL | Expected | Report |
|-----|----------|--------|
| caps.ftable.co.il | 200, game loads | |
| caps.ftable.co.il/bugs/ | 200, dashboard loads | |
| caps.ftable.co.il/hand/ | 200, replay page loads | |

═══════════════════════════════════════════════════════════
CROSS-CUTTING CHECKS
═══════════════════════════════════════════════════════════

```
# Check for hardcoded pixel values that should be responsive
grep -rn "fontSize: [0-9]" C:\Projects\Caps\components\*.tsx C:\Projects\Caps\app\*.tsx | grep -v node_modules | grep -v __tests__ | grep -v "Math\.\|getCard\|CARD_SCALE\|rankSize\|suitSize" | head -30

# Check for text that might be clipped
grep -rn "numberOfLines\|ellipsizeMode\|adjustsFontSizeToFit" C:\Projects\Caps\app\*.tsx C:\Projects\Caps\components\*.tsx | head -20

# Check all buttons have minimum touch target (44px)
grep -rn "hitSlop\|height.*4[0-9]\|height.*5[0-9]\|height.*6[0-9]\|minHeight" C:\Projects\Caps\app\*.tsx C:\Projects\Caps\components\*.tsx | head -20
```

═══════════════════════════════════════════════════════════
REPORT FORMAT
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
FULL UI AUDIT — CAPS POKER
═══════════════════════════════════════

SCREEN 1 — HOME: [✅ PASS / ⚠️ ISSUES / ❌ BROKEN]
  Issues: [list any]
  375pt: [FITS / OVERFLOW / TRUNCATED]
  
SCREEN 2 — GAME: [✅ / ⚠️ / ❌]
  Card sizing table (ALL widths × ALL player counts):
  375pt×2p: [W]×[H] rank [N]px [OK/FAIL]
  375pt×3p: [W]×[H] rank [N]px [OK/FAIL]
  375pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  380pt×2p: [W]×[H] rank [N]px [OK/FAIL]
  380pt×3p: [W]×[H] rank [N]px [OK/FAIL]
  380pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  390pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  393pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  402pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  414pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  430pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  440pt×4p: [W]×[H] rank [N]px [OK/FAIL]
  SE3 vertical (375×667 + 4 boards): [FITS / OVERFLOW]
  Issues: [list any]

SCREEN 3 — REVEAL: [✅ / ⚠️ / ❌]
  Card flip: [WORKING / NOT WORKING]
  Hand name overlay: [WORKING / NOT WORKING]
  Floating chips: [WORKING / NOT WORKING]
  Issues: [list any]

SCREEN 4 — RESULTS: [✅ / ⚠️ / ❌]
  Replay cards with both hands: [YES / NO]
  Share buttons: [ALL PRESENT / MISSING]
  DEAL ME IN: [VISIBLE / HIDDEN]
  375pt: [FITS / OVERFLOW]
  Issues: [list any]

SCREEN 5 — SETTINGS: [✅ / ⚠️ / ❌]
  All toggles present: [YES / NO — list missing]
  Credits: [YES / NO]
  Issues: [list any]

SCREEN 6 — LOBBY: [✅ / ⚠️ / ❌]
  Issues: [list any]

SCREEN 7 — HAND HISTORY: [✅ / ⚠️ / ❌]
  Share button: [YES / NO]
  Issues: [list any]

SCREEN 8 — TUTORIAL: [✅ / ⚠️ / ❌]
  Issues: [list any]

SCREEN 9 — WEB: [✅ / ⚠️ / ❌]
  All 3 URLs: [status codes]
  Issues: [list any]

CROSS-CUTTING:
  Hardcoded font sizes found: [list any risky ones]
  Touch targets <44px: [list any]
  Text truncation risks: [list any]

═══════════════════════════════════════
OVERALL: [X/9 screens pass]
CRITICAL ISSUES: [list — things that MUST be fixed]
MINOR ISSUES: [list — nice to fix]
═══════════════════════════════════════
```

VAMOS CAPS FULL-UI-AUDIT — END
