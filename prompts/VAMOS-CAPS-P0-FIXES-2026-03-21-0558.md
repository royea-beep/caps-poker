# VAMOS CAPS P0-FIXES
**Date:** 2026-03-21 05:58 IST
**Priority:** 🔴 Finish what was missed in the P0 sprint

## ROLE
Senior mobile UI engineer — completing unfinished P0 work

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\PlayerHand.tsx
Read C:\Projects\Caps\components\CompleteOverlay.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\app\index.tsx
Read C:\Projects\Caps\constants\gameConfig.ts
```

## CONTEXT
Last sprint (P0-READABILITY-ONBOARDING) completed 9/14 items.
5 items were missed + 1 bug was introduced. This sprint fixes ALL of them.

═══════════════════════════════════════════════
FIX 1 — Card.tsx Visual Upgrade (MISSED)
═══════════════════════════════════════════════

The card SCALE was added but Card.tsx itself was never touched.

Open `components/Card.tsx` and make these changes:

**A. Card background for face-up cards:**
- Background: PURE WHITE `#FFFFFF` — maximum contrast
- No transparency, no dark tint

**B. Rank text:**
- fontWeight: '900' (BOLD)
- Color: BLACK `#1a1a1a` for spades ♠ and clubs ♣
- Color: RED `#d32f2f` for hearts ♥ and diamonds ♦
- fontSize: should respect CARD_SCALE from gameConfig (pass via prop or derive from cardHeight)

**C. Suit symbol:**
- Bigger — suit fontSize = rank fontSize × 0.85
- Add subtle glow shadow behind suit:
  - ♥♦ → textShadowColor: `rgba(211, 47, 47, 0.3)`, textShadowRadius: 4
  - ♠♣ → textShadowColor: `rgba(255, 255, 255, 0.2)`, textShadowRadius: 3

**D. Card border:**
- 1px solid border based on suit color:
  - ♥♦ → borderColor: `rgba(211, 47, 47, 0.3)`
  - ♠♣ → borderColor: `rgba(100, 100, 100, 0.3)`

═══════════════════════════════════════════════
FIX 2 — PlayerHand Cards Bigger (MISSED)
═══════════════════════════════════════════════

Cards in the player's hand (unplaced, at bottom of screen) should be LARGER than cards sitting on boards.

Open `components/PlayerHand.tsx`:

**A.** Hand card size = board card size × 1.3
- Get BOARD_CARD_H from props or gameConfig
- Apply 1.3 multiplier to both width and height of cards in hand

**B.** Selected card in hand:
- Gold border: `#FFD700`, borderWidth 2
- Slight scale up: transform `scale(1.05)`

**C.** Make sure the hand area scrolls horizontally if cards overflow (16 cards for 2-player game)

═══════════════════════════════════════════════
FIX 3 — In-Game Hints with Counter (MISSED)
═══════════════════════════════════════════════

The bot put ProQuoteBanner during ARRANGING. That's fine as a bonus, but the REAL request was:

**First 3 games only — show specific hint text, then disappear forever.**

Open `app/game.tsx`:

**A.** On game start, read AsyncStorage key `caps_games_played` (number)
- If key doesn't exist → treat as 0

**B.** During ARRANGING phase, if games_played < 3, show a hint bar at TOP of game area:
- Game 0-1: "👆 Tap a card from your hand, then tap a board to place it"
- Game 1-2: "🎯 Try to win ALL boards for the COMPLETE bonus!"
- Game 2-3: "💡 Tip: Tap a placed card to remove it and try a different board"

**C.** Style: semi-transparent bar (rgba 0,0,0,0.5), fontSize 12, white text, centered, paddingVertical 4

**D.** On game END (when results screen loads or game finishes), increment the counter:
```typescript
const count = parseInt(await AsyncStorage.getItem('caps_games_played') || '0');
await AsyncStorage.setItem('caps_games_played', String(count + 1));
```

**E.** After 3 games — hint bar never shows again. ProQuoteBanner can stay as separate feature.

═══════════════════════════════════════════════
FIX 4 — Restore HAND HISTORY Link (BUG)
═══════════════════════════════════════════════

The bot REPLACED the "HAND HISTORY" link with "HOW TO PLAY". Both should exist.

Open `app/index.tsx`:

**A.** Find the links row. It should have ALL of these:
- LEADERBOARD
- HAND HISTORY (was removed — ADD IT BACK)
- 📖 HOW TO PLAY (new — keep it)
- SETTINGS

**B.** If 4 links don't fit in one row, wrap to 2 rows or reduce font slightly. Do NOT remove any link.

═══════════════════════════════════════════════
FIX 5 — COMPLETE: All Boards Pulse Gold (MISSED)
═══════════════════════════════════════════════

When COMPLETE triggers, the celebration should include ALL boards pulsing gold simultaneously.

Open `app/game.tsx` and/or `components/Board.tsx`:

**A.** When the game detects COMPLETE (player wins all boards):
- Before showing CompleteOverlay, trigger a board pulse animation
- ALL boards simultaneously get borderColor animated to gold `#FFD700`
- 3 pulses: gold → original color → gold → original → gold → stay gold
- Each pulse: 200ms on, 200ms off
- Total: ~1200ms of pulsing, then CompleteOverlay appears

**B.** Board.tsx should accept a `pulseGold` prop (boolean)
- When true, run the 3-pulse animation using reanimated
- borderWidth temporarily goes from 1 to 3 during pulse

**C.** Haptic on each pulse: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`

═══════════════════════════════════════════════
FIX 6 — COMPLETE Duration: 3 Full Seconds (VERIFY)
═══════════════════════════════════════════════

Open `components/CompleteOverlay.tsx`:

**A.** Find the auto-dismiss timer. It should be at least 3000ms.
- If it's less → change to 3000
- The overlay should NOT be dismissible by tap during the first 3 seconds
- After 3 seconds → either auto-dismiss or allow tap to dismiss

═══════════════════════════════════════════════
FIX 7 — Pro Quotes on Waiting/Lobby Screen (MISSED)
═══════════════════════════════════════════════

```
Read C:\Projects\Caps\app\lobby\host.tsx
Read C:\Projects\Caps\app\lobby\join.tsx
Read C:\Projects\Caps\app\multiplayer-game.tsx
```

**A.** Find the "waiting for opponent" state in multiplayer lobby/game.
**B.** Add `<ProQuoteBanner context="waiting" rotating rotateInterval={6000} />` to that screen.
**C.** If there's a waiting/loading state in the multiplayer game screen, add it there too.

═══════════════════════════════════════════════
AGENT FINISH
═══════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ tests pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "fix: P0 completion — card visuals, hand size, hints, COMPLETE pulse, hand history restored"
F7. git push origin main
F8. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ Card.tsx: white background, bold rank, suit glow, suit-colored border
- ✅ PlayerHand: cards 1.3x bigger than board cards, gold border on selected
- ✅ Hints: show first 3 games only, then disappear forever (separate from ProQuotes)
- ✅ HAND HISTORY link restored on home screen alongside HOW TO PLAY
- ✅ COMPLETE: all boards pulse gold 3 times before overlay
- ✅ COMPLETE: overlay stays 3 seconds minimum
- ✅ ProQuoteBanner on waiting/lobby screen
- ✅ All existing 126 tests pass + any new tests
- ✅ 0 TypeScript errors

## DO NOT
- Do NOT remove ProQuoteBanner from where it's already placed
- Do NOT change game logic
- Do NOT change Tutorial component (it works)
- Do NOT break any existing tests

VAMOS CAPS P0-FIXES — END
