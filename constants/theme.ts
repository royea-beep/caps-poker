// Caps Poker Theme — Central Perk premium aesthetic

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

// ─── Colors (Premium espresso + antique gold) ───────────────────────────────
export const colors = {
  // Core surfaces — darkest espresso
  background: '#0d0600',
  surface: '#1a0e06',
  surfaceRaised: '#2a1a0e',
  border: '#3d2a1a',
  overlay: 'rgba(0,0,0,0.85)',

  // Primary accent — warm amber
  gold: '#c96a1a',
  goldLight: '#d4862e',
  goldDim: '#8a4a10',
  goldGlow: '#c96a1a66',
  goldBright: '#c8a84b',

  // Warm accents
  neonBlue: '#c8a84b',    // antique gold
  neonPurple: '#8a6a45',  // mocha
  neonGreen: '#2d7a2d',   // forest green
  neonRed: '#c0392b',     // warm red

  // Text — warm cream
  text: '#f0dfc0',
  textMuted: '#8a6a45',
  textDim: '#6a5030',

  // Cards
  cardRed: '#c0392b',
  cardBlack: '#1a1a1a',
  cardBack: '#2a1810',
  cardFace: '#f5e6c8',
  cardWhite: '#f5e6c8',
  cardBackPattern: '#3d2a1a',

  // Semantic
  success: '#2d7a2d',
  error: '#c0392b',
  danger: '#c0392b',

  // Board — dark poker green
  boardBg: '#1f3a1a',
  boardBorder: '#2d5a24',
  boardActive: '#c96a1a',
  boardFull: '#2d7a2d',

  // Legacy aliases
  felt: '#0d0600',
  feltLight: '#1a0e06',
  red: '#c0392b',
  black: '#1a1a1a',
  white: '#f0dfc0',
  textPrimary: '#f0dfc0',
  textSecondary: '#8a6a45',
  chipGreen: '#2d7a2d',
  chipRed: '#c0392b',

  // Button
  buttonPrimary: '#c96a1a',
  buttonSecondary: '#1a0e06',
  buttonDanger: '#8b1a1a',
} as const;

// ─── Unified THEME export ──────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;
