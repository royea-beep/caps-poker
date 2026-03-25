# CAPS — RESPONSIVE LAYOUT: CARDS + BUTTONS + BOARD ON ALL DEVICES
**Date:** 2026-03-23 | **Time:** 20:00 IST
**Session:** Fix card sizes, button sizes, board layout — pixel-perfect on every device
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** 4dd4dab

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## PROBLEM

Cards, buttons, and board layout don't scale properly across different screen sizes.
Cards placed on the board may overflow, overlap, or look wrong on smaller/larger devices.
Everything must be calculated from screen dimensions — zero hardcoded pixel values.

---

## TASK

### STEP 0 — AUDIT CURRENT LAYOUT

```bash
cd /c/Projects/Caps

echo "=== 1. Board component ==="
find . -name "Board*" -o -name "board*" | grep -v node_modules | grep -E "\.tsx$" | head -5
for f in $(find . -name "Board*" | grep -v node_modules | grep -E "\.tsx$" | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== 2. Card component ==="
find . -name "Card*" -o -name "card*" | grep -v node_modules | grep -E "\.tsx$" | head -5
for f in $(find . -name "Card*" | grep -v node_modules | grep -E "\.tsx$" | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== 3. Screen dimensions usage ==="
grep -rn "useWindowDimensions\|Dimensions\|screenWidth\|screenHeight\|SCREEN_WIDTH" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -20

echo "=== 4. Hardcoded sizes (the problem) ==="
grep -rn "width: [0-9]\|height: [0-9]\|fontSize: [0-9]\|padding: [0-9]\|margin: [0-9]" components/ --include="*.tsx" | grep -v node_modules | head -30

echo "=== 5. Card dimensions ==="
grep -rn "CARD_WIDTH\|CARD_HEIGHT\|cardWidth\|cardHeight\|cardSize" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -15

echo "=== 6. Button styles ==="
grep -rn "TouchableOpacity\|Pressable" components/ --include="*.tsx" | grep -v node_modules | wc -l
grep -A 5 "style.*button\|btn.*style\|buttonStyle" components/ --include="*.tsx" | grep -v node_modules | head -30

echo "=== 7. Board layout / grid ==="
grep -rn "flexDirection\|flexWrap\|justifyContent\|alignItems\|gap\|board.*style\|boardLayout" components/Board* --include="*.tsx" | head -20

echo "=== 8. Safe areas ==="
grep -rn "SafeAreaView\|useSafeAreaInsets\|safeArea" . --include="*.tsx" | grep -v node_modules | head -10

echo "=== 9. Device breakpoints ==="
grep -rn "isSmall\|isTablet\|breakpoint\|scaledFont\|scale" . --include="*.tsx" --include="*.ts" | grep -v node_modules | head -15

echo "=== 10. Player hand + community cards layout ==="
grep -rn "playerCards\|communityCards\|holeCards\|playerHand\|community\|flop\|turn\|river" components/ --include="*.tsx" | head -20
```

### STEP 1 — CREATE RESPONSIVE SIZING SYSTEM

Create `lib/responsive.ts` (or update if exists):

```typescript
import { Dimensions, PixelRatio, Platform } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Base design: iPhone 14 Pro (393 × 852)
const BASE_WIDTH = 393
const BASE_HEIGHT = 852

// Scale factor based on screen width
export const scale = (size: number): number => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH
  const newSize = size * ratio
  return Math.round(PixelRatio.roundToNearestPixel(newSize))
}

// Vertical scale (for heights)
export const verticalScale = (size: number): number => {
  const ratio = SCREEN_HEIGHT / BASE_HEIGHT
  const newSize = size * ratio
  return Math.round(PixelRatio.roundToNearestPixel(newSize))
}

// Moderate scale — less aggressive scaling for fonts/padding
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return Math.round(size + (scale(size) - size) * factor)
}

// Device categories
export const isSmallPhone = SCREEN_WIDTH < 375    // iPhone SE
export const isNormalPhone = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414
export const isLargePhone = SCREEN_WIDTH >= 414 && SCREEN_WIDTH < 768
export const isTablet = SCREEN_WIDTH >= 768

// ── CARD SIZING ──────────────────────────────────

// Card aspect ratio: standard playing card = 2.5:3.5 (5:7)
const CARD_RATIO = 5 / 7

// Board has 4 sub-boards × community cards + player hand
// Calculate card size so everything fits on screen

export function getCardDimensions(options: {
  cardsPerRow: number        // how many cards side by side
  containerWidth?: number    // available width (default: screen - padding)
  gapBetweenCards?: number   // gap between cards (default: scaled)
}) {
  const { 
    cardsPerRow, 
    containerWidth = SCREEN_WIDTH - scale(24),  // 12px padding each side
    gapBetweenCards = scale(4) 
  } = options
  
  const totalGaps = (cardsPerRow - 1) * gapBetweenCards
  const cardWidth = Math.floor((containerWidth - totalGaps) / cardsPerRow)
  const cardHeight = Math.floor(cardWidth / CARD_RATIO)
  
  return {
    width: cardWidth,
    height: cardHeight,
    gap: gapBetweenCards,
    fontSize: moderateScale(cardWidth > 40 ? 14 : 10),
    cornerRadius: scale(4),
  }
}

// ── BOARD LAYOUT ─────────────────────────────────

export function getBoardLayout() {
  const padding = scale(8)
  const boardWidth = SCREEN_WIDTH - (padding * 2)
  
  // Community cards: 5 cards in a row
  const communityCard = getCardDimensions({ 
    cardsPerRow: 5, 
    containerWidth: boardWidth - scale(16),
  })
  
  // Player hand cards: 4 cards (Omaha) — should be slightly larger
  const playerCard = getCardDimensions({ 
    cardsPerRow: 4, 
    containerWidth: boardWidth * 0.6,  // player hand takes 60% width
  })
  
  // Board sub-sections (if 4 boards like Caps)
  const subBoardCard = getCardDimensions({
    cardsPerRow: 5,
    containerWidth: (boardWidth - scale(8)) / 2,  // 2 boards per row
  })
  
  return {
    padding,
    boardWidth,
    communityCard,
    playerCard,
    subBoardCard,
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    isSmall: isSmallPhone,
  }
}

// ── BUTTON SIZING ────────────────────────────────

export function getButtonSize(type: 'primary' | 'secondary' | 'action' | 'small') {
  switch (type) {
    case 'primary':
      return {
        height: scale(48),
        minWidth: scale(120),
        paddingHorizontal: scale(24),
        fontSize: moderateScale(16),
        borderRadius: scale(12),
      }
    case 'secondary':
      return {
        height: scale(40),
        minWidth: scale(100),
        paddingHorizontal: scale(16),
        fontSize: moderateScale(14),
        borderRadius: scale(10),
      }
    case 'action': // bet, fold, call etc.
      return {
        height: scale(44),
        minWidth: scale(80),
        paddingHorizontal: scale(16),
        fontSize: moderateScale(14),
        borderRadius: scale(10),
      }
    case 'small':
      return {
        height: scale(32),
        minWidth: scale(60),
        paddingHorizontal: scale(12),
        fontSize: moderateScale(12),
        borderRadius: scale(8),
      }
  }
}

// ── MINIMUM TOUCH TARGET ─────────────────────────

export const MIN_TOUCH = 44  // Apple HIG minimum

export { SCREEN_WIDTH, SCREEN_HEIGHT }
```

### STEP 2 — FIX BOARD COMPONENT

```bash
cat components/Board.tsx 2>/dev/null | wc -l
```

Read the Board component, then fix ALL hardcoded sizes:

```typescript
// In Board.tsx:
import { getBoardLayout, scale, moderateScale, MIN_TOUCH } from '@/lib/responsive'

const layout = getBoardLayout()

// REPLACE all hardcoded sizes:
// BEFORE: width: 60, height: 84
// AFTER:  width: layout.communityCard.width, height: layout.communityCard.height

// BEFORE: fontSize: 12
// AFTER:  fontSize: moderateScale(12)

// BEFORE: padding: 8
// AFTER:  padding: scale(8)

// BEFORE: gap: 4
// AFTER:  gap: layout.communityCard.gap
```

**Key rules for the board:**
1. **Community cards (5 in a row):** calculate width from `(boardWidth - gaps) / 5`
2. **Player cards (4 Omaha):** calculate from available space
3. **Sub-boards (if 4 boards):** each takes half width, cards scale down
4. **Cards placed on board:** SAME SIZE as the slot they're placed into
5. **No overflow:** cards + gaps must never exceed container width
6. **Min card width:** `scale(30)` — below this cards are unreadable

```typescript
// Card on board should be EXACTLY the same size as the board slot:
const placedCardStyle = {
  width: layout.subBoardCard.width,
  height: layout.subBoardCard.height,
  // NOT the hand card size — the BOARD card size
}
```

### STEP 3 — FIX CARD COMPONENT

```bash
find . -name "Card*" | grep -v node_modules | grep -E "\.tsx$" | head -3
for f in $(find . -name "Card*" | grep -v node_modules | grep -E "\.tsx$" | head -3); do
  echo "===== $f ====="
  cat "$f"
done
```

CardComponent should accept width/height as props:

```typescript
interface CardProps {
  card: Card
  width?: number
  height?: number
  faceDown?: boolean
  onPress?: () => void
}

function CardComponent({ card, width, height, faceDown, onPress }: CardProps) {
  const defaultSize = getCardDimensions({ cardsPerRow: 5 })
  const w = width || defaultSize.width
  const h = height || defaultSize.height
  const fontSize = moderateScale(w > 40 ? 14 : w > 30 ? 11 : 9)
  const cornerFontSize = moderateScale(w > 40 ? 10 : 8)
  
  return (
    <View style={{
      width: w,
      height: h,
      borderRadius: scale(4),
      // ... rest of card styling
    }}>
      <Text style={{ fontSize }}>{card.rank}</Text>
      <Text style={{ fontSize: cornerFontSize }}>{card.suit}</Text>
    </View>
  )
}
```

### STEP 4 — FIX BUTTON SIZES

```bash
grep -rn "TouchableOpacity\|Pressable" components/ --include="*.tsx" | grep -v node_modules | head -20
```

Replace hardcoded button styles:

```typescript
import { getButtonSize, MIN_TOUCH } from '@/lib/responsive'

// For action buttons (bet, fold, call):
const actionBtn = getButtonSize('action')

<TouchableOpacity style={{
  height: Math.max(actionBtn.height, MIN_TOUCH),
  minWidth: actionBtn.minWidth,
  paddingHorizontal: actionBtn.paddingHorizontal,
  borderRadius: actionBtn.borderRadius,
  justifyContent: 'center',
  alignItems: 'center',
}}>
  <Text style={{ fontSize: actionBtn.fontSize, fontWeight: 'bold' }}>
    CALL
  </Text>
</TouchableOpacity>
```

### STEP 5 — FIX PLAYER HAND AREA

The player's hand (bottom of screen) needs to show 4 cards + action buttons
without overlapping:

```typescript
// Player hand area:
const playerAreaHeight = verticalScale(140)
const playerCardSize = getCardDimensions({
  cardsPerRow: 4,
  containerWidth: SCREEN_WIDTH * 0.5,  // cards take 50% of width
  gapBetweenCards: scale(6),
})

// Action buttons take the other 50%:
// [FOLD] [CALL $X] [RAISE]
// All must be MIN_TOUCH height (44px minimum)
```

### STEP 6 — TEST ON ALL SCREEN SIZES

```bash
echo "=== Check responsive calculations ==="
# Create a quick test:
cat > /tmp/test-responsive.js << 'EOF'
// Simulate different screen sizes
const screens = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 393, height: 852 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'iPhone 15 Plus', width: 430, height: 932 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'Small Android', width: 360, height: 640 },
  { name: 'Galaxy S24', width: 412, height: 915 },
]

const BASE_WIDTH = 393

screens.forEach(s => {
  const ratio = s.width / BASE_WIDTH
  const cardWidth5 = Math.floor((s.width - 24 - 4*4) / 5)
  const cardWidth4 = Math.floor((s.width * 0.6 - 3*6) / 4)
  const subBoardCard = Math.floor(((s.width - 16 - 8) / 2 - 4*4) / 5)
  
  console.log(`${s.name} (${s.width}×${s.height}):`)
  console.log(`  Scale ratio: ${ratio.toFixed(2)}`)
  console.log(`  Community card: ${cardWidth5}×${Math.floor(cardWidth5 / (5/7))}`)
  console.log(`  Player card: ${cardWidth4}×${Math.floor(cardWidth4 / (5/7))}`)
  console.log(`  Sub-board card: ${subBoardCard}×${Math.floor(subBoardCard / (5/7))}`)
  console.log(`  Button height: ${Math.round(48 * ratio)}`)
  console.log(`  Font (14): ${Math.round(14 + (14*ratio - 14) * 0.5)}`)
  console.log()
})
EOF

node /tmp/test-responsive.js
```

Verify: no card is smaller than 30px wide, no button shorter than 44px.

### STEP 7 — FIX SPECIFIC ISSUES FROM SCREENSHOTS

Read the actual rendering code and fix issues Roye reported:

```bash
echo "=== Cards placed on board — are they same size as slots? ==="
grep -rn "placed\|onBoard\|boardCard\|slot" components/Board* --include="*.tsx" | head -15

echo "=== Arrangement mode vs play mode sizing ==="
grep -rn "isArrang\|arrangement\|dragg" components/Board* --include="*.tsx" | head -15

echo "=== Overlapping elements ==="
grep -rn "position.*absolute\|zIndex\|elevation" components/ --include="*.tsx" | head -20
```

**Key fix:** When cards move from hand → board, they must RESIZE to board card size:

```typescript
// Card in hand: playerCard size
// Card on board: subBoardCard size (smaller)
// The transition should be smooth but the FINAL size must match the board slot
```

### STEP 8 — ADD TRACKACTION FOR LAYOUT DEBUG

```typescript
// In Board.tsx — add tracking so debug system captures layout info:
import { trackAction } from '@/lib/crash-evidence'

useEffect(() => {
  trackAction('board_rendered', {
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    communityCardW: layout.communityCard.width,
    playerCardW: layout.playerCard.width,
    subBoardCardW: layout.subBoardCard.width,
  })
}, [])
```

This way if layout looks wrong on a specific device, we see the exact dimensions.

### STEP 9 — BUILD + DEPLOY

```bash
cd /c/Projects/Caps

npx tsc --noEmit 2>&1 | tail -10

git add -A
git commit -m "fix: responsive layout — cards, buttons, board scale to all screen sizes, zero hardcoded pixels"
git push origin main

gh run list --repo royea-beep/Caps --limit 1 2>/dev/null
```

---

## CONSTRAINTS

- Zero hardcoded pixel values — EVERYTHING from scale/verticalScale/moderateScale
- Card aspect ratio: 5:7 (standard playing card)
- Min card width: scale(30) — below this unreadable
- Min touch target: 44px (Apple HIG)
- Base design: iPhone 14 Pro (393×852)
- Cards on board = SAME size as board slot (not hand card size)
- Player hand + action buttons must fit without overlap
- Test all sizes: SE (375), 14 (393), 14 Pro Max (430), iPad (768)

---

## MEGA FINAL REPORT (MANDATORY)

```
RESPONSIVE LAYOUT FIX — Caps
Commit: [hash]

SIZING SYSTEM:
  responsive.ts created/updated: ✅/❌
  scale() / verticalScale() / moderateScale(): ✅/❌
  getCardDimensions(): ✅/❌
  getBoardLayout(): ✅/❌
  getButtonSize(): ✅/❌

CARD SIZES (calculated):
  | Device | Community | Player | Sub-board | Button |
  |--------|-----------|--------|-----------|--------|
  | SE 375 | [X]×[X] | [X]×[X] | [X]×[X] | [X]h |
  | 14 393 | [X]×[X] | [X]×[X] | [X]×[X] | [X]h |
  | Max 430| [X]×[X] | [X]×[X] | [X]×[X] | [X]h |

FIXES:
  Board.tsx: [X] hardcoded values replaced
  Card.tsx: accepts width/height props ✅/❌
  Buttons: min 44px touch target ✅/❌
  Cards on board match slot size: ✅/❌
  No overflow on any screen size: ✅/❌

LAYOUT TRACKING:
  board_rendered trackAction: ✅/❌ (logs dimensions for debug)

Build: ✅/❌
```

---

Yes, allow all edits in components
