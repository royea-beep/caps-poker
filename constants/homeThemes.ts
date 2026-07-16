import { activePaint } from './paintThemes';

export type ButtonStyle = 'solid' | 'glass' | 'outline';

export type HomeThemeId =
  | 'dark_gold'
  | 'navy_silver'
  | 'purple_neon'
  | 'casino_red'
  | 'emerald'
  | 'rose_gold'
  | 'ocean'
  | 'sunset'
  | 'arctic'
  | 'matrix';

export interface HomeTheme {
  bg: string;
  accent: string;
  accentSecondary: string;
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  titleColor: string;
  subtitleColor: string;
}

// S75 (theme plumbing) — the 100 paint VALUES (10 themes x 10 keys) moved verbatim
// to the paint layer (constants/paintThemes.ts -> currentPaint.home) and this export
// now RESOLVES from the active paint. Name, shape and values are unchanged, so every
// HOME_THEMES consumer renders identically. This palette is 100% paint (no geometry).
export const HOME_THEMES: Record<HomeThemeId, HomeTheme> = activePaint.home;

export const HOME_THEME_NAMES: Record<HomeThemeId, string> = {
  dark_gold: 'Gold',
  navy_silver: 'Silver',
  purple_neon: 'Neon',
  casino_red: 'Red',
  emerald: 'Emerald',
  rose_gold: 'Rose',
  ocean: 'Ocean',
  sunset: 'Sunset',
  arctic: 'Arctic',
  matrix: 'Matrix',
};

export const DEFAULT_HOME_THEME: HomeThemeId = 'dark_gold';
