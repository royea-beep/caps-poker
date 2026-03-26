/**
 * Bot placement strategy — easy/medium/hard.
 * Iron Rule 5: bot uses heuristics only, never a full solver.
 * Bot sees only: its own cards + the visible flop (3 open community cards).
 * Turn and river are NOT visible during placement.
 */
import { Card, CARDS_PER_BOARD } from '../constants/gameConfig';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

/** Minimal board interface — only what the bot can see during placement */
interface BoardForBot {
  openCards: Card[];  // the flop (3 visible community cards)
}

// ── EASY: fully random ─────────────────────────────────────────────────────

function placeRandomly(cards: Card[], boardCount: number): Card[][] {
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  return Array.from({ length: boardCount }, (_, i) =>
    shuffled.slice(i * CARDS_PER_BOARD, (i + 1) * CARDS_PER_BOARD)
  );
}

// ── MEDIUM: group suited cards on boards with matching flop suit ───────────

function placeMedium(cards: Card[], boards: BoardForBot[]): Card[][] {
  const result: (Card[] | null)[] = boards.map(() => null);
  const remaining = [...cards];

  // Count flop suit frequencies per board
  const boardSuitCounts = boards.map((b) => {
    const counts: Record<string, number> = {};
    for (const c of b.openCards) counts[c.suit] = (counts[c.suit] || 0) + 1;
    return counts;
  });

  // Find the largest suited group in bot hand
  const suitGroups: Record<string, Card[]> = {};
  for (const c of cards) {
    if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
    suitGroups[c.suit].push(c);
  }
  const bestSuitedGroup = Object.values(suitGroups).sort((a, b) => b.length - a.length)[0];

  if (bestSuitedGroup && bestSuitedGroup.length >= 2) {
    const suit = bestSuitedGroup[0].suit;
    // Find the board with the most matching suit in its flop
    const bestBoardIdx = boards
      .map((_, i) => ({ i, count: result[i] === null ? (boardSuitCounts[i][suit] || 0) : -1 }))
      .sort((a, b) => b.count - a.count)[0]?.i ?? 0;

    const toPlace = bestSuitedGroup.slice(0, CARDS_PER_BOARD);
    result[bestBoardIdx] = toPlace;
    for (const c of toPlace) {
      const idx = remaining.indexOf(c);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  // Fill remaining boards randomly
  const remainingShuffled = [...remaining].sort(() => Math.random() - 0.5);
  let ri = 0;
  for (let i = 0; i < boards.length; i++) {
    if (result[i] !== null) continue;
    result[i] = remainingShuffled.slice(ri, ri + CARDS_PER_BOARD);
    ri += CARDS_PER_BOARD;
  }

  return result as Card[][];
}

// ── HARD: pair-aware + suited + high-card positioning ─────────────────────

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function placeHard(cards: Card[], boards: BoardForBot[]): Card[][] {
  // Strategy: assign a "preferred board index" for key cards, then fill each board to CARDS_PER_BOARD.
  const boardCount = boards.length;
  const boardPrefs: Card[][] = Array.from({ length: boardCount }, () => []);
  const unassigned = [...cards];

  // Board analysis
  const boardSuitCounts = boards.map((b) => {
    const counts: Record<string, number> = {};
    for (const c of b.openCards) counts[c.suit] = (counts[c.suit] || 0) + 1;
    return counts;
  });
  const boardRankSets = boards.map((b) => new Set(b.openCards.map((c) => c.rank)));

  // Step 1: find the best pair in hand — keep on one board together
  const rankGroups: Record<string, Card[]> = {};
  for (const c of cards) {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
    rankGroups[c.rank].push(c);
  }
  const bestPair = Object.values(rankGroups).filter((g) => g.length >= 2).sort((a, b) => b.length - a.length)[0];
  if (bestPair) {
    // Prefer board where flop has matching rank (set potential), else first available
    const boardIdx = boards
      .map((_, i) => ({ i, score: boardRankSets[i].has(bestPair[0].rank) ? 1 : 0 }))
      .sort((a, b) => b.score - a.score)[0].i;
    const toAssign = bestPair.slice(0, Math.min(bestPair.length, CARDS_PER_BOARD));
    for (const c of toAssign) {
      boardPrefs[boardIdx].push(c);
      const idx = unassigned.indexOf(c);
      if (idx >= 0) unassigned.splice(idx, 1);
    }
  }

  // Step 2: find best suited group in REMAINING cards — put on board with most matching flop suit
  const suitGroups: Record<string, Card[]> = {};
  for (const c of unassigned) {
    if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
    suitGroups[c.suit].push(c);
  }
  const bestSuited = Object.values(suitGroups).sort((a, b) => b.length - a.length)[0];
  if (bestSuited && bestSuited.length >= 2) {
    const suit = bestSuited[0].suit;
    // Find board with most matching suit that still has capacity
    const boardIdx = boards
      .map((_, i) => ({ i, score: boardPrefs[i].length < CARDS_PER_BOARD ? (boardSuitCounts[i][suit] || 0) : -1 }))
      .sort((a, b) => b.score - a.score)[0]?.i ?? 0;
    if (boardPrefs[boardIdx].length < CARDS_PER_BOARD) {
      const slots = CARDS_PER_BOARD - boardPrefs[boardIdx].length;
      const toAssign = bestSuited.slice(0, slots);
      for (const c of toAssign) {
        boardPrefs[boardIdx].push(c);
        const idx = unassigned.indexOf(c);
        if (idx >= 0) unassigned.splice(idx, 1);
      }
    }
  }

  // Step 3: fill remaining slots with unassigned cards (high cards first)
  const remainingByRank = [...unassigned].sort((a, b) => (RANK_VALUES[b.rank] || 0) - (RANK_VALUES[a.rank] || 0));
  let ri = 0;
  for (let i = 0; i < boardCount; i++) {
    while (boardPrefs[i].length < CARDS_PER_BOARD && ri < remainingByRank.length) {
      boardPrefs[i].push(remainingByRank[ri++]);
    }
  }

  return boardPrefs;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns placement: one Card[] per board, in board order.
 * boards must be in order [board0, board1, ...].
 */
export function placeBotCardsWithStrategy(
  botHand: Card[],
  boards: BoardForBot[],
  difficulty: BotDifficulty
): Card[][] {
  try {
    switch (difficulty) {
      case 'medium': return placeMedium(botHand, boards);
      case 'hard': return placeHard(botHand, boards);
      default: return placeRandomly(botHand, boards.length);
    }
  } catch {
    // Fallback: random — never crash the bot
    return placeRandomly(botHand, boards.length);
  }
}
