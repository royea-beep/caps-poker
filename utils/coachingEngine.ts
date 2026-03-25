/**
 * coachingEngine.ts — Post-hand optimal allocation analysis.
 * Uses greedy heuristic (NOT brute force) to find best card-to-board assignment.
 */
import { Card, Rank, Suit } from '../constants/gameConfig';
import { HandRecord, HandBoardRecord } from './handHistory';
import { evaluateOmahaHand, HAND_RANK_NAMES } from './handEvaluator';

export interface BoardAllocation {
  boardIndex: number;
  playerCards: Card[];   // 4 cards assigned to this board
  handName: string;      // "Flush", "Two Pair", etc.
  handRank: number;      // numeric rank for comparison
  won: boolean;          // did this allocation win?
}

export interface CoachingResult {
  actualAllocations: BoardAllocation[];    // what the player actually did
  optimalAllocations: BoardAllocation[];   // best possible allocation
  actualScore: number;                     // chips won with actual allocation
  optimalScore: number;                    // chips that COULD have been won
  improvement: number;                     // optimalScore - actualScore
  wasOptimal: boolean;                     // player chose the best allocation
  insights: string[];                      // 2-3 human-readable tips
}

/** Reconstruct a Card object (with synthetic id) from a plain rank/suit record */
function toCard(raw: { rank: string; suit: string }, idx: number): Card {
  return {
    rank: raw.rank as Rank,
    suit: raw.suit as Suit,
    id: `c${idx}_${raw.rank}_${raw.suit}`,
  };
}

/** Generate all C(n, 4) index combinations from an array of length n */
function combos4(n: number): [number, number, number, number][] {
  const result: [number, number, number, number][] = [];
  for (let a = 0; a < n - 3; a++) {
    for (let b = a + 1; b < n - 2; b++) {
      for (let c = b + 1; c < n - 1; c++) {
        for (let d = c + 1; d < n; d++) {
          result.push([a, b, c, d]);
        }
      }
    }
  }
  return result;
}

/**
 * Greedy optimal allocation:
 * 1. Collect all player cards across all boards into a pool.
 * 2. Sort boards by pot descending (highest value first).
 * 3. For each board (in pot order), try all remaining 4-card subsets from the pool.
 *    Pick the subset that produces the highest Omaha hand rank.
 * 4. Remove used cards from pool and continue to next board.
 */
export function computeOptimalAllocation(hand: HandRecord): CoachingResult {
  const { boards, potPerBoard, numberOfPlayers } = hand;

  // Collect all player cards with synthetic IDs
  const allPlayerCards: Card[] = [];
  for (let bi = 0; bi < boards.length; bi++) {
    for (let ci = 0; ci < boards[bi].playerCards.length; ci++) {
      allPlayerCards.push(toCard(boards[bi].playerCards[ci], bi * 20 + ci));
    }
  }

  // Community cards per board
  const communityPerBoard: Card[][] = boards.map((b) =>
    b.communityCards.map((c, ci) => toCard(c, 100 + boards.indexOf(b) * 10 + ci))
  );

  // --- Actual allocations ---
  const actualAllocations: BoardAllocation[] = boards.map((board, i) => {
    const pCards = board.playerCards.map((c, ci) => toCard(c, i * 20 + ci));
    const result = evaluateOmahaHand(pCards, communityPerBoard[i]);
    return {
      boardIndex: i,
      playerCards: pCards,
      handName: result.name,
      handRank: result.rank,
      won: board.winner === 'player',
    };
  });

  // --- Greedy optimal allocation ---
  // Sort boards by pot descending (most valuable board gets best hand)
  const boardOrder = boards.map((_, i) => i).sort((a, b) => {
    // If potPerBoard differs per board, use it. Otherwise equal — sort by index.
    return b - a; // default: assign to highest-indexed boards first... actually let's sort by winner likelihood
    // But we have no per-board pot variation currently, so just keep original order
  });
  // Reset — process boards in original order for simplicity (all boards have same pot)
  const boardIndices = boards.map((_, i) => i);

  const pool: Card[] = [...allPlayerCards];
  const optimalAllocations: BoardAllocation[] = new Array(boards.length);

  for (const bi of boardIndices) {
    const community = communityPerBoard[bi];
    if (pool.length < 4) {
      // Fallback: use actual allocation if pool runs out
      optimalAllocations[bi] = { ...actualAllocations[bi] };
      continue;
    }

    const indices = combos4(pool.length);
    let bestScore = -1;
    let bestCombo: Card[] = pool.slice(0, 4);
    let bestRank = 0;
    let bestName = 'High Card';

    for (const [a, b, c, d] of indices) {
      const subset = [pool[a], pool[b], pool[c], pool[d]];
      const res = evaluateOmahaHand(subset, community);
      if (res.score > bestScore) {
        bestScore = res.score;
        bestRank = res.rank;
        bestName = res.name;
        bestCombo = subset;
      }
    }

    // Remove used cards from pool
    const usedIds = new Set(bestCombo.map((c) => c.id));
    for (let i = pool.length - 1; i >= 0; i--) {
      if (usedIds.has(pool[i].id)) pool.splice(i, 1);
    }

    optimalAllocations[bi] = {
      boardIndex: bi,
      playerCards: bestCombo,
      handName: bestName,
      handRank: bestRank,
      won: false, // computed below
    };
  }

  // --- Score computation ---
  // Actual score: chips won per board
  const chipPerBoard = potPerBoard * (numberOfPlayers - 1); // chips won when winning a board
  let actualScore = 0;
  for (const alloc of actualAllocations) {
    if (alloc.won) actualScore += chipPerBoard;
  }
  // Subtract chips lost on boards where bot won (already captured in hand.netChips)
  // Use hand.netChips as actualScore for accuracy
  actualScore = hand.netChips;

  // Optimal score: simulate wins with optimal allocation
  let optimalScore = 0;
  for (const bi of boardIndices) {
    const optAlloc = optimalAllocations[bi];
    const board = boards[bi];
    const community = communityPerBoard[bi];

    // Compare optimal player hand vs bot hand
    const botCards = board.botCards.map((c, ci) => toCard(c, 200 + bi * 20 + ci));
    const playerRes = evaluateOmahaHand(optAlloc.playerCards, community);
    const botRes = evaluateOmahaHand(botCards, community);

    if (botCards.length >= 4) {
      if (playerRes.score > botRes.score) {
        optAlloc.won = true;
        optimalScore += chipPerBoard;
      } else if (playerRes.score === botRes.score) {
        // Tie — no chips exchanged
      } else {
        optimalScore -= potPerBoard; // lost this board
      }
    } else {
      // No bot cards (multiplayer or missing data) — use actual result
      if (board.winner === 'player') {
        optAlloc.won = true;
        optimalScore += chipPerBoard;
      } else if (board.winner === 'bot') {
        optimalScore -= potPerBoard;
      }
    }
  }

  const improvement = optimalScore - actualScore;
  const wasOptimal = improvement <= 0;

  // --- Insights generation ---
  const insights: string[] = [];

  // Insight 1: Did player have a strong hand on a low-value board?
  const bestActual = [...actualAllocations].sort((a, b) => b.handRank - a.handRank)[0];
  const bestOptimal = [...optimalAllocations].sort((a, b) => b.handRank - a.handRank)[0];
  if (bestActual.boardIndex !== bestOptimal.boardIndex && bestActual.handRank >= 5) {
    insights.push(
      `Your best hand (${bestActual.handName}) was on Board ${bestActual.boardIndex + 1} — moving it to Board ${bestOptimal.boardIndex + 1} would score better`
    );
  }

  // Insight 2: Did optimal find a better hand rank on any board?
  for (const bi of boardIndices) {
    const opt = optimalAllocations[bi];
    const act = actualAllocations[bi];
    if (opt.handRank > act.handRank + 1) {
      insights.push(
        `Board ${bi + 1}: optimal cards give a ${opt.handName} vs your ${act.handName}`
      );
      break; // only first notable upgrade
    }
  }

  // Insight 3: Spreading vs concentrating
  const actualWins = actualAllocations.filter((a) => a.won).length;
  const optimalWins = optimalAllocations.filter((a) => a.won).length;
  if (optimalWins > actualWins) {
    const diff = optimalWins - actualWins;
    insights.push(
      `Rearranging cards could win ${diff} more board${diff > 1 ? 's' : ''}`
    );
  }

  // Fallback insight if none generated
  if (insights.length === 0) {
    if (wasOptimal) {
      insights.push('Your allocation was optimal — well played!');
    } else {
      insights.push('Try spreading your strong cards across high-pot boards');
    }
  }

  return {
    actualAllocations,
    optimalAllocations,
    actualScore,
    optimalScore,
    improvement,
    wasOptimal,
    insights: insights.slice(0, 3),
  };
}
