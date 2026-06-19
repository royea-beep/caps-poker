// VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — English-only. The lang parameter is
// kept on the function signatures for source compatibility with existing
// callsites (BoardReveal/BoardResultCard/RevealSequence) but is now ignored.
// Hebrew was confusing when the device locale defaulted to 'he' since the rest
// of the app is migrating to English-only.
import { Card } from '../constants/gameConfig';

type Lang = 'en' | 'he';

/** Hand category name — always English. */
export function getHandName(englishName: string, _lang?: Lang): string {
  return englishName;
}

/**
 * "Three of a Kind beats One Pair" — always English, rank-specific via
 * getSpecificHandName when bestCards are available.
 */
export function getComparisonText(
  playerHandName: string,
  botHandName: string,
  winner: 'player' | 'bot' | 'tie',
  _lang?: Lang,
  playerBestCards?: Card[] | null,
  botBestCards?: Card[] | null,
): string {
  const p = getSpecificHandName(playerHandName, playerBestCards);
  const b = getSpecificHandName(botHandName, botBestCards);
  if (winner === 'tie') return `Tie — ${p}`;
  return winner === 'player' ? `${p} beats ${b}` : `${b} beats ${p}`;
}

// ─── Rank-specific labels (no evaluator calls) ────────────────────────────────

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};
const RANK_WORDS: Record<string, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven',
  '8': 'Eight', '9': 'Nine', '10': 'Ten', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace',
};
const RANK_PLURAL: Record<string, string> = {
  '2': 'Twos', '3': 'Threes', '4': 'Fours', '5': 'Fives', '6': 'Sixes', '7': 'Sevens',
  '8': 'Eights', '9': 'Nines', '10': 'Tens', 'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings', 'A': 'Aces',
};

function countByRank(cards: Card[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

function highestRank(cards: Card[]): string {
  let best = cards[0]?.rank ?? '2';
  let bestV = RANK_VALUES[best] ?? 0;
  for (const c of cards) {
    const v = RANK_VALUES[c.rank] ?? 0;
    if (v > bestV) { best = c.rank; bestV = v; }
  }
  return best;
}

/**
 * Returns a rank-specific English label for the hand
 * (e.g. "Pair of Kings", "Two Pair, Aces and Eights"). NO evaluator call —
 * derives everything from `bestCards`, which the reveal already computed.
 * Falls back to the plain category name when `bestCards` is missing.
 */
export function getSpecificHandName(handName: string, bestCards?: Card[] | null): string {
  if (!bestCards || bestCards.length === 0) return handName;
  const counts = countByRank(bestCards);
  const groups = Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count, value: RANK_VALUES[rank] ?? 0 }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  switch (handName) {
    case 'High Card': {
      const r = highestRank(bestCards);
      return `${RANK_WORDS[r] ?? r} High`;
    }
    case 'One Pair': {
      const pair = groups.find((g) => g.count === 2);
      return pair ? `Pair of ${RANK_PLURAL[pair.rank] ?? pair.rank}` : 'One Pair';
    }
    case 'Two Pair': {
      const pairs = groups.filter((g) => g.count === 2);
      if (pairs.length >= 2) {
        return `Two Pair, ${RANK_PLURAL[pairs[0].rank]} and ${RANK_PLURAL[pairs[1].rank]}`;
      }
      return 'Two Pair';
    }
    case 'Three of a Kind': {
      const trips = groups.find((g) => g.count === 3);
      return trips ? `Three of a Kind, ${RANK_PLURAL[trips.rank]}` : 'Three of a Kind';
    }
    case 'Straight': {
      const r = highestRank(bestCards);
      return `${RANK_WORDS[r] ?? r}-High Straight`;
    }
    case 'Flush': {
      const r = highestRank(bestCards);
      return `${RANK_WORDS[r] ?? r}-High Flush`;
    }
    case 'Full House': {
      const trips = groups.find((g) => g.count === 3);
      const pair = groups.find((g) => g.count === 2);
      if (trips && pair) {
        return `Full House, ${RANK_PLURAL[trips.rank]} over ${RANK_PLURAL[pair.rank]}`;
      }
      return 'Full House';
    }
    case 'Four of a Kind': {
      const quads = groups.find((g) => g.count === 4);
      return quads ? `Four of a Kind, ${RANK_PLURAL[quads.rank]}` : 'Four of a Kind';
    }
    case 'Straight Flush': {
      const r = highestRank(bestCards);
      return `${RANK_WORDS[r] ?? r}-High Straight Flush`;
    }
    case 'Royal Flush':
      return 'Royal Flush';
    default:
      return handName;
  }
}
