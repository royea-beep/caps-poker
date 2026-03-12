// Caps Poker Theme — Poker felt table aesthetic

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

// ─── Colors (Poker felt green + gold accents) ───────────────────────────────
export const colors = {
  // Core surfaces — poker felt green
  background: '#0a3d1f',
  surface: '#0d4a26',
  surfaceRaised: '#126b32',
  border: '#1a6b38',
  overlay: 'rgba(0,0,0,0.85)',

  // Gold accent (primary)
  gold: '#f0c040',
  goldLight: '#f5d060',
  goldDim: '#b89020',
  goldGlow: '#f0c04066',

  // Neon accents
  neonBlue: '#00e5ff',
  neonPurple: '#8B5CF6',
  neonGreen: '#00FF88',
  neonRed: '#FF3366',

  // Text
  text: '#FFFFFF',
  textMuted: '#b0d0b8',
  textDim: '#6a8a70',

  // Cards
  cardRed: '#cc2233',
  cardBlack: '#1a1a1a',
  cardBack: '#1a3a28',
  cardFace: '#FFFFFF',

  // Semantic
  success: '#00FF88',
  error: '#FF3366',
  danger: '#FF3366',

  // Board
  boardBorder: '#1a6b38',
  boardActive: '#00e5ff',
  boardFull: '#00FF88',

  // Legacy aliases — backward compat
  felt: '#0a3d1f',
  feltLight: '#0d4a26',
  goldBright: '#f5d060',
  cardWhite: '#FFFFFF',
  cardBackPattern: '#2a5a3a',
  red: '#FF3366',
  black: '#1a1a1a',
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#b0d0b8',
  chipGreen: '#00FF88',
  chipRed: '#FF3366',

  // Button
  buttonPrimary: '#f0c040',
  buttonSecondary: '#0d4a26',
  buttonDanger: '#FF3366',
} as const;

// ─── Unified THEME export ──────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;
