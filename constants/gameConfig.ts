export const DEFAULT_CONFIG = {
  arrangementTime: 60,
  boardRevealDuration: 5,
  completeBonusDisplay: 2,
  startingChips: 1000,
  potPerBoard: 25,
  completeBonusPercent: 50,
  botSpeedMin: 5000,
  botSpeedMax: 30000,
};

export type GameConfig = typeof DEFAULT_CONFIG;

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export const NUM_BOARDS = 4;
export const CARDS_PER_BOARD = 4;
export const BOARD_COMMUNITY_CARDS = 5;
export const BOARD_OPEN_CARDS = 3;
export const BOARD_CLOSED_CARDS = 2;
export const PLAYER_HAND_SIZE = 16;

export const COLORS = {
  background: '#0a1a0f',
  felt: '#0d2818',
  feltLight: '#143d24',
  gold: '#d4a843',
  goldBright: '#f0c75e',
  goldDim: '#8a6d2b',
  cardWhite: '#f5f0e8',
  cardBack: '#1a3a2a',
  cardBackPattern: '#245035',
  red: '#c0392b',
  black: '#1a1a1a',
  white: '#ffffff',
  textPrimary: '#e8e0d0',
  textSecondary: '#8a9a8a',
  chipGreen: '#27ae60',
  chipRed: '#e74c3c',
  boardBorder: '#2a5a3a',
  boardActive: '#d4a843',
  overlay: 'rgba(0, 0, 0, 0.7)',
  success: '#2ecc71',
  danger: '#e74c3c',
};
