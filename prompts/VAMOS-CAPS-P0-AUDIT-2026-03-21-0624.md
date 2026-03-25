# VAMOS CAPS P0-AUDIT
**Date:** 2026-03-21 06:24 IST
**Priority:** Verification only — DO NOT CHANGE ANY CODE

## ROLE
Code auditor — read and report ONLY

## MISSION
We asked for 7 fixes. We need to verify which ones are ACTUALLY in the code.
Print evidence for each one. Be honest — if it's not there, say so.

## CHECK 1 — Card.tsx Visual Upgrade
```
cat C:\Projects\Caps\components\Card.tsx
```
Report:
- Is card background `#FFFFFF` (pure white) for face-up cards? YES/NO + line number
- Is rank fontWeight '900' or 'bold'? YES/NO + line number
- Is there suit-based text shadow / glow? YES/NO + line number
- Is there suit-colored border (red for ♥♦, gray for ♠♣)? YES/NO + line number

## CHECK 2 — PlayerHand.tsx Larger Cards
```
cat C:\Projects\Caps\components\PlayerHand.tsx
```
Report:
- Is there a 1.3x multiplier on hand card size vs board card size? YES/NO + line number
- Is there a gold border on selected card? YES/NO + line number
- Is there scale(1.05) on selected card? YES/NO + line number

## CHECK 3 — In-Game Hints with Counter
```
grep -n "caps_games_played" C:\Projects\Caps\app\game.tsx
grep -n "games_played\|hintText\|hint_bar\|HINT" C:\Projects\Caps\app\game.tsx
```
Report:
- Is there an AsyncStorage counter `caps_games_played`? YES/NO
- Does it show different text for game 1/2/3? YES/NO
- Does it disappear after 3 games? YES/NO

## CHECK 4 — HAND HISTORY Link
```
grep -n "HAND HISTORY\|hand-history\|HOW TO PLAY" C:\Projects\Caps\app\index.tsx
```
Report:
- Is "HAND HISTORY" link present? YES/NO + line number
- Is "HOW TO PLAY" link present? YES/NO + line number
- Are BOTH showing? YES/NO

## CHECK 5 — COMPLETE Gold Pulse on All Boards
```
grep -n "pulseGold\|goldPulse\|gold.*pulse\|PULSE\|boardPulse" C:\Projects\Caps\app\game.tsx
grep -n "pulseGold\|goldPulse" C:\Projects\Caps\components\Board.tsx
```
Report:
- Is there a `pulseGold` prop on Board component? YES/NO
- Does game.tsx trigger 3 gold pulses on all boards before CompleteOverlay? YES/NO
- Is there a 1200ms pulse sequence (3×200ms on + 200ms off)? YES/NO
- Is there haptic feedback on each pulse? YES/NO

## CHECK 6 — COMPLETE Duration
```
grep -n "3000\|duration\|dismiss\|auto.*dismiss\|timer" C:\Projects\Caps\components\CompleteOverlay.tsx
```
Report:
- What is the auto-dismiss timer value? (should be 3000ms minimum)
- Is tap-to-dismiss blocked during first 3 seconds? YES/NO

## CHECK 7 — Pro Quotes on Lobby
```
grep -n "ProQuoteBanner" C:\Projects\Caps\app\lobby\host.tsx
grep -n "ProQuoteBanner" C:\Projects\Caps\app\lobby\internet-join.tsx
```
Report:
- ProQuoteBanner in host.tsx? YES/NO + line number
- ProQuoteBanner in internet-join.tsx? YES/NO + line number
- Context is "waiting"? YES/NO

## OUTPUT FORMAT

```
═══════════════════════════════════════
P0 AUDIT RESULTS
═══════════════════════════════════════

CHECK 1 — Card.tsx Visual: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

CHECK 2 — PlayerHand Larger: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

CHECK 3 — Hints Counter: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

CHECK 4 — Hand History: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

CHECK 5 — COMPLETE Pulse: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

CHECK 6 — COMPLETE 3s: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

CHECK 7 — Lobby Quotes: [✅ DONE / ❌ MISSING / ⚠️ PARTIAL]
Evidence: [exact lines]

SUMMARY: [X/7 confirmed done]
MISSING ITEMS: [list what needs to be built]
═══════════════════════════════════════
```

## RULES
- DO NOT change any code
- DO NOT deploy anything
- DO NOT commit anything
- Print the ACTUAL code lines as evidence
- Be HONEST — if something is missing, say ❌ MISSING

VAMOS CAPS P0-AUDIT — END
