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
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Quads'
  | 'Straight Flush'
  | 'Flush Draw'
  | 'Straight Draw'
  | 'Str+Flush Draw'
  ;

const HINT_PRIORITY: Record<HandHintLabel, number> = {
  'High Card': 0,
  'Straight Draw': 1,
  'Flush Draw': 2,
  'Str+Flush Draw': 3,
  'Pair': 4,
  'Two Pair': 5,
  'Trips': 6,
  'Straight': 7,
  'Flush': 8,
  'Full House': 9,
  'Quads': 10,
  'Straight Flush': 11,
};

/**
 * Omaha-style: best 5-card hand from EXACTLY 2 player + 3 community.
 * If communityCards.length >= 3, enumerate combinations and return best.
 * Else fallback to player-cards-only hint (early arrange phase).
 */
export function getHandHint(playerCards: Card[], communityCards: Card[] = []): HandHintLabel {
  if (communityCards.length >= 3 && playerCards.length >= 2) {
    return getBestOmahaHint(playerCards, communityCards);
  }
  // Fallback: player-only hint (early arrange phase)
  const cards = playerCards;
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

// ============================================================
// Omaha 2+3 best-hand evaluator
// ============================================================

function getBestOmahaHint(playerCards: Card[], communityCards: Card[]): HandHintLabel {
  let best: HandHintLabel = 'High Card';
  // 2 from player
  for (let i = 0; i < playerCards.length; i++) {
    for (let j = i + 1; j < playerCards.length; j++) {
      // 3 from community
      for (let a = 0; a < communityCards.length; a++) {
        for (let b = a + 1; b < communityCards.length; b++) {
          for (let c = b + 1; c < communityCards.length; c++) {
            const five = [
              playerCards[i], playerCards[j],
              communityCards[a], communityCards[b], communityCards[c],
            ];
            const hint = evaluateFiveCardHand(five);
            if (HINT_PRIORITY[hint] > HINT_PRIORITY[best]) best = hint;
          }
        }
      }
    }
  }
  return best;
}

function evaluateFiveCardHand(cards: Card[]): HandHintLabel {
  const rankCounts = new Map<Rank, number>();
  for (const c of cards) rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1);
  const counts = [...rankCounts.values()].sort((a, b) => b - a);

  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => a - b);
  const isStraight = checkConsecutive(values);

  if (isFlush && isStraight) return 'Straight Flush';
  if (counts[0] === 4) return 'Quads';
  if (counts[0] === 3 && counts[1] === 2) return 'Full House';
  if (isFlush) return 'Flush';
  if (isStraight) return 'Straight';
  if (counts[0] === 3) return 'Trips';
  if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';
  if (counts[0] === 2) return 'Pair';
  return 'High Card';
}

function checkConsecutive(sortedValues: number[]): boolean {
  // Standard straight
  let consecutive = true;
  for (let i = 1; i < sortedValues.length; i++) {
    if (sortedValues[i] - sortedValues[i - 1] !== 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive) return true;
  // Ace-low (A-2-3-4-5)
  if (sortedValues.includes(14)) {
    const aceLow = sortedValues.map((v) => (v === 14 ? 1 : v)).sort((a, b) => a - b);
    let consec = true;
    for (let i = 1; i < aceLow.length; i++) {
      if (aceLow[i] - aceLow[i - 1] !== 1) {
        consec = false;
        break;
      }
    }
    if (consec) return true;
  }
  return false;
}
