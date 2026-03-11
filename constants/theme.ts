// Caps Poker Theme — Gaming palette: vibrant, bold, aggressive

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

// ─── Colors (Gaming palette — neon accents, strong contrast) ────────────────
export const colors = {
  // Core surfaces
  background: '#0a0a0f',
  surface: '#12121f',
  surfaceRaised: '#1a1a2e',
  border: '#2a2a4a',
  overlay: 'rgba(0,0,0,0.85)',

  // Gold accent (primary)
  gold: '#FFD700',
  goldLight: '#FFE44D',
  goldDim: '#CC9900',
  goldGlow: '#FFD70066',

  // Neon accents
  neonBlue: '#00D4FF',
  neonPurple: '#8B5CF6',
  neonGreen: '#00FF88',
  neonRed: '#FF3366',

  // Text
  text: '#FFFFFF',
  textMuted: '#A0A0C0',
  textDim: '#606080',

  // Cards
  cardRed: '#e63946',
  cardBlack: '#1a1a2e',
  cardBack: '#1a1a3e',
  cardFace: '#FFFFFF',

  // Semantic
  success: '#00FF88',
  error: '#FF3366',
  danger: '#FF3366',

  // Board
  boardBorder: '#2a2a4a',
  boardActive: '#00D4FF',
  boardFull: '#00FF88',

  // Legacy aliases — backward compat (map old keys to new values)
  felt: '#12121f',
  feltLight: '#1a1a2e',
  goldBright: '#FFE44D',
  cardWhite: '#FFFFFF',
  cardBackPattern: '#2a2a4a',
  red: '#FF3366',
  black: '#1a1a2e',
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0C0',
  chipGreen: '#00FF88',
  chipRed: '#FF3366',

  // Button
  buttonPrimary: '#FFD700',
  buttonSecondary: '#1a1a3e',
  buttonDanger: '#FF3366',
} as const;

// ─── Unified THEME export ──────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;
