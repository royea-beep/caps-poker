# VAMOS CAPS REVEAL-NUCLEAR-FIX
**Date:** 2026-03-22 13:08 IST
**Priority:** 🔴🔴🔴 NUCLEAR — Two previous fix attempts FAILED. App STILL crashes at reveal.

## SITUATION
- Fix attempt 1: cancelAnimation on unmount → STILL CRASHES
- Fix attempt 2: InteractionManager + fast evaluator → STILL CRASHES
- We're guessing. STOP GUESSING. REPRODUCE AND DEBUG.

## RULE
1. REPRODUCE the crash locally in dev mode
2. READ the exact error from Metro/React Native logs
3. FIX the exact error, not a guess
4. VERIFY the fix by playing 5 hands without crash

## STEP 1 — REPRODUCE LOCALLY

```bash
cd C:\Projects\Caps

# Start dev server with FULL logging:
npx expo start --ios --dev-client 2>&1 | tee /tmp/caps-crash.log &

# OR if no physical device connected, use web:
npx expo start --web 2>&1 | tee /tmp/caps-crash.log &
```

If neither works, simulate the reveal flow with a test:
```bash
# Create a crash reproduction test:
cat > utils/__tests__/revealCrash.test.ts << 'EOF'
import { calculateHandResultsMulti } from '../gameLogic';
import { createDeck, shuffleDeck } from '../deck';

describe('Reveal crash reproduction', () => {
  it('should evaluate all boards without crash', () => {
    const deck = shuffleDeck(createDeck());
    
    // Simulate a 2-player, 4-board game
    const numBoards = 4;
    const cardsPerPlayer = numBoards * 4; // 16 cards each
    
    const playerCards = deck.slice(0, cardsPerPlayer);
    const botCards = deck.slice(cardsPerPlayer, cardsPerPlayer * 2);
    const remaining = deck.slice(cardsPerPlayer * 2);
    
    const boards = [];
    for (let i = 0; i < numBoards; i++) {
      const boardPlayerCards = playerCards.slice(i * 4, (i + 1) * 4);
      const boardBotCards = botCards.slice(i * 4, (i + 1) * 4);
      const communityCards = remaining.slice(i * 5, (i + 1) * 5);
      
      boards.push({
        playerCards: boardPlayerCards,
        botCards: boardBotCards,
        communityCards: communityCards,
      });
    }
    
    // This should NOT throw:
    console.time('evaluation');
    const results = calculateHandResultsMulti(boards);
    console.timeEnd('evaluation');
    
    expect(results).toBeDefined();
    expect(results.length).toBe(numBoards);
    
    results.forEach((r, i) => {
      expect(r.playerHand).toBeDefined();
      expect(r.botHand).toBeDefined();
      expect(r.winner).toBeDefined();
      console.log(`Board ${i}: player=${r.playerHand?.name}, bot=${r.botHand?.name}, winner=${r.winner}`);
    });
  });

  it('should handle edge cases', () => {
    // Empty boards
    expect(() => calculateHandResultsMulti([])).not.toThrow();
    
    // Board with missing cards
    expect(() => calculateHandResultsMulti([{
      playerCards: [],
      botCards: [],
      communityCards: [],
    }])).not.toThrow();
  });

  it('should run 100 evaluations in under 200ms', () => {
    const deck = shuffleDeck(createDeck());
    const boards = createMockBoards(deck, 4);
    
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      calculateHandResultsMulti(boards);
    }
    const elapsed = Date.now() - start;
    
    console.log(`100 evaluations: ${elapsed}ms (${elapsed/100}ms each)`);
    expect(elapsed).toBeLessThan(200);
  });
});

function createMockBoards(deck: any[], numBoards: number) {
  const boards = [];
  let cardIndex = 0;
  for (let i = 0; i < numBoards; i++) {
    boards.push({
      playerCards: deck.slice(cardIndex, cardIndex + 4),
      botCards: deck.slice(cardIndex + 4, cardIndex + 8),
      communityCards: deck.slice(cardIndex + 8, cardIndex + 13),
    });
    cardIndex += 13;
  }
  return boards;
}
EOF

npx jest utils/__tests__/revealCrash.test.ts --verbose 2>&1
```

## STEP 2 — READ EVERY ERROR

```bash
# Check for recent crashes logged to Supabase (ErrorBoundary should log):
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?severity=eq.CRITICAL&order=created_at.desc&limit=5" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null | python -m json.tool

# Check if ErrorBoundary is actually catching:
grep -n "ErrorBoundary\|componentDidCatch\|getDerivedState" components/ErrorBoundary.tsx | head -10

# Is ErrorBoundary wrapping the game screen?
grep -n "ErrorBoundary" app/game.tsx app/_layout.tsx | head -5
```

## STEP 3 — READ THE ACTUAL REVEAL CODE (every line)

```bash
# Print the COMPLETE reveal flow — don't skip anything:
echo "=========================================="
echo "GAME.TSX — handleReady / navigateToReveal"
echo "=========================================="
cat app/game.tsx

echo ""
echo "=========================================="
echo "USE REVEAL SEQUENCE"
echo "=========================================="
cat hooks/useRevealSequence.ts

echo ""
echo "=========================================="
echo "GAME LOGIC — calculateHandResults"  
echo "=========================================="
cat utils/gameLogic.ts

echo ""
echo "=========================================="
echo "HAND EVALUATOR"
echo "=========================================="
cat utils/handEvaluator.ts
```

Read ALL of it. Find:
1. **Where exactly does it crash?** (which line, which function)
2. **What data is null/undefined when it shouldn't be?**
3. **What animation is running when the crash happens?**
4. **Is the error a JS error (caught by ErrorBoundary) or a NATIVE crash (Reanimated/Hermes)?**

## STEP 4 — IF IT'S A NATIVE CRASH (Reanimated)

Native crashes bypass ErrorBoundary. Check:

```bash
# List all Reanimated usage in reveal-related files:
grep -rn "useSharedValue\|useAnimatedStyle\|withTiming\|withSequence\|withRepeat\|withDelay\|runOnJS\|runOnUI\|cancelAnimation\|useAnimatedReaction" \
  app/game.tsx hooks/useRevealSequence.ts components/Board.tsx components/Card.tsx \
  components/CompleteOverlay.tsx components/HandNameOverlay.tsx components/FloatingChips.tsx \
  | grep -v node_modules

# Count total Reanimated hooks:
echo "Total Reanimated hooks in reveal chain:"
grep -rn "useSharedValue\|useAnimatedStyle\|withTiming\|withRepeat\|runOnJS" \
  app/game.tsx hooks/useRevealSequence.ts components/Board.tsx components/Card.tsx \
  components/CompleteOverlay.tsx components/HandNameOverlay.tsx components/FloatingChips.tsx \
  | grep -v node_modules | wc -l
```

**If too many animations → SIMPLIFY:**
```typescript
// NUCLEAR OPTION: Disable ALL reveal animations temporarily to prove they're the crash cause:

// In useRevealSequence.ts, add a SIMPLE_MODE flag:
const SIMPLE_MODE = true; // Set to true to bypass all animations

if (SIMPLE_MODE) {
  // Skip ALL animations — just show results immediately:
  // 1. Set all community cards face-up
  // 2. Calculate results
  // 3. Show hand names
  // 4. Show win/loss
  // 5. Navigate to results
  // NO flips, NO floats, NO particles, NO delays
  
  boards.forEach((board, i) => {
    board.allRevealed = true;
    board.result = results[i];
  });
  
  await delay(500); // brief pause
  router.replace('/results');
  return;
}
```

**Test with SIMPLE_MODE = true. If it DOESN'T crash → the animations are the problem.**
**If it STILL crashes → the evaluation/data is the problem.**

## STEP 5 — FIX BASED ON FINDINGS

### If animations are the problem:
1. Reduce animation count — max 2 concurrent animations at any time
2. Use `requestAnimationFrame` instead of `withTiming` chains
3. Cancel ALL previous animations before starting new ones
4. Use `LayoutAnimation` (native driver) instead of Reanimated for simple fades

### If evaluation is the problem:
1. Add null checks on EVERY field access
2. Add validation before evaluation: `if (cards.length < 4) return DEFAULT_RESULT`
3. Wrap in try-catch with fallback result
4. Log the exact cards that cause the crash

### If state management is the problem:
1. Don't update state during animation
2. Batch all state updates into one `React.startTransition`
3. Use `useRef` instead of `useState` for reveal progress

## STEP 6 — VERIFY

After fixing:
```bash
# Run the crash reproduction test:
npx jest utils/__tests__/revealCrash.test.ts --verbose

# Run ALL tests:
npx jest --forceExit

# TypeScript:
npx tsc --noEmit

# Play 5 hands locally:
npx expo start --web
# Play 5 hands. All must reach results without crash.
```

## STEP 7 — DEPLOY

```bash
# OTA first (instant):
eas update --branch production --message "fix: reveal crash — [describe actual fix]"

# Then full build:
git add -A && git commit -m "fix: reveal crash — [describe actual fix]"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
REVEAL NUCLEAR FIX — REPORT
═══════════════════════════════════════
CRASH REPRODUCED LOCALLY: [YES — error message / NO]

SIMPLE_MODE TEST:
  With animations OFF: [CRASHES / WORKS]
  With animations ON: [CRASHES / WORKS]
  → Cause is: [ANIMATIONS / EVALUATION / STATE / OTHER]

EXACT ERROR: [copy the actual error message/stack trace]
EXACT FILE:LINE: [where it crashes]
EXACT CAUSE: [what value is wrong/null/overloaded]

FIX APPLIED: [describe exactly what changed]

VERIFICATION:
  Crash reproduction test: [PASS / FAIL]
  5 hands played without crash: [YES / NO]
  Evaluation speed: [N]ms per full game

Supabase crash logs found: [N] — [describe if any]

OTA deployed: [YES — ID / NO]
Build triggered: [YES / NO]

Tests: [N]/[N]
TS: 0 errors
═══════════════════════════════════════
```

## DO NOT
- Do NOT guess. REPRODUCE then fix.
- Do NOT apply another "maybe this will work" patch
- Do NOT skip the SIMPLE_MODE test — it proves the root cause
- If you can't reproduce → add MORE logging and deploy, ask user to trigger crash again

VAMOS CAPS REVEAL-NUCLEAR-FIX — END
