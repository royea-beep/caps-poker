// Caps Poker Theme — Monaco Casino 2026

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

// ─── Colors (Monaco Casino — deep black, rich gold, dark green felt) ─────────
export const colors = {
  // Core surfaces — deep black
  background: '#0a0a0a',
  surface: '#111111',
  surfaceRaised: '#1a1a1a',
  border: '#2a2a2a',
  overlay: 'rgba(0,0,0,0.88)',

  // Primary accent — rich gold
  gold: '#c9a84c',
  goldLight: '#e8c96a',
  goldDim: '#9a7a2e',
  goldGlow: 'rgba(201,168,76,0.4)',
  goldBright: '#e8c96a',

  // Warm accents
  neonBlue: '#c9a84c',       // gold alias (legacy)
  neonPurple: '#8a6a45',     // mocha
  neonGreen: '#2ecc71',      // bright green for wins
  neonRed: '#c0392b',        // rich crimson for losses

  // Text — warm cream
  text: '#f0ead6',
  textMuted: '#8a7a5a',
  textDim: '#5a4a30',

  // Cards — premium warm whites
  cardRed: '#c0392b',        // rich crimson for hearts/diamonds
  cardBlack: '#1a1a2e',      // dark navy for clubs/spades
  cardBack: '#0f3460',
  cardFace: '#f5f0e8',       // warm white face
  cardWhite: '#f5f0e8',      // warm white
  cardBackPattern: '#16213e',

  // Semantic
  success: '#2ecc71',
  error: '#c0392b',
  danger: '#c0392b',

  // Board — deep red felt (5-0 poker style)
  boardBg: '#6B0000',
  boardBorder: '#8B0000',
  boardActive: '#c9a84c',
  boardFull: '#2ecc71',

  // Table / felt
  felt: '#6B0000',
  feltLight: '#8B0000',
  feltBorder: '#a00000',
  tableEdge: '#0a0a0a',

  // Chip colors (denomination-based)
  chip1: '#f5f0e8',
  chip5: '#c0392b',
  chip25: '#2ecc71',
  chip100: '#1a1a2e',
  chip500: '#8B008B',

  // Legacy aliases
  red: '#c0392b',
  black: '#1a1a2e',
  white: '#f0ead6',
  textPrimary: '#f0ead6',
  textSecondary: '#8a7a5a',
  chipGreen: '#2ecc71',
  chipRed: '#c0392b',

  // Button
  buttonPrimary: '#c9a84c',
  buttonSecondary: '#111111',
  buttonDanger: '#8b1a1a',
} as const;

// ─── Unified THEME export ──────────────────────────────────────────────────
export const THEME = {
  colors,
  spacing,
  typography: fontWeight,
} as const;

// ─── Win/Lose palettes — default and colorblind-safe ─────────────────────────
export const DEFAULT_WIN_LOSE = {
  win: '#2ecc71',        // green
  winLight: '#E8F5E9',
  winText: '#1B5E20',
  lose: '#F44336',       // red
  loseLight: '#FFEBEE',
  loseText: '#B71C1C',
} as const;

export const COLORBLIND_WIN_LOSE = {
  win: '#1565C0',        // blue (safe for deuteranopia/protanopia)
  winLight: '#E3F2FD',
  winText: '#0D47A1',
  lose: '#E65100',       // orange
  loseLight: '#FFF3E0',
  loseText: '#BF360C',
} as const;

export interface WinLosePalette {
  win: string;
  winLight: string;
  winText: string;
  lose: string;
  loseLight: string;
  loseText: string;
}
