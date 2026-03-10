// Caps Poker Theme — adapted from Wingman theme system

// ─── Spacing (from Wingman) ───────────────────────────────────────────────────
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

// ─── Typography (from Wingman) ────────────────────────────────────────────────
export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// ─── Colors (Caps Poker palette) ──────────────────────────────────────────────
export const colors = {
  // Core palette
  background: '#0a1a0f',
  surface: '#0f2318',
  surfaceRaised: '#143020',
  border: '#1e4028',
  gold: '#c9a227',
  goldLight: '#e8c547',
  goldDim: '#8a6e1a',
  text: '#f0f0e8',
  textMuted: '#8a9e8a',
  textDim: '#4a6050',
  cardRed: '#e63946',
  cardBlack: '#f0f0e8',
  success: '#4caf50',
  error: '#f44336',
  overlay: 'rgba(0,0,0,0.85)',

  // Legacy aliases — map old gameConfig COLORS keys to new palette values
  felt: '#0f2318',            // → surface
  feltLight: '#143020',       // → surfaceRaised
  goldBright: '#e8c547',      // → goldLight
  cardWhite: '#f0f0e8',       // → text
  cardBack: '#0f2318',        // → surface
  cardBackPattern: '#1e4028', // → border
  red: '#e63946',             // → cardRed
  black: '#f0f0e8',           // → cardBlack
  white: '#ffffff',
  textPrimary: '#f0f0e8',     // → text
  textSecondary: '#8a9e8a',   // → textMuted
  chipGreen: '#4caf50',       // → success
  chipRed: '#f44336',         // → error
  boardBorder: '#1e4028',     // → border
  boardActive: '#c9a227',     // → gold
  danger: '#f44336',          // → error
} as const;

// ─── Unified THEME export ─────────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;
