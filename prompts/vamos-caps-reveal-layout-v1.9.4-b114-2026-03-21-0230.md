# VAMOS MEGA PROMPT — Reveal Layout: Player Below, Bot Above
**Version:** v1.9.4 | **Build:** b114 | **Date:** 2026-03-21 02:30 IL (UTC+2)

---

## ROLE
You are a **Senior Poker UI Engineer**. You understand how poker reveals should look.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
cat components/RevealSequence.tsx
```

---

## WHAT ROYE WANTS — Clear Layout

The reveal screen (RevealSequence) and results screen (results.tsx) should show each board like a poker table view:

```
┌─────────────────────────────────────────────┐
│  BOT 23%                        [best: J♠]  │
│  [9♣] [6♦] [8♣] [10♠]                      │
│                                              │
│        ── Community Cards ──                 │
│     [Q♦] [7♠] [4♦] [??] [??]               │
│                                              │
│  YOU 77%                        [best: A♥]  │
│  [3♦] [7♥] [5♠] [9♦]                       │
└─────────────────────────────────────────────┘
```

### Key rules:
1. **BOT cards ABOVE** the community cards (top of the board)
2. **YOUR cards BELOW** the community cards (bottom of the board)
3. Each player shows **win percentage** next to their label (e.g., "YOU 77%")
4. Each player shows their **best next card** — the single card that would help them the most — displayed small on the side. This is the card from the remaining deck that maximizes their hand equity.
5. Community cards in the CENTER as a horizontal row
6. This layout applies to BOTH:
   - **RevealSequence** (the animated board-by-board reveal)
   - **results.tsx** (the final summary showing all boards)

### Win percentage:
- Already calculated — the percentages are shown in the current UI ("BOT 23%", "YOU 77%")
- Keep using whatever calculation exists

### Best next card:
- This is a NEW feature. For each player, calculate: "which single card from the remaining deck would give them the strongest hand?"
- Show it small (like a mini card) on the right side of the player's row
- Label it "Best:" or just show the card with a small glow/highlight
- If all community cards are already revealed (no more cards to come), don't show it
- Implementation: iterate over remaining deck cards, for each card temporarily add it to community, evaluate the player's hand, pick the card that gives the highest hand rank
- This can be computed ONCE when the board data is available — no need for real-time recalculation

### For results.tsx (summary screen):
Same layout per board:
```
BOARD 1  WIN                              +50
┌─────────────────────────────────────────────┐
│  BOT    [2♦] [K♦] [10♣] [10♣]   High Card  │
│         [K♥] [5♠] [8♠] [3♣] [7♣]          │
│  YOU    [A♦] [Q♥] [8♣] [4♠]     One Pair   │
└─────────────────────────────────────────────┘
```
- Community cards in the middle row
- BOT cards above
- YOU cards below
- Hand name on the right (One Pair, High Card, etc.)

---

## IMPLEMENTATION NOTES

### Best next card calculation:
```typescript
// In utils/handEvaluator.ts or similar
function findBestNextCard(
  playerCards: Card[],      // 4 player cards
  communityCards: Card[],   // current community (3-4 cards)
  usedCards: Set<string>    // all cards already in play
): Card | null {
  if (communityCards.length >= 5) return null; // all revealed, no "next"
  
  const deck = fullDeck.filter(c => !usedCards.has(c.id));
  let bestCard: Card | null = null;
  let bestRank = -1;
  
  for (const card of deck) {
    const testCommunity = [...communityCards, card];
    const handResult = evaluateOmahaHand(playerCards, testCommunity);
    if (handResult.rank > bestRank) {
      bestRank = handResult.rank;
      bestCard = card;
    }
  }
  return bestCard;
}
```

If this is too complex or the evaluator doesn't support it easily, skip the best card feature and just fix the layout (bot above, player below).

---

## PRIORITY ORDER
1. **MUST:** Bot above community, Player below community — both screens
2. **MUST:** Percentages visible per player
3. **NICE TO HAVE:** Best next card mini-display
4. **MUST:** Layout centered, works on web and mobile

---

## SUCCESS CRITERIA
- [ ] Bot cards displayed ABOVE community cards
- [ ] Player cards displayed BELOW community cards
- [ ] Percentages shown per player
- [ ] Layout centered and clean
- [ ] Works on both RevealSequence and results.tsx
- [ ] 115/115 tests | TS: 0 errors
- [ ] Web deployed + git pushed

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "feat: reveal layout — bot above, player below community [v1.9.4-b115]" && git push
# Update MEMORY.md
```

---

*Fix autonomously. The poker table metaphor: bot sits across from you. Community cards are the shared table. Bot's hand is on the far side (top), your hand is on your side (bottom). Simple.*
