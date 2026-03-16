// Caps Poker Theme — Premium 2026 aesthetic

// ─── Spacing ────────────────────────────────────────────────────────────────
export const spacing = {
  hairline: 1,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────
export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// ─── Colors (Premium poker table — dark espresso app, green felt boards) ────
export const colors = {
  // Core surfaces — dark espresso app background
  background: '#0d0600',
  surface: '#1a0e06',
  surfaceRaised: '#2a1a0e',
  border: '#3d2a1a',
  overlay: 'rgba(0,0,0,0.85)',

  // Primary accent — metallic gold (PokerStars style)
  gold: '#C9A84C',
  goldLight: '#E5C56A',
  goldDim: '#A07830',
  goldGlow: 'rgba(201,168,76,0.4)',
  goldBright: '#E5C56A',

  // Warm accents
  neonBlue: '#C9A84C',    // gold alias (legacy)
  neonPurple: '#8a6a45',  // mocha
  neonGreen: '#2d7a2d',   // forest green
  neonRed: '#c0392b',     // warm red

  // Text — warm cream
  text: '#f0dfc0',
  textMuted: '#8a6a45',
  textDim: '#6a5030',

  // Cards
  cardRed: '#CC2936',
  cardBlack: '#1a1a2e',
  cardBack: '#0f3460',
  cardFace: '#FFFFFF',
  cardWhite: '#FFFFFF',
  cardBackPattern: '#16213e',

  // Semantic
  success: '#2d7a2d',
  error: '#c0392b',
  danger: '#c0392b',

  // Board — premium poker green (felt)
  boardBg: '#0d5c2e',
  boardBorder: '#0a4a24',
  boardActive: '#C9A84C',
  boardFull: '#2d7a2d',

  // Table / felt
  felt: '#0d5c2e',
  feltLight: '#1a0e06',   // espresso (used for UI panels — NOT felt green)
  feltBorder: '#0a4a24',
  tableEdge: '#2c1810',

  // Chip colors (denomination-based)
  chip1: '#FFFFFF',
  chip5: '#CC2936',
  chip25: '#2E8B57',
  chip100: '#1a1a2e',
  chip500: '#8B008B',

  // Legacy aliases
  red: '#CC2936',
  black: '#1a1a2e',
  white: '#f0dfc0',
  textPrimary: '#f0dfc0',
  textSecondary: '#8a6a45',
  chipGreen: '#2d7a2d',
  chipRed: '#CC2936',

  // Button
  buttonPrimary: '#C9A84C',
  buttonSecondary: '#1a0e06',
  buttonDanger: '#8b1a1a',
} as const;

// ─── Unified THEME export ──────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;
