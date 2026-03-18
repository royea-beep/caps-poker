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
  emerald: {
    bg: '#001a0d',
    accent: '#00c875',
    accentSecondary: '#007a47',
    buttonPrimary: '#00c875',
    buttonPrimaryText: '#000000',
    buttonSecondaryBg: 'rgba(0,200,117,0.08)',
    buttonSecondaryBorder: '#00c875',
    buttonSecondaryText: '#00c875',
    titleColor: '#00c875',
    subtitleColor: 'rgba(0,200,117,0.6)',
  },
  rose_gold: {
    bg: '#120008',
    accent: '#e8a0b4',
    accentSecondary: '#b4627a',
    buttonPrimary: '#e8a0b4',
    buttonPrimaryText: '#120008',
    buttonSecondaryBg: 'rgba(232,160,180,0.08)',
    buttonSecondaryBorder: '#e8a0b4',
    buttonSecondaryText: '#e8a0b4',
    titleColor: '#e8a0b4',
    subtitleColor: 'rgba(232,160,180,0.6)',
  },
  ocean: {
    bg: '#000d1a',
    accent: '#00d4ff',
    accentSecondary: '#0088cc',
    buttonPrimary: '#00d4ff',
    buttonPrimaryText: '#000d1a',
    buttonSecondaryBg: 'rgba(0,212,255,0.08)',
    buttonSecondaryBorder: '#00d4ff',
    buttonSecondaryText: '#00d4ff',
    titleColor: '#00d4ff',
    subtitleColor: 'rgba(0,212,255,0.6)',
  },
  sunset: {
    bg: '#0a0500',
    accent: '#ff6b35',
    accentSecondary: '#cc3d00',
    buttonPrimary: '#ff6b35',
    buttonPrimaryText: '#000000',
    buttonSecondaryBg: 'rgba(255,107,53,0.08)',
    buttonSecondaryBorder: '#ff6b35',
    buttonSecondaryText: '#ff6b35',
    titleColor: '#ff6b35',
    subtitleColor: 'rgba(255,107,53,0.6)',
  },
  arctic: {
    bg: '#0a0f14',
    accent: '#e8f4f8',
    accentSecondary: '#a8c8d8',
    buttonPrimary: '#e8f4f8',
    buttonPrimaryText: '#0a0f14',
    buttonSecondaryBg: 'rgba(232,244,248,0.08)',
    buttonSecondaryBorder: '#e8f4f8',
    buttonSecondaryText: '#e8f4f8',
    titleColor: '#e8f4f8',
    subtitleColor: 'rgba(232,244,248,0.6)',
  },
  matrix: {
    bg: '#000a00',
    accent: '#00ff41',
    accentSecondary: '#007a1e',
    buttonPrimary: '#00ff41',
    buttonPrimaryText: '#000a00',
    buttonSecondaryBg: 'rgba(0,255,65,0.08)',
    buttonSecondaryBorder: '#00ff41',
    buttonSecondaryText: '#00ff41',
    titleColor: '#00ff41',
    subtitleColor: 'rgba(0,255,65,0.6)',
  },
};

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
