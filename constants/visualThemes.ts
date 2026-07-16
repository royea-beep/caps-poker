import { activePaint } from './paintThemes';

export type VisualTheme = 'classic' | 'fiveo';

export interface ThemeTokens {
  background: string;
  surface: string;
  boardBg: string;
  boardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  cardFace: string;
  cardBorder: string;
  cardShadow: string;
  primaryBtn: string;
  primaryBtnText: string;
  primaryBtnRadius: number;
  winColor: string;
  loseColor: string;
}

// S75 (theme plumbing) — the 32 paint VALUES (2 themes x 16 keys) moved verbatim to
// the paint layer (constants/paintThemes.ts -> currentPaint.visual); each theme now
// spreads the active paint and keeps primaryBtnRadius inline. primaryBtnRadius is a
// DIMENSION, not paint, so it stays here untouched (S75 R-C). The `ThemeTokens` type
// above is left exactly as-is — the paint layer deliberately uses the distinct name
// `PaintTokens` to avoid colliding with it (S75 R-A).
//
// Original intent (VAMOS-THEME-PROPAGATION 2026-06-13): both themes obsidianized.
// "classic" is Option C (Obsidian + Lift); "fiveo" keeps a slightly warmer navy
// surface so users who picked it still see a distinct vibe, on the same obsidian board.
export const VISUAL_THEMES: Record<VisualTheme, ThemeTokens> = {
  classic: {
    ...activePaint.visual.classic,
    primaryBtnRadius: 12, // GEOMETRY — unchanged
  },
  fiveo: {
    ...activePaint.visual.fiveo,
    primaryBtnRadius: 8, // GEOMETRY — unchanged
  },
};

export function getTheme(theme: VisualTheme | null): ThemeTokens {
  return VISUAL_THEMES[theme ?? 'classic'];
}
