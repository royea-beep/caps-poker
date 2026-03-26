import { placeBotCardsWithStrategy, BotDifficulty } from '../botStrategy';
import { Card } from '../../constants/gameConfig';

function makeCard(rank: string, suit: string, idx: number): Card {
  return { rank: rank as Card['rank'], suit: suit as Card['suit'], id: `${rank}${suit}${idx}` };
}

const SPADES_HAND: Card[] = [
  makeCard('A', 'spades', 1),
  makeCard('K', 'spades', 2),
  makeCard('Q', 'spades', 3),
  makeCard('J', 'spades', 4),
  makeCard('2', 'hearts', 5),
  makeCard('3', 'hearts', 6),
  makeCard('4', 'diamonds', 7),
  makeCard('5', 'clubs', 8),
];

const PAIR_HAND: Card[] = [
  makeCard('A', 'spades', 1),
  makeCard('A', 'hearts', 2),
  makeCard('K', 'spades', 3),
  makeCard('Q', 'hearts', 4),
  makeCard('2', 'clubs', 5),
  makeCard('3', 'diamonds', 6),
  makeCard('4', 'spades', 7),
  makeCard('5', 'hearts', 8),
];

const TWO_BOARDS = [
  { openCards: [makeCard('A', 'spades', 10), makeCard('7', 'spades', 11), makeCard('2', 'spades', 12)] },
  { openCards: [makeCard('K', 'diamonds', 13), makeCard('Q', 'clubs', 14), makeCard('J', 'hearts', 15)] },
];

describe('placeBotCardsWithStrategy', () => {
  describe('easy (random)', () => {
    it('distributes all cards across boards', () => {
      const result = placeBotCardsWithStrategy(SPADES_HAND, TWO_BOARDS, 'easy');
      expect(result).toHaveLength(2);
      const totalCards = result.reduce((s, b) => s + b.length, 0);
      expect(totalCards).toBe(8);
    });

    it('returns 4 cards per board', () => {
      const result = placeBotCardsWithStrategy(SPADES_HAND, TWO_BOARDS, 'easy');
      result.forEach((b) => expect(b).toHaveLength(4));
    });
  });

  describe('medium (suit grouping)', () => {
    it('groups suited cards on boards with matching flop suit', () => {
      const result = placeBotCardsWithStrategy(SPADES_HAND, TWO_BOARDS, 'medium');
      expect(result).toHaveLength(2);
      // Board 0 has 3 spades in flop — spade-heavy hand should prefer board 0
      const board0SpadeCount = result[0].filter(c => c.suit === 'spades').length;
      expect(board0SpadeCount).toBeGreaterThanOrEqual(2);
    });

    it('distributes all cards', () => {
      const result = placeBotCardsWithStrategy(SPADES_HAND, TWO_BOARDS, 'medium');
      const totalCards = result.reduce((s, b) => s + b.length, 0);
      expect(totalCards).toBe(8);
    });
  });

  describe('hard (pair + suit + position)', () => {
    it('keeps pairs together on same board', () => {
      const result = placeBotCardsWithStrategy(PAIR_HAND, TWO_BOARDS, 'hard');
      const allBoards = result.flat();
      const hasAceSpades = (cards: Card[]) => cards.some(c => c.rank === 'A' && c.suit === 'spades');
      const hasAceHearts = (cards: Card[]) => cards.some(c => c.rank === 'A' && c.suit === 'hearts');
      // Both aces should be on the same board
      const acesOnSameBoard = result.some(b => hasAceSpades(b) && hasAceHearts(b));
      expect(acesOnSameBoard).toBe(true);
      expect(allBoards).toHaveLength(8);
    });

    it('distributes all cards', () => {
      const result = placeBotCardsWithStrategy(PAIR_HAND, TWO_BOARDS, 'hard');
      const totalCards = result.reduce((s, b) => s + b.length, 0);
      expect(totalCards).toBe(8);
    });
  });

  describe('card size constants', () => {
    it('community > boardSlot > hand', () => {
      const { CARD_SIZES } = require('../../constants/cardSizes');
      expect(CARD_SIZES.community.width).toBeGreaterThan(CARD_SIZES.boardSlot.width);
      expect(CARD_SIZES.boardSlot.width).toBeGreaterThan(CARD_SIZES.hand.width);
      expect(CARD_SIZES.community.height).toBeGreaterThan(CARD_SIZES.boardSlot.height);
      expect(CARD_SIZES.boardSlot.height).toBeGreaterThan(CARD_SIZES.hand.height);
    });

    it('all required size fields are defined', () => {
      const { CARD_SIZES } = require('../../constants/cardSizes');
      const keys: Array<keyof typeof CARD_SIZES> = ['community', 'boardSlot', 'hand', 'results'];
      for (const key of keys) {
        expect(CARD_SIZES[key].width).toBeGreaterThan(0);
        expect(CARD_SIZES[key].height).toBeGreaterThan(0);
        expect(CARD_SIZES[key].fontSize).toBeGreaterThan(0);
      }
    });
  });

  describe('fallback safety', () => {
    it('never throws for any difficulty', () => {
      const difficulties: BotDifficulty[] = ['easy', 'medium', 'hard'];
      for (const d of difficulties) {
        expect(() => placeBotCardsWithStrategy(SPADES_HAND, TWO_BOARDS, d)).not.toThrow();
      }
    });
  });
});
