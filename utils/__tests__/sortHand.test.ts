import { sortHandCAPS, sortHandUser, sortHand } from '../sortHand';
import { Card } from '../../constants/gameConfig';

function c(rank: string, suit: string, id?: string): Card {
  return { rank: rank as Card['rank'], suit: suit as Card['suit'], id: id ?? `${rank}${suit}` };
}

// AAKQQJJJ76554442 — use cards: A♠A♥K♠Q♠Q♣J♠J♥J♦7♠6♠5♠5♥4♠4♣2♣
const hand: Card[] = [
  c('A','spades'), c('A','hearts'), c('K','spades'),
  c('Q','spades'), c('Q','clubs'), c('J','spades'), c('J','hearts'), c('J','diamonds'),
  c('7','spades'), c('6','spades'), c('5','spades'), c('5','hearts'),
  c('4','spades'), c('4','clubs'), c('2','clubs'),
];

describe('sortHandCAPS (Method A)', () => {
  const sorted = sortHandCAPS(hand);

  test('trips before pairs before singletons', () => {
    const ranks = sorted.map(c => c.rank);
    // J appears 3x (trips), A/Q/5/4 appear 2x (pairs), K/7/6/2 are singletons
    expect(ranks[0]).toBe('J'); // trips first
    expect(ranks[1]).toBe('J');
    expect(ranks[2]).toBe('J');
    // pairs next
    const pairRanks = ranks.slice(3, 11);
    for (const r of pairRanks) expect(['A','Q','5','4']).toContain(r);
    // singletons last
    const singRanks = ranks.slice(11);
    for (const r of singRanks) expect(['K','7','6','2']).toContain(r);
  });

  test('rank ascending within pairs', () => {
    // pairs: 4,4,5,5,A,A,Q,Q — sorted by rank ASC within pair group
    const sorted2 = sortHandCAPS([c('Q','spades'), c('Q','clubs'), c('4','spades'), c('4','clubs')]);
    expect(sorted2[0].rank).toBe('4');
    expect(sorted2[2].rank).toBe('Q');
  });

  test('singletons clustered by suit then rank ASC', () => {
    const singles = sortHandCAPS([c('7','spades'), c('6','spades'), c('2','clubs'), c('K','spades')]);
    // spades first (suit val 0), clubs last (suit val 3)
    expect(singles[0].suit).toBe('spades');
    expect(singles[1].suit).toBe('spades');
    expect(singles[2].suit).toBe('spades');
    expect(singles[3].suit).toBe('clubs');
    // within spades: rank ASC: 6,7,K
    expect(singles[0].rank).toBe('6');
    expect(singles[1].rank).toBe('7');
    expect(singles[2].rank).toBe('K');
  });

  test('empty array returns empty', () => {
    expect(sortHandCAPS([])).toEqual([]);
  });
});

describe('sortHandUser (Method B)', () => {
  test('all duplicates before singletons', () => {
    const sorted = sortHandUser(hand);
    // First section: all cards with count > 1
    const counts: Record<string, number> = {};
    hand.forEach(card => { counts[card.rank] = (counts[card.rank] ?? 0) + 1; });
    let inDupes = true;
    for (const card of sorted) {
      if (inDupes && counts[card.rank] === 1) inDupes = false;
      if (!inDupes) expect(counts[card.rank]).toBe(1);
    }
  });

  test('no distinction between trips and pairs', () => {
    // trips (J) and pairs (A) should both appear before singletons
    const sorted = sortHandUser(hand);
    const singletonsStart = sorted.findIndex(c => {
      const cnt: Record<string, number> = {};
      hand.forEach(x => { cnt[x.rank] = (cnt[x.rank] ?? 0) + 1; });
      return cnt[c.rank] === 1;
    });
    const ranks = sorted.slice(0, singletonsStart).map(c => c.rank);
    expect(ranks).toContain('J'); // trips in dupes section
    expect(ranks).toContain('A'); // pairs in dupes section
  });

  test('empty array returns empty', () => {
    expect(sortHandUser([])).toEqual([]);
  });
});

describe('sortHand dispatch', () => {
  test('defaults to caps method', () => {
    const a = sortHand(hand);
    const b = sortHandCAPS(hand);
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });

  test('routes to user method', () => {
    const a = sortHand(hand, 'user');
    const b = sortHandUser(hand);
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });
});
