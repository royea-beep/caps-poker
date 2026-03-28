# G-PROMPT: CAPS — Remove ALL Card Corner Indicators
## For Claude Code agent in C:\Projects\caps-poker
## Date: 2026-03-28
## AFTER EXECUTION: Move this file to C:\Projects\caps-poker\docs\prompts\2026-03-28_CAPS_Remove-Card-Corner-Indicators.md

---

## THE PROBLEM

Screenshot from iPhone 17 Pro Max / Build 266 shows: every card (board cards AND player hand cards) still has a small rank number + suit symbol in the TOP-LEFT CORNER. This makes cards look cluttered, especially on smaller screens.

Roye's directive: **"תוריד מכל הקלפים כולל כולם את הסוט והמספר הקטן ששמת בפינה השמאלית למעלה"**

Translation: Remove the small rank and suit indicator from the top-left corner of ALL cards — board cards, player hole cards, bot cards, results screen cards. Every single card in the entire app.

## WHAT TO DO

1. **Find the card component(s)** — search for:
   - `CardComponent`, `Card.tsx`, `PlayingCard`
   - Any component that renders a playing card face
   - Look for small text/views positioned at top-left with rank + suit

2. **Remove the corner indicator completely:**
   - Delete or hide the small rank text in top-left
   - Delete or hide the small suit icon in top-left
   - Keep ONLY the large centered rank and suit
   - If there's a config flag like `show_corner_indicator` or `hideCornerLabels` — set it to remove them permanently, don't just toggle

3. **Check ALL places cards render:**
   - `components/Card.tsx` or `CardComponent.tsx`
   - `components/BoardCards.tsx` — flop, turn, river cards
   - `components/PlayerHand.tsx` or `YourHand.tsx` — player's hole cards
   - `components/BotCards.tsx` — opponent cards
   - `screens/ResultsScreen.tsx` — cards shown in results
   - `components/SharedHand.tsx` — shared hand display
   - Any other screen that shows card faces

4. **After removing corners, adjust card sizing:**
   - With no corner labels, the large rank+suit can be slightly bigger
   - Ensure rank font = `cardWidth * 0.35` minimum
   - Ensure suit font = `cardWidth * 0.25` minimum
   - Cards should look clean with ONLY the center content

5. **Also check the app_config value:**
   - `card_display.show_corner_indicator` should be `false` in Supabase
   - But don't RELY on the config — remove the rendering code entirely so even if config is true, nothing shows

## VERIFICATION

1. `npx tsc --noEmit` — TypeScript clean
2. `npm test` — all tests pass
3. Search entire codebase for "corner" / "cornerLabel" / "smallRank" / "topLeft" related to cards — should find NO rendering code
4. Visual check: no card anywhere in the app should show a small indicator in any corner

## DO NOT

- Do NOT remove the large centered rank and suit — those stay
- Do NOT change card back designs (the diamond pattern on face-down cards)
- Do NOT modify game logic, only card visual rendering
- Do NOT break card animations or flip effects
