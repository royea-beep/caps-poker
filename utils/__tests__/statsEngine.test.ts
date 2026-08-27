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

/**
 * OUTCOME IS EXPRESSED WITH BOARDS, NOT CHIPS.
 *
 * These fixtures used to say "this is a loss" by setting netChips negative on top of a board
 * fixture whose single board the PLAYER won. They passed only because computeStats read the
 * chips, so they asserted the defect rather than the rule. Same shape the align-the-celebration
 * sprint found in the achievement tests.
 */
const board = (winner: 'player' | 'bot' | 'tie', seat: number, name = 'One Pair') => ({
  boardIndex: 0, winner, winnerSeat: seat,
  playerHandName: name, botHandName: 'High Card',
  playerCards: [], botCards: [], communityCards: [],
});
const WIN_BOARDS = [board('player', 0)];
const LOSS_BOARDS = [board('bot', 1)];
/** One each — the server calls that a tie, whatever the chips did. */
const TIE_BOARDS = [board('player', 0), { ...board('bot', 1), boardIndex: 1 }];

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
    const s = computeStats([makeHand({ netChips: -150, boards: LOSS_BOARDS })]);
    expect(s.handsLost).toBe(1);
    expect(s.handsWon).toBe(0);
    expect(s.biggestLoss).toBe(150);
    expect(s.netChipsAllTime).toBe(-150);
  });

  it('counts ties correctly', () => {
    const s = computeStats([makeHand({ netChips: 0, boards: TIE_BOARDS })]);
    expect(s.handsTied).toBe(1);
    expect(s.handsWon).toBe(0);
    expect(s.handsLost).toBe(0);
  });

  it('computes win rate across multiple hands', () => {
    const hands = [
      makeHand({ netChips: 100, boards: WIN_BOARDS }),
      makeHand({ netChips: -50, boards: LOSS_BOARDS }),
      makeHand({ netChips: 200, boards: WIN_BOARDS }),
      makeHand({ netChips: -30, boards: LOSS_BOARDS }),
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
      makeHand({ netChips: -50, boards: LOSS_BOARDS }),
      makeHand({ netChips: 100, boards: WIN_BOARDS }),
      makeHand({ netChips: 100, boards: WIN_BOARDS }),
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
      ...Array.from({ length: 7 }, () => makeHand({ netChips: 50, boards: WIN_BOARDS })),
      ...Array.from({ length: 3 }, () => makeHand({ netChips: -50, boards: LOSS_BOARDS })),
      ...Array.from({ length: 5 }, () => makeHand({ netChips: -50, boards: LOSS_BOARDS })),
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

  /**
   * THE DIVERGENCE ITSELF. Each of these is a hand where the chips and the boards disagree, so
   * each one fails if any counter goes back to reading `netChips`. The old code passed none of
   * them: it scored the first as a win, the second as a loss, and broke the streak on the third.
   */
  describe('boards decide the outcome, chips decide the money', () => {
    it('a TIE that paid positive chips is not a win', () => {
      const s = computeStats([makeHand({ netChips: 50, boards: TIE_BOARDS })]);
      expect(s.handsTied).toBe(1);
      expect(s.handsWon).toBe(0);
      expect(s.handsLost).toBe(0);
      // ...and the money is still counted as money.
      expect(s.totalChipsWon).toBe(50);
      expect(s.biggestWin).toBe(50);
      expect(s.netChipsAllTime).toBe(50);
    });

    it('a board WIN that netted zero is a win, and is not the biggest win', () => {
      const s = computeStats([makeHand({ netChips: 0, boards: WIN_BOARDS })]);
      expect(s.handsWon).toBe(1);
      expect(s.handsTied).toBe(0);
      // "Biggest win" is a statement about money; a zero-net hand must not become one.
      expect(s.biggestWin).toBe(0);
      expect(s.totalChipsWon).toBe(0);
    });

    it('a tie neither extends nor breaks the win streak', () => {
      // newest-first, so oldest-first is: win, TIE, win  -> the streak survives the tie.
      const hands = [
        makeHand({ netChips: 100, boards: WIN_BOARDS }),
        makeHand({ netChips: 0, boards: TIE_BOARDS }),
        makeHand({ netChips: 100, boards: WIN_BOARDS }),
      ];
      const s = computeStats(hands);
      expect(s.handsWon).toBe(2);
      expect(s.handsTied).toBe(1);
      expect(s.currentWinStreak).toBe(2);
      expect(s.bestWinStreak).toBe(2);
      expect(s.currentLoseStreak).toBe(0);
    });

    it('recent form asks the same question the all-time win rate does', () => {
      // Ten hands, every one a TIE that paid positive chips. Recent form read the chips, so it
      // reported 100% while the all-time rate beside it reported 0%.
      const hands = Array.from({ length: 10 }, () => makeHand({ netChips: 25, boards: TIE_BOARDS }));
      const s = computeStats(hands);
      expect(s.last10WinRate).toBe(0);
      expect(s.winRate).toBe(0);
    });

    it('THE 3-PLAYER SHAPE — one board each is a tie here too', () => {
      // Three seats, one board apiece. Counting opponents together made this 1 v 2 = a loss.
      const oneEach = [
        { ...board('player', 0), boardIndex: 0 },
        { ...board('bot', 1), boardIndex: 1 },
        { ...board('bot', 2), boardIndex: 2 },
      ];
      const s = computeStats([makeHand({ netChips: 0, boards: oneEach, numberOfPlayers: 3, boardCount: 3 })]);
      expect(s.handsTied).toBe(1);
      expect(s.handsLost).toBe(0);
    });
  });
});
