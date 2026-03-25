# VAMOS CAPS CRASH-REAL-CAUSE
**Date:** 2026-03-22 15:53 IST
**Priority:** 🔴🔴🔴🔴🔴 FIFTH ATTEMPT — BUT NOW WE KNOW WHERE

## BREAKTHROUGH
All animations are OFF (KILL switch). App STILL crashes.
**Crash happens: after turn+river shown on Board 1.**
**This means: the crash is in the REVEAL LOGIC, not animations.**

The 3 previous "animation fixes" were ALL wrong. The real crash is in:
- useRevealSequence.ts — the code that runs AFTER board 1 reveals
- OR hand evaluation of board 1 results
- OR state update after board 1

## DO NOT touch animations. Focus ONLY on reveal logic.

## FIRST ACTIONS — Read the reveal sequence line by line
```
cd C:\Projects\Caps
cat hooks/useRevealSequence.ts
```

## STEP 1 — Map the EXACT flow after Board 1 turn+river

The user sees:
1. Board 1 community cards (flop) — visible ✅
2. Board 1 turn card revealed ✅
3. Board 1 river card revealed ✅
4. 💥 CRASH HERE

What happens in code at step 4? It's ONE of these:
- Evaluate board 1 hand results (evaluateOmahaHand)
- Update state with board 1 winner
- Show hand name overlay
- Show floating chips
- Move to board 2
- runOnJS callback
- Sound playback
- Haptic feedback

```bash
# Find the EXACT code that runs after board 1 river:
grep -n "river\|turn\|board.*1\|board.*0\|boards\[0\]\|revealBoard\|nextBoard\|boardIndex" hooks/useRevealSequence.ts | head -30

# Find what happens AFTER a board's cards are revealed:
grep -n "after.*reveal\|onReveal\|boardComplete\|boardFinish\|handResult\|setResult\|winner" hooks/useRevealSequence.ts | head -20

# Find ALL try-catch in the reveal sequence:
grep -n "try\|catch" hooks/useRevealSequence.ts
```

## STEP 2 — ADD LOGGING TO EVERY STEP

In useRevealSequence.ts, add console.log at EVERY step between "river revealed" and "move to board 2":

```typescript
// After river card of board is revealed:
console.log('[REVEAL] Board', boardIndex, 'river revealed — starting evaluation');

try {
  console.log('[REVEAL] Evaluating player hand...');
  const playerResult = evaluateOmahaHand(board.playerCards, board.communityCards);
  console.log('[REVEAL] Player result:', playerResult?.name);
  
  console.log('[REVEAL] Evaluating bot hand...');
  const botResult = evaluateOmahaHand(board.botCards, board.communityCards);
  console.log('[REVEAL] Bot result:', botResult?.name);
  
  console.log('[REVEAL] Determining winner...');
  const winner = determineWinner(playerResult, botResult);
  console.log('[REVEAL] Winner:', winner);
  
  console.log('[REVEAL] Updating state...');
  // ... state update
  console.log('[REVEAL] State updated');
  
  console.log('[REVEAL] Moving to board', boardIndex + 1);
} catch (error) {
  console.error('[REVEAL] CRASH AT BOARD', boardIndex, ':', error);
  console.error('[REVEAL] Stack:', error?.stack);
  // Don't crash — skip to results:
  router.replace('/results');
}
```

## STEP 3 — CHECK FOR COMMON REVEAL BUGS

```bash
# 1. Does it access board.communityCards[3] and [4] (turn+river)?
# What if they're undefined?
grep -n "communityCards\[3\]\|communityCards\[4\]\|turn\|river" hooks/useRevealSequence.ts

# 2. Does evaluateOmahaHand handle 4 player cards + 5 community cards?
# What if board.playerCards has < 4 or communityCards has < 5?
grep -n "playerCards\|communityCards\|\.length" utils/handEvaluator.ts | head -20

# 3. Are there any async operations without await?
grep -n "async\|await\|Promise\|setTimeout\|setInterval" hooks/useRevealSequence.ts | head -20

# 4. Is there a delay/sleep between boards?
grep -n "delay\|sleep\|setTimeout\|wait" hooks/useRevealSequence.ts | head -10

# 5. Does it use runOnJS to call back from Reanimated?
grep -n "runOnJS" hooks/useRevealSequence.ts

# 6. Is there a setState during an animation frame?
grep -n "set[A-Z]\|dispatch\|setState" hooks/useRevealSequence.ts | head -20

# 7. Does it access the game store?
grep -n "useStore\|gameStore\|zustand\|persist" hooks/useRevealSequence.ts app/game.tsx | head -10
```

## STEP 4 — THE MOST LIKELY CAUSE

After Board 1 river reveals, the code probably:
1. Calls evaluateOmahaHand for board 1
2. Something in that evaluation CRASHES

**OR:**
1. Board 1 evaluation completes
2. Code tries to show result (hand name, chips)
3. Accessing a property on undefined result → crash

**OR:**
1. The reveal sequence uses setTimeout/delay between boards
2. During the delay, something unmounts or state changes
3. Callback runs on dead component → crash

**Check ALL three theories with the logging from Step 2.**

## STEP 5 — EMERGENCY FALLBACK

If you can't find the exact cause, add a BULLETPROOF try-catch:

```typescript
// Wrap the ENTIRE reveal sequence:
async function runRevealSequence(boards, ...) {
  for (let i = 0; i < boards.length; i++) {
    try {
      await revealBoard(i);
    } catch (error) {
      console.error(`Board ${i} reveal crashed:`, error);
      // Skip this board, continue to next:
      continue;
    }
  }
  
  // Always reach results, even if some boards crashed:
  try {
    router.replace('/results');
  } catch (e) {
    // Nuclear fallback:
    router.replace('/');
  }
}
```

This doesn't fix the ROOT cause but prevents the crash from killing the app.
The user sees results (maybe with missing board data) instead of a crash.

## STEP 6 — ALSO CHECK: Is it a Zustand/persist issue?

```bash
grep -n "persist\|zustand\|AsyncStorage" store/gameStore.ts | head -10
```

If the game store persists to AsyncStorage, and the reveal sequence writes to the store,
there could be a serialization crash (trying to persist a non-serializable value).

## DEPLOY

```bash
# Add logging + try-catch fallback:
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

# OTA with logging (so we can see what happens):
eas update --branch production --message "debug: reveal crash logging + try-catch fallback"

# Tell user: play a hand, if it crashes send console output
# If it DOESN'T crash (try-catch caught it), we'll see the error in logs
```

## REPORT
```
═══════════════════════════════════════
REAL CAUSE — REPORT
═══════════════════════════════════════
CONFIRMED: Crash is NOT animations (all disabled, still crashes)
CONFIRMED: Crash is after Board 1 turn+river

Code flow after Board 1 river:
  Step 1: [what happens — file:line]
  Step 2: [what happens — file:line]
  Step 3: [what happens — file:line]
  Step 4: 💥 [CRASH HERE — file:line — error message]

Root cause: [EXACT description]
Fix: [EXACT change]

Emergency fallback added: [YES — try-catch wraps entire reveal]
Logging added: [YES — every step logged]

OTA deployed: [YES — ID]
Tests: [N]/[N]
═══════════════════════════════════════
```

## DO NOT
- Do NOT "fix" more animations — PROVEN not the cause
- Do NOT guess — READ the code and ADD LOGGING
- Do NOT deploy without the try-catch fallback
- The try-catch is MANDATORY even if you find the root cause
  (belt AND suspenders — never crash again)

VAMOS CAPS CRASH-REAL-CAUSE — END
