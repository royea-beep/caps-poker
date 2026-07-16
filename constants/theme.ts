// Caps Poker Theme — Obsidian + Lift (VAMOS-THEME-PROPAGATION, 2026-06-13)
//
// App-wide palette cascade. Was "Monaco Casino" (deep red felt + rich gold).
// Now obsidian neutrals + mint accent + per-board identity, matching Option C.
// Gold KEEPS its value for the winning-card highlight only — see card-state docs.
// Rollback: tag `good/pre-theme-prop`.

import { activePaint } from './paintThemes';

// ─── Spacing ────────────────────────────────────────────────────────────────
// GEOMETRY — deliberately NOT in the paint layer (S75 R-B). A theme changes paint
// only; it must never move or resize anything. Do not route this through a theme.
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
//
// S75 (theme plumbing) — the 56 VALUES moved verbatim to the paint layer
// (constants/paintThemes.ts → currentPaint.colors) and this export now RESOLVES
// from the active paint. The name, shape, literal types and values are unchanged,
// so every `COLORS.*` consumer (648 refs) renders identically. Geometry stays put:
// `spacing`/`fontWeight` above are NOT part of the paint layer.
export const colors = activePaint.colors;

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
