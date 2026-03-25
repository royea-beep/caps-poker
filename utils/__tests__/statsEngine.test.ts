import { computeStats, HAND_RANK_ORDER } from '../statsEngine';
import { HandRecord } from '../handHistory';

function makeHand(overrides: Partial<HandRecord> = {}): HandRecord {
  return {
    id: Math.random().toString(),
    timestamp: Date.now(),
    boards: [
      {
        boardIndex: 0,
        winner: 'player',
        playerHandName: 'One Pair',
        botHandName: 'High Card',
        playerCards: [],
        botCards: [],
        communityCards: [],
      },
    ],
    netChips: 100,
    potPerBoard: 100,
    numberOfPlayers: 2,
    boardCount: 1,
    isComplete: false,
    completeBonusAmount: 0,
    ...overrides,
  };
}

describe('computeStats', () => {
  it('returns zeroed stats for empty history', () => {
    const s = computeStats([]);
    expect(s.handsPlayed).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.netChipsAllTime).toBe(0);
    expect(s.bestHandEver).toBe('—');
    expect(s.cumulativeBalance).toHaveLength(0);
  });

  it('counts a single win correctly', () => {
    const s = computeStats([makeHand({ netChips: 200 })]);
    expect(s.handsPlayed).toBe(1);
    expect(s.handsWon).toBe(1);
    expect(s.handsLost).toBe(0);
    expect(s.winRate).toBe(100);
    expect(s.netChipsAllTime).toBe(200);
    expect(s.biggestWin).toBe(200);
  });

  it('counts a single loss correctly', () => {
    const s = computeStats([makeHand({ netChips: -150 })]);
    expect(s.handsLost).toBe(1);
    expect(s.handsWon).toBe(0);
    expect(s.biggestLoss).toBe(150);
    expect(s.netChipsAllTime).toBe(-150);
  });

  it('counts ties correctly', () => {
    const s = computeStats([makeHand({ netChips: 0 })]);
    expect(s.handsTied).toBe(1);
    expect(s.handsWon).toBe(0);
    expect(s.handsLost).toBe(0);
  });

  it('computes win rate across multiple hands', () => {
    const hands = [
      makeHand({ netChips: 100 }),
      makeHand({ netChips: -50 }),
      makeHand({ netChips: 200 }),
      makeHand({ netChips: -30 }),
    ];
    const s = computeStats(hands);
    expect(s.handsPlayed).toBe(4);
    expect(s.handsWon).toBe(2);
    expect(s.winRate).toBe(50);
  });

  it('builds win streak from oldest-first ordering', () => {
    // hands[] is newest-first, so reverse = [50, 60, 70] oldest→newest = 3 wins
    const hands = [
      makeHand({ netChips: 70 }),
      makeHand({ netChips: 60 }),
      makeHand({ netChips: 50 }),
    ];
    const s = computeStats(hands);
    expect(s.currentWinStreak).toBe(3);
    expect(s.bestWinStreak).toBe(3);
    expect(s.currentLoseStreak).toBe(0);
  });

  it('resets win streak on a loss', () => {
    // newest-first: [-50, 100, 100] → oldest-first: [100, 100, -50]
    const hands = [
      makeHand({ netChips: -50 }),
      makeHand({ netChips: 100 }),
      makeHand({ netChips: 100 }),
    ];
    const s = computeStats(hands);
    expect(s.currentLoseStreak).toBe(1);
    expect(s.currentWinStreak).toBe(0);
    expect(s.bestWinStreak).toBe(2);
  });

  it('computes completeRate correctly', () => {
    const hands = [
      makeHand({ isComplete: true }),
      makeHand({ isComplete: true }),
      makeHand({ isComplete: false }),
      makeHand({ isComplete: false }),
    ];
    const s = computeStats(hands);
    expect(s.completeCount).toBe(2);
    expect(s.completeRate).toBe(50);
  });

  it('tracks hand frequency and bestHandEver', () => {
    const hands = [
      makeHand({ boards: [{ boardIndex: 0, winner: 'player', playerHandName: 'Flush', botHandName: 'One Pair', playerCards: [], botCards: [], communityCards: [] }] }),
      makeHand({ boards: [{ boardIndex: 0, winner: 'bot', playerHandName: 'One Pair', botHandName: 'Two Pair', playerCards: [], botCards: [], communityCards: [] }] }),
      makeHand({ boards: [{ boardIndex: 0, winner: 'player', playerHandName: 'Full House', botHandName: 'Flush', playerCards: [], botCards: [], communityCards: [] }] }),
    ];
    const s = computeStats(hands);
    expect(s.handFrequency['Flush']).toBe(1);
    expect(s.handFrequency['One Pair']).toBe(1);
    expect(s.handFrequency['Full House']).toBe(1);
    expect(s.bestHandEver).toBe('Full House');
    expect(HAND_RANK_ORDER.indexOf('Full House')).toBeGreaterThan(HAND_RANK_ORDER.indexOf('Flush'));
  });

  it('computes cumulative balance (oldest→newest) and trims to 20', () => {
    const hands = Array.from({ length: 25 }, (_, i) => makeHand({ netChips: 10 }));
    const s = computeStats(hands);
    expect(s.cumulativeBalance).toHaveLength(20);
    // All wins of 10 each — last 20 of 25 = balances 60,70,...,250
    expect(s.cumulativeBalance[0]).toBe(60);
    expect(s.cumulativeBalance[19]).toBe(250);
  });

  it('computes last10 win rate from newest hands', () => {
    // 15 hands newest-first: first 10 (newest) = 7 wins, last 5 = all losses
    const hands = [
      ...Array.from({ length: 7 }, () => makeHand({ netChips: 50 })),
      ...Array.from({ length: 3 }, () => makeHand({ netChips: -50 })),
      ...Array.from({ length: 5 }, () => makeHand({ netChips: -50 })),
    ];
    const s = computeStats(hands);
    expect(s.last10WinRate).toBe(70);
  });

  it('computes boardWinRateByIndex per board position', () => {
    const hands = [
      makeHand({
        boards: [
          { boardIndex: 0, winner: 'player', playerHandName: 'One Pair', botHandName: 'High Card', playerCards: [], botCards: [], communityCards: [] },
          { boardIndex: 1, winner: 'bot', playerHandName: 'High Card', botHandName: 'One Pair', playerCards: [], botCards: [], communityCards: [] },
        ],
      }),
      makeHand({
        boards: [
          { boardIndex: 0, winner: 'player', playerHandName: 'Two Pair', botHandName: 'One Pair', playerCards: [], botCards: [], communityCards: [] },
          { boardIndex: 1, winner: 'player', playerHandName: 'Flush', botHandName: 'Straight', playerCards: [], botCards: [], communityCards: [] },
        ],
      }),
    ];
    const s = computeStats(hands);
    // Board 0: 2/2 = 100%
    expect(s.boardWinRateByIndex[0]).toBe(100);
    // Board 1: 1/2 = 50%
    expect(s.boardWinRateByIndex[1]).toBe(50);
  });
});
