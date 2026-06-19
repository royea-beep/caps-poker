import { Card, CARDS_PER_BOARD } from '../constants/gameConfig';
import { evaluateOmahaHand, HandResult } from './handEvaluator';

export interface EfficiencyResult {
  actualScore: number;
  optimalScore: number;
  percentage: number;
  grade: string;
  gradeEmoji: string;
  optimalAssignment: Card[][]; // cards per board for optimal
  actualHandNames: string[];
  optimalHandNames: string[];
}

/**
 * Calculate placement efficiency by comparing player's arrangement
 * against all possible permutations (4! = 24 for 4 boards with 4 cards each).
 *
 * For N boards, we have N*4 player cards total. We try all permutations
 * of assigning groups of 4 cards to each board and pick the one that
 * maximizes total hand strength (sum of scores).
 */
export function analyzeEfficiency(
  playerCardsByBoard: Card[][],
  boardCommunityCards: { openCards: Card[]; closedCards: Card[] }[],
): EfficiencyResult {
  const boardCount = playerCardsByBoard.length;

  // Collect all player cards in order
  const allPlayerCards: Card[] = [];
  for (const boardCards of playerCardsByBoard) {
    allPlayerCards.push(...boardCards);
  }

  // If not enough cards, return 100%
  if (allPlayerCards.length < boardCount * CARDS_PER_BOARD) {
    return {
      actualScore: 0,
      optimalScore: 0,
      percentage: 100,
      grade: 'N/A',
      gradeEmoji: '',
      optimalAssignment: playerCardsByBoard,
      actualHandNames: [],
      optimalHandNames: [],
    };
  }

  // Evaluate the player's actual arrangement
  let actualScore = 0;
  const actualHandNames: string[] = [];
  for (let i = 0; i < boardCount; i++) {
    const communityCards = [...boardCommunityCards[i].openCards, ...boardCommunityCards[i].closedCards];
    const result = evaluateOmahaHand(playerCardsByBoard[i], communityCards);
    actualScore += result.score;
    actualHandNames.push(result.name);
  }

  // Generate all permutations of card assignments
  // Each board gets CARDS_PER_BOARD cards from the pool
  let optimalScore = actualScore;
  let optimalAssignment = playerCardsByBoard;
  let optimalHandNames = actualHandNames;

  const indices = Array.from({ length: allPlayerCards.length }, (_, i) => i);
  const permutations = getAssignmentPermutations(indices, boardCount, CARDS_PER_BOARD);

  for (const perm of permutations) {
    let totalScore = 0;
    const handNames: string[] = [];
    const assignment: Card[][] = [];

    for (let b = 0; b < boardCount; b++) {
      const boardCards = perm[b].map((idx) => allPlayerCards[idx]);
      assignment.push(boardCards);
      const communityCards = [...boardCommunityCards[b].openCards, ...boardCommunityCards[b].closedCards];
      const result = evaluateOmahaHand(boardCards, communityCards);
      totalScore += result.score;
      handNames.push(result.name);
    }

    if (totalScore > optimalScore) {
      optimalScore = totalScore;
      optimalAssignment = assignment;
      optimalHandNames = handNames;
    }
  }

  const percentage = optimalScore > 0
    ? Math.round((actualScore / optimalScore) * 100)
    : 100;

  const { grade, gradeEmoji } = getGrade(percentage);

  return {
    actualScore,
    optimalScore,
    percentage,
    grade,
    gradeEmoji,
    optimalAssignment,
    actualHandNames,
    optimalHandNames,
  };
}

function getGrade(pct: number): { grade: string; gradeEmoji: string } {
  if (pct >= 90) return { grade: 'Excellent', gradeEmoji: '\uD83C\uDFC6' };
  if (pct >= 75) return { grade: 'Good', gradeEmoji: '\uD83D\uDC4D' };
  if (pct >= 60) return { grade: 'Room to improve', gradeEmoji: '\uD83D\uDCC8' };
  return { grade: 'Try again', gradeEmoji: '\uD83D\uDCA1' };
}

/**
 * Generate all ways to partition `indices` into `groupCount` groups of `groupSize`.
 * For 2 boards (8 cards, groups of 4): C(8,4) = 70 permutations
 * For 3 boards (12 cards): C(12,4)*C(8,4) = 34,650 — capped via sampling
 * For 4 boards (16 cards): C(16,4)*C(12,4)*C(8,4) = ~2.5M — capped via sampling
 *
 * VAMOS-FIX-RESULTS-EVAL 2026-06-17 — sample caps cut hard:
 *   bc=4 (4 boards): 5000 → 400   (was 20k evaluator calls, now 1.6k)
 *   bc=3 (3 boards): unbounded → 400  (was ~104k calls, now 1.2k)
 *   bc=2 (2 boards): unbounded → 70  (exhaustive — small enough)
 * The evaluator was burning 12s of throttled CPU on the results path.
 * The hint feature value here is "are you within ~5% of optimal," which
 * 400 random samples answer just as well as 5000.
 */
function getAssignmentPermutations(
  indices: number[],
  groupCount: number,
  groupSize: number,
): number[][][] {
  if (groupCount >= 3) {
    return samplePermutations(indices, groupCount, groupSize, 400);
  }

  const results: number[][][] = [];

  function recurse(remaining: number[], groups: number[][]) {
    if (groups.length === groupCount) {
      results.push([...groups]);
      return;
    }

    // Pick `groupSize` cards from remaining for the next group
    const combos = combinations(remaining, groupSize);
    for (const combo of combos) {
      const rest = remaining.filter((x) => !combo.includes(x));
      recurse(rest, [...groups, combo]);
    }
  }

  recurse(indices, []);
  return results;
}

function samplePermutations(
  indices: number[],
  groupCount: number,
  groupSize: number,
  sampleCount: number,
): number[][][] {
  const results: number[][][] = [];
  for (let s = 0; s < sampleCount; s++) {
    const shuffled = [...indices].sort(() => Math.random() - 0.5);
    const groups: number[][] = [];
    for (let g = 0; g < groupCount; g++) {
      groups.push(shuffled.slice(g * groupSize, (g + 1) * groupSize));
    }
    results.push(groups);
  }
  return results;
}

function combinations(arr: number[], k: number): number[][] {
  const result: number[][] = [];
  function combine(start: number, current: number[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  combine(0, []);
  return result;
}
