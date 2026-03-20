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
    background: '#2D0A0E',      // near-black red — dimly lit casino atmosphere
    surface: '#1A1A2E',         // dark navy — panels, modals, overlays
    boardBg: '#5C1018',         // dark casino red felt — board surface
    boardBorder: '#3D2415',     // dark wood brown — subtle table rail
    textPrimary: '#ffffff',
    textSecondary: '#FFD700',
    textMuted: '#aaaaaa',
    accent: '#FFD700',
    accentText: '#000000',
    cardFace: '#F5F5F5',
    cardBorder: 'rgba(0,0,0,0.18)',
    cardShadow: 'rgba(0,0,0,0.55)',
    primaryBtn: '#FFD700',
    primaryBtnText: '#1A1A2E',
    primaryBtnRadius: 8,
    winColor: '#28A745',        // green badge — Match Five-O WIN style
    loseColor: '#CC0000',
  },
};

export function getTheme(theme: VisualTheme | null): ThemeTokens {
  return VISUAL_THEMES[theme ?? 'classic'];
}
