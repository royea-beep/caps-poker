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
