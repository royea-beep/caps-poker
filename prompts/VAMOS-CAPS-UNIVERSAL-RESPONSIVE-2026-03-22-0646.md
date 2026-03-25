# VAMOS CAPS UNIVERSAL-RESPONSIVE-SYSTEM
**Date:** 2026-03-22 06:46 IST
**Priority:** 🔴🔴🔴 SYSTEMIC FIX — once and forever, all devices, all projects

## ROLE
You are 5 specialists building a UNIVERSAL responsive system:
1. **Responsive Architect** — designs the scaling system (the GEM)
2. **Screen Auditor** — maps EVERY element in EVERY screen
3. **Device Matrix Engineer** — defines ALL devices (iPhone + Android + future)
4. **Polish Engineer** — applies the system to every element in CAPS
5. **QA Simulator** — tests all 30+ device sizes × all screens

## PHILOSOPHY — READ THIS FIRST
The current approach is BROKEN:
- We design for iPhone 15/16 (393pt) and everything looks great
- Then on SE (375pt) things are too small
- Then on 17 Pro Max (440pt) things have too much whitespace
- THIS IS BACKWARDS

**The correct approach:**
- Design for the SMALLEST device first (320pt Android)
- Scale UP elegantly to the LARGEST (440pt+)
- EVERY element has a responsive size — NOTHING is hardcoded px
- The system is a REUSABLE GEM for ALL projects

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\constants\gameConfig.ts
Read C:\Projects\Caps\constants\theme.ts
Read C:\Projects\Caps\app\index.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\app\results.tsx
Read C:\Projects\Caps\app\settings.tsx
Read C:\Projects\Caps\app\hand-history.tsx
Read C:\Projects\Caps\app\lobby\host.tsx
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\components\Board.tsx
Read C:\Projects\Caps\components\PlayerHand.tsx
Read C:\Projects\Caps\components\CompleteOverlay.tsx
Read C:\Projects\Caps\components\TimerBar.tsx
Read C:\Projects\Caps\components\HandNameOverlay.tsx
Read C:\Projects\Caps\components\FloatingChips.tsx
Read C:\Projects\Caps\components\ProQuoteBanner.tsx
Read C:\Projects\Caps\components\ShareCard.tsx
Read C:\Projects\Caps\components\Tutorial.tsx
Read C:\Projects\Caps\components\ErrorBoundary.tsx
```

═══════════════════════════════════════════════════════════
AGENT 1 — THE GEM: Universal Responsive System
═══════════════════════════════════════════════════════════

Create `utils/responsive.ts` — THE reusable responsive system.
This file will be copied to EVERY future project.

### 1A. Complete Device Matrix — ALL devices that exist

```typescript
import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PIXEL_RATIO = PixelRatio.get();

// ═══════════════════════════════════════
// DEVICE CATEGORIES — covers EVERYTHING
// ═══════════════════════════════════════

// ALL known screen widths (points/dp):
// 
// ── TINY (≤340) ──────────────────────
// 320pt  — iPhone SE 1/5s, iPod Touch (LEGACY)
// 320dp  — Android: Galaxy S3, Moto G (1st), many budget phones
// 340dp  — Android: Pixel 4a narrow mode
//
// ── XSMALL (341-375) ─────────────────
// 360dp  — Android: Galaxy S7/S8/S9, Pixel 2/3/4/5, MOST budget Androids
// 375pt  — iPhone SE 2/3, 12 mini, 13 mini, X, XS, 11 Pro
// 
// ── SMALL (376-389) ──────────────────
// 380pt  — iPhone 16e
// 384dp  — Android: Pixel 6/7/8 narrow
//
// ── MEDIUM (390-409) ─────────────────
// 390pt  — iPhone 12, 12 Pro, 13, 13 Pro, 14
// 393pt  — iPhone 14 Pro, 15, 15 Pro, 16, 16 Pro, 17e
// 402pt  — iPhone 17, 17 Pro, 17 Air
// 412dp  — Android: Pixel 6/7/8 Pro, Galaxy S21/S22/S23/S24
//
// ── LARGE (410-440) ──────────────────
// 414pt  — iPhone XR, 11, XS Max, 11 Pro Max
// 428pt  — iPhone 12 Pro Max, 13 Pro Max, 14 Plus
// 430pt  — iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus/Pro Max
// 440pt  — iPhone 17 Pro Max
// 412dp  — Android: Galaxy S24 Ultra, Pixel 8 Pro
// 432dp  — Android: Galaxy S24 Ultra
//
// ── XLARGE (441+) ────────────────────
// 480dp+ — Android tablets in phone mode, foldables (Galaxy Fold inner)
//
// ── HEIGHT categories ────────────────
// 568pt  — iPhone SE 1/5s (SHORTEST EVER)
// 667pt  — iPhone SE 2/3 (VERY SHORT)
// 736pt  — iPhone 8 Plus
// 812pt  — iPhone X/XS/12 mini/13 mini
// 844pt  — iPhone 12/13/14
// 852pt  — iPhone 14 Pro/15/16
// 874pt  — iPhone 17/17 Pro
// 896pt  — iPhone XR/11/XS Max
// 926pt  — iPhone 12/13 Pro Max/14 Plus
// 932pt  — iPhone 14-16 Pro Max
// 956pt  — iPhone 17 Pro Max (TALLEST)

type DeviceCategory = 'tiny' | 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
type HeightCategory = 'vshort' | 'short' | 'medium' | 'tall' | 'vtall';

function getDeviceCategory(): DeviceCategory {
  if (SCREEN_W <= 340) return 'tiny';
  if (SCREEN_W <= 375) return 'xsmall';
  if (SCREEN_W <= 389) return 'small';
  if (SCREEN_W <= 409) return 'medium';
  if (SCREEN_W <= 440) return 'large';
  return 'xlarge';
}

function getHeightCategory(): HeightCategory {
  if (SCREEN_H <= 600) return 'vshort';
  if (SCREEN_H <= 740) return 'short';
  if (SCREEN_H <= 860) return 'medium';
  if (SCREEN_H <= 940) return 'tall';
  return 'vtall';
}
```

### 1B. The Scaling Functions — the heart of the system

```typescript
// ═══════════════════════════════════════
// RESPONSIVE VALUE (rv) — percentage of screen width
// ═══════════════════════════════════════
// Base: 393pt (iPhone 15/16 — the most common device)
// On 320pt device: rv(16) = 16 × (320/393) = 13.0
// On 375pt device: rv(16) = 16 × (375/393) = 15.3
// On 393pt device: rv(16) = 16 (base)
// On 440pt device: rv(16) = 16 × (440/393) = 17.9

const BASE_WIDTH = 393; // Design base — most common iPhone

export function rv(value: number): number {
  return Math.round(value * (SCREEN_W / BASE_WIDTH));
}

// ═══════════════════════════════════════
// RESPONSIVE HEIGHT (rh) — percentage of screen height
// ═══════════════════════════════════════
const BASE_HEIGHT = 852;

export function rh(value: number): number {
  return Math.round(value * (SCREEN_H / BASE_HEIGHT));
}

// ═══════════════════════════════════════
// RESPONSIVE FONT (rf) — scales with width but CLAMPED
// ═══════════════════════════════════════
// Fonts need min/max to stay readable on tiny and not huge on big

export function rf(value: number, min?: number, max?: number): number {
  const scaled = Math.round(value * (SCREEN_W / BASE_WIDTH));
  const lower = min ?? Math.round(value * 0.75); // never below 75% of design
  const upper = max ?? Math.round(value * 1.25); // never above 125% of design
  return Math.max(lower, Math.min(upper, scaled));
}

// ═══════════════════════════════════════
// RESPONSIVE SPACING (rs) — margins/paddings
// ═══════════════════════════════════════
export function rs(value: number): number {
  return Math.round(value * (SCREEN_W / BASE_WIDTH));
}

// ═══════════════════════════════════════
// RESPONSIVE ICON (ri) — icons need to be at least 24px for tap targets
// ═══════════════════════════════════════
export function ri(value: number): number {
  return Math.max(24, Math.round(value * (SCREEN_W / BASE_WIDTH)));
}

// ═══════════════════════════════════════
// RESPONSIVE BUTTON HEIGHT — always at least 44pt (Apple HIG)
// ═══════════════════════════════════════
export function rb(value: number): number {
  return Math.max(44, Math.round(value * (SCREEN_W / BASE_WIDTH)));
}

// ═══════════════════════════════════════
// DEVICE INFO — exported for conditional logic
// ═══════════════════════════════════════
export const DEVICE = {
  width: SCREEN_W,
  height: SCREEN_H,
  pixelRatio: PIXEL_RATIO,
  category: getDeviceCategory(),
  heightCategory: getHeightCategory(),
  isSmall: SCREEN_W <= 375,
  isTiny: SCREEN_W <= 340,
  isTall: SCREEN_H >= 860,
  isShort: SCREEN_H <= 740,
  isAndroid: Platform.OS === 'android',
  isIOS: Platform.OS === 'ios',
};

// ═══════════════════════════════════════
// CARD DIMENSIONS — game-specific but responsive
// ═══════════════════════════════════════
export function getCardDimensions(numPlayers: number, numBoards: number) {
  const maxBoardWidth = SCREEN_W - rs(24); // horizontal padding
  const cardsPerBoard = 5; // community cards
  const cardGap = rs(3);
  
  // Board card width = available / cards, with min
  const boardCardW = Math.max(rv(28), Math.floor((maxBoardWidth / numBoards - rs(8)) / cardsPerBoard) - cardGap);
  const boardCardH = Math.round(boardCardW * 1.4);
  const boardRank = Math.max(rf(10, 9, 16), Math.round(boardCardW * 0.22));
  const boardSuit = Math.max(rf(8, 7, 14), Math.round(boardCardW * 0.18));

  // Player hand cards = 1.3x board cards
  const handCardW = Math.round(boardCardW * 1.3);
  const handCardH = Math.round(handCardW * 1.4);
  const handRank = Math.max(rf(12, 10, 18), Math.round(handCardW * 0.22));
  const handSuit = Math.max(rf(10, 8, 16), Math.round(handCardW * 0.18));

  return {
    board: { width: boardCardW, height: boardCardH, rankSize: boardRank, suitSize: boardSuit },
    hand: { width: handCardW, height: handCardH, rankSize: handRank, suitSize: handSuit },
  };
}

// ═══════════════════════════════════════
// BOARD LAYOUT — vertical space per board
// ═══════════════════════════════════════
export function getBoardLayout(numBoards: number) {
  // Available height after safe area, header, timer, hand
  const headerH = rh(40);
  const timerH = rh(20);
  const handH = rh(100);
  const safeArea = rh(90); // top + bottom safe area
  const availableH = SCREEN_H - headerH - timerH - handH - safeArea;
  
  const boardH = Math.floor(availableH / numBoards);
  const boardPadV = DEVICE.isSmall && numBoards >= 4 ? rs(2) : rs(4);
  const boardHeaderH = DEVICE.isSmall && numBoards >= 4 ? rh(16) : rh(22);
  
  return {
    boardHeight: boardH,
    boardPaddingV: boardPadV,
    boardHeaderHeight: boardHeaderH,
    compact: DEVICE.isSmall && numBoards >= 4,
  };
}
```

### 1C. UI Element Sizes — a complete design token system

```typescript
// ═══════════════════════════════════════
// DESIGN TOKENS — every element in the app
// ═══════════════════════════════════════
export const UI = {
  // ── Buttons ──
  button: {
    primaryHeight: rb(60),
    secondaryHeight: rb(50),
    pillHeight: rb(36),
    borderRadius: rv(16),
    iconSize: ri(24),
  },
  
  // ── Text ──
  text: {
    hero: rf(44, 32, 52),         // CAPS logo
    h1: rf(24, 18, 28),           // screen titles
    h2: rf(18, 14, 22),           // section headers
    body: rf(16, 13, 18),         // regular text
    caption: rf(13, 11, 15),      // secondary text
    tiny: rf(11, 9, 13),          // labels, hints
    handName: rf(14, 11, 18),     // "FULL HOUSE" overlay
    chipAmount: rf(16, 12, 20),   // "+150" floating
    timer: rf(14, 11, 16),        // timer countdown
    versionBadge: rf(10, 8, 12),  // version badge
    proQuote: rf(13, 11, 15),     // quote text
    shareCardTitle: rf(20, 16, 24), // share card
  },
  
  // ── Spacing ──
  spacing: {
    xs: rs(4),
    sm: rs(8),
    md: rs(12),
    lg: rs(16),
    xl: rs(24),
    xxl: rs(32),
    screenPadH: rs(12),   // horizontal page padding
    screenPadV: rh(8),    // vertical page padding
    cardGap: rs(3),       // between cards
    boardGap: rs(4),      // between boards (vertical)
    sectionGap: rs(16),   // between sections
  },

  // ── Cards ──
  card: {
    borderRadius: rv(6),
    borderWidth: rv(1.5),
    selectedScale: 1.06,
    selectedBorderWidth: rv(2),
    miniWidth: rv(20),      // results screen mini cards
    miniHeight: rv(28),
  },

  // ── Boards ──
  board: {
    borderRadius: rv(8),
    borderWidth: rv(2),
    labelFontSize: rf(11, 9, 13),
  },

  // ── Timer ──
  timer: {
    barHeight: rh(4),
    borderRadius: rv(2),
  },

  // ── Complete ──
  complete: {
    textSize: rf(58, 40, 68),
    particleCount: DEVICE.isSmall ? 25 : 40,
    particleMaxRadius: rv(150),
    flashDuration: 80,
  },

  // ── Home ──
  home: {
    logoSize: rf(44, 32, 52),
    logoSpacing: rv(10),
    subtitleSize: rf(14, 11, 16),
    cardFanScale: SCREEN_W / BASE_WIDTH,
    particleCount: DEVICE.isSmall ? 10 : 15,
    particleFontSize: rf(30, 20, 40),
  },

  // ── Results ──
  results: {
    replayCardPadding: rs(12),
    miniCardWidth: rv(22),
    miniCardHeight: rv(31),
    dealMeInHeight: rb(64),
    bestHandFontSize: rf(13, 11, 15),
    statsRowFontSize: rf(12, 10, 14),
  },

  // ── Settings ──
  settings: {
    rowHeight: rb(48),
    labelFontSize: rf(16, 13, 18),
    sectionHeaderSize: rf(14, 12, 16),
  },

  // ── Share ──
  share: {
    cardWidth: 1080,
    storyWidth: 1080,
    storyHeight: 1920,
    pillHeight: rb(32),
  },

  // ── Tutorial ──
  tutorial: {
    stepTextSize: rf(16, 13, 18),
    dotSize: rv(8),
    buttonHeight: rb(48),
  },

  // ── ProQuote ──
  proQuote: {
    containerPadH: rs(12),
    containerPadV: rs(8),
    borderRadius: rv(12),
    quoteSize: rf(13, 11, 15),
    authorSize: rf(11, 9, 13),
    disclaimerSize: rf(9, 7, 11),
  },

  // ── Lobby ──
  lobby: {
    roomCodeSize: rf(32, 24, 40),
    playerNameSize: rf(16, 13, 18),
    statusSize: rf(14, 11, 16),
  },

  // ── Hand History ──
  handHistory: {
    entryHeight: rb(60),
    dateFontSize: rf(12, 10, 14),
    resultFontSize: rf(16, 13, 18),
    chipFontSize: rf(14, 11, 16),
  },
};
```

═══════════════════════════════════════════════════════════
AGENT 2 — APPLY TO EVERY SCREEN
═══════════════════════════════════════════════════════════

**CRITICAL:** Go through EVERY .tsx file that renders UI.
Replace EVERY hardcoded number with the responsive system.

### 2A. Audit every file for hardcoded values

```bash
echo "=== ALL HARDCODED FONT SIZES ==="
grep -rn "fontSize: [0-9]" app/*.tsx components/*.tsx | grep -v "rv\|rf\|rh\|rs\|UI\.\|Math\." | grep -v node_modules | grep -v __tests__

echo ""
echo "=== ALL HARDCODED WIDTHS ==="
grep -rn "width: [0-9]" app/*.tsx components/*.tsx | grep -v "rv\|rf\|rh\|rs\|UI\.\|100%\|SCREEN\|Dimensions\|getCard" | grep -v node_modules | grep -v __tests__

echo ""
echo "=== ALL HARDCODED HEIGHTS ==="
grep -rn "height: [0-9]" app/*.tsx components/*.tsx | grep -v "rv\|rf\|rh\|rs\|UI\.\|100%\|SCREEN\|Dimensions\|getCard" | grep -v node_modules | grep -v __tests__

echo ""
echo "=== ALL HARDCODED PADDING/MARGIN ==="
grep -rn "padding.*: [0-9]\|margin.*: [0-9]" app/*.tsx components/*.tsx | grep -v "rv\|rf\|rh\|rs\|UI\." | grep -v node_modules | grep -v __tests__

echo ""
echo "=== ALL HARDCODED BORDER RADIUS ==="
grep -rn "borderRadius: [0-9]" app/*.tsx components/*.tsx | grep -v "rv\|rf\|rh\|rs\|UI\." | grep -v node_modules | grep -v __tests__

echo ""
echo "=== ALL HARDCODED GAP ==="
grep -rn "gap: [0-9]" app/*.tsx components/*.tsx | grep -v "rv\|rf\|rh\|rs\|UI\." | grep -v node_modules | grep -v __tests__
```

### 2B. Replace every hardcoded value

For EVERY match from the audit above:

| Before | After |
|--------|-------|
| `fontSize: 16` | `fontSize: rf(16)` or `fontSize: UI.text.body` |
| `fontSize: 44` | `fontSize: UI.home.logoSize` |
| `padding: 12` | `padding: rs(12)` or `padding: UI.spacing.md` |
| `height: 60` | `height: rb(60)` or `height: UI.button.primaryHeight` |
| `width: 80` | `width: rv(80)` |
| `borderRadius: 16` | `borderRadius: rv(16)` |
| `gap: 8` | `gap: rs(8)` |
| `marginTop: 20` | `marginTop: rh(20)` |

**IMPORTANT: Add import to EVERY file:**
```typescript
import { rv, rh, rf, rs, rb, ri, UI, DEVICE } from '../utils/responsive';
```

### 2C. File-by-file checklist

Go through EACH file and convert:

```
[ ] app/index.tsx (home) — logo, buttons, card fan, links, particles, chips, quote
[ ] app/game.tsx — header, timer, boards container, ready/undo/auto buttons, hints
[ ] app/results.tsx — replay cards, stats, share buttons, DEAL ME IN, best hand
[ ] app/settings.tsx — rows, toggles, sections, credits, themes
[ ] app/hand-history.tsx — entries, dates, chips, share buttons
[ ] app/lobby/host.tsx — room code, player list, start button
[ ] app/lobby/join.tsx — input, join button
[ ] app/lobby/internet-join.tsx — same
[ ] app/multiplayer-game.tsx — same as game.tsx patterns
[ ] components/Card.tsx — card dimensions, rank, suit, border
[ ] components/Board.tsx — board layout, labels, community cards, player cards
[ ] components/PlayerHand.tsx — hand area, card layout, stagger
[ ] components/CompleteOverlay.tsx — text size, particles, flash
[ ] components/TimerBar.tsx — bar height, text size, position
[ ] components/HandNameOverlay.tsx — text size, pill padding
[ ] components/FloatingChips.tsx — text size, translation distance
[ ] components/ProQuoteBanner.tsx — container, text, disclaimer
[ ] components/ShareCard.tsx — all share card dimensions (stays 1080px — only UI elements)
[ ] components/Tutorial.tsx — step text, dots, buttons
[ ] components/ErrorBoundary.tsx — text, button
[ ] components/ChipsDisplay.tsx — chip number, icon
```

═══════════════════════════════════════════════════════════
AGENT 3 — SPECIAL CASES: 375pt + 4 boards
═══════════════════════════════════════════════════════════

The responsive system handles MOST cases automatically.
But 375pt + 4 boards needs EXTRA attention:

```typescript
// In Board container layout:
if (DEVICE.isSmall && numBoards >= 4) {
  // Compact mode:
  // - Board header: 16pt instead of 22pt
  // - Board vertical padding: 2pt instead of 4pt
  // - Community card gap: 2pt instead of 3pt
  // - Board label: 9px instead of 11px
  // - Player cards on board: 0.5px border instead of 1.5px
  // This saves ~40pt total height = everything fits in 667pt
}
```

Also for the SHORTEST screen (SE 3 = 667pt height):
```typescript
if (DEVICE.isShort && numBoards >= 4) {
  // Reduce hand area height from rh(100) to rh(80)
  // Reduce header from rh(40) to rh(32)
  // Reduce timer from rh(20) to rh(14)
}
```

═══════════════════════════════════════════════════════════
AGENT 4 — ANDROID PREPARATION
═══════════════════════════════════════════════════════════

Even though CAPS is iOS only right now, the responsive system MUST work on Android too.

```typescript
// Platform-specific adjustments in responsive.ts:
const FONT_SCALE = Platform.OS === 'android' ? 0.97 : 1.0;
// Android renders fonts slightly larger — compensate

const SAFE_AREA_TOP = Platform.OS === 'android' ? 24 : 0;
// Android status bar

// Android-specific text rendering:
export function rf(value: number, min?: number, max?: number): number {
  const scaled = Math.round(value * (SCREEN_W / BASE_WIDTH) * FONT_SCALE);
  const lower = min ?? Math.round(value * 0.75);
  const upper = max ?? Math.round(value * 1.25);
  return Math.max(lower, Math.min(upper, scaled));
}
```

Also: add Android screen widths to the comments in responsive.ts:
```
// Android common widths (dp):
// 320dp — low-end (Galaxy J series, Moto E)
// 360dp — Galaxy S7/S8/S9/S10e, Pixel 2-5, MOST mid-range
// 384dp — Pixel 6/7/8
// 393dp — Pixel 8a
// 412dp — Galaxy S21-S24, Pixel 6-8 Pro
// 432dp — Galaxy S24 Ultra
// 480dp — Galaxy Fold (inner), tablets in compact mode
```

═══════════════════════════════════════════════════════════
AGENT 5 — VERIFICATION: Test ALL combos
═══════════════════════════════════════════════════════════

### 5A. Create a test utility

```typescript
// In utils/__tests__/responsive.test.ts

import { rv, rh, rf, rs, rb, ri, getCardDimensions, getBoardLayout, UI } from '../responsive';

const ALL_WIDTHS = [320, 360, 375, 380, 384, 390, 393, 402, 412, 414, 428, 430, 432, 440, 480];
const ALL_HEIGHTS = [568, 667, 736, 812, 824, 844, 852, 874, 896, 926, 932, 956];
const PLAYER_COUNTS = [2, 3, 4];

describe('Responsive System', () => {
  ALL_WIDTHS.forEach(w => {
    PLAYER_COUNTS.forEach(p => {
      const boards = p === 2 ? 4 : p === 3 ? 3 : 2;
      it(`Cards readable at ${w}pt × ${p} players (${boards} boards)`, () => {
        // Mock dimensions
        const dims = getCardDimensions(w, p, boards);
        expect(dims.board.width).toBeGreaterThanOrEqual(24);
        expect(dims.board.rankSize).toBeGreaterThanOrEqual(9);
        expect(dims.hand.width).toBeGreaterThanOrEqual(30);
        expect(dims.hand.rankSize).toBeGreaterThanOrEqual(10);
      });
    });
  });

  it('Button heights always >= 44pt (Apple HIG)', () => {
    ALL_WIDTHS.forEach(w => {
      const btn = rb(60, w); // mock
      expect(btn).toBeGreaterThanOrEqual(44);
    });
  });

  it('Font sizes never below minimum', () => {
    ALL_WIDTHS.forEach(w => {
      expect(rf(16, 13, undefined, w)).toBeGreaterThanOrEqual(13);
      expect(rf(11, 9, undefined, w)).toBeGreaterThanOrEqual(9);
    });
  });
});
```

### 5B. Print the full matrix

After applying all changes, run:
```typescript
console.log('=== RESPONSIVE MATRIX ===');
ALL_WIDTHS.forEach(w => {
  ALL_HEIGHTS.forEach(h => {
    PLAYER_COUNTS.forEach(p => {
      const boards = p === 2 ? 4 : p === 3 ? 3 : 2;
      console.log(`${w}×${h} ${p}p: card ${dims.board.width}×${dims.board.height} rank ${dims.board.rankSize}px | btn ${UI.button.primaryHeight}px | title ${UI.text.h1}px`);
    });
  });
});
```

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass + NEW responsive tests pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "feat: universal responsive system — rv/rh/rf/rs/rb/ri + UI tokens — all screens, all devices, 320-480pt"
F7. git push origin main
F8. Copy utils/responsive.ts to C:\Projects\docs\RESPONSIVE_GEM.ts
F9. Update MEMORY.md
```

═══════════════════════════════════════════════════════════
REPORT — MUST INCLUDE FULL MATRIX
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
UNIVERSAL RESPONSIVE SYSTEM — REPORT
═══════════════════════════════════════

GEM Created: utils/responsive.ts
  Functions: rv, rh, rf, rs, rb, ri
  UI tokens: [count] design tokens
  Device coverage: 320-480pt width × 568-956pt height
  Android ready: [YES/NO]

Hardcoded values found: [N]
Hardcoded values replaced: [N]
Remaining hardcoded: [N] — list each with reason

Files updated: [list every file]

Card sizing matrix (15 widths × 3 player counts = 45 combos):
  320pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  360pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  375pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  380pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  390pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  393pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  402pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  412pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  414pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  428pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  430pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  432pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  440pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  480pt×4b: card [W]×[H] rank [N]px [OK/FAIL]
  ALL must be OK.

Button min heights: [all ≥ 44pt? YES/NO]
Font min sizes: [all ≥ 9px? YES/NO]
Touch targets: [all ≥ 44pt? YES/NO]

Tests: [N] pass / [N] fail
TS: [N] errors

Quality: target 9.7+/10 on EVERY device
═══════════════════════════════════════
```

## DO NOT
- Do NOT leave ANY hardcoded pixel value in ANY .tsx file
- Do NOT skip any screen or component
- Do NOT break existing features
- Do NOT change game logic
- Do NOT make it "mostly responsive" — it must be 100% responsive
- Do NOT forget Android widths (320-480dp)
- Do NOT forget height categories (short screens need compact layouts)

VAMOS CAPS UNIVERSAL-RESPONSIVE-SYSTEM — END
