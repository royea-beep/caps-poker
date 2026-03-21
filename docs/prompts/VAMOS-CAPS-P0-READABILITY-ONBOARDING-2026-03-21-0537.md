# VAMOS CAPS P0-READABILITY-ONBOARDING
**Date:** 2026-03-21 05:37 IST
**Version:** current | **Priority:** 🔴 P0 — MUST FIX

## ROLE
Senior mobile UI engineer + game UX designer

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\Board.tsx
Read C:\Projects\Caps\components\PlayerHand.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\app\index.tsx
Read C:\Projects\Caps\constants\theme.ts
Read C:\Projects\Caps\constants\gameConfig.ts
Read C:\Projects\Caps\types\gameTypes.ts
```

## CONTEXT
AI simulation playtest scored Card Readability **5.6/10** and Onboarding **4.8/10**.
These are the two lowest scores and kill the experience.
Key complaints:
- Cards too small on 4-board iPhone layout
- Suits blend into dark background
- Community cards and player cards look the same size
- No tutorial at all — new player is lost
- Board 2+3 merge visually on 4-board

## MISSION — TWO P0 FIXES IN ONE SPRINT

═══════════════════════════════════════════════
AGENT 1 — CARD READABILITY OVERHAUL
═══════════════════════════════════════════════

Target: 5.6 → 8.0

**A1. Measure current card dimensions:**
```
grep -n "width\|height\|fontSize\|CARD" components/Card.tsx
grep -n "width\|height\|CARD" constants/gameConfig.ts
```
Note exact pixel values for: card width, card height, rank fontSize, suit fontSize.

**A2. Calculate optimal card size per player count:**

The key insight: card size MUST scale based on number of boards.
- 4 boards (2 players) = smallest cards → need the MOST improvement
- 3 boards (3 players) = medium
- 2 boards (4 players) = largest cards → already OK

Add to `gameConfig.ts`:
```typescript
export const CARD_SCALE = {
  2: { // 4 boards — MOST CRITICAL
    cardWidth: 42,    // was ~32
    cardHeight: 58,   // was ~44
    rankSize: 16,     // was ~11
    suitSize: 14,     // was ~10
    communityScale: 1.15,  // community cards 15% bigger than player cards
  },
  3: { // 3 boards
    cardWidth: 46,
    cardHeight: 64,
    rankSize: 18,
    suitSize: 15,
    communityScale: 1.1,
  },
  4: { // 2 boards
    cardWidth: 52,
    cardHeight: 72,
    rankSize: 20,
    suitSize: 16,
    communityScale: 1.1,
  },
};
```
**These are STARTING VALUES — adjust based on what fits the screen. The goal: rank must be readable at arm's length.**

**A3. Update Card.tsx:**
- Accept `scale` prop from parent (based on player count)
- Rank: **BOLD**, high contrast white on dark / black on light
- Suit emoji/symbol: bigger, with subtle color glow behind it
  - ♥♦ = red with faint red glow (rgba red 0.2)
  - ♠♣ = white with faint white glow (rgba white 0.15)
- Card background: PURE WHITE `#FFFFFF` for face-up cards — maximum contrast
- Border: 1px solid based on suit color (red border for hearts/diamonds, dark gray for spades/clubs)

**A4. Update Board.tsx — Visual Separation:**
- Each board gets a unique subtle border color:
  - Board 1: `#FFD700` (gold)
  - Board 2: `#4FC3F7` (blue)
  - Board 3: `#81C784` (green)
  - Board 4: `#FF8A65` (orange)
- Board number label: bigger, same color as border, top-left corner
- Add 4px gap between boards (instead of current margin)
- Community cards row: slightly larger than player cards (use communityScale)
- Player cards: show below community cards, visually grouped with subtle background

**A5. Update PlayerHand.tsx:**
- Cards in hand (unplaced) should be LARGER than cards on board
  - Hand card = board card × 1.3
- Selected card: bright gold border + slight scale up (1.05)
- Show suit color on card edge even when face down

**A6. Test on both layouts:**
- Screenshot the game with 2 players (4 boards) — verify readability
- Screenshot with 4 players (2 boards) — verify nothing broke
- Use Dimensions API to confirm cards fit without overflow

═══════════════════════════════════════════════
AGENT 2 — ONBOARDING TUTORIAL
═══════════════════════════════════════════════

Target: 4.8 → 7.5

**B1. Create `components/Tutorial.tsx`:**

A 4-step overlay tutorial that shows on FIRST LAUNCH ONLY.

```
Step 1: "Welcome to CAPS Poker 🃏"
  Visual: animated hand of 16 cards fanning out
  Text: "You get cards. You decide where they go."
  
Step 2: "Place Cards on Boards"  
  Visual: arrow showing tap card → tap board
  Text: "Tap a card, then tap a board to place it. 4 cards per board."
  
Step 3: "Win Boards, Win Chips 💰"
  Visual: board with ✅ checkmark
  Text: "Each board is a separate Omaha hand. Win the board = win the pot."
  
Step 4: "COMPLETE = MEGA BONUS 🏆"
  Visual: all boards glowing gold
  Text: "Win ALL boards? 50% bonus chips from your opponent!"
```

Each step:
- Full screen overlay, dark background rgba(0,0,0,0.85)
- Big visual in center (can be simplified SVG or View-based illustration)
- Text below visual — max 2 lines, fontSize 18, white
- "Next →" button bottom right
- Step dots at bottom (● ● ○ ○)
- Step 4 has "Let's Play! 🎯" button instead of Next
- Smooth fadeIn between steps (reanimated)

**B2. First Launch Detection:**
- AsyncStorage key: `caps_tutorial_seen`
- On app launch in `app/index.tsx`:
  - If key doesn't exist → show Tutorial overlay
  - After completing tutorial → set key to `true`
- In Settings: add "🎓 Show Tutorial Again" button that resets the key

**B3. In-Game Hint (first 3 games only):**
- AsyncStorage: `caps_games_played` counter
- If < 3 games played, show subtle hint bar at top of game screen during ARRANGING:
  - Game 1: "👆 Tap a card from your hand, then tap a board to place it"
  - Game 2: "🎯 Try to win ALL boards for the COMPLETE bonus!"
  - Game 3: "💡 Tip: You can tap a placed card to remove it"
- After 3 games — hints disappear forever
- Style: small bar, semi-transparent, fontSize 12, doesn't block gameplay

**B4. Quick Rules button on Home:**
- Add "📖 How to Play" button on home screen (secondary style, below main buttons)
- Tapping it opens the same Tutorial overlay (re-uses component)

═══════════════════════════════════════════════
AGENT 3 — COMPLETE CELEBRATION UPGRADE
═══════════════════════════════════════════════

While we're in P0 — the COMPLETE mechanic scored 9.2 but the PRESENTATION needs love.

**C1. Read `components/CompleteOverlay.tsx`**

**C2. Upgrade the COMPLETE moment:**
- Screen flash: brief white flash (100ms) before overlay appears
- All 4 board borders pulse gold simultaneously (3 pulses)
- Overlay text: "🏆 COMPLETE!" — fontSize 48, gold, with shadow
- Below: "+50% BONUS" with animated chip count rolling up
- Particle count: increase from current to 40 particles
- Duration: celebration lasts 3 full seconds before dismissible
- Haptic: heavy impact on flash, then medium on each pulse
- The whole sequence should feel like WINNING THE SUPER BOWL

**C3. Sound placeholder:**
- Add a louder, distinct sound trigger point for COMPLETE
- If `sounds/complete.mp3` doesn't exist, create a placeholder comment:
  `// TODO: Add premium COMPLETE sound — should feel MASSIVE`
- Use existing best sound for now, at higher volume

═══════════════════════════════════════════════
AGENT 4 — TESTS
═══════════════════════════════════════════════

```
D1. Test CARD_SCALE config has all player counts (2, 3, 4)
D2. Test communityScale > 1 for all configs
D3. Test getRandomQuote returns correct context (if pro-quotes sprint already done)
D4. Test Tutorial component renders all 4 steps
D5. Test Tutorial respects AsyncStorage flag
D6. Test hint bar shows only for games < 3
D7. All existing tests still pass
```

═══════════════════════════════════════════════
AGENT 5 — DEPLOY + FINISH
═══════════════════════════════════════════════

```
E1. npx tsc --noEmit — 0 errors
E2. npx jest --forceExit — all pass
E3. npx expo export --platform web --output-dir web-dist
E4. node scripts/fix-web-html.js
E5. cd web-dist && vercel --prod --yes
E6. git add -A && git commit -m "feat: P0 — card readability overhaul + onboarding tutorial + COMPLETE upgrade"
E7. git push origin main
E8. Update MEMORY.md: P0 sprint done, new test count, changes list
```

## SUCCESS CRITERIA
- ✅ Cards readable at arm's length on iPhone — even on 4-board layout
- ✅ Each board visually distinct with colored border
- ✅ Community cards visibly larger than player cards
- ✅ Tutorial shows on first launch — 4 steps, clear, beautiful
- ✅ In-game hints for first 3 games
- ✅ "How to Play" button on home screen
- ✅ COMPLETE celebration is MASSIVE — screen flash, gold pulse, 3 seconds
- ✅ Settings: toggle tutorial, toggle quotes (if exists)
- ✅ All tests pass, 0 TS errors, web deployed

## DO NOT
- Do NOT change game logic — only UI and UX
- Do NOT change tap-to-place mechanic (scored 7.4 — it works)
- Do NOT change timer values (scored 7.4 — it works)
- Do NOT add drag-and-drop — Iron Rule: tap only
- Do NOT break any existing tests

VAMOS CAPS P0-READABILITY-ONBOARDING — END
