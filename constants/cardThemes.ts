// RESERVED — this is the card-face mechanism. Its Settings picker was removed in BATCH-B (the five
// look-pickers were unified into Visual Style), but the mechanism (CardThemeId, CARD_THEMES,
// DEFAULT_CARD_THEME + the store's cardTheme field) MUST stay: the upcoming CARD-FACE batch revives
// this as its toggle, and simulate.tsx still reads it. Do NOT remove as "unused".
import { activePaint } from './paintThemes';

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

// S75 (theme plumbing) — the 27 paint VALUES (3 themes x 9 keys) moved verbatim to the
// paint layer (constants/paintThemes.ts -> currentPaint.card); each config now spreads
// the active paint and keeps its own GEOMETRY inline. faceRadius / faceBorderWidth /
// backBorderWidth / selectedTranslateY are dimensions, NOT paint, so they stay here
// untouched and identical across themes (S75 R-B / R-C). id/name/label are metadata.
const V1_CLASSIC: CardThemeConfig = {
  id: 'v1',
  name: 'Classic Poker',
  label: 'V1: Classic',
  ...activePaint.card.v1,
  // GEOMETRY — unchanged
  faceRadius: 8,
  faceBorderWidth: 1,
  backBorderWidth: 2,
  selectedTranslateY: -8,
};

const V2_VEGAS: CardThemeConfig = {
  id: 'v2',
  name: 'Vegas Dark',
  label: 'V2: Vegas',
  ...activePaint.card.v2,
  // GEOMETRY — unchanged
  faceRadius: 12,
  faceBorderWidth: 2,
  backBorderWidth: 2.5,
  selectedTranslateY: -6,
};

const V3_MODERN: CardThemeConfig = {
  id: 'v3',
  name: 'Clean Modern',
  label: 'V3: Modern',
  ...activePaint.card.v3,
  // GEOMETRY — unchanged
  faceRadius: 16,
  faceBorderWidth: 0,
  backBorderWidth: 2,
  selectedTranslateY: -4,
};

export const CARD_THEMES: Record<CardThemeId, CardThemeConfig> = {
  v1: V1_CLASSIC,
  v2: V2_VEGAS,
  v3: V3_MODERN,
};

export const DEFAULT_CARD_THEME: CardThemeId = 'v1';
