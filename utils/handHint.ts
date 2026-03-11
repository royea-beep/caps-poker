import { Card, Rank, Suit } from '../constants/gameConfig';

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export type HandHintLabel =
  | 'High Card'
  | 'Pair'
  | 'Two Pair'
  | 'Trips'
  | 'Flush Draw'
  | 'Straight Draw'
  | 'Str+Flush Draw'
  ;

/**
 * Analyze 4 player cards to produce a hint label.
 * Priority: Trips > Two Pair > Pair > Str+Flush Draw > Flush Draw > Straight Draw > High Card
 */
export function getHandHint(cards: Card[]): HandHintLabel {
  if (cards.length !== 4) return 'High Card';

  // Count ranks
  const rankCounts = new Map<Rank, number>();
  for (const c of cards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1);
  }
  const counts = [...rankCounts.values()].sort((a, b) => b - a);

  // Trips (3 of same rank)
  if (counts[0] >= 3) return 'Trips';

  // Two Pair (2 different pairs)
  if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';

  // Pair
  if (counts[0] === 2) {
    // Still check for draws alongside the pair
    const hasFlushDraw = checkFlushDraw(cards);
    const hasStraightDraw = checkStraightDraw(cards);
    // Pair beats draws in priority
    return 'Pair';
  }

  // No pairs — check draws
  const hasFlushDraw = checkFlushDraw(cards);
  const hasStraightDraw = checkStraightDraw(cards);

  if (hasFlushDraw && hasStraightDraw) return 'Str+Flush Draw';
  if (hasFlushDraw) return 'Flush Draw';
  if (hasStraightDraw) return 'Straight Draw';

  return 'High Card';
}

/** 3+ cards of same suit = flush draw */
function checkFlushDraw(cards: Card[]): boolean {
  const suitCounts = new Map<Suit, number>();
  for (const c of cards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
  }
  return [...suitCounts.values()].some((count) => count >= 3);
}

/** Check if 3+ cards can form part of a straight (within 4-rank window) */
function checkStraightDraw(cards: Card[]): boolean {
  const values = cards.map((c) => RANK_VALUES[c.rank]);
  const unique = [...new Set(values)].sort((a, b) => a - b);

  if (unique.length < 3) return false;

  // Check consecutive windows: any 3 cards within a span of 4
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 2; j < unique.length; j++) {
      if (unique[j] - unique[i] <= 4) return true;
    }
  }

  // Ace-low straight draw (A-2-3 or A-2-3-4)
  if (unique.includes(14)) {
    const lowValues = unique.filter((v) => v <= 5).concat([1]); // treat ace as 1
    const lowUnique = [...new Set(lowValues)].sort((a, b) => a - b);
    for (let i = 0; i < lowUnique.length; i++) {
      for (let j = i + 2; j < lowUnique.length; j++) {
        if (lowUnique[j] - lowUnique[i] <= 4) return true;
      }
    }
  }

  return false;
}
