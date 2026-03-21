import { THEME } from './theme';

export const DEFAULT_CONFIG = {
  arrangementTime: 60,
  boardRevealDuration: 5,
  turnRevealDelay: 800,
  completeBonusDisplay: 3,
  startingChips: 1000,
  potPerBoard: 25,
  completeBonusPercent: 50,
  numberOfPlayers: 2,
  botSpeedMin: 1500,
  botSpeedMax: 4000,
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

/** Board count depends on player count (52-card deck constraint) */
export function getBoardCount(numberOfPlayers: number): number {
  if (numberOfPlayers === 3) return 3;
  if (numberOfPlayers === 4) return 2;
  return 4;
}

/** Cards per player depends on player count */
export function getCardsPerPlayer(numberOfPlayers: number): number {
  if (numberOfPlayers === 3) return 12;
  if (numberOfPlayers === 4) return 8;
  return 16;
}

/** Unique board accent colors — gives each board visual identity */
export const BOARD_COLORS = [
  '#FFD700', // Board 1 — gold
  '#4FC3F7', // Board 2 — blue
  '#81C784', // Board 3 — green
  '#FF8A65', // Board 4 — orange
] as const;

/** Card sizing based on player count (more players = fewer boards = bigger cards) */
export const CARD_SCALE: Record<number, { cardHeight: number; communityScale: number }> = {
  2: { cardHeight: 60, communityScale: 1.15 },  // 4 boards — tightest, needs biggest relative boost
  3: { cardHeight: 66, communityScale: 1.1  },  // 3 boards
  4: { cardHeight: 74, communityScale: 1.1  },  // 2 boards — most space
};

// Re-export for backward compatibility
export const COLORS = THEME.colors;
