# VAMOS CAPS FULL-QA-TEAM
**Date:** 2026-03-22 16:42 IST
**Priority:** 🔴🔴🔴🔴🔴 EVERYTHING IS BROKEN — Full team, full audit, fix everything

## SITUATION — READ CAREFULLY
1. App crashes at reveal — 5 fix attempts FAILED
2. Cards in YOUR HAND appear DUPLICATED — same card showing multiple times
3. Cards OVERLAP each other visually
4. These are probably CONNECTED — duplicate cards → evaluation crashes on impossible hand

## THE TEAM
- **Agent 1 — Data Integrity Engineer**: Find and fix the duplicate cards bug
- **Agent 2 — Crash Forensics**: Read Supabase remote logs, find exact crash point
- **Agent 3 — Reveal Sequence Rewriter**: Rewrite the reveal to be crash-proof
- **Agent 4 — UI/UX Auditor**: Fix all visual bugs — card overlap, sizing, layout
- **Agent 5 — Pipeline QA**: Verify build→submit→TestFlight→OTA chain
- **Agent 6 — Stress Tester**: Run 1000 simulated hands, find ALL edge cases

## FIRST — Read the remote crash logs
```
cd C:\Projects\Caps

echo "=== CRASH DEBUG LOGS ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?description=like.*CRASH-DEBUG*&order=created_at.desc&limit=30" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null | python -m json.tool

echo ""
echo "=== ALL RECENT BUG REPORTS ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=20" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" 2>/dev/null | python -m json.tool
```

## THEN — Read ALL relevant code
```
cat app/game.tsx
cat hooks/useRevealSequence.ts
cat utils/gameLogic.ts
cat utils/handEvaluator.ts
cat utils/deck.ts
cat components/Board.tsx
cat components/PlayerHand.tsx
cat components/Card.tsx
cat store/gameStore.ts
```

═══════════════════════════════════════════════════════════
AGENT 1 — DATA INTEGRITY: Fix Duplicate Cards
═══════════════════════════════════════════════════════════

**The screenshot shows cards appearing duplicated in the hand.** 
This is CRITICAL — if the deck has duplicate cards:
- Evaluation fails (impossible Omaha hand)
- Results are wrong
- Crash is likely from trying to evaluate a hand with duplicates

### 1A. Find where the deck is created
```bash
grep -n "createDeck\|shuffleDeck\|newDeck\|generateDeck" utils/deck.ts | head -20
cat utils/deck.ts
```

Check:
- Does createDeck create exactly 52 unique cards?
- Does shuffleDeck actually shuffle correctly?
- Is the deck used once or can it be reused/corrupted?

### 1B. Find where cards are dealt
```bash
grep -n "deal\|dealCards\|playerHand\|botHand\|slice\|splice" utils/gameLogic.ts app/game.tsx | head -30
```

Check:
- When cards are dealt, are they REMOVED from the deck?
- Can the same card be dealt twice?
- When cards are placed on boards, is the source array mutated?

### 1C. Find where cards are placed on boards
```bash
grep -n "placeCard\|handleBoardPress\|addCard\|boardCards\|playerCards" app/game.tsx components/Board.tsx | head -30
```

Check:
- When a card is placed on a board, is it removed from the hand?
- Can the same card be placed on two different boards?
- Is there a validation that each card appears ONCE across all boards?

### 1D. Find the bug

Most likely cause: **the card placement uses array index references that don't update correctly.** 

Example bug pattern:
```typescript
// BUG: splice mutates the array but React state doesn't update
const newHand = [...playerHand];
newHand.splice(index, 1); // removes from copy
setPlayerHand(newHand);
// BUT: the original playerHand reference is stale in a callback
```

Or:
```typescript
// BUG: placing a card doesn't remove it from hand state
function placeCard(card, boardIndex) {
  boards[boardIndex].playerCards.push(card);
  // MISSING: remove card from playerHand
}
```

Or:
```typescript
// BUG: same deck reference used for player AND bot
const deck = shuffleDeck(createDeck());
const playerCards = deck.slice(0, 16); // first 16
const botCards = deck.slice(0, 16); // SAME 16!!! should be slice(16, 32)
```

### 1E. Fix — Add validation everywhere

```typescript
// In deck.ts — verify no duplicates:
function validateDeck(cards: Card[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) {
    const key = `${card.rank}${card.suit}`;
    if (seen.has(key)) {
      console.error(`DUPLICATE CARD: ${key}`);
      return false;
    }
    seen.add(key);
  }
  return true;
}

// Call after dealing:
const deck = shuffleDeck(createDeck());
console.assert(validateDeck(deck), 'Deck has duplicates!');

const playerCards = deck.slice(0, 16);
const botCards = deck.slice(16, 32);
console.assert(validateDeck(playerCards), 'Player cards have duplicates!');
console.assert(validateDeck(botCards), 'Bot cards have duplicates!');
console.assert(validateDeck([...playerCards, ...botCards]), 'Player and bot share cards!');

// In game.tsx — verify no duplicates when placing:
function handlePlaceCard(card, boardIndex) {
  // Check card isn't already on ANY board:
  const allPlacedCards = boards.flatMap(b => b.playerCards);
  const isDuplicate = allPlacedCards.some(c => c.rank === card.rank && c.suit === card.suit);
  if (isDuplicate) {
    console.error('DUPLICATE PLACEMENT:', card);
    return; // refuse to place
  }
  // ... proceed
}
```

═══════════════════════════════════════════════════════════
AGENT 2 — CRASH FORENSICS: Read Remote Logs
═══════════════════════════════════════════════════════════

Read the Supabase bug_reports for CRASH-DEBUG entries (from the remote logger we added).

Find the LAST step before silence. That's where the crash is.

If no CRASH-DEBUG entries → the remote logger wasn't in the build the user tested.
→ The OTA didn't load on their device.
→ They're on build 178/179 WITHOUT the logging.

In that case: the logging MUST be in the NEXT build (not OTA).

### 2A. Check what build the user has
```bash
echo "=== Latest submitted builds ==="
eas build:list --platform ios --limit 5

echo ""
echo "=== Latest OTA ==="
eas update:list --branch production --limit 5 2>&1
```

### 2B. If remote logs exist — analyze them
The last log entry = the step right before crash.
Map back to code and find what runs NEXT.

### 2C. If no remote logs — add logging to the BUILD itself
The logging must be compiled into the native binary, not just OTA.
Include `crashDebug.ts` + all `logStepFast` calls in the next build.

═══════════════════════════════════════════════════════════
AGENT 3 — REWRITE: Crash-Proof Reveal
═══════════════════════════════════════════════════════════

The current reveal is too complex. REWRITE it from scratch — simple, safe, no animations:

```typescript
// hooks/useSimpleReveal.ts — NEW FILE, replaces useRevealSequence

import { useState, useCallback, useRef, useEffect } from 'react';
import { logStepFast } from '../utils/crashDebug';

interface SimpleRevealProps {
  boards: Board[];
  onComplete: (results: BoardResult[]) => void;
}

export function useSimpleReveal({ boards, onComplete }: SimpleRevealProps) {
  const [currentBoard, setCurrentBoard] = useState(-1); // -1 = not started
  const [revealPhase, setRevealPhase] = useState<'idle' | 'turn' | 'river' | 'result' | 'done'>('idle');
  const mountedRef = useRef(true);
  const resultsRef = useRef<BoardResult[]>([]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const startReveal = useCallback(async () => {
    logStepFast('simple-reveal-start', { numBoards: boards.length });
    
    // Pre-calculate ALL results FIRST — before any UI changes
    try {
      logStepFast('simple-eval-all-start');
      const allResults: BoardResult[] = [];
      
      for (let i = 0; i < boards.length; i++) {
        const board = boards[i];
        
        // Validate data before evaluation:
        if (!board?.playerCards?.length || !board?.communityCards?.length) {
          logStepFast(`simple-board-${i}-INVALID-DATA`, {
            playerCards: board?.playerCards?.length,
            communityCards: board?.communityCards?.length,
          });
          allResults.push(getDefaultResult());
          continue;
        }
        
        // Check for duplicate cards:
        const allCards = [...board.playerCards, ...board.communityCards];
        const unique = new Set(allCards.map(c => `${c.rank}${c.suit}`));
        if (unique.size !== allCards.length) {
          logStepFast(`simple-board-${i}-DUPLICATE-CARDS`, {
            total: allCards.length,
            unique: unique.size,
            cards: allCards.map(c => `${c.rank}${c.suit}`),
          });
          // Still try to evaluate — but log the issue
        }
        
        try {
          logStepFast(`simple-board-${i}-eval`);
          const result = evaluateBoard(board);
          logStepFast(`simple-board-${i}-eval-done`, { winner: result.winner });
          allResults.push(result);
        } catch (evalError) {
          logStepFast(`simple-board-${i}-eval-CRASH`, { 
            error: String(evalError),
            playerCards: board.playerCards?.map(c => `${c.rank}${c.suit}`),
            communityCards: board.communityCards?.map(c => `${c.rank}${c.suit}`),
          });
          allResults.push(getDefaultResult());
        }
      }
      
      resultsRef.current = allResults;
      logStepFast('simple-eval-all-done');
    } catch (outerError) {
      logStepFast('simple-eval-FATAL', { error: String(outerError) });
      resultsRef.current = boards.map(() => getDefaultResult());
    }
    
    // NOW do the visual reveal — one board at a time, simple delays:
    for (let i = 0; i < boards.length; i++) {
      if (!mountedRef.current) return;
      
      logStepFast(`simple-show-board-${i}`);
      setCurrentBoard(i);
      
      // Show turn
      setRevealPhase('turn');
      await safeSleep(800);
      if (!mountedRef.current) return;
      
      // Show river
      setRevealPhase('river');
      await safeSleep(800);
      if (!mountedRef.current) return;
      
      // Show result
      setRevealPhase('result');
      await safeSleep(1200);
      if (!mountedRef.current) return;
    }
    
    // Done — send results
    logStepFast('simple-reveal-complete');
    setRevealPhase('done');
    
    if (mountedRef.current) {
      onComplete(resultsRef.current);
    }
  }, [boards, onComplete]);

  return { startReveal, currentBoard, revealPhase };
}

function safeSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDefaultResult(): BoardResult {
  return {
    winner: 'tie',
    playerHand: { name: 'Unknown', rank: 0, value: 0, cards: [] },
    botHand: { name: 'Unknown', rank: 0, value: 0, cards: [] },
    pot: 0,
  };
}
```

### 3B. Wire it into game.tsx

Replace the current reveal system:
```typescript
// BEFORE: import { useRevealSequence } from '../hooks/useRevealSequence';
// AFTER:
import { useSimpleReveal } from '../hooks/useSimpleReveal';

// Replace usage:
const { startReveal, currentBoard, revealPhase } = useSimpleReveal({
  boards: gameBoards,
  onComplete: (results) => {
    setGameResults(results);
    router.replace('/results');
  },
});
```

### 3C. Render the simple reveal in game.tsx

```typescript
// During reveal, each board shows:
{revealPhase !== 'idle' && boards.map((board, i) => (
  <View key={i}>
    {/* Community cards — turn visible if currentBoard >= i and phase >= 'turn' */}
    {/* River visible if currentBoard >= i and phase >= 'river' */}
    {/* Result shown if currentBoard >= i and phase >= 'result' */}
  </View>
))}
```

No Reanimated. No runOnJS. No shared values. Pure React state + setTimeout.

═══════════════════════════════════════════════════════════
AGENT 4 — UI/UX: Fix Card Overlap and Visual Bugs
═══════════════════════════════════════════════════════════

### 4A. Card overlap in YOUR HAND

The screenshot shows cards overlapping. Check PlayerHand.tsx:

```bash
cat components/PlayerHand.tsx
```

Check:
- Are cards positioned with `absolute` positioning that overlaps?
- Is the card width calculated correctly for the number of cards?
- When there are 16 cards in 2 rows of 8, does each card have enough space?

Fix:
```typescript
// Cards should use flexWrap with calculated width:
const cardWidth = Math.floor((containerWidth - (cardsPerRow - 1) * gap) / cardsPerRow);

// Each card:
<View style={{ width: cardWidth, height: cardWidth * 1.4 }}>
  <Card ... />
</View>
```

### 4B. Check for duplicate React keys

```bash
grep -n "key=" components/PlayerHand.tsx components/Board.tsx | head -20
```

If keys use array index AND cards can be reordered → React renders duplicates.
Fix: use card identity as key: `key={card.rank + card.suit}`

But WAIT — if cards are actually duplicated in the DATA (same card twice),
this would cause a key collision → React renders weirdly → visual "overlap".

**This connects Agent 1 (data integrity) to Agent 4 (visual bugs).**

═══════════════════════════════════════════════════════════
AGENT 5 — PIPELINE: Verify everything works
═══════════════════════════════════════════════════════════

```bash
echo "=== Build 179 status ==="
eas build:list --platform ios --limit 3

echo "=== Was 179 submitted? ==="
# The auto-submit should have triggered

echo "=== GitHub Actions ==="
gh run list --repo royea-beep/caps-poker --limit 5

echo "=== OTA updates ==="
eas update:list --branch production --limit 5 2>&1
```

If 179 wasn't submitted:
```bash
eas submit --platform ios --latest --non-interactive
```

═══════════════════════════════════════════════════════════
AGENT 6 — STRESS TEST: 1000 Hands Simulation
═══════════════════════════════════════════════════════════

Create a stress test that catches ANY possible crash:

```typescript
// utils/__tests__/stressTest.test.ts

import { createDeck, shuffleDeck } from '../deck';
import { calculateHandResultsMulti } from '../gameLogic';

describe('Stress Test — 1000 hands', () => {
  for (let hand = 0; hand < 1000; hand++) {
    it(`Hand ${hand}: no crashes, no duplicates`, () => {
      const deck = shuffleDeck(createDeck());
      
      // Verify deck integrity
      expect(deck.length).toBe(52);
      const uniqueCards = new Set(deck.map(c => `${c.rank}${c.suit}`));
      expect(uniqueCards.size).toBe(52);
      
      // Test all player counts:
      for (const numPlayers of [2, 3, 4]) {
        const numBoards = numPlayers === 2 ? 4 : numPlayers === 3 ? 3 : 2;
        const cardsPerPlayer = numBoards * 4;
        
        const playerCards = deck.slice(0, cardsPerPlayer);
        const botCards = deck.slice(cardsPerPlayer, cardsPerPlayer * 2);
        
        // Verify no overlap:
        const overlap = playerCards.filter(pc => 
          botCards.some(bc => bc.rank === pc.rank && bc.suit === pc.suit)
        );
        expect(overlap).toEqual([]);
        
        // Build boards:
        let communityIndex = cardsPerPlayer * numPlayers;
        const boards = [];
        for (let b = 0; b < numBoards; b++) {
          boards.push({
            playerCards: playerCards.slice(b * 4, (b + 1) * 4),
            botCards: botCards.slice(b * 4, (b + 1) * 4),
            communityCards: deck.slice(communityIndex + b * 5, communityIndex + (b + 1) * 5),
          });
        }
        
        // Evaluate — must not throw:
        expect(() => {
          const results = calculateHandResultsMulti(boards);
          expect(results.length).toBe(numBoards);
          results.forEach(r => {
            expect(r.winner).toBeDefined();
            expect(['player', 'bot', 'tie']).toContain(r.winner);
          });
        }).not.toThrow();
      }
    });
  }
});
```

Run:
```bash
npx jest utils/__tests__/stressTest.test.ts --verbose 2>&1 | tail -30
```

═══════════════════════════════════════════════════════════
DEPLOY ORDER
═══════════════════════════════════════════════════════════

```
1. npx tsc --noEmit — 0 errors
2. npx jest --forceExit — all pass including stress test
3. eas update --branch production --message "fix: duplicate cards + crash-proof reveal + data validation"
4. git add -A && git commit -m "fix: duplicate cards data integrity + simple reveal rewrite + stress test 1000 hands"
5. git push origin main
6. eas submit --platform ios --latest --non-interactive (if build ready)
```

## REPORT
```
═══════════════════════════════════════
FULL QA TEAM — REPORT
═══════════════════════════════════════

AGENT 1 — Data Integrity:
  Duplicate cards found in code: [YES — where / NO]
  Root cause: [exact bug: wrong slice / missing removal / etc]
  Validation added: [YES — N checkpoints]
  
AGENT 2 — Crash Forensics:
  Remote logs found: [YES — last step was X / NO — OTA not loaded]
  Crash point: [between step X and step Y]

AGENT 3 — Reveal Rewrite:
  useSimpleReveal created: [YES/NO]
  Wired into game.tsx: [YES/NO]
  Zero Reanimated in reveal: [YES/NO]

AGENT 4 — UI/UX:
  Card overlap fix: [YES — cause was X]
  React key collision: [YES — fixed / NO]
  
AGENT 5 — Pipeline:
  Build 179 submitted: [YES/NO]
  OTA deployed: [YES — ID]
  
AGENT 6 — Stress Test:
  1000 hands × 3 player counts = 3000 games: [ALL PASS / N failures]
  Failures: [describe any]

═══════════════════════════════════════
```

## DO NOT
- Do NOT keep the old useRevealSequence — REPLACE it with useSimpleReveal
- Do NOT skip the duplicate card investigation — it's probably the ROOT CAUSE of everything
- Do NOT deploy without the stress test passing
- Do NOT ask user to do anything manual

VAMOS CAPS FULL-QA-TEAM — END
