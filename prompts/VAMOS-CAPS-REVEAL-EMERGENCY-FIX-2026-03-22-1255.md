# VAMOS CAPS REVEAL-EMERGENCY-FIX
**Date:** 2026-03-22 12:55 IST
**Priority:** 🔴🔴🔴 EMERGENCY — App still crashes at reveal after OTA. Previous fix didn't work.

## SITUATION
- Build 172 + OTA update applied
- App STILL crashes right before/during reveal
- Hand evaluation STILL too slow
- Previous fix was NOT enough — need deeper investigation

## RULE
Do NOT guess. Read the ACTUAL code. Find the ACTUAL crash. Fix it. Test it.

## FIRST ACTIONS — Read EVERY file in the reveal chain
```
cd C:\Projects\Caps
cat app/game.tsx
cat hooks/useRevealSequence.ts
cat utils/handEvaluator.ts
cat utils/gameLogic.ts
cat components/Board.tsx
cat components/Card.tsx
cat components/CompleteOverlay.tsx
cat components/HandNameOverlay.tsx
cat components/FloatingChips.tsx
cat utils/sounds.ts
```

## STEP 1 — TRACE THE EXACT FLOW

Map every function call from "Ready pressed" to "Results screen":

```
Ready pressed
  → handleReady() in game.tsx — WHAT DOES IT DO? Print every line.
    → calculateHandResults? evaluateOmaha? navigateToReveal?
      → WHAT is called? In what ORDER?
        → Which function takes the longest?
        → Which function can crash?
```

Print the COMPLETE call chain:
```bash
echo "=== handleReady ==="
grep -A 30 "handleReady\|onReady\|pressReady" app/game.tsx | head -40

echo ""
echo "=== navigateToReveal or transition to reveal ==="
grep -A 30 "navigateToReveal\|setPhase.*reveal\|phase.*REVEAL\|startReveal" app/game.tsx hooks/useRevealSequence.ts | head -50

echo ""
echo "=== calculateHandResults ==="
grep -A 30 "calculateHand\|evaluateAll\|calculateResults\|HandResult" utils/gameLogic.ts | head -50

echo ""
echo "=== evaluateOmahaHand ==="
grep -A 40 "function evaluateOmaha\|function evaluate5\|function rankHand" utils/handEvaluator.ts | head -60
```

## STEP 2 — ADD PERFORMANCE LOGGING

Add timing to EVERY step in the reveal chain:

```typescript
// In game.tsx — wherever Ready triggers reveal:
console.log('[REVEAL] Ready pressed at', Date.now());

console.time('[REVEAL] hand evaluation');
const results = calculateAllHandResults(...);
console.timeEnd('[REVEAL] hand evaluation');

console.time('[REVEAL] state update');
setResults(results);
console.timeEnd('[REVEAL] state update');

console.time('[REVEAL] phase transition');
setPhase('REVEAL');
console.timeEnd('[REVEAL] phase transition');
```

```typescript
// In handEvaluator.ts:
console.time('[EVAL] single hand');
// ... evaluation
console.timeEnd('[EVAL] single hand');
```

Run the app in dev mode and play one hand:
```
npx expo start --ios
```

Copy the console output — it will show EXACTLY where the time is spent and where it crashes.

## STEP 3 — THE MOST LIKELY CRASH: Reanimated on JS thread overload

When the JS thread is busy calculating 480 hands:
- Reanimated animations can't update → worklet crash
- React state updates queue up → memory spike → crash
- Sound playback fails → unhandled promise rejection → crash

**THE FIX:** Separate calculation from animation COMPLETELY.

```typescript
// CURRENT (broken):
function handleReady() {
  const results = heavyCalculation(); // BLOCKS JS thread for 500ms+
  startAnimations(); // tries to start while JS thread is blocked → CRASH
}

// FIXED:
function handleReady() {
  setPhase('CALCULATING'); // show brief spinner or "Calculating..."
  
  // Use InteractionManager to wait for UI to settle:
  InteractionManager.runAfterInteractions(async () => {
    // Calculation runs AFTER all pending animations/renders are done:
    const results = calculateAllHandResults(...);
    
    if (!mountedRef.current) return;
    
    setResults(results);
    
    // Small delay to let React render the results into state:
    await new Promise(r => setTimeout(r, 50));
    
    if (!mountedRef.current) return;
    
    setPhase('REVEAL'); // NOW start animations — JS thread is free
  });
}
```

## STEP 4 — SPEED UP HAND EVALUATION

```bash
# How many lines is the evaluator?
wc -l utils/handEvaluator.ts

# Are there nested loops?
grep -c "for\b" utils/handEvaluator.ts
grep -c "forEach" utils/handEvaluator.ts

# Any sort operations? (expensive)
grep -n "\.sort(" utils/handEvaluator.ts

# Any string operations in hot path? (slow)
grep -n "\.join(\|\.toString(\|\.includes(\|\.indexOf(" utils/handEvaluator.ts | head -10

# Any array creation in hot path? (GC pressure)
grep -n "new Array\|\[\.\.\.\|\.slice(\|\.filter(\|\.map(" utils/handEvaluator.ts | head -10
```

**Common speed killers in hand evaluators:**
1. `Array.sort()` inside the hot loop — use insertion sort or avoid sort
2. String concatenation for hand comparison — use numbers
3. `Array.slice()` / spread `[...arr]` creating garbage — reuse arrays
4. `Array.filter().map()` chains — use single loop
5. Not caching results — same 5-card hand evaluated multiple times

**Apply these optimizations:**
```typescript
// 1. Pre-allocate arrays (avoid GC pressure)
const tempHand = new Array(5); // reuse, don't create new

// 2. Use numeric comparison instead of string
// BAD: cards.map(c => c.rank + c.suit).sort().join('')
// GOOD: cards.reduce((acc, c) => acc * 100 + cardValue(c), 0)

// 3. Cache the C(4,2) and C(5,3) combinations — they're always the same shapes
const PLAYER_COMBOS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]; // C(4,2) = 6
const BOARD_COMBOS = [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]]; // C(5,3) = 10

function evaluateOmahaHand(playerCards: Card[], communityCards: Card[]): HandResult {
  let bestRank = -1;
  let bestResult: HandResult | null = null;
  
  for (const [pi, pj] of PLAYER_COMBOS) {
    for (const [ci, cj, ck] of BOARD_COMBOS) {
      tempHand[0] = playerCards[pi];
      tempHand[1] = playerCards[pj];
      tempHand[2] = communityCards[ci];
      tempHand[3] = communityCards[cj];
      tempHand[4] = communityCards[ck];
      
      const rank = evaluate5CardsFast(tempHand);
      if (rank > bestRank) {
        bestRank = rank;
        bestResult = { rank, cards: [...tempHand], name: getHandName(rank) };
      }
      
      if (bestRank >= 8) break; // Straight flush+ = unbeatable
    }
    if (bestRank >= 8) break;
  }
  
  return bestResult!;
}

// 4. Fast 5-card evaluator using bit manipulation
function evaluate5CardsFast(cards: Card[]): number {
  // Convert to bitmask for fast evaluation
  let rankBits = 0;
  let suitCounts = [0, 0, 0, 0];
  let rankCounts = new Uint8Array(15); // reuse, pre-allocated
  
  for (let i = 0; i < 5; i++) {
    const r = cardRankValue(cards[i]);
    const s = cardSuitValue(cards[i]);
    rankBits |= (1 << r);
    suitCounts[s]++;
    rankCounts[r]++;
  }
  
  const isFlush = suitCounts[0] === 5 || suitCounts[1] === 5 || suitCounts[2] === 5 || suitCounts[3] === 5;
  const isStraight = checkStraightBits(rankBits);
  
  if (isFlush && isStraight) return rankBits === 0x7C00 ? 9 : 8; // Royal/Straight flush
  
  // Count pairs, trips, quads
  let pairs = 0, trips = 0, quads = 0;
  for (let r = 2; r <= 14; r++) {
    if (rankCounts[r] === 4) quads++;
    else if (rankCounts[r] === 3) trips++;
    else if (rankCounts[r] === 2) pairs++;
  }
  
  if (quads) return 7;
  if (trips && pairs) return 6;
  if (isFlush) return 5;
  if (isStraight) return 4;
  if (trips) return 3;
  if (pairs === 2) return 2;
  if (pairs === 1) return 1;
  return 0;
}
```

## STEP 5 — MEASURE AFTER FIX

```typescript
// Add a performance test that runs at startup in __DEV__:
if (__DEV__) {
  const testStart = Date.now();
  for (let i = 0; i < 100; i++) {
    calculateAllHandResults(mockBoards, mockPlayerCards, mockBotCards);
  }
  const elapsed = Date.now() - testStart;
  console.log(`[PERF] 100 full evaluations in ${elapsed}ms (${elapsed/100}ms each)`);
  // Target: < 5ms each = < 500ms for 100
}
```

## STEP 6 — TEST THE FIX

```
# 1. TypeScript
npx tsc --noEmit

# 2. Tests
npx jest --forceExit

# 3. Run in dev and play 5 hands — no crash, fast reveal:
# Check console for timing logs

# 4. Deploy OTA (instant — no build needed):
eas update --branch production --message "fix: reveal crash — InteractionManager + fast evaluator"
```

## STEP 7 — ALSO: Deploy as new build (in case OTA doesn't cover native changes)
```
git add -A && git commit -m "fix: reveal crash — separate calc from animation + fast hand evaluator"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
REVEAL EMERGENCY FIX — REPORT
═══════════════════════════════════════
CRASH ROOT CAUSE: [exact cause with file:line]
  Was it: Reanimated / null access / JS thread overload / memory / other?

SPEED:
  Evaluation BEFORE: [N]ms for all boards
  Evaluation AFTER: [N]ms for all boards
  Speedup: [Nx]
  
  100 evaluations benchmark: [N]ms total ([N]ms each)

FIXES:
  [ ] InteractionManager separates calc from animation
  [ ] mountedRef checked before every state update
  [ ] Pre-allocated arrays in evaluator
  [ ] Cached combinations (PLAYER_COMBOS, BOARD_COMBOS)
  [ ] Bitwise 5-card evaluation
  [ ] Early exit on strong hands
  [ ] try-catch with fallback to results screen

Deployed:
  OTA: [YES — eas update ID]
  Build: [triggered / not needed]
  
Crash reproduced after fix: [YES still crashes / NO — FIXED]
═══════════════════════════════════════
```

## DO NOT
- Do NOT skip the performance measurement — MUST show before/after numbers
- Do NOT remove reveal animations — only SEPARATE them from calculation
- Do NOT change Omaha rules
- Do NOT change the visual sequence

VAMOS CAPS REVEAL-EMERGENCY-FIX — END
