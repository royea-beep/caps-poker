import { getHandHint } from '../handHint';
import { Card } from '../../constants/gameConfig';

function makeCard(rank: string, suit: string): Card {
  return { rank: rank as Card['rank'], suit: suit as Card['suit'], id: `${rank}_${suit}` };
}

describe('getHandHint', () => {
  it('returns "High Card" for 4 unrelated cards', () => {
    const cards = [
      makeCard('2', 'hearts'),
      makeCard('7', 'diamonds'),
      makeCard('J', 'clubs'),
      makeCard('A', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('High Card');
  });

  it('returns "Pair" for one pair', () => {
    const cards = [
      makeCard('K', 'hearts'),
      makeCard('K', 'diamonds'),
      makeCard('5', 'clubs'),
      makeCard('9', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('Pair');
  });

  it('returns "Two Pair" for two pairs', () => {
    const cards = [
      makeCard('8', 'hearts'),
      makeCard('8', 'diamonds'),
      makeCard('Q', 'clubs'),
      makeCard('Q', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('Two Pair');
  });

  it('returns "Trips" for three of a kind', () => {
    const cards = [
      makeCard('6', 'hearts'),
      makeCard('6', 'diamonds'),
      makeCard('6', 'clubs'),
      makeCard('A', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('Trips');
  });

  it('returns "Flush Draw" for 3+ cards of same suit', () => {
    const cards = [
      makeCard('2', 'hearts'),
      makeCard('7', 'hearts'),
      makeCard('J', 'hearts'),
      makeCard('A', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('Flush Draw');
  });

  it('returns "Straight Draw" for 3+ consecutive-ish cards', () => {
    const cards = [
      makeCard('5', 'hearts'),
      makeCard('6', 'diamonds'),
      makeCard('7', 'clubs'),
      makeCard('A', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('Straight Draw');
  });

  it('returns "Str+Flush Draw" for both flush and straight draws', () => {
    const cards = [
      makeCard('5', 'hearts'),
      makeCard('6', 'hearts'),
      makeCard('7', 'hearts'),
      makeCard('A', 'spades'),
    ];
    expect(getHandHint(cards)).toBe('Str+Flush Draw');
  });
});
