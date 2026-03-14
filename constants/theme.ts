// Caps Poker Theme — Central Perk coffee shop aesthetic

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

// ─── Colors (Espresso brown + orange accents) ───────────────────────────────
export const colors = {
  // Core surfaces — espresso brown
  background: '#1a0f0a',
  surface: '#2d1f14',
  surfaceRaised: '#3d2a1a',
  border: '#4d3a2a',
  overlay: 'rgba(0,0,0,0.85)',

  // Orange accent (Central Perk couch)
  gold: '#e8762b',
  goldLight: '#f09040',
  goldDim: '#b85a1a',
  goldGlow: '#e8762b66',

  // Warm accents
  neonBlue: '#d4a843',    // warm gold instead of neon blue
  neonPurple: '#a07850',  // mocha
  neonGreen: '#5a8a3c',   // Central Perk green
  neonRed: '#cc3333',     // warm red

  // Text — cream/latte tones
  text: '#f5e6d3',
  textMuted: '#c4a882',
  textDim: '#8a6a4a',

  // Cards
  cardRed: '#cc2233',
  cardBlack: '#2a1a10',
  cardBack: '#3d2a1a',
  cardFace: '#f5e6d3',

  // Semantic
  success: '#5a8a3c',
  error: '#cc3333',
  danger: '#cc3333',

  // Board
  boardBorder: '#4d3a2a',
  boardActive: '#e8762b',
  boardFull: '#5a8a3c',

  // Legacy aliases — backward compat
  felt: '#1a0f0a',
  feltLight: '#2d1f14',
  goldBright: '#f09040',
  cardWhite: '#f5e6d3',
  cardBackPattern: '#4d3a2a',
  red: '#cc3333',
  black: '#2a1a10',
  white: '#f5e6d3',
  textPrimary: '#f5e6d3',
  textSecondary: '#c4a882',
  chipGreen: '#5a8a3c',
  chipRed: '#cc3333',

  // Button
  buttonPrimary: '#e8762b',
  buttonSecondary: '#2d1f14',
  buttonDanger: '#cc3333',
} as const;

// ─── Unified THEME export ──────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;
