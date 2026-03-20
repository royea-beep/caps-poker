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

export const VISUAL_THEMES: Record<VisualTheme, ThemeTokens> = {
  classic: {
    background: '#0a0a0a',
    surface: '#111111',
    boardBg: '#1a0800',
    boardBorder: '#3d2010',
    textPrimary: '#f0f0e8',
    textSecondary: '#c9a84c',
    textMuted: '#666666',
    accent: '#c9a84c',
    accentText: '#0a0a0a',
    cardFace: '#ffffff',
    cardBorder: 'rgba(0,0,0,0.15)',
    cardShadow: 'rgba(201,168,76,0.3)',
    primaryBtn: '#c9a84c',
    primaryBtnText: '#0a0a0a',
    primaryBtnRadius: 12,
    winColor: '#22c55e',
    loseColor: '#ef4444',
  },
  fiveo: {
    background: '#1a1a2e',
    surface: '#16213e',
    boardBg: '#5c0000',
    boardBorder: '#8B0000',
    textPrimary: '#ffffff',
    textSecondary: '#FFD700',
    textMuted: '#aaaaaa',
    accent: '#FFD700',
    accentText: '#000000',
    cardFace: '#f8f8f8',
    cardBorder: '#cccccc',
    cardShadow: 'rgba(0,0,0,0.5)',
    primaryBtn: '#FFD700',
    primaryBtnText: '#000000',
    primaryBtnRadius: 8,
    winColor: '#00cc44',
    loseColor: '#cc0000',
  },
};

export function getTheme(theme: VisualTheme | null): ThemeTokens {
  return VISUAL_THEMES[theme ?? 'classic'];
}
