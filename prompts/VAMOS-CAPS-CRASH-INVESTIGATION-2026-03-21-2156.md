# VAMOS CAPS CRASH-INVESTIGATION
**Date:** 2026-03-21 21:56 IST
**Priority:** 🔴 CRITICAL — App crashes during gameplay

## ROLE
Senior crash investigator — find every possible crash point in game flow

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
```

## MISSION — Find ALL crash risks in game code

═══════════════════════════════════════════════════════════
AGENT 1 — Static Analysis: Find Unguarded Code
═══════════════════════════════════════════════════════════

```
cd C:\Projects\Caps

echo "=== POTENTIAL NULL/UNDEFINED ACCESS ==="
grep -rn "\.\(length\|map\|filter\|forEach\|reduce\|find\|some\|every\|indexOf\|slice\|splice\)" app/game.tsx components/Board.tsx components/PlayerHand.tsx components/Card.tsx hooks/useRevealSequence.ts hooks/useGameTimer.ts utils/gameLogic.ts utils/handEvaluator.ts | grep -v "?\\." | grep -v node_modules | head -40

echo ""
echo "=== MISSING OPTIONAL CHAINING ==="
grep -rn "\[0\]\.\|\.cards\.\|\.board\.\|\.player\.\|\.bot\.\|\.hand\.\|\.community\." app/game.tsx components/Board.tsx components/PlayerHand.tsx hooks/useRevealSequence.ts utils/gameLogic.ts | grep -v "?\\." | grep -v node_modules | head -30

echo ""
echo "=== ARRAY INDEX ACCESS WITHOUT BOUNDS CHECK ==="
grep -rn "\[[0-9]\]\|\.at(" app/game.tsx components/Board.tsx hooks/useRevealSequence.ts utils/gameLogic.ts utils/handEvaluator.ts | grep -v node_modules | head -20

echo ""
echo "=== DIVISION BY ZERO RISKS ==="
grep -rn "/ [a-zA-Z]" app/game.tsx components/Board.tsx utils/gameLogic.ts utils/handEvaluator.ts | grep -v "// " | grep -v node_modules | head -10

echo ""
echo "=== ASYNC WITHOUT TRY-CATCH ==="
grep -rn "await " app/game.tsx hooks/useRevealSequence.ts utils/sounds.ts utils/shareHand.ts | grep -v "try" | grep -v node_modules | head -20

echo ""
echo "=== REANIMATED SHARED VALUES ON UNMOUNTED COMPONENT ==="
grep -rn "useSharedValue\|useAnimatedStyle\|withTiming\|withSequence\|withRepeat" app/game.tsx components/Board.tsx components/Card.tsx components/PlayerHand.tsx components/CompleteOverlay.tsx components/FloatingChips.tsx components/HandNameOverlay.tsx | grep -v node_modules | wc -l
```

═══════════════════════════════════════════════════════════
AGENT 2 — Game Flow: Trace Every Phase Transition
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\app\game.tsx
```

Trace the game phases and find crash risks at EACH transition:

**DEALING → ARRANGING:**
- Are all cards initialized before render?
- Is playerHand populated before PlayerHand component mounts?
- Are boards initialized with correct community cards?

**ARRANGING → REVEAL:**
- What happens if player doesn't place all cards and timer runs out?
- What happens if auto-fill runs on timer expiry — does it handle all edge cases?
- Is there a race condition between timer callback and manual Ready press?

**REVEAL → RESULTS:**
- What happens if handEvaluator returns undefined for a hand?
- What happens if bot cards are null/undefined?
- What happens if a board has fewer than 4 player cards?
- Does useRevealSequence handle unmount during animation?

**RESULTS → HOME (or PLAY AGAIN):**
- Is game state fully reset?
- Are all Reanimated shared values reset?
- Memory leak from sounds/animations not cleaned up?

═══════════════════════════════════════════════════════════
AGENT 3 — Recent Changes: What Could Have Broken?
═══════════════════════════════════════════════════════════

```
git log --oneline -20
git diff HEAD~10 --stat
```

For EACH recent commit that touched game files, check:
```
git log --oneline -20 -- app/game.tsx components/Board.tsx components/PlayerHand.tsx components/Card.tsx hooks/useRevealSequence.ts utils/gameLogic.ts utils/handEvaluator.ts
```

**High risk changes from today's session:**
- Card flip animation (rotateY) — crash on unmount?
- FloatingChips animation — null reference?
- Deal animation (AnimatedCardSlot) — race condition?
- HandNameOverlay — handEvaluator returns unexpected value?
- Timer bar — division by zero on time=0?
- ProQuoteBanner voice playback — Audio crash on low memory?
- ShareCard offscreen render — ViewShot crash?
- PlayerHand responsive sizing (72e7b2f) — card width = 0?

═══════════════════════════════════════════════════════════
AGENT 4 — Sound System: Common iOS Crash Source
═══════════════════════════════════════════════════════════

```
cat C:\Projects\Caps\utils\sounds.ts
```

Check:
- Is `Audio.Sound.createAsync()` wrapped in try-catch?
- Is sound unloaded on component unmount?
- Can two sounds play simultaneously without crash?
- Does `playSound()` handle missing sound files gracefully?
- Is voice clip playback (ProQuoteBanner) crash-safe?

═══════════════════════════════════════════════════════════
AGENT 5 — Reanimated: #1 Crash Source in RN
═══════════════════════════════════════════════════════════

Common Reanimated crashes:
1. Accessing shared value after component unmount
2. `runOnJS` calling a stale callback
3. `withSequence` / `withRepeat` running on unmounted component
4. Animated style applied to unmounted View

```
grep -rn "runOnJS\|cancelAnimation\|useAnimatedReaction" app/game.tsx components/*.tsx hooks/*.ts | head -20
```

Check: does `game.tsx` cancel all animations on unmount?
```
grep -n "useEffect.*return\|cleanup\|cancel" app/game.tsx | head -10
```

═══════════════════════════════════════════════════════════
AGENT 6 — Reproduce & Fix
═══════════════════════════════════════════════════════════

After finding all risks:

1. For EACH crash risk found — add defensive code:
   - Optional chaining `?.`
   - Default values `?? []` / `?? 0`
   - try-catch around async operations
   - Animation cleanup on unmount
   - Bounds checking on array access
   - Null guards before `.map()` / `.length`

2. Add error boundaries:
   - If not exists: create `components/ErrorBoundary.tsx`
   - Wrap game screen with ErrorBoundary that shows "Something went wrong. Tap to restart."
   - Log the error to Supabase bug_reports table automatically

═══════════════════════════════════════════════════════════
AGENT 7 — Test + Deploy
═══════════════════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "fix: crash investigation — defensive guards + error boundary + animation cleanup"
F7. git push origin main
F8. Update MEMORY.md
```

## REPORT — MUST include:
```
═══════════════════════════════════════
CRASH INVESTIGATION REPORT
═══════════════════════════════════════

CRASH RISKS FOUND: [N total]

HIGH RISK (likely causes of current crash):
  1. [file:line] [description] — [FIXED / NEEDS MORE INFO]
  2. ...

MEDIUM RISK (could crash under edge cases):
  1. [file:line] [description] — [FIXED]
  2. ...

LOW RISK (defensive, unlikely to crash):
  1. [file:line] [description] — [FIXED]
  2. ...

FIXES APPLIED: [N total]
  - Optional chaining added: [N] locations
  - try-catch added: [N] locations
  - Animation cleanup: [N] locations
  - Default values: [N] locations
  - Error boundary: [ADDED / ALREADY EXISTS]

MOST LIKELY CRASH CAUSE:
  [Best guess based on investigation]

═══════════════════════════════════════
```

## DO NOT
- Do NOT change game logic (Omaha evaluation, board count)
- Do NOT remove any features
- Do NOT change visual design
- ONLY add defensive code + error handling

VAMOS CAPS CRASH-INVESTIGATION — END
