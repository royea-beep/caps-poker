# VAMOS CAPS CAPS-S54-DUPE-FIX
**Date:** 2026-03-24 IST

---

## BUG — CRITICAL
Same card appears twice on screen during arrangement phase.
This was fixed before (S46 — atomic state + guard) but has regressed.

## TASK A — Read and diagnose

```bash
cd C:\Projects\Caps

echo "=== Check deck generation ==="
grep -n "shuffle\|deal\|deck\|duplicate\|Set\|unique" utils/deck.ts | head -30

echo "=== Check deal logic ==="
grep -n "dealCards\|playerCards\|botCards\|communityCards\|splice\|slice" utils/gameLogic.ts | head -40

echo "=== Check S46 guard ==="
grep -n "duplicate\|guard\|atomic\|Set\|unique" store/gameStore.ts | head -20
grep -n "duplicate\|guard\|atomic\|Set\|unique" app/game.tsx | head -20
```

## TASK B — Fix

The duplicate card guard from S46 must be present and working. 

Check `utils/deck.ts`:
- `createDeck()` must produce exactly 52 unique cards
- `shuffleDeck()` must not create copies
- After dealing, verify no card appears in both playerCards AND botCards AND communityCards

Add a guard in `utils/gameLogic.ts` in the deal function:
```typescript
// After dealing all cards, verify no duplicates:
const allDealtCards = [
  ...boards.flatMap(b => b.communityCards),
  ...boards.flatMap(b => b.playerCards),
  ...boards.flatMap(b => b.botCards),
];
const cardKeys = allDealtCards.map(c => `${c.rank}${c.suit}`);
const uniqueKeys = new Set(cardKeys);
if (uniqueKeys.size !== cardKeys.length) {
  console.error('[DEAL] DUPLICATE CARDS DETECTED — re-dealing');
  // Re-deal by calling the function recursively once
  return dealCards(config); // or however the function is named
}
```

## TASK C — Also fix: bot cards hidden during arrangement

While in this file, also fix:
- Bot cards during arrangement = `faceDown={true}` always
- Hand hint = player cards only, never bot

## TASK D — Fix layout order in BoardReveal

Also fix in `components/BoardReveal.tsx`:
- Order: BOT (top) → COMMUNITY (middle) → YOUR CARDS (bottom)

## TASK E

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5
eas update --branch production --message "fix: duplicate cards + bot hidden + BoardReveal layout order"
git add -A && git commit -m "fix: duplicate card guard + bot faceDown + BoardReveal layout"
git push origin main
git log --oneline -3
```

## AFTER AUDIT
```
Duplicate card guard: EXISTS / location: [file:line]
Bot cards faceDown during arrangement: YES
Hint player-only: YES
BoardReveal layout: BOT → COMMUNITY → YOUR CARDS
TS errors: 0
Tests: 2234/2234
OTA: [hash]
Git: [commit]
```

Yes, allow all edits in components/ during this session.
VAMOS CAPS CAPS-S54-DUPE-FIX — END
