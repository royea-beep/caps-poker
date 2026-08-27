import { HandRecord } from './handHistory';
import { deriveHandOutcome } from './handOutcome';

export const HAND_RANK_ORDER = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
];

export interface PlayerStats {
  // Volume
  handsPlayed: number;
  boardsPlayed: number;

  // Results
  handsWon: number;
  handsLost: number;
  handsTied: number;
  winRate: number; // % hands won

  // Chips
  totalChipsWon: number;
  totalChipsLost: number;
  netChipsAllTime: number;
  biggestWin: number;
  biggestLoss: number;

  // Boards
  boardsWon: number;
  boardWinRate: number; // % individual boards won
  boardWinRateByIndex: number[]; // [board0%, board1%, board2%, board3%]
  boardPlayCountByIndex: number[]; // [board0count, board1count, ...] — 0 = never played

  // Special
  completeCount: number; // hands where isComplete=true
  completeRate: number; // %

  // Hands made
  bestHandEver: string;
  handFrequency: Record<string, number>;

  // Streaks
  currentWinStreak: number;
  bestWinStreak: number;
  currentLoseStreak: number;

  // Recent form
  last10WinRate: number;
  last10NetChips: number;

  // Chart data (oldest→newest cumulative balance, last 20 hands)
  cumulativeBalance: number[];
}

export function computeStats(hands: HandRecord[]): PlayerStats {
  const empty: PlayerStats = {
    handsPlayed: 0,
    boardsPlayed: 0,
    handsWon: 0,
    handsLost: 0,
    handsTied: 0,
    winRate: 0,
    totalChipsWon: 0,
    totalChipsLost: 0,
    netChipsAllTime: 0,
    biggestWin: 0,
    biggestLoss: 0,
    boardsWon: 0,
    boardWinRate: 0,
    boardWinRateByIndex: [0, 0, 0, 0],
    boardPlayCountByIndex: [0, 0, 0, 0],
    completeCount: 0,
    completeRate: 0,
    bestHandEver: '—',
    handFrequency: {},
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    last10WinRate: 0,
    last10NetChips: 0,
    cumulativeBalance: [],
  };

  if (hands.length === 0) return empty;

  // hands[] is newest-first; process oldest-first for streaks + cumulative
  const ordered = [...hands].reverse();

  let handsWon = 0;
  let handsLost = 0;
  let handsTied = 0;
  let totalChipsWon = 0;
  let totalChipsLost = 0;
  let biggestWin = 0;
  let biggestLoss = 0;
  let boardsWon = 0;
  let boardsTotal = 0;
  let completeCount = 0;
  const handFrequency: Record<string, number> = {};
  const boardWinsByIndex = [0, 0, 0, 0];
  const boardTotalsByIndex = [0, 0, 0, 0];
  let bestHandRankIdx = -1;
  let bestHandEver = '—';
  let runningBalance = 0;
  const cumulativeBalance: number[] = [];
  let currentWinStreak = 0;
  let bestWinStreak = 0;
  let currentLoseStreak = 0;

  for (const hand of ordered) {
    const net = hand.netChips;
    // ONE DEFINITION OF WINNING, HERE TOO. Every counter below used to key off `net`, so this
    // whole screen - win rate, recent form, both streak figures - carried the CHIPS definition
    // while the record, the ladder and the celebration derive a win from BOARDS. That is the
    // same split the align-the-celebration ruling closed on /results, surviving one file over.
    // WHAT SPLITS AND WHAT DOES NOT: the OUTCOME counters ask the boards; the MONEY counters
    // still ask the chips, because "biggest win" and "total chips won" are statements about
    // money and a board win that nets zero is not a bigger one. They are no longer the same
    // branch, which is precisely why they could not disagree before.
    const outcome = deriveHandOutcome(hand.boards);

    // MONEY - unchanged, and deliberately still keyed on the net.
    if (net > 0) {
      totalChipsWon += net;
      biggestWin = Math.max(biggestWin, net);
    } else if (net < 0) {
      totalChipsLost += Math.abs(net);
      biggestLoss = Math.max(biggestLoss, Math.abs(net));
    }

    // OUTCOME - boards decide it, and a tie is a third state rather than "not a win".
    // The streaks mirror what /results already does live (app/results.tsx): a win extends the
    // win streak, a loss ends it, and A TIE DOES NEITHER. Previously a net-zero hand reset both,
    // so a tie broke a streak exactly as a loss did.
    if (outcome === 'win') {
      handsWon++;
      currentWinStreak++;
      currentLoseStreak = 0;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
    } else if (outcome === 'loss') {
      handsLost++;
      currentLoseStreak++;
      currentWinStreak = 0;
    } else {
      handsTied++;
    }

    if (hand.isComplete) completeCount++;
    runningBalance += net;
    cumulativeBalance.push(runningBalance);

    for (const board of hand.boards) {
      boardsTotal++;
      if (board.winner === 'player') boardsWon++;
      const idx = board.boardIndex;
      if (idx >= 0 && idx < 4) {
        boardTotalsByIndex[idx]++;
        if (board.winner === 'player') boardWinsByIndex[idx]++;
      }
      const handName = board.playerHandName;
      if (handName) {
        handFrequency[handName] = (handFrequency[handName] ?? 0) + 1;
        const rankIdx = HAND_RANK_ORDER.indexOf(handName);
        if (rankIdx > bestHandRankIdx) {
          bestHandRankIdx = rankIdx;
          bestHandEver = handName;
        }
      }
    }
  }

  const handsPlayed = hands.length;
  const winRate = handsPlayed > 0 ? Math.round((handsWon / handsPlayed) * 1000) / 10 : 0;
  const boardWinRate = boardsTotal > 0 ? Math.round((boardsWon / boardsTotal) * 1000) / 10 : 0;
  const completeRate = handsPlayed > 0 ? Math.round((completeCount / handsPlayed) * 1000) / 10 : 0;
  const boardWinRateByIndex = boardWinsByIndex.map((w, i) =>
    boardTotalsByIndex[i] > 0 ? Math.round((w / boardTotalsByIndex[i]) * 1000) / 10 : 0
  );

  // Recent form: hands[0..9] are newest
  const last10 = hands.slice(0, 10);
  // Recent form asked the chips while the all-time win rate three lines up now asks the boards,
  // which would have put two different win rates on one screen.
  const last10Won = last10.filter((h) => deriveHandOutcome(h.boards) === 'win').length;
  const last10WinRate = last10.length > 0 ? Math.round((last10Won / last10.length) * 1000) / 10 : 0;
  const last10NetChips = last10.reduce((s, h) => s + h.netChips, 0);

  // Chart: oldest→newest, last 20
  const chartData = cumulativeBalance.slice(-20);

  return {
    handsPlayed,
    boardsPlayed: boardsTotal,
    handsWon,
    handsLost,
    handsTied,
    winRate,
    totalChipsWon,
    totalChipsLost,
    netChipsAllTime: totalChipsWon - totalChipsLost,
    biggestWin,
    biggestLoss,
    boardsWon,
    boardWinRate,
    boardWinRateByIndex,
    boardPlayCountByIndex: boardTotalsByIndex,
    completeCount,
    completeRate,
    bestHandEver,
    handFrequency,
    currentWinStreak,
    bestWinStreak,
    currentLoseStreak,
    last10WinRate,
    last10NetChips,
    cumulativeBalance: chartData,
  };
}
