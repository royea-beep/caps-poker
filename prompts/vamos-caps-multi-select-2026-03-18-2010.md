VAMOS CAPS MULTI-SELECT 2026-03-18-2010

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## FEATURE REQUEST
Player wants to select up to 4 cards at once and assign them all to one board in one tap.
Currently: tap card → tap board slot (one by one = 16 taps for full hand)
New: tap up to 4 cards → tap board → all 4 placed instantly

---

## TASK A — Implement multi-select card assignment
Agent: multi-select-dev

A1. Read app/game.tsx in full — understand current card selection flow:
    - handleSelectCard
    - handleBoardPress
    - selectedCardId state

A2. Current flow:
    1. Tap card → selectedCardId = card.id
    2. Tap board slot → places ONE card

A3. New flow:
    1. Tap cards → selectedCardIds = [id1, id2, id3, id4] (up to 4)
    2. Tap board → if selectedCardIds.length === 4 → place all 4 to that board
    3. If selectedCardIds.length < 4 → place however many are selected (1-3)
    4. After placing → clear selectedCardIds

A4. Changes needed in game.tsx:
    - Change selectedCardId (single) → selectedCardIds (array, max 4)
    - handleSelectCard: toggle card in/out of selectedCardIds
      - If card already selected → deselect it
      - If selectedCardIds.length < 4 → add to array
      - If selectedCardIds.length === 4 → replace last selected with new one (or show hint)
    - handleBoardPress: place ALL selectedCardIds to board at once
      - Only if board has enough empty slots
      - Place them in order

A5. Visual feedback:
    - Selected cards: gold border + glow (already done for single select)
    - Show counter badge on selected cards: "1", "2", "3", "4"
    - Show hint text: "2 cards selected — tap a board" 
    - If board doesn't have enough slots: shake animation + "Not enough slots"

A6. Also add "Quick Fill" button per board:
    When a board has 0 player cards → show small "AUTO" button
    Tap AUTO → automatically picks best 4 cards from hand for that board
    (random selection is fine — just pick first 4 available)

A7. Keep backward compatibility:
    - Single tap still works (select 1 card, tap board = place 1)
    - Iron Rule: tap-to-select + tap-to-place (no drag) ← PRESERVED

A8. npx tsc --noEmit — 0 errors
A9. npx jest --silent — all pass

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: multi-select cards + quick board fill"
7. git push origin main
8. Report done with description of new UX flow

VAMOS CAPS MULTI-SELECT — END
