import { THEME } from './theme';

export const DEFAULT_CONFIG = {
  arrangementTime: 60,
  boardRevealDuration: 5,
  turnRevealDelay: 800,
  completeBonusDisplay: 2,
  startingChips: 1000,
  potPerBoard: 25,
  completeBonusPercent: 50,
  numberOfPlayers: 2,
  botSpeedMin: 5000,
  botSpeedMax: 30000,
  soundEnabled: true as boolean,
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

// Re-export for backward compatibility
export const COLORS = THEME.colors;
