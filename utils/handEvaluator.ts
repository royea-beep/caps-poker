import { Card, Rank, RANKS, SUITS } from '../constants/gameConfig';

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

function evaluate5Cards(cards: Card[]): { rank: HandRank; score: number } {
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

export function evaluateOmahaHand(playerCards: Card[], boardCards: Card[]): HandResult {
  // Guard: need at least 2 player cards and 3 board cards for valid Omaha evaluation
  if (!playerCards || playerCards.length < 2 || !boardCards || boardCards.length < 3) {
    return { ...DEFAULT_HAND_RESULT };
  }

  try {
    const playerCombos = combinations(playerCards, 2);
    const boardCombos = combinations(boardCards, 3);

    let bestResult: HandResult | null = null;

    for (const pc of playerCombos) {
      for (const bc of boardCombos) {
        const hand = [...pc, ...bc];
        const { rank, score } = evaluate5Cards(hand);

        if (!bestResult || score > bestResult.score) {
          bestResult = {
            rank,
            score,
            bestCards: hand,
            playerCardsUsed: pc,
            boardCardsUsed: bc,
            name: HAND_RANK_NAMES[rank],
          };
        }
      }
    }

    return bestResult ?? { ...DEFAULT_HAND_RESULT };
  } catch {
    return { ...DEFAULT_HAND_RESULT };
  }
}

export function compareHands(result1: HandResult, result2: HandResult): number {
  return result1.score - result2.score;
}

/**
 * Compute pre-flop / post-flop equity for player vs one or more bots using Omaha rules.
 * Enumerates all possible remaining community cards (turn+river, or just river) from the deck.
 * Returns player's win percentage (0–100).
 */
export function computeOmahaEquity(
  playerCards: Card[],
  allBotCards: Card[][],
  communityCards: Card[], // already-known board cards (e.g. flop, or flop+turn)
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

  // Enumerate all combinations of neededCards from the remaining deck
  let wins = 0;
  let ties = 0;
  let total = 0;

  const extras = combinations(remaining, neededCards);
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
