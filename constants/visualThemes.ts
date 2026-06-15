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

// VAMOS-THEME-PROPAGATION 2026-06-13 — both themes obsidianized.
// "classic" is now Option C (Obsidian + Lift). "fiveo" keeps slightly warmer
// navy surface so users who picked it still see a distinct vibe, but on the
// same obsidian board so the whole app reads cohesive.
export const VISUAL_THEMES: Record<VisualTheme, ThemeTokens> = {
  classic: {
    background: '#0a0a0a',
    surface: '#161922',         // was '#111111' — obsidian
    boardBg: '#161922',         // was '#5C1818' (maroon) — obsidian
    boardBorder: 'rgba(79,214,168,0.45)',  // was '#8B4513' (brown) — mint hairline
    textPrimary: '#f0ead6',     // was '#f0f0e8' — slightly warmer
    textSecondary: '#4FD6A8',   // was '#c9a84c' (gold) — mint
    textMuted: '#9aa19b',       // was '#666666' — cool gray
    accent: '#4FD6A8',          // was '#c9a84c' (gold) — mint
    accentText: '#0a0a0a',
    cardFace: '#FCFAF3',        // was '#FFFEF8' — cream fallback
    cardBorder: 'rgba(0,0,0,0.15)',
    cardShadow: 'rgba(79,214,168,0.30)',   // was rgba(201,168,76,0.3) — mint glow
    primaryBtn: '#4FD6A8',      // was '#c9a84c' — mint CTA
    primaryBtnText: '#0a0a0a',
    primaryBtnRadius: 12,
    winColor: '#22c55e',
    loseColor: '#ef4444',
  },
  fiveo: {
    background: '#0a0a0a',      // was '#1C0508' (dark red) — obsidian
    surface: '#1A1A2E',         // KEEP — slightly warmer navy panel
    boardBg: '#161922',         // was '#6B1520' (red) — obsidian (cohesive board)
    boardBorder: 'rgba(79,214,168,0.45)',  // was '#8B6914' (gold-brown) — mint
    textPrimary: '#ffffff',
    textSecondary: '#4FD6A8',   // was '#FFD700' (gold) — mint
    textMuted: '#bbbbbb',
    accent: '#4FD6A8',          // was '#FFD700' (gold) — mint
    accentText: '#0a0a0a',
    cardFace: '#FAFAFA',
    cardBorder: 'rgba(0,0,0,0.25)',
    cardShadow: 'rgba(0,0,0,0.6)',
    primaryBtn: '#4FD6A8',      // was '#FFD700' — mint CTA
    primaryBtnText: '#1A1A2E',
    primaryBtnRadius: 8,
    winColor: '#28A745',
    loseColor: '#CC0000',
  },
};

export function getTheme(theme: VisualTheme | null): ThemeTokens {
  return VISUAL_THEMES[theme ?? 'classic'];
}
