import { computeOptimalAllocation, CoachingResult } from '../coachingEngine';
import { HandRecord } from '../handHistory';

// Minimal factory for a HandRecord
function makeHand(overrides: Partial<HandRecord> = {}): HandRecord {
  return {
    id: 'test-hand-1',
    timestamp: Date.now(),
    netChips: -25,
    potPerBoard: 25,
    numberOfPlayers: 2,
    boardCount: 2,
    isComplete: false,
    completeBonusAmount: 0,
    boards: [
      {
        boardIndex: 0,
        winner: 'bot',
        playerHandName: 'High Card',
        botHandName: 'One Pair',
        playerCards: [
          { rank: '2', suit: 'hearts' },
          { rank: '5', suit: 'clubs' },
          { rank: '9', suit: 'diamonds' },
          { rank: 'J', suit: 'spades' },
        ],
        botCards: [
          { rank: 'A', suit: 'hearts' },
          { rank: 'A', suit: 'clubs' },
          { rank: '7', suit: 'diamonds' },
          { rank: '3', suit: 'spades' },
        ],
        communityCards: [
          { rank: 'K', suit: 'hearts' },
          { rank: 'Q', suit: 'diamonds' },
          { rank: '10', suit: 'clubs' },
          { rank: '6', suit: 'spades' },
          { rank: '4', suit: 'hearts' },
        ],
      },
      {
        boardIndex: 1,
        winner: 'player',
        playerHandName: 'Flush',
        botHandName: 'High Card',
        playerCards: [
          { rank: 'A', suit: 'spades' },
          { rank: 'K', suit: 'spades' },
          { rank: 'Q', suit: 'spades' },
          { rank: 'J', suit: 'spades' },
        ],
        botCards: [
          { rank: '2', suit: 'clubs' },
          { rank: '3', suit: 'clubs' },
          { rank: '4', suit: 'clubs' },
          { rank: '5', suit: 'clubs' },
        ],
        communityCards: [
          { rank: '10', suit: 'spades' },
          { rank: '8', suit: 'hearts' },
          { rank: '7', suit: 'diamonds' },
          { rank: '6', suit: 'clubs' },
          { rank: '2', suit: 'spades' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('computeOptimalAllocation', () => {
  it('returns a CoachingResult object', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('has actualAllocations matching board count', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result.actualAllocations).toHaveLength(hand.boardCount);
  });

  it('has optimalAllocations matching board count', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result.optimalAllocations).toHaveLength(hand.boardCount);
  });

  it('optimalScore >= actualScore always', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result.optimalScore).toBeGreaterThanOrEqual(result.actualScore);
  });

  it('improvement = optimalScore - actualScore', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result.improvement).toBe(result.optimalScore - result.actualScore);
  });

  it('insights array has 1-3 items', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result.insights.length).toBeGreaterThanOrEqual(1);
    expect(result.insights.length).toBeLessThanOrEqual(3);
  });

  it('each insight is a non-empty string', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    for (const tip of result.insights) {
      expect(typeof tip).toBe('string');
      expect(tip.length).toBeGreaterThan(0);
    }
  });

  it('wasOptimal = true when improvement <= 0', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    expect(result.wasOptimal).toBe(result.improvement <= 0);
  });

  it('each actualAllocation has 4 playerCards', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    for (const alloc of result.actualAllocations) {
      expect(alloc.playerCards).toHaveLength(4);
    }
  });

  it('each optimalAllocation has 4 playerCards', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    for (const alloc of result.optimalAllocations) {
      expect(alloc.playerCards).toHaveLength(4);
    }
  });

  it('optimal cards across boards are unique (no card used twice)', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    const allIds = result.optimalAllocations.flatMap((a) => a.playerCards.map((c) => c.id));
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it('works with a winning hand (wasOptimal may be true)', () => {
    const hand = makeHand({ netChips: 50 });
    const result = computeOptimalAllocation(hand);
    expect(result).toBeDefined();
    expect(typeof result.wasOptimal).toBe('boolean');
  });

  it('handName is a non-empty string for each allocation', () => {
    const hand = makeHand();
    const result = computeOptimalAllocation(hand);
    for (const alloc of [...result.actualAllocations, ...result.optimalAllocations]) {
      expect(typeof alloc.handName).toBe('string');
      expect(alloc.handName.length).toBeGreaterThan(0);
    }
  });
});
