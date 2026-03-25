# VAMOS CAPS SKIP-REVEAL-NUCLEAR
**Date:** 2026-03-22 20:07 IST
**Priority:** 🔴🔴🔴🔴🔴🔴 SIXTH CRASH. ZERO TOLERANCE. NEW APPROACH.

## THE PROBLEM
6 fix attempts. All failed. The reveal STILL crashes. 
We keep trying to fix the reveal. STOP.

## NEW APPROACH: SKIP THE REVEAL ENTIRELY

Don't fix it. Don't rewrite it. Don't debug it. **REMOVE IT.**
Go straight from "Ready" to "Results". Zero reveal. Zero modal. Zero animation.

If THAT crashes → the problem is NOT the reveal.
If THAT works → we build a NEW reveal from absolute zero, one piece at a time.

## FIRST — Learn from 9soccer (project that works)
```
ls C:\Projects\9soccer\ 2>/dev/null || ls C:\Projects\90soccer\ 2>/dev/null
# Check how 9soccer handles screen transitions — no crashes there
```

## STEP 1 — BYPASS REVEAL COMPLETELY

In `app/game.tsx`, find where "Ready" triggers the reveal.
Replace it with DIRECT navigation to results:

```typescript
// FIND the handleReady / navigateToReveal function
// REPLACE the ENTIRE reveal flow with:

async function handleReady() {
  // Calculate results — plain synchronous JS, no animations, no modals
  const results = evaluateAllBoards(boards);
  
  // Store results in game store or route params
  gameStore.setResults(results);
  
  // Go DIRECTLY to results screen — NO reveal modal, NO RevealSequence
  router.replace('/results');
}
```

**DO NOT:**
- Open any Modal
- Call RevealSequence
- Call useSimpleReveal
- Start any animation
- Play any sound
- Fire any haptic
- Do anything except: calculate → store → navigate

## STEP 2 — Make sure results screen works without reveal data

The results screen might expect data that the reveal normally provides.
Check `app/results.tsx`:

```bash
# What data does results expect?
grep -n "route\.params\|gameStore\|results\|winner\|handName\|pot" app/results.tsx | head -20
```

Make sure ALL required data is set BEFORE navigating:
- Board results (winner per board)
- Hand names (playerHandName, botHandName)
- Chip deltas
- COMPLETE status

If results.tsx reads from the game store → set everything in the store before navigation.
If results.tsx reads from route params → pass everything in router.replace params.

## STEP 3 — REMOVE RevealSequence from rendering

In `app/game.tsx`, find where `<RevealSequence>` is rendered:
```bash
grep -n "RevealSequence\|revealSequence\|reveal.*modal\|reveal.*visible" app/game.tsx | head -10
```

Comment it out or remove it entirely:
```typescript
// REMOVE OR COMMENT:
// {showReveal && <RevealSequence boards={...} visible={true} onDone={...} />}

// REPLACE WITH NOTHING — reveal is skipped
```

## STEP 4 — TEST

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5
```

Deploy OTA:
```bash
eas update --branch production --message "test: bypass reveal entirely — straight to results"
```

AND trigger a build (in case OTA doesn't load):
```bash
git add -A && git commit -m "test: bypass reveal — Ready goes straight to results"
git push origin main
```

## STEP 5 — REPORT

```
═══════════════════════════════════════
SKIP REVEAL TEST
═══════════════════════════════════════
Reveal bypassed: [YES/NO]
RevealSequence removed from render: [YES/NO]
Ready → results direct: [YES/NO]

Results screen shows:
  Board winners: [YES/NO]
  Hand names: [YES/NO]  
  Chip amounts: [YES/NO]
  COMPLETE detection: [YES/NO]

OTA deployed: [YES — ID]
Build triggered: [YES]
Tests: [N]/[N]
TS: 0 errors

CRASH STATUS: [user must test — WAITING]
═══════════════════════════════════════
```

## AFTER USER CONFIRMS NO CRASH:

Then and ONLY then — build a minimal reveal:

**Phase A:** Just show text "Board 1: YOU WIN" for 2 seconds before results. No modal. No animation. Just a View with Text.

**Phase B:** Add card display (face up, no flip). Still no modal.

**Phase C:** Add simple setTimeout delays between boards.

**Phase D:** Add card flip animation.

**Phase E:** Add modal wrapper.

Each phase: deploy → user tests → crash? If yes → the thing we just added is the cause.

## DO NOT
- Do NOT keep RevealSequence in the render tree
- Do NOT play sounds or haptics during this test
- Do NOT use any Modal component
- Do NOT use any Reanimated during this test  
- Do NOT use setTimeout or setInterval during this test
- Ready → calculate → navigate. THREE steps. Nothing else.

VAMOS CAPS SKIP-REVEAL-NUCLEAR — END
