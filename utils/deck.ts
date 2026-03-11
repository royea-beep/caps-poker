import { Card, SUITS, RANKS } from '../constants/gameConfig';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}_${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface DealResult {
  playerHand: Card[];
  botHand: Card[];
  boards: { openCards: Card[]; closedCards: Card[] }[];
}

export interface MultiDealResult {
  playerHands: Card[][]; // one hand per player
  boards: { openCards: Card[]; closedCards: Card[] }[];
  discarded: Card[];
}

/**
 * Deal cards for N players:
 * - 2 players: 16 cards each, 4 boards (52 cards total, 0 discarded)
 * - 3 players: 12 cards each, 3 boards (51 used, 1 discarded)
 * - 4 players: 8 cards each, 2 boards (42 used, 10 discarded)
 */
export function dealCardsMultiplayer(playerCount: 2 | 3 | 4): MultiDealResult {
  const cardsPerPlayer = playerCount === 2 ? 16 : playerCount === 3 ? 12 : 8;
  const boardCount = playerCount === 2 ? 4 : playerCount === 3 ? 3 : 2;

  const deck = shuffleDeck(createDeck());
  let idx = 0;

  const playerHands: Card[][] = [];
  for (let p = 0; p < playerCount; p++) {
    playerHands.push(deck.slice(idx, idx + cardsPerPlayer));
    idx += cardsPerPlayer;
  }

  const boards: { openCards: Card[]; closedCards: Card[] }[] = [];
  for (let b = 0; b < boardCount; b++) {
    const openCards = deck.slice(idx, idx + 3);
    idx += 3;
    const closedCards = deck.slice(idx, idx + 2);
    idx += 2;
    boards.push({ openCards, closedCards });
  }

  const discarded = deck.slice(idx);
  return { playerHands, boards, discarded };
}

export function dealCards(): DealResult {
  const deck = shuffleDeck(createDeck());
  let idx = 0;

  const playerHand = deck.slice(idx, idx + 16);
  idx += 16;

  const botHand = deck.slice(idx, idx + 16);
  idx += 16;

  const boards: { openCards: Card[]; closedCards: Card[] }[] = [];
  for (let i = 0; i < 4; i++) {
    const openCards = deck.slice(idx, idx + 3);
    idx += 3;
    const closedCards = deck.slice(idx, idx + 2);
    idx += 2;
    boards.push({ openCards, closedCards });
  }

  return { playerHand, botHand, boards };
}
