import { getHandName, getComparisonText, getSpecificHandName } from '../handNames';
import { Card } from '../../constants/gameConfig';

const c = (rank: string, suit: 'hearts' | 'diamonds' | 'clubs' | 'spades', id = ''): Card =>
  ({ rank: rank as any, suit, id: id || `${rank}-${suit}` });

describe('getHandName', () => {
  it('returns English name unchanged', () => {
    expect(getHandName('Three of a Kind')).toBe('Three of a Kind');
    expect(getHandName('One Pair')).toBe('One Pair');
    expect(getHandName('Royal Flush')).toBe('Royal Flush');
  });

  it('ignores lang parameter (English-only after VAMOS-HAND-LABELS-ENGLISH)', () => {
    expect(getHandName('One Pair', 'he')).toBe('One Pair');
    expect(getHandName('Three of a Kind', 'he')).toBe('Three of a Kind');
  });

  it('falls back to original name for unknown hand', () => {
    expect(getHandName('Unknown Hand')).toBe('Unknown Hand');
  });
});

describe('getComparisonText', () => {
  it('generates English win comparison', () => {
    expect(getComparisonText('Three of a Kind', 'One Pair', 'player'))
      .toBe('Three of a Kind beats One Pair');
  });

  it('generates English loss comparison', () => {
    expect(getComparisonText('One Pair', 'Flush', 'bot'))
      .toBe('Flush beats One Pair');
  });

  it('generates tie text', () => {
    expect(getComparisonText('Two Pair', 'Two Pair', 'tie'))
      .toBe('Tie — Two Pair');
  });

  it('uses specific labels when bestCards are provided', () => {
    const playerBest = [c('K', 'hearts'), c('K', 'spades'), c('5', 'diamonds'), c('9', 'clubs'), c('2', 'hearts')];
    const botBest = [c('7', 'hearts'), c('7', 'spades'), c('A', 'diamonds'), c('J', 'clubs'), c('3', 'hearts')];
    expect(getComparisonText('One Pair', 'One Pair', 'player', 'en', playerBest, botBest))
      .toBe('Pair of Kings beats Pair of Sevens');
  });
});

describe('getSpecificHandName', () => {
  it('falls back to plain name when bestCards is missing', () => {
    expect(getSpecificHandName('One Pair')).toBe('One Pair');
    expect(getSpecificHandName('Flush', null)).toBe('Flush');
    expect(getSpecificHandName('Straight', [])).toBe('Straight');
  });

  it('labels Pair with the pair rank', () => {
    const cards = [c('K', 'hearts'), c('K', 'spades'), c('9', 'clubs'), c('5', 'diamonds'), c('2', 'hearts')];
    expect(getSpecificHandName('One Pair', cards)).toBe('Pair of Kings');
  });

  it('labels Two Pair with both ranks, higher first', () => {
    const cards = [c('A', 'hearts'), c('A', 'spades'), c('8', 'clubs'), c('8', 'diamonds'), c('3', 'hearts')];
    expect(getSpecificHandName('Two Pair', cards)).toBe('Two Pair, Aces and Eights');
  });

  it('labels Three of a Kind with the trip rank', () => {
    const cards = [c('K', 'hearts'), c('K', 'spades'), c('K', 'clubs'), c('9', 'diamonds'), c('2', 'hearts')];
    expect(getSpecificHandName('Three of a Kind', cards)).toBe('Three of a Kind, Kings');
  });

  it('labels Straight with the high card', () => {
    const cards = [c('K', 'hearts'), c('Q', 'spades'), c('J', 'clubs'), c('10', 'diamonds'), c('9', 'hearts')];
    expect(getSpecificHandName('Straight', cards)).toBe('King-High Straight');
  });

  it('labels Flush with the high card', () => {
    const cards = [c('A', 'hearts'), c('J', 'hearts'), c('9', 'hearts'), c('5', 'hearts'), c('2', 'hearts')];
    expect(getSpecificHandName('Flush', cards)).toBe('Ace-High Flush');
  });

  it('labels Full House with trips over pair', () => {
    const cards = [c('K', 'hearts'), c('K', 'spades'), c('K', 'clubs'), c('7', 'diamonds'), c('7', 'hearts')];
    expect(getSpecificHandName('Full House', cards)).toBe('Full House, Kings over Sevens');
  });

  it('labels Four of a Kind with the quad rank', () => {
    const cards = [c('Q', 'hearts'), c('Q', 'spades'), c('Q', 'clubs'), c('Q', 'diamonds'), c('A', 'hearts')];
    expect(getSpecificHandName('Four of a Kind', cards)).toBe('Four of a Kind, Queens');
  });

  it('labels Straight Flush with the high card', () => {
    const cards = [c('9', 'spades'), c('8', 'spades'), c('7', 'spades'), c('6', 'spades'), c('5', 'spades')];
    expect(getSpecificHandName('Straight Flush', cards)).toBe('Nine-High Straight Flush');
  });

  it('labels Royal Flush plainly', () => {
    const cards = [c('A', 'hearts'), c('K', 'hearts'), c('Q', 'hearts'), c('J', 'hearts'), c('10', 'hearts')];
    expect(getSpecificHandName('Royal Flush', cards)).toBe('Royal Flush');
  });

  it('labels High Card with the high rank', () => {
    const cards = [c('A', 'hearts'), c('J', 'spades'), c('9', 'clubs'), c('5', 'diamonds'), c('2', 'hearts')];
    expect(getSpecificHandName('High Card', cards)).toBe('Ace High');
  });
});
