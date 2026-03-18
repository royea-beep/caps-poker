export type HomeThemeId = 'dark_gold' | 'navy_silver' | 'purple_neon' | 'casino_red';

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

export const HOME_THEMES: Record<HomeThemeId, HomeTheme> = {
  dark_gold: {
    bg: '#0a0a0a',
    accent: '#c9a84c',
    accentSecondary: '#8B6914',
    buttonPrimary: '#c9a84c',
    buttonPrimaryText: '#000000',
    buttonSecondaryBg: 'rgba(201,168,76,0.08)',
    buttonSecondaryBorder: '#c9a84c',
    buttonSecondaryText: '#c9a84c',
    titleColor: '#c9a84c',
    subtitleColor: 'rgba(201,168,76,0.6)',
  },
  navy_silver: {
    bg: '#0a0f1e',
    accent: '#7eb8e8',
    accentSecondary: '#4a90c4',
    buttonPrimary: '#7eb8e8',
    buttonPrimaryText: '#0a0f1e',
    buttonSecondaryBg: 'rgba(126,184,232,0.08)',
    buttonSecondaryBorder: '#7eb8e8',
    buttonSecondaryText: '#7eb8e8',
    titleColor: '#ffffff',
    subtitleColor: 'rgba(255,255,255,0.5)',
  },
  purple_neon: {
    bg: '#080010',
    accent: '#b44fff',
    accentSecondary: '#7c1fe0',
    buttonPrimary: '#b44fff',
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: 'rgba(180,79,255,0.08)',
    buttonSecondaryBorder: '#b44fff',
    buttonSecondaryText: '#b44fff',
    titleColor: '#b44fff',
    subtitleColor: 'rgba(180,79,255,0.6)',
  },
  casino_red: {
    bg: '#0a0000',
    accent: '#e8192c',
    accentSecondary: '#a00000',
    buttonPrimary: '#e8192c',
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: 'rgba(232,25,44,0.08)',
    buttonSecondaryBorder: '#e8192c',
    buttonSecondaryText: '#e8192c',
    titleColor: '#ffffff',
    subtitleColor: 'rgba(255,255,255,0.5)',
  },
};

export const HOME_THEME_NAMES: Record<HomeThemeId, string> = {
  dark_gold: 'Gold',
  navy_silver: 'Silver',
  purple_neon: 'Neon',
  casino_red: 'Red',
};

export const DEFAULT_HOME_THEME: HomeThemeId = 'dark_gold';
