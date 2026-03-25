# VAMOS CAPS CARD-SIZE-ALL-DEVICES
**Date:** 2026-03-21 10:35 IST
**Priority:** 🔴 P0 — Cards unreadable on smaller iPhones

## ROLE
Senior mobile UI engineer — responsive design expert

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\Board.tsx
Read C:\Projects\Caps\components\PlayerHand.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\constants\gameConfig.ts
Read C:\Projects\Caps\constants\deviceBreakpoints.ts 2>/dev/null
```

## CONTEXT
Build 150 on TestFlight. Tester with a phone **smaller than iPhone 17** reports cards are still not readable. This means our card sizing only works on the largest screens. We need to support ALL iPhone sizes.

## MISSION

═══════════════════════════════════════════════
AGENT 1 — Map All iPhone Screen Sizes
═══════════════════════════════════════════════

Reference table — these are the screens we MUST support:

| Device | Screen (pts) | Scale | Pixel | Category |
|--------|-------------|-------|-------|----------|
| iPhone SE 3 | 375×667 | 2x | 750×1334 | **SMALL** |
| iPhone 13 mini / 12 mini | 375×812 | 3x | 1125×2436 | **SMALL** |
| iPhone 14 / 15 / 16 | 393×852 | 3x | 1179×2556 | **MEDIUM** |
| iPhone 14 Pro / 15 Pro / 16 Pro | 393×852 | 3x | 1179×2556 | **MEDIUM** |
| iPhone 14 Plus / 15 Plus / 16 Plus | 430×932 | 3x | 1290×2796 | **LARGE** |
| iPhone 15 Pro Max / 16 Pro Max | 430×932 | 3x | 1290×2796 | **LARGE** |
| iPhone 17 | ~430×950 (estimated) | 3x | ~1290×2850 | **LARGE** |

**Key insight:** If it works on iPhone 17 (430pt wide) but NOT on a smaller phone, the problem is that card sizes are calculated for ~430pt width but break at 375pt width. That's a 15% difference.

═══════════════════════════════════════════════
AGENT 2 — Diagnose Current Sizing Logic
═══════════════════════════════════════════════

```
grep -n "Dimensions\|screenW\|screenH\|width\|SCREEN" C:\Projects\Caps\app\game.tsx | head -30
grep -n "cardWidth\|cardHeight\|CARD_SCALE\|BOARD_CARD" C:\Projects\Caps\app\game.tsx | head -20
grep -n "width\|height\|fontSize\|size" C:\Projects\Caps\components\Card.tsx | head -30
```

Identify:
- How is screen width obtained? (Dimensions / useWindowDimensions / PixelRatio?)
- Are card sizes hardcoded pixels or percentage/ratio of screen?
- Is there a responsive breakpoint system?
- What is the minimum card width currently?

Report:
```
═══════════════════════════════════════
CARD SIZING DIAGNOSIS
═══════════════════════════════════════
Screen width source: [how obtained]
Card width calculation: [formula or hardcoded value]
Card height calculation: [formula or hardcoded value]
Rank fontSize: [formula or hardcoded]
Suit fontSize: [formula or hardcoded]

Simulated sizes:
  375pt (SE/mini): card = [W]×[H], rank = [size]px
  393pt (14/15/16): card = [W]×[H], rank = [size]px
  430pt (Plus/Max): card = [W]×[H], rank = [size]px

PROBLEM: [what breaks on small screens]
═══════════════════════════════════════
```

═══════════════════════════════════════════════
AGENT 3 — Fix: Fully Responsive Card Sizing
═══════════════════════════════════════════════

The fix must make cards readable on **375pt width with 4 boards**.

**Approach: Calculate card size as PERCENTAGE of available space, not hardcoded pixels.**

```typescript
// In game.tsx or gameConfig.ts:
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Card sizing based on screen width and board count
function getCardDimensions(screenWidth: number, boardCount: number) {
  // Available width per board (accounting for padding and gaps)
  const boardPadding = 8; // each side
  const boardGap = 4;
  const totalGaps = (boardCount - 1) * boardGap;
  const availableWidth = screenWidth - (boardPadding * 2);
  
  // Each board gets equal share of vertical space
  // Inside each board: 5 community cards + 4 player cards = need to fit 5 cards in a row
  const maxCardsInRow = 5; // community cards row
  const cardGap = 2;
  const totalCardGaps = (maxCardsInRow - 1) * cardGap;
  
  // Card width = available width / cards per row - gaps
  const cardWidth = Math.floor((availableWidth - totalCardGaps) / maxCardsInRow);
  const cardHeight = Math.floor(cardWidth * 1.4); // poker card ratio
  
  // Font sizes scale with card width
  const rankSize = Math.max(10, Math.floor(cardWidth * 0.38));
  const suitSize = Math.max(8, Math.floor(cardWidth * 0.32));
  
  // Player hand cards: 1.3x bigger
  const handCardWidth = Math.floor(cardWidth * 1.3);
  const handCardHeight = Math.floor(handCardWidth * 1.4);
  const handRankSize = Math.max(12, Math.floor(handCardWidth * 0.38));
  
  return {
    board: { width: cardWidth, height: cardHeight, rankSize, suitSize },
    hand: { width: handCardWidth, height: handCardHeight, rankSize: handRankSize },
  };
}
```

**Key rules:**
1. Card width = function of screen width — NEVER hardcoded
2. Minimum rank fontSize = 10px (below this = unreadable)
3. Minimum card width = 28px (below this = too small to tap)
4. If 4 boards don't fit with readable cards → consider stacking 2+2 vertically on small screens
5. Community cards in a row of 5 must fit screen width with padding
6. Player hand cards must be scrollable horizontally if they overflow

═══════════════════════════════════════════════
AGENT 4 — Test on All Screen Sizes
═══════════════════════════════════════════════

After fixing, simulate all sizes:

```typescript
// Add a test or debug function:
const TEST_WIDTHS = [375, 393, 414, 430];
const TEST_BOARDS = [2, 3, 4];

for (const w of TEST_WIDTHS) {
  for (const b of TEST_BOARDS) {
    const dims = getCardDimensions(w, b);
    console.log(`Screen ${w}pt, ${b} boards → card: ${dims.board.width}×${dims.board.height}, rank: ${dims.board.rankSize}px`);
  }
}
```

**Expected output — ALL must have rank ≥ 10px and card width ≥ 28px:**
```
Screen 375pt, 4 boards → card: ~34×48, rank: ~13px  ✅ readable
Screen 375pt, 3 boards → card: ~38×53, rank: ~14px  ✅ readable
Screen 375pt, 2 boards → card: ~44×62, rank: ~17px  ✅ readable
Screen 393pt, 4 boards → card: ~36×50, rank: ~14px  ✅ readable
Screen 430pt, 4 boards → card: ~40×56, rank: ~15px  ✅ readable
```

If any combination falls below minimums → adjust formula.

═══════════════════════════════════════════════
AGENT 5 — Board Layout Adjustment for Small Screens
═══════════════════════════════════════════════

On screens ≤ 375pt wide with 4 boards:
- Reduce board padding from 8 to 4
- Reduce board gap from 4 to 2
- Board number label: fontSize 10 (was 12)
- Community cards gap: 1px (was 2px)
- If STILL too small after all compression: boards scroll vertically (2 visible + scroll to see 2 more)

On screens ≥ 414pt:
- Keep current layout, it works

═══════════════════════════════════════════════
AGENT 6 — Card.tsx Responsive Font
═══════════════════════════════════════════════

Card.tsx must accept `rankSize` and `suitSize` as props (or derive from `cardHeight`):

```typescript
// Inside Card.tsx
const rankFontSize = props.rankSize || Math.max(10, Math.floor(props.cardHeight * 0.28));
const suitFontSize = props.suitSize || Math.max(8, Math.floor(props.cardHeight * 0.22));
```

Don't hardcode font sizes — derive from card dimensions.

═══════════════════════════════════════════════
AGENT 7 — Deploy + Verify
═══════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. Add the debug output for all screen sizes → paste in report
F4. npx expo export --platform web --output-dir web-dist
F5. node scripts/fix-web-html.js
F6. cd web-dist && vercel --prod --yes
F7. git add -A && git commit -m "fix: responsive card sizing — readable on all iPhones (375pt-430pt)"
F8. git push origin main
F9. Update MEMORY.md

Report:
═══════════════════════════════════════
RESPONSIVE CARD SIZING — RESULTS
═══════════════════════════════════════
375pt + 4 boards: card [W]×[H], rank [N]px — [READABLE/NOT]
375pt + 3 boards: card [W]×[H], rank [N]px — [READABLE/NOT]
375pt + 2 boards: card [W]×[H], rank [N]px — [READABLE/NOT]
393pt + 4 boards: card [W]×[H], rank [N]px — [READABLE/NOT]
430pt + 4 boards: card [W]×[H], rank [N]px — [READABLE/NOT]
═══════════════════════════════════════
```

## SUCCESS CRITERIA
- ✅ Cards readable on iPhone SE (375pt) with 4 boards
- ✅ Cards readable on iPhone 13 mini (375pt) with 4 boards
- ✅ Cards readable on iPhone 14/15/16 (393pt)
- ✅ Cards readable on iPhone Plus/Max (430pt)
- ✅ Rank fontSize NEVER below 10px on any device
- ✅ Card width NEVER below 28px on any device
- ✅ No hardcoded pixel sizes — all responsive
- ✅ Player hand cards 1.3x board cards on all sizes
- ✅ All tests pass, 0 TS errors

## DO NOT
- Do NOT change game logic
- Do NOT change Iron Rules
- Do NOT remove voice clips or pro quotes
- Do NOT change any non-visual code

VAMOS CAPS CARD-SIZE-ALL-DEVICES — END
