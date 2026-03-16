// Card Theme System — V1/V2/V3

export type CardThemeId = 'v1' | 'v2' | 'v3';

export interface CardThemeConfig {
  id: CardThemeId;
  name: string;
  label: string;
  // Face
  faceBg: string;
  faceRadius: number;
  faceBorderWidth: number;
  faceBorderColor: string;
  // Suit colors
  redSuit: string;
  blackSuit: string;
  // Face-down back
  backBg: string;
  backBorderColor: string;
  backBorderWidth: number;
  backDiamond: string;
  // Selected state
  selectedBorderColor: string;
  selectedGlowColor: string;
  selectedTranslateY: number;
}

const V1_CLASSIC: CardThemeConfig = {
  id: 'v1',
  name: 'Classic Poker',
  label: 'V1: Classic',
  // Pure white face — PokerStars style
  faceBg: '#FFFFFF',
  faceRadius: 12,
  faceBorderWidth: 1,
  faceBorderColor: 'rgba(0,0,0,0.08)',
  redSuit: '#CC2936',
  blackSuit: '#1a1a2e',
  // Navy back with gold border
  backBg: '#0f3460',
  backBorderColor: '#C9A84C',
  backBorderWidth: 2,
  backDiamond: '#C9A84C',
  // Gold selected
  selectedBorderColor: '#C9A84C',
  selectedGlowColor: '#C9A84C',
  selectedTranslateY: -6,
};

const V2_VEGAS: CardThemeConfig = {
  id: 'v2',
  name: 'Vegas Dark',
  label: 'V2: Vegas',
  // Dark face — premium night club feel
  faceBg: '#1a1a2e',
  faceRadius: 12,
  faceBorderWidth: 2,
  faceBorderColor: '#C9A84C',
  // All suits in gold on dark face
  redSuit: '#E5C56A',
  blackSuit: '#C9A84C',
  // Rich navy back with bright gold
  backBg: '#0a0a1a',
  backBorderColor: '#C9A84C',
  backBorderWidth: 2.5,
  backDiamond: '#E5C56A',
  // Purple selected glow
  selectedBorderColor: '#9B59B6',
  selectedGlowColor: '#9B59B6',
  selectedTranslateY: -6,
};

const V3_MODERN: CardThemeConfig = {
  id: 'v3',
  name: 'Clean Modern',
  label: 'V3: Modern',
  // Pure white, no border — shadow only
  faceBg: '#FFFFFF',
  faceRadius: 16,
  faceBorderWidth: 0,
  faceBorderColor: 'transparent',
  redSuit: '#E74C3C',
  blackSuit: '#2C3E50',
  // Deep purple back
  backBg: '#4A0E8F',
  backBorderColor: '#7B2FBE',
  backBorderWidth: 2,
  backDiamond: '#C39BD3',
  // Blue selected
  selectedBorderColor: '#3498DB',
  selectedGlowColor: '#3498DB',
  selectedTranslateY: -4,
};

export const CARD_THEMES: Record<CardThemeId, CardThemeConfig> = {
  v1: V1_CLASSIC,
  v2: V2_VEGAS,
  v3: V3_MODERN,
};

export const DEFAULT_CARD_THEME: CardThemeId = 'v1';
