// Caps Poker Theme — Obsidian + Lift (VAMOS-THEME-PROPAGATION, 2026-06-13)
//
// App-wide palette cascade. Was "Monaco Casino" (deep red felt + rich gold).
// Now obsidian neutrals + mint accent + per-board identity, matching Option C.
// Gold KEEPS its value for the winning-card highlight only — see card-state docs.
// Rollback: tag `good/pre-theme-prop`.

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

// ─── Colors (Obsidian + Lift — VAMOS-THEME-PROPAGATION 2026-06-13) ───────────
// Cascade source for the whole app. Most screens reference COLORS.* via
// constants/gameConfig.ts → here. Mint is the obsidian inner-detail accent;
// per-board identity (yellow/blue/green/orange) lives in PRD.board.accent.
// `gold` is preserved at its original value so the winning-card highlight
// (the ONLY surviving gold use) reads correctly on the obsidian felt.
export const colors = {
  // Core surfaces — obsidian neutrals (was deep black + dark casino)
  background: '#0a0a0a',
  surface: '#161922',         // was '#111111' — obsidian fallback
  surfaceRaised: '#1c1f26',   // was '#1a1a1a' — obsidian top
  border: 'rgba(255,255,255,0.10)',  // was '#2a2a2a' — neutral hairline (mint reserved for accents)
  overlay: 'rgba(0,0,0,0.88)',

  // Primary accent — gold KEPT for the winning-card highlight ONLY.
  // Selected/active/community frame remap to mint via mintHalo + boardActive below.
  gold: '#c9a84c',          // KEEP — winning-card highlight only
  goldLight: '#e8c96a',     // KEEP — winning text/bannerHandName
  goldDim: 'rgba(79,214,168,0.65)',         // was '#9a7a2e' (mocha gold) → mint @65%
  goldGlow: 'rgba(79,214,168,0.40)',        // was rgba(201,168,76,0.4)  → mint glow
  goldBright: '#e8c96a',    // KEEP — winning text alias

  // Mint accent (NEW tokens for direct use)
  mint: '#4FD6A8',
  mintGlow: 'rgba(79,214,168,0.55)',
  mintHairline: 'rgba(79,214,168,0.30)',
  mintGhost: 'rgba(79,214,168,0.10)',

  // Warm accents — neonBlue retasked from gold-alias → mint so all legacy
  // "neonBlue" decorations cascade to mint.
  neonBlue: '#4FD6A8',         // was '#c9a84c' (gold legacy) — now mint
  neonPurple: '#3da583',       // was '#8a6a45' (mocha) — now darker mint
  neonGreen: '#2ecc71',        // KEEP — semantic win
  neonRed: '#c0392b',          // KEEP — semantic lose

  // Text — warm cream still reads beautifully on obsidian; mute/dim go cool
  text: '#f0ead6',
  textMuted: '#9aa19b',        // was '#8a7a5a' (warm tan) — cooler gray
  textDim: '#5b6168',          // was '#5a4a30' (mocha) — cooler dim

  // Cards — premium warm whites unchanged. Back palette obsidianized.
  cardRed: '#c0392b',
  cardBlack: '#1a1a2e',
  cardBack: '#2A2F3D',         // was '#0f3460' (navy) — obsidian back top
  cardFace: '#f5f0e8',
  cardWhite: '#f5f0e8',
  cardBackPattern: 'rgba(79,214,168,0.45)',  // was '#16213e' (deep navy) — mint emblem hint

  // Semantic
  success: '#2ecc71',
  error: '#c0392b',
  danger: '#c0392b',

  // Board — obsidian
  boardBg: '#161922',          // was '#6B0000' (red felt) — obsidian
  boardBorder: 'rgba(79,214,168,0.45)',  // was '#8B0000' — mint hairline
  boardActive: '#4FD6A8',      // was '#c9a84c' (gold) — mint for active state
  boardFull: '#2ecc71',        // KEEP — semantic "board filled" green

  // Table / felt — eliminate red entirely
  felt: '#161922',             // was '#6B0000'
  feltLight: '#1c1f26',        // was '#8B0000'
  feltBorder: 'rgba(79,214,168,0.30)',  // was '#a00000'
  tableEdge: '#0a0a0a',

  // Chip colors (denomination-based) unchanged — semantic
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
  textSecondary: '#9aa19b',    // matches textMuted
  chipGreen: '#2ecc71',
  chipRed: '#c0392b',

  // Button — primary CTA is now mint (was gold)
  buttonPrimary: '#4FD6A8',
  buttonSecondary: '#161922',
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
