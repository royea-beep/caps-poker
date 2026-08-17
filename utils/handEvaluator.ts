// Reads the four card primitives from the LEAF module, not from gameConfig. gameConfig's chain
// reaches react-native (gameConfig -> theme -> paintThemes), which is fine in the app and fatal in
// Deno — and server-side adjudication runs THIS evaluator rather than a second implementation.
// Only this line moved; the body below is unchanged.
import { Card, Rank, RANKS, SUITS } from '../constants/cards';

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export enum HandRank {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  [HandRank.HighCard]: 'High Card',
  [HandRank.OnePair]: 'One Pair',
  [HandRank.TwoPair]: 'Two Pair',
  [HandRank.ThreeOfAKind]: 'Three of a Kind',
  [HandRank.Straight]: 'Straight',
  [HandRank.Flush]: 'Flush',
  [HandRank.FullHouse]: 'Full House',
  [HandRank.FourOfAKind]: 'Four of a Kind',
  [HandRank.StraightFlush]: 'Straight Flush',
  [HandRank.RoyalFlush]: 'Royal Flush',
};

export interface HandResult {
  rank: HandRank;
  score: number;
  bestCards: Card[];
  playerCardsUsed: Card[];
  boardCardsUsed: Card[];
  name: string;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  const [first, ...rest] = arr;
  for (const combo of combinations(rest, k - 1)) {
    result.push([first, ...combo]);
  }
  for (const combo of combinations(rest, k)) {
    result.push(combo);
  }
  return result;
}

// Pre-computed index combinations — avoids calling combinations() on every evaluation
// C(4,2) = 6 player card combos (indices into 4-card hand)
const PLAYER_COMBO_IDX: [number, number][] = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
// C(5,3) = 10, C(4,3) = 4, C(3,3) = 1 board combos (indexed by board length)
const BOARD_COMBO_IDX: Record<number, [number, number, number][]> = {
  3: [[0,1,2]],
  4: [[0,1,2],[0,1,3],[0,2,3],[1,2,3]],
  5: [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]],
};

// Exported for targeted comparator tests (VAMOS-HAND-TIEBREAK 2026-06-22).
export function evaluate5Cards(cards: Card[]): { rank: HandRank; score: number } {
  const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length >= 5) {
    for (let i = 0; i <= unique.length - 5; i++) {
      if (unique[i] - unique[i + 4] === 4) {
        isStraight = true;
        straightHigh = unique[i];
        break;
      }
    }
  }
  // Wheel (A-2-3-4-5)
  if (!isStraight && unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
    isStraight = true;
    straightHigh = 5;
  }

  // Count ranks
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts)
    .map(([val, cnt]) => ({ val: Number(val), cnt }))
    .sort((a, b) => b.cnt - a.cnt || b.val - a.val);

  if (isStraight && isFlush) {
    if (straightHigh === 14) {
      return { rank: HandRank.RoyalFlush, score: rankScore(HandRank.RoyalFlush, [14]) };
    }
    return { rank: HandRank.StraightFlush, score: rankScore(HandRank.StraightFlush, [straightHigh]) };
  }

  if (groups[0].cnt === 4) {
    return {
      rank: HandRank.FourOfAKind,
      score: rankScore(HandRank.FourOfAKind, [groups[0].val, groups[1].val]),
    };
  }

  if (groups[0].cnt === 3 && groups[1].cnt === 2) {
    return {
      rank: HandRank.FullHouse,
      score: rankScore(HandRank.FullHouse, [groups[0].val, groups[1].val]),
    };
  }

  if (isFlush) {
    return { rank: HandRank.Flush, score: rankScore(HandRank.Flush, values) };
  }

  if (isStraight) {
    return { rank: HandRank.Straight, score: rankScore(HandRank.Straight, [straightHigh]) };
  }

  if (groups[0].cnt === 3) {
    const kickers = groups.filter((g) => g.cnt === 1).map((g) => g.val).sort((a, b) => b - a);
    return {
      rank: HandRank.ThreeOfAKind,
      score: rankScore(HandRank.ThreeOfAKind, [groups[0].val, ...kickers]),
    };
  }

  if (groups[0].cnt === 2 && groups[1].cnt === 2) {
    const pairs = [groups[0].val, groups[1].val].sort((a, b) => b - a);
    const kicker = groups[2].val;
    return {
      rank: HandRank.TwoPair,
      score: rankScore(HandRank.TwoPair, [...pairs, kicker]),
    };
  }

  if (groups[0].cnt === 2) {
    const kickers = groups.filter((g) => g.cnt === 1).map((g) => g.val).sort((a, b) => b - a);
    return {
      rank: HandRank.OnePair,
      score: rankScore(HandRank.OnePair, [groups[0].val, ...kickers]),
    };
  }

  return { rank: HandRank.HighCard, score: rankScore(HandRank.HighCard, values) };
}

function rankScore(rank: HandRank, values: number[]): number {
  // Encode hand rank + up to 5 kicker values into a single comparable number
  let score = rank * 100000000000;
  for (let i = 0; i < values.length && i < 5; i++) {
    score += values[i] * Math.pow(100, 4 - i);
  }
  return score;
}

const DEFAULT_HAND_RESULT: HandResult = {
  rank: HandRank.HighCard,
  score: 0,
  bestCards: [],
  playerCardsUsed: [],
  boardCardsUsed: [],
  name: HAND_RANK_NAMES[HandRank.HighCard],
};

// Shared mutable 5-card hand array — reused across all evaluations (safe in single-threaded JS)
const _hand5: Card[] = new Array(5) as Card[];

export function evaluateOmahaHand(playerCards: Card[], boardCards: Card[]): HandResult {
  // Guard: need at least 2 player cards and 3 board cards for valid Omaha evaluation
  if (!playerCards || playerCards.length < 2 || !boardCards || boardCards.length < 3) {
    return { ...DEFAULT_HAND_RESULT };
  }

  try {
    // Use pre-computed index combos (no array allocation) for standard 4-card hands
    const playerCombos = playerCards.length >= 4 ? PLAYER_COMBO_IDX : null;
    const boardKey = Math.min(boardCards.length, 5);
    const boardCombos = BOARD_COMBO_IDX[boardKey] ?? BOARD_COMBO_IDX[3];

    let bestScore = -1;
    let bestRank = HandRank.HighCard;
    let bestPi = 0, bestPj = 1, bestCi = 0, bestCj = 1, bestCk = 2;

    if (playerCombos) {
      // Fast path: pre-computed indices, no array creation per combo
      outer:
      for (const [pi, pj] of playerCombos) {
        for (const [ci, cj, ck] of boardCombos) {
          _hand5[0] = playerCards[pi];
          _hand5[1] = playerCards[pj];
          _hand5[2] = boardCards[ci];
          _hand5[3] = boardCards[cj];
          _hand5[4] = boardCards[ck];
          const { rank, score } = evaluate5Cards(_hand5);
          if (score > bestScore) {
            bestScore = score; bestRank = rank;
            bestPi = pi; bestPj = pj; bestCi = ci; bestCj = cj; bestCk = ck;
            if (rank === HandRank.RoyalFlush) break outer;
          }
        }
      }
    } else {
      // Slow path: arbitrary player card count (edge cases only)
      const dynPlayerCombos = combinations(playerCards, 2);
      outer2:
      for (const pc of dynPlayerCombos) {
        for (const [ci, cj, ck] of boardCombos) {
          _hand5[0] = pc[0]; _hand5[1] = pc[1];
          _hand5[2] = boardCards[ci]; _hand5[3] = boardCards[cj]; _hand5[4] = boardCards[ck];
          const { rank, score } = evaluate5Cards(_hand5);
          if (score > bestScore) {
            bestScore = score; bestRank = rank;
            // Store indices by finding in original array
            bestPi = playerCards.indexOf(pc[0]);
            bestPj = playerCards.indexOf(pc[1]);
            bestCi = ci; bestCj = cj; bestCk = ck;
            if (rank === HandRank.RoyalFlush) break outer2;
          }
        }
      }
    }

    if (bestScore < 0) return { ...DEFAULT_HAND_RESULT };

    // Build result arrays only once (not in the hot loop)
    return {
      rank: bestRank,
      score: bestScore,
      bestCards: [playerCards[bestPi], playerCards[bestPj], boardCards[bestCi], boardCards[bestCj], boardCards[bestCk]],
      playerCardsUsed: [playerCards[bestPi], playerCards[bestPj]],
      boardCardsUsed: [boardCards[bestCi], boardCards[bestCj], boardCards[bestCk]],
      name: HAND_RANK_NAMES[bestRank],
    };
  } catch {
    return { ...DEFAULT_HAND_RESULT };
  }
}

export function compareHands(result1: HandResult, result2: HandResult): number {
  return result1.score - result2.score;
}

/**
 * Compute pre-flop / post-flop equity for player vs one or more bots using Omaha rules.
 * Uses Monte Carlo sampling when combinations exceed maxSamples to keep it fast (<20ms).
 * Returns player's win percentage (0–100).
 */
export function computeOmahaEquity(
  playerCards: Card[],
  allBotCards: Card[][],
  communityCards: Card[], // already-known board cards (e.g. flop, or flop+turn)
  maxSamples = 200,       // cap for performance — 200 samples ≈ ±4% accuracy
): number {
  if (playerCards.length < 2) return 50;
  const activeBots = allBotCards.filter((bc) => bc.length >= 2);
  if (activeBots.length === 0) return 50;

  // Build the set of known cards to exclude from the remaining deck
  const knownKeys = new Set<string>([
    ...playerCards,
    ...activeBots.flat(),
    ...communityCards,
  ].map((c) => `${c.rank}-${c.suit}`));

  // Build remaining deck
  const remaining: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = `${rank}-${suit}`;
      if (!knownKeys.has(key)) {
        remaining.push({ rank, suit, id: key });
      }
    }
  }

  const neededCards = 5 - communityCards.length;

  // If all community cards are already known, evaluate directly
  if (neededCards <= 0) {
    const pScore = evaluateOmahaHand(playerCards, communityCards).score;
    const maxBotScore = Math.max(...activeBots.map((bc) => evaluateOmahaHand(bc, communityCards).score));
    if (pScore > maxBotScore) return 100;
    if (pScore === maxBotScore) return 50;
    return 0;
  }

  // For turn (1 card needed): all combos are fast enough (~40 cards), no sampling needed
  // For flop (2 cards needed): C(37-41, 2) = 666-820 combos → cap at maxSamples via random sampling
  const allExtras = combinations(remaining, neededCards);
  let extras = allExtras;
  if (allExtras.length > maxSamples) {
    // Fisher-Yates partial shuffle to get maxSamples random combos without copying full array
    const arr = allExtras;
    const limit = maxSamples;
    for (let i = 0; i < limit; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    extras = arr.slice(0, limit);
  }

  let wins = 0;
  let ties = 0;
  let total = 0;

  for (const extra of extras) {
    const board = [...communityCards, ...extra];
    const pScore = evaluateOmahaHand(playerCards, board).score;
    const maxBotScore = Math.max(...activeBots.map((bc) => evaluateOmahaHand(bc, board).score));
    if (pScore > maxBotScore) wins++;
    else if (pScore === maxBotScore) ties++;
    total++;
  }

  if (total === 0) return 50;
  return Math.round(((wins + ties * 0.5) / total) * 100);
}
