/**
 * utils/responsive.ts
 * Universal Responsive System for CAPS Poker
 *
 * Designed for: 393pt (iPhone 15/16) — scales to ALL devices 320–480pt
 * Copied to: C:\Projects\docs\RESPONSIVE_GEM.ts
 *
 * IRON RULE: Never call Dimensions.get() at module level on web —
 *   crashes SPA before DOM is ready (Sprint-28 white screen).
 *   Solution: Platform guard with 393×852 safe fallback for web.
 *
 * All functions accept an optional screenW override for unit testing.
 */

import { Platform, PixelRatio } from 'react-native';

// ─── Safe dimension init ────────────────────────────────────────────────────
// On web (SPA): module runs before DOM — Dimensions returns 0 → crash.
// On native: always safe at module time.
const _raw: { width: number; height: number } =
  Platform.OS !== 'web'
    ? (require('react-native').Dimensions.get('window') as { width: number; height: number })
    : { width: 393, height: 852 };

export const SCREEN_W = _raw.width > 0 ? _raw.width : 393;
export const SCREEN_H = _raw.height > 0 ? _raw.height : 852;
export const PIXEL_RATIO = PixelRatio.get();

// ─── Base dimensions (design target = iPhone 15/16 = most common) ───────────
const BASE_WIDTH  = 393;
const BASE_HEIGHT = 852;

// ─── Android font compensation ───────────────────────────────────────────────
// Android renders fonts ~3% larger than iOS at same dp — compensate.
const FONT_SCALE = Platform.OS === 'android' ? 0.97 : 1.0;

// ─── Device categories ───────────────────────────────────────────────────────
//
// ALL known screen widths (points / dp):
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
// 393pt  — iPhone 14 Pro, 15, 15 Pro, 16, 16 Pro, 17e  ← BASE
// 402pt  — iPhone 17, 17 Pro, 17 Air
// 412dp  — Android: Pixel 6/7/8 Pro, Galaxy S21/S22/S23/S24
//
// ── LARGE (410-440) ──────────────────
// 414pt  — iPhone XR, 11, XS Max, 11 Pro Max
// 428pt  — iPhone 12 Pro Max, 13 Pro Max, 14 Plus
// 430pt  — iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus/Pro Max
// 440pt  — iPhone 17 Pro Max
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
// 852pt  — iPhone 14 Pro/15/16         ← BASE
// 874pt  — iPhone 17/17 Pro
// 896pt  — iPhone XR/11/XS Max
// 926pt  — iPhone 12/13 Pro Max/14 Plus
// 932pt  — iPhone 14-16 Pro Max
// 956pt  — iPhone 17 Pro Max (TALLEST)
//
// Android common widths (dp):
// 320dp — low-end (Galaxy J series, Moto E)
// 360dp — Galaxy S7/S8/S9/S10e, Pixel 2-5, MOST mid-range
// 384dp — Pixel 6/7/8
// 393dp — Pixel 8a
// 412dp — Galaxy S21-S24, Pixel 6-8 Pro
// 432dp — Galaxy S24 Ultra
// 480dp — Galaxy Fold (inner), tablets in compact mode

export type DeviceCategory   = 'tiny' | 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
export type HeightCategory   = 'vshort' | 'short' | 'medium' | 'tall' | 'vtall';

function _deviceCategory(w: number): DeviceCategory {
  if (w <= 340) return 'tiny';
  if (w <= 375) return 'xsmall';
  if (w <= 389) return 'small';
  if (w <= 409) return 'medium';
  if (w <= 440) return 'large';
  return 'xlarge';
}

function _heightCategory(h: number): HeightCategory {
  if (h <= 600) return 'vshort';
  if (h <= 740) return 'short';
  if (h <= 860) return 'medium';
  if (h <= 940) return 'tall';
  return 'vtall';
}

// ─── Exported device info ────────────────────────────────────────────────────
export const DEVICE = {
  width:          SCREEN_W,
  height:         SCREEN_H,
  pixelRatio:     PIXEL_RATIO,
  category:       _deviceCategory(SCREEN_W),
  heightCategory: _heightCategory(SCREEN_H),
  isSmall:        SCREEN_W <= 375,
  isTiny:         SCREEN_W <= 340,
  isTall:         SCREEN_H >= 860,
  isShort:        SCREEN_H <= 740,
  isAndroid:      Platform.OS === 'android',
  isIOS:          Platform.OS === 'ios',
  isWeb:          Platform.OS === 'web',
} as const;

// ─── Scaling functions ───────────────────────────────────────────────────────
// All accept an optional `screenW` override so unit tests can inject widths.

/**
 * Responsive Value — scales a design-base value proportionally to screen width.
 * rv(16) on 375pt = 15 | on 393pt = 16 | on 430pt = 18
 */
export function rv(value: number, screenW = SCREEN_W): number {
  return Math.round(value * (screenW / BASE_WIDTH));
}

/**
 * Responsive Height — scales proportionally to screen height.
 * rh(100) on 667pt = 78 | on 852pt = 100 | on 932pt = 109
 */
export function rh(value: number, screenH = SCREEN_H): number {
  return Math.round(value * (screenH / BASE_HEIGHT));
}

/**
 * Responsive Font — scales with width but CLAMPED to readable range.
 * Default clamp: [75%, 125%] of design value.
 * rf(16) on 320pt = 13 (clamped) | on 393pt = 16 | on 440pt = 18
 */
export function rf(value: number, min?: number, max?: number, screenW = SCREEN_W): number {
  const scaled = Math.round(value * (screenW / BASE_WIDTH) * FONT_SCALE);
  const lower = min  !== undefined ? min  : Math.round(value * 0.75);
  const upper = max  !== undefined ? max  : Math.round(value * 1.25);
  return Math.max(lower, Math.min(upper, scaled));
}

/**
 * Responsive Spacing — margins, padding, gaps.
 * Same as rv() but semantically for spacing.
 */
export function rs(value: number, screenW = SCREEN_W): number {
  return Math.round(value * (screenW / BASE_WIDTH));
}

/**
 * Responsive Button — always at least 44pt (Apple Human Interface Guidelines).
 */
export function rb(value: number, screenW = SCREEN_W): number {
  return Math.max(44, Math.round(value * (screenW / BASE_WIDTH)));
}

/**
 * Responsive Icon — always at least 24pt for tap targets.
 */
export function ri(value: number, screenW = SCREEN_W): number {
  return Math.max(24, Math.round(value * (screenW / BASE_WIDTH)));
}

// ─── Card dimensions ─────────────────────────────────────────────────────────
/**
 * getCardDimensions(screenW, numPlayers, numBoards)
 *
 * Returns pixel-perfect card sizes for community (board) cards and
 * player hand cards, calibrated for the given screen width.
 *
 * overhead = 100pt — accounts for horizontal padding, row label, card gaps.
 */
export function getCardDimensions(
  screenW: number,
  numPlayers: number,
  numBoards: number,
): {
  board: { width: number; height: number; rankSize: number; suitSize: number };
  hand:  { width: number; height: number; rankSize: number; suitSize: number };
} {
  const maxBoardWidth = screenW - rs(24, screenW);
  const cardsPerBoard = 5;
  const cardGap = rs(3, screenW);

  // Board card width: available / boards / 5 cards, with a minimum
  const boardCardW = Math.max(
    24, // absolute minimum — 9px rank requires at least 24pt card width
    rv(28, screenW),
    Math.floor((maxBoardWidth / numBoards - rs(8, screenW)) / cardsPerBoard) - cardGap,
  );
  const boardCardH   = Math.round(boardCardW * 1.4);
  const boardRank    = Math.max(rf(10, 9, 16, screenW), Math.round(boardCardW * 0.22));
  const boardSuit    = Math.max(rf(8,  7, 14, screenW), Math.round(boardCardW * 0.18));

  // Hand cards are 1.3× board cards
  const handCardW = Math.round(boardCardW * 1.3);
  const handCardH = Math.round(handCardW * 1.4);
  const handRank  = Math.max(rf(12, 10, 18, screenW), Math.round(handCardW * 0.22));
  const handSuit  = Math.max(rf(10,  8, 16, screenW), Math.round(handCardW * 0.18));

  return {
    board: { width: boardCardW, height: boardCardH, rankSize: boardRank, suitSize: boardSuit },
    hand:  { width: handCardW,  height: handCardH,  rankSize: handRank,  suitSize: handSuit  },
  };
}

// ─── Board layout ─────────────────────────────────────────────────────────────
/**
 * getBoardLayout(screenW, screenH, numBoards)
 *
 * Calculates how much vertical space each board gets, accounting for
 * header, timer bar, player hand, and safe areas.
 *
 * Compact mode kicks in on small screens with 4 boards — saves ~40pt.
 */
export function getBoardLayout(
  screenW: number,
  screenH: number,
  numBoards: number,
): {
  boardHeight:      number;
  boardPaddingV:    number;
  boardHeaderHeight: number;
  compact:          boolean;
} {
  const compact    = screenW <= 375 && numBoards >= 4;
  const headerH    = compact ? rh(32, screenH) : rh(40, screenH);
  const timerH     = compact ? rh(14, screenH) : rh(20, screenH);
  const handH      = compact ? rh(80, screenH) : rh(100, screenH);
  const safeArea   = rh(90, screenH);
  const availableH = screenH - headerH - timerH - handH - safeArea;

  const boardH        = Math.floor(availableH / numBoards);
  const boardPadV     = compact ? rs(2, screenW) : rs(4, screenW);
  const boardHeaderH  = compact ? rh(16, screenH) : rh(22, screenH);

  return {
    boardHeight:       boardH,
    boardPaddingV:     boardPadV,
    boardHeaderHeight: boardHeaderH,
    compact,
  };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Computed once at module load — static for the lifetime of the process.
// On web: SCREEN_W = 393 (fallback) → scale factor = 1 → tokens = base values.
// On native: SCREEN_W = real device width at startup.

export const UI = {
  // ── Buttons ──────────────────────────────────────────────────────────────
  button: {
    primaryHeight:   rb(60),
    secondaryHeight: rb(50),
    pillHeight:      rb(36),
    borderRadius:    rv(16),
    iconSize:        ri(24),
  },

  // ── Text ─────────────────────────────────────────────────────────────────
  text: {
    hero:            rf(44, 32, 52),   // CAPS logo
    h1:              rf(24, 18, 28),   // screen titles
    h2:              rf(18, 14, 22),   // section headers
    body:            rf(16, 13, 18),   // regular text
    caption:         rf(13, 11, 15),   // secondary text
    tiny:            rf(11,  9, 13),   // labels, hints
    handName:        rf(14, 11, 18),   // "FULL HOUSE" overlay
    chipAmount:      rf(16, 12, 20),   // "+150" floating chips
    timer:           rf(14, 11, 16),   // timer countdown
    versionBadge:    rf(10,  8, 12),   // version badge
    proQuote:        rf(13, 11, 15),   // quote text
    shareCardTitle:  rf(20, 16, 24),   // share card heading
  },

  // ── Spacing ───────────────────────────────────────────────────────────────
  spacing: {
    xs:          rs(4),
    sm:          rs(8),
    md:          rs(12),
    lg:          rs(16),
    xl:          rs(24),
    xxl:         rs(32),
    screenPadH:  rs(12),   // horizontal page padding
    screenPadV:  rh(8),    // vertical page padding
    cardGap:     rs(3),    // between cards
    boardGap:    rs(4),    // between boards (vertical)
    sectionGap:  rs(16),   // between sections
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    borderRadius:        rv(6),
    borderWidth:         rv(1.5),
    selectedScale:       1.06,
    selectedBorderWidth: rv(2),
    miniWidth:           rv(20),  // results screen mini cards
    miniHeight:          rv(28),
  },

  // ── Boards ────────────────────────────────────────────────────────────────
  board: {
    borderRadius:   rv(8),
    borderWidth:    rv(2),
    labelFontSize:  rf(11, 9, 13),
  },

  // ── Timer ─────────────────────────────────────────────────────────────────
  timer: {
    barHeight:    rh(4),
    borderRadius: rv(2),
  },

  // ── Complete overlay ──────────────────────────────────────────────────────
  complete: {
    textSize:          rf(58, 40, 68),
    particleCount:     DEVICE.isSmall ? 25 : 40,
    particleMaxRadius: rv(150),
    flashDuration:     80,
  },

  // ── Home screen ───────────────────────────────────────────────────────────
  home: {
    logoSize:         rf(44, 32, 52),
    logoSpacing:      rv(10),
    subtitleSize:     rf(14, 11, 16),
    cardFanScale:     SCREEN_W / BASE_WIDTH,
    particleCount:    DEVICE.isSmall ? 10 : 15,
    particleFontSize: rf(30, 20, 40),
  },

  // ── Results screen ────────────────────────────────────────────────────────
  results: {
    replayCardPadding: rs(12),
    miniCardWidth:     rv(22),
    miniCardHeight:    rv(31),
    dealMeInHeight:    rb(64),
    bestHandFontSize:  rf(13, 11, 15),
    statsRowFontSize:  rf(12, 10, 14),
  },

  // ── Settings screen ───────────────────────────────────────────────────────
  settings: {
    rowHeight:         rb(48),
    labelFontSize:     rf(16, 13, 18),
    sectionHeaderSize: rf(14, 12, 16),
  },

  // ── Share cards (always 1080px — fixed output size) ───────────────────────
  share: {
    cardWidth:   1080,
    storyWidth:  1080,
    storyHeight: 1920,
    pillHeight:  rb(32),
  },

  // ── Tutorial ──────────────────────────────────────────────────────────────
  tutorial: {
    stepTextSize:  rf(16, 13, 18),
    dotSize:       rv(8),
    buttonHeight:  rb(48),
  },

  // ── Pro Quote banner ──────────────────────────────────────────────────────
  proQuote: {
    containerPadH:  rs(12),
    containerPadV:  rs(8),
    borderRadius:   rv(12),
    quoteSize:      rf(13, 11, 15),
    authorSize:     rf(11,  9, 13),
    disclaimerSize: rf( 9,  7, 11),
  },

  // ── Lobby ─────────────────────────────────────────────────────────────────
  lobby: {
    roomCodeSize:   rf(32, 24, 40),
    playerNameSize: rf(16, 13, 18),
    statusSize:     rf(14, 11, 16),
  },

  // ── Hand History ──────────────────────────────────────────────────────────
  handHistory: {
    entryHeight:  rb(60),
    dateFontSize: rf(12, 10, 14),
    resultFontSize: rf(16, 13, 18),
    chipFontSize:   rf(14, 11, 16),
  },
} as const;

// ─── React Native Responsive Aliases ──────────────────────────────────────────
// Aliases matching the react-native-size-matters API so components can use
// the familiar names (scale / verticalScale / moderateScale) without an
// extra dependency.

/** Alias for rv() — proportional width scale */
export const scale = rv;

/** Alias for rh() — proportional height scale */
export const verticalScale = rh;

/**
 * moderateScale — less aggressive than full scale.
 * moderateScale(16, 0.5) on 375pt = 15.1 → 15 (halfway between raw and scaled)
 * Useful for font sizes and padding where full scaling looks too extreme.
 */
export function moderateScale(size: number, factor = 0.5): number {
  return Math.round(size + (rv(size) - size) * factor);
}
