# VAMOS CAPS REVEAL-CRASH-AND-SPEED
**Date:** 2026-03-22 12:32 IST
**Priority:** 🔴🔴 CRITICAL — App crashes at reveal + hand calculation too slow

## TWO BUGS — both happen at the same moment (reveal)

**Bug 1:** App CRASHES right before the reveal sequence starts
**Bug 2:** Hand evaluation takes too long — noticeable delay before results show

These are likely CONNECTED — the crash may BE the timeout/overload from slow evaluation.

## FIRST ACTIONS — Read everything related to reveal
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\hooks\useRevealSequence.ts
cat C:\Projects\Caps\utils\handEvaluator.ts
cat C:\Projects\Caps\utils\gameLogic.ts
cat C:\Projects\Caps\app\game.tsx
cat C:\Projects\Caps\components\Board.tsx
cat C:\Projects\Caps\components\CompleteOverlay.tsx
```

═══════════════════════════════════════════════════════════
BUG 1 — CRASH AT REVEAL
═══════════════════════════════════════════════════════════

### Agent 1A — Find the exact crash point

```bash
cd C:\Projects\Caps

# What happens at the transition to reveal?
grep -n "reveal\|REVEAL\|phase.*reveal\|setPhase.*reveal\|navigateToReveal\|calculateHand\|evaluateOmaha" app/game.tsx | head -30

# What happens in the reveal sequence?
grep -n "start\|begin\|init\|board\[" hooks/useRevealSequence.ts | head -30

# Any unguarded access?
grep -n "boards\[.\]\.\|board\.\|result\.\|hand\.\|cards\[" hooks/useRevealSequence.ts | grep -v "?\\.\|??\|if.*null\|if.*undefined\|try" | head -20

# Reanimated animations starting at reveal:
grep -n "withTiming\|withSequence\|withRepeat\|useSharedValue\|runOnJS" hooks/useRevealSequence.ts components/Board.tsx components/Card.tsx | head -30
```

### Agent 1B — Common crash causes at reveal moment

Check each of these:

**1. Hand evaluation returns null/undefined:**
```
grep -n "evaluateOmaha\|calculateHand\|getHandName\|handResult" utils/handEvaluator.ts utils/gameLogic.ts | head -20
```
Does the evaluator handle ALL edge cases?
- What if a board has < 4 player cards?
- What if community cards are incomplete?
- What if cards are duplicated?

**2. Too many animations starting simultaneously:**
At reveal, ALL of these may fire at once:
- Card flip animations (turn + river per board)
- Hand name overlay animations
- Floating chips animations
- Board pulse animations
- Sound effects
- Haptic feedback

This can overwhelm the JS thread → crash.

**3. State update on unmounted component:**
```
grep -n "setState\|set[A-Z].*(\|dispatch" hooks/useRevealSequence.ts | head -20
```
Is there a `mountedRef` check before EVERY state update?

**4. runOnJS calling stale function:**
```
grep -n "runOnJS" hooks/useRevealSequence.ts components/Board.tsx | head -10
```

### Agent 1C — Fix the crash

For EACH risk found:

```typescript
// 1. Wrap entire reveal sequence in try-catch
async function startReveal() {
  try {
    // ... reveal logic
  } catch (error) {
    console.error('Reveal crash:', error);
    // Fallback: skip animations, show results directly
    router.replace('/results');
  }
}

// 2. Guard every board access
boards?.forEach((board, index) => {
  if (!board?.communityCards?.length || !board?.playerCards?.length) {
    console.warn(`Board ${index} has incomplete data — skipping`);
    return;
  }
  // ... proceed with reveal
});

// 3. Stagger animations to avoid JS thread overload
// Instead of starting ALL boards at once:
// BAD: boards.forEach(board => revealBoard(board));
// GOOD: 
for (let i = 0; i < boards.length; i++) {
  await revealBoard(boards[i]);
  await delay(200); // breathe between boards
}

// 4. Add mountedRef check
const mountedRef = useRef(true);
useEffect(() => { return () => { mountedRef.current = false; }; }, []);
// Before every state update:
if (!mountedRef.current) return;
```

═══════════════════════════════════════════════════════════
BUG 2 — HAND EVALUATION TOO SLOW
═══════════════════════════════════════════════════════════

### Agent 2A — Profile the evaluator

```bash
# How complex is the evaluation?
wc -l utils/handEvaluator.ts

# Count nested loops (O(n²) or worse):
grep -n "for.*for\|forEach.*forEach\|\.map.*\.map\|combinations\|permutations" utils/handEvaluator.ts | head -10

# How many combinations are evaluated?
grep -n "C(.*,.*)\|choose\|combination\|combo" utils/handEvaluator.ts | head -10
```

### Agent 2B — Understand the math

Omaha evaluation = choose 2 from 4 player cards × choose 3 from 5 community cards
= C(4,2) × C(5,3) = 6 × 10 = **60 combinations per hand**

With 4 boards × 2 players = 8 hands = **480 evaluations total**

If each evaluation takes 1ms = 480ms = **almost half a second**. Noticeable.
If each takes 5ms = 2.4 seconds = **terrible UX**.

### Agent 2C — Measure current performance

Add timing:
```typescript
// In gameLogic.ts or wherever evaluation is called:
console.time('handEvaluation');
const results = calculateAllHandResults(boards, playerCards, botCards);
console.timeEnd('handEvaluation');
```

Run and check: how many milliseconds?

### Agent 2D — Optimize the evaluator

**Optimization 1: Pre-compute hand ranks**
```typescript
// Instead of evaluating every 5-card combo from scratch,
// use a lookup table for common patterns:
const HAND_RANK_CACHE = new Map<string, number>();

function evaluateHand(cards: Card[]): HandResult {
  const key = cards.map(c => c.rank + c.suit).sort().join('');
  if (HAND_RANK_CACHE.has(key)) return HAND_RANK_CACHE.get(key)!;
  
  const result = evaluateHandSlow(cards);
  HAND_RANK_CACHE.set(key, result);
  return result;
}
```

**Optimization 2: Early exit on strong hands**
```typescript
// When evaluating 60 combos, if we find a straight flush early,
// we can skip remaining combos (can't beat it):
function evaluateOmahaHand(playerCards: Card[], communityCards: Card[]): HandResult {
  let best = DEFAULT_HAND_RESULT;
  
  for (const playerCombo of choose2(playerCards)) {
    for (const communityCombo of choose3(communityCards)) {
      const hand = [...playerCombo, ...communityCombo];
      const result = evaluate5Cards(hand);
      
      if (result.rank > best.rank || (result.rank === best.rank && result.value > best.value)) {
        best = result;
      }
      
      // Early exit: Royal Flush = unbeatable
      if (best.rank === 9) return best;
      // Early exit: Straight Flush = nearly unbeatable
      if (best.rank === 8) break;
    }
    if (best.rank >= 8) break;
  }
  
  return best;
}
```

**Optimization 3: Move evaluation off the JS thread**
```typescript
// If evaluation is STILL slow (>200ms), run it before the reveal animation starts:
// During the "ARRANGING" phase, when player presses Ready:

async function handleReady() {
  setPhase('CALCULATING'); // show brief loading indicator
  
  // Run evaluation in next tick to not block UI:
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const results = calculateAllHandResults(boards, playerCards, botCards);
  
  setResults(results);
  setPhase('REVEAL'); // now start animations with pre-calculated results
}
```

**Optimization 4: Bitwise hand evaluation (fastest possible)**
```typescript
// Instead of string comparisons, use bitwise operations:
// Each card = a 6-bit number (4 bits rank + 2 bits suit)
// Hand evaluation becomes bitwise operations = ~10x faster

function cardToBits(card: Card): number {
  const ranks = '23456789TJQKA';
  const suits = 'shdc';
  return (ranks.indexOf(card.rank) << 2) | suits.indexOf(card.suit);
}

// Pre-compute all possible 5-card hand ranks into a lookup table
// This makes evaluation O(1) per hand
```

### Agent 2E — Reduce perceived delay

Even if evaluation is fast, the TRANSITION should feel instant:

```typescript
// 1. Pre-calculate results WHILE player is still arranging
//    (after all cards placed, before Ready pressed):
useEffect(() => {
  if (allCardsPlaced && phase === 'ARRANGING') {
    // Background pre-calculation:
    const preResults = calculateAllHandResults(boards, playerCards, botCards);
    preCalculatedResultsRef.current = preResults;
  }
}, [allCardsPlaced]);

// 2. When Ready pressed → results already available → instant reveal
function handleReady() {
  const results = preCalculatedResultsRef.current ?? calculateAllHandResults(...);
  setResults(results);
  setPhase('REVEAL');
}
```

═══════════════════════════════════════════════════════════
TIMING TARGETS
═══════════════════════════════════════════════════════════

| What | Current (guess) | Target |
|------|----------------|--------|
| Hand evaluation (all boards) | 500ms-2s? | **< 50ms** |
| Ready → first card flip | 1-3s? | **< 300ms** |
| Total reveal sequence | 10s+? | **6-8s** (dramatic but not boring) |
| Ready → crash | NOW: crash | **never crash** |

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 724+ pass
F3. Add performance test:
    - Evaluate 480 hands in < 50ms (4 boards × 2 players × 60 combos)
F4. npx expo export --platform web --output-dir web-dist
F5. git add -A && git commit -m "fix: reveal crash — try-catch + staggered animations + evaluation speedup"
F6. git push origin main
F7. Update MEMORY.md
```

## REPORT
```
═══════════════════════════════════════
REVEAL CRASH + SPEED — REPORT
═══════════════════════════════════════
CRASH:
  Root cause: [exact cause + file:line]
  Fix: [what was done]
  Tested: [crash still happens? YES/NO]
  ErrorBoundary catches it: [YES/NO]

SPEED:
  Evaluation time BEFORE: [N]ms
  Evaluation time AFTER: [N]ms
  Speedup: [Nx]
  Pre-calculation during arranging: [YES/NO]
  
  Ready → first card flip: [N]ms
  Total reveal sequence: [N]s

Optimizations applied:
  [ ] try-catch around reveal
  [ ] Board data validation
  [ ] Staggered animations (not all at once)
  [ ] mountedRef checks
  [ ] Hand rank cache
  [ ] Early exit on strong hands
  [ ] Pre-calculation during arranging
  [ ] Bitwise evaluation (if needed)

Tests: [N] pass
TS: 0 errors
═══════════════════════════════════════
```

## DO NOT
- Do NOT change the visual reveal sequence (flip + hand name + chips)
- Do NOT remove any animations — just stagger them
- Do NOT change Omaha rules (must use exactly 2 player + 3 community)
- Do NOT make the reveal faster than 6 seconds (drama is important!)

VAMOS CAPS REVEAL-CRASH-AND-SPEED — END
