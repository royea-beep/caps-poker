# VAMOS CAPS FIX-DUPLICATE-CARDS-V2
**Date:** 2026-03-24 06:00 IST
**Priority:** 🔴 Cards appear duplicated when placed on board

## CRASH SAFETY — READ BEFORE ANY CHANGE
```
IRON RULES (from crash investigation):
1. results.tsx = ZERO Reanimated
2. No withRepeat(-1) anywhere
3. Max 5 shared values per screen
4. Every animation has cancelAnimation in cleanup
5. No ConfettiCannon
6. No entering= layout animation props
7. Cancel ALL game.tsx shared values BEFORE router.replace
```

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat app/game.tsx
cat components/Board.tsx
cat components/PlayerHand.tsx
cat store/gameStore.ts
cat utils/gameLogic.ts
```

═══════════════════════════════════════════════════════════
BUG — DUPLICATE CARDS ON BOARD
═══════════════════════════════════════════════════════════

**Symptom:** When user taps a card from hand → taps a board slot,
the card appears on the board BUT also stays duplicated — either:
- Same card appears twice on the board, OR
- Card stays in hand AND appears on board

**Known root cause (from crash investigation session):**
Nested setState — `setPlayerHand` is called inside `setBoards` updater function.
This causes an intermediate render where the card exists in BOTH locations.

### STEP 1 — Find the placement logic

```bash
echo "=== placeCard / handlePlace / onCardPlace ==="
grep -n "placeCard\|handlePlace\|onCardPlace\|addCard.*board\|board.*addCard" app/game.tsx store/gameStore.ts | head -20

echo "=== removeCard from hand ==="
grep -n "removeCard\|removeFromHand\|setPlayerHand\|hand.*filter\|filter.*hand" app/game.tsx store/gameStore.ts | head -20

echo "=== Are both state updates in one function? ==="
grep -B 2 -A 15 "placeCard\|handleCardPlace\|onPlace" app/game.tsx | head -40
```

### STEP 2 — Fix: Atomic state update

The fix is to update BOTH board and hand in a SINGLE state update,
not two separate setState calls.

**Option A: If using Zustand store:**
```typescript
placeCardOnBoard: (cardIndex: number, boardIndex: number, slotIndex: number) => {
  set((state) => {
    const card = state.playerHand[cardIndex];
    if (!card) return state;
    const newBoards = state.boards.map((b, i) => {
      if (i !== boardIndex) return b;
      const newCards = [...b.playerCards];
      newCards[slotIndex] = card;
      return { ...b, playerCards: newCards };
    });
    const newHand = state.playerHand.filter((_, i) => i !== cardIndex);
    return { boards: newBoards, playerHand: newHand };
  });
},
```

**Option B: If using React useState — DO NOT NEST:**
```typescript
// WRONG:
const placeCard = (card, boardIdx, slotIdx) => {
  setBoards(prev => {
    setPlayerHand(hand => hand.filter(c => c !== card)); // NESTED!
    return updatedBoards;
  });
};

// CORRECT — React 18+ auto-batches:
const placeCard = (card, boardIdx, slotIdx) => {
  setBoards(prev => { /* update board */ });
  setPlayerHand(prev => prev.filter(c => c.rank !== card.rank || c.suit !== card.suit));
};
```

### STEP 3 — Check card identity comparison

```bash
grep -n "===.*card\|card.*===\|includes(card\|indexOf(card" app/game.tsx store/gameStore.ts | head -15
grep -n "card\.id\|cardId\|uuid" types/gameTypes.ts utils/deck.ts | head -10
```

If comparing by reference — fix to compare by rank+suit:
```typescript
const isSameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
```

### STEP 4 — Add duplicate guard

```typescript
const isCardOnAnyBoard = (card: Card, boards: Board[]) =>
  boards.some(b => b.playerCards.some(pc => pc && isSameCard(pc, card)));

// In placeCard — before placing:
if (isCardOnAnyBoard(card, boards)) {
  console.warn('[DUPLICATE BLOCKED]', card.rank, card.suit);
  return;
}
```

### STEP 5 — Also fix removeCard (return to hand)

```bash
grep -n "removeCard\|handleRemove\|onRemove\|returnToHand" app/game.tsx store/gameStore.ts | head -15
```
Same atomic update pattern for removing from board + returning to hand.

### STEP 6 — Test + Deploy

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -10
eas update --branch production --message "fix: duplicate cards — atomic state update"
git add -A && git commit -m "fix: atomic placeCard prevents duplicate cards on board"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
DUPLICATE CARDS — REPORT
═══════════════════════════════════════
Root cause: [nested setState / reference comparison / other]
Fix: [atomic update / guard / both]
Duplicate guard added: [YES/NO]
Remove-from-board also fixed: [YES/NO]
Tests: [N]/[N]
OTA: [ID]
═══════════════════════════════════════
```

VAMOS CAPS FIX-DUPLICATE-CARDS-V2 — END
