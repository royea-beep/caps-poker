/**
 * BX2 — EXACT equity and outs for the board reveal.
 *
 * Why this file exists rather than reusing `computeOmahaEquity` directly:
 * that function samples by default (`maxSamples = 200`, ~±4%) and returns a single
 * number. The reveal needs three things it does not provide — a per-side split, the
 * out CARDS (not a count), and a guarantee of exactness so that every device and
 * every re-render shows the identical figure. See docs/REVEAL-SEQUENCE-SPEC.md BO2.
 *
 * THE COMBINATION COUNTS, verified against the real config rather than assumed:
 *
 *   players  boards  holes/board  post-flop unseen  C(u,2)  post-turn unseen
 *      2       4          8              41           820         40
 *      3       3         12              37           666         36
 *      4       2         16              33           528         32
 *
 * The spec quotes 666/36. That is the THREE-player case only; it generalised from one
 * example. All three counts are small enough to enumerate, so "exact, never sampled"
 * survives the correction — but the number itself was wrong for 2 and 4 players.
 *
 * A CAVEAT THAT CANNOT BE ENGINEERED AWAY, stated rather than hidden:
 * CAPS deals every board from one 52-card deck up front. At 2 players that consumes
 * all 52 cards (2x16 holes + 4x5 community). So the 41 "unseen" cards above are not
 * undealt — they are sitting on the other three boards. The equity here is therefore
 * the standard poker counterfactual ("over all runouts consistent with what this board
 * can see"), not "cards that could physically still arrive". The alternative — counting
 * only genuinely undealt cards — yields an EMPTY set at 2 players and an undefined
 * percentage, so it is not an option. This matches what every broadcast equity display
 * does, and it is the same set `computeOmahaEquity` already uses.
 */

import { Card, RANKS, SUITS } from '../constants/gameConfig';
import { evaluateOmahaHand } from './handEvaluator';

export interface EquitySplit {
  /** 0-100, player's share. Ties split, so the two sides always sum to 100. */
  selfPct: number;
  oppPct: number;
  /** How many combinations were enumerated. Exposed so the UI can never claim exact when it is not. */
  combos: number;
  /** Always true here; present so a future sampled path cannot silently pass for exact. */
  exact: true;
}

export interface OutsResult {
  /** The cards that matter next street. Exact enumeration. */
  outs: Card[];
  /** Outs that existed at the previous street and no longer do. Rendered struck through. */
  dead: Card[];
  /**
   * Which question the cards answer.
   *
   * MEASURED, not assumed: the naive definition ("cards that leave me ahead") returns
   * 35 of 41 cards when the player is already ahead at 78% — a row of noise that says
   * nothing. So the set is chosen by who is currently winning:
   *   'chasing' — player is behind or tied: cards that WIN it. The classic out.
   *   'defending' — player is ahead: cards that LOSE it. What a broadcast calls danger
   *                 cards, and the only genuinely informative set from in front.
   * Roye asked for "the cards they want to come". When you are ahead, the honest answer
   * is which cards you do NOT want, and the label has to say so.
   */
  mode: 'chasing' | 'defending';
}

const key = (c: Card) => `${c.rank}-${c.suit}`;

/** Every card not visible to this board. */
function remainingDeck(known: Card[]): Card[] {
  const seen = new Set(known.map(key));
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const k = `${rank}-${suit}`;
      if (!seen.has(k)) out.push({ rank, suit, id: k });
    }
  }
  return out;
}

export interface SeatEquity {
  /** 0 = the player, 1..N = bots in `botHands` order. */
  seat: number;
  isSelf: boolean;
  /** Integer 0-100. The array is guaranteed to sum to exactly 100 — see largestRemainder. */
  pct: number;
  /** Unrounded share, kept so ordering never flips between two seats that round the same. */
  raw: number;
}

/**
 * BY1 — per-seat equity. Roye: "מספר נפרד לכל יריב".
 *
 * Same enumeration as computeExactEquity, more counters. Every combination awards exactly
 * ONE point, split equally among the seats tied for the best hand — so a 3-way board where
 * two seats chop gives each of them 0.5 for that runout. Because each combination
 * distributes 1.0 and nothing else, the raw shares sum to 1 by construction and the
 * displayed integers are forced to 100 by largest-remainder rounding. There is no case
 * where four figures add up to 99 or 101 on screen.
 */
export function computeSeatEquity(
  playerCards: Card[],
  botHands: Card[][],
  community: Card[],
): SeatEquity[] {
  const live = botHands.filter((b) => b.length >= 2);
  const hands = [playerCards, ...live];
  if (playerCards.length < 2 || live.length === 0) {
    return [{ seat: 0, isSelf: true, pct: 100, raw: 1 }];
  }

  const deck = remainingDeck([...playerCards, ...live.flat(), ...community]);
  const need = 5 - community.length;
  const score = new Array<number>(hands.length);
  const points = new Array<number>(hands.length).fill(0);
  let combos = 0;

  const award = (board: Card[]) => {
    let best = -Infinity;
    for (let h = 0; h < hands.length; h++) {
      const s = evaluateOmahaHand(hands[h], board).score;
      score[h] = s;
      if (s > best) best = s;
    }
    let tied = 0;
    for (let h = 0; h < hands.length; h++) if (score[h] === best) tied++;
    const share = 1 / tied;
    for (let h = 0; h < hands.length; h++) if (score[h] === best) points[h] += share;
    combos++;
  };

  if (need <= 0) {
    award(community);
  } else if (need === 1) {
    for (let i = 0; i < deck.length; i++) award([...community, deck[i]]);
  } else {
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) award([...community, deck[i], deck[j]]);
  }

  const raws = points.map((p) => (combos === 0 ? 0 : p / combos));
  const pcts = largestRemainder(raws);
  return raws.map((raw, i) => ({ seat: i, isSelf: i === 0, pct: pcts[i], raw }));
}

/** Round shares to integers that sum to exactly 100. Plain rounding does not guarantee that. */
function largestRemainder(raws: number[]): number[] {
  const scaled = raws.map((r) => r * 100);
  const floors = scaled.map(Math.floor);
  let deficit = 100 - floors.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = floors.slice();
  for (let k = 0; k < order.length && deficit > 0; k++, deficit--) out[order[k].i]++;
  return out;
}

/** > 0 player ahead, 0 tie, < 0 behind. */
function compareAtBoard(playerCards: Card[], botHands: Card[][], board: Card[]): number {
  const p = evaluateOmahaHand(playerCards, board).score;
  let best = -Infinity;
  for (const b of botHands) {
    if (b.length < 2) continue;
    const s = evaluateOmahaHand(b, board).score;
    if (s > best) best = s;
  }
  if (best === -Infinity) return 1;
  return p > best ? 1 : p === best ? 0 : -1;
}

/**
 * Exact equity by full enumeration of the remaining street(s).
 * community.length may be 3 (flop, two to come) or 4 (turn, one to come) or 5 (done).
 */
export function computeExactEquity(
  playerCards: Card[],
  botHands: Card[][],
  community: Card[],
): EquitySplit {
  const live = botHands.filter((b) => b.length >= 2);
  if (playerCards.length < 2 || live.length === 0) {
    return { selfPct: 50, oppPct: 50, combos: 0, exact: true };
  }

  const deck = remainingDeck([...playerCards, ...live.flat(), ...community]);
  const need = 5 - community.length;

  let wins = 0;
  let ties = 0;
  let combos = 0;

  if (need <= 0) {
    const c = compareAtBoard(playerCards, live, community);
    return { selfPct: c > 0 ? 100 : c === 0 ? 50 : 0, oppPct: c > 0 ? 0 : c === 0 ? 50 : 100, combos: 1, exact: true };
  }

  if (need === 1) {
    for (let i = 0; i < deck.length; i++) {
      const c = compareAtBoard(playerCards, live, [...community, deck[i]]);
      if (c > 0) wins++; else if (c === 0) ties++;
      combos++;
    }
  } else {
    // need === 2 — C(n,2) unordered pairs
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const c = compareAtBoard(playerCards, live, [...community, deck[i], deck[j]]);
        if (c > 0) wins++; else if (c === 0) ties++;
        combos++;
      }
    }
  }

  const share = combos === 0 ? 0.5 : (wins + ties / 2) / combos;
  // Round once, derive the other side, so the pair always sums to exactly 100.
  const selfPct = Math.round(share * 100);
  return { selfPct, oppPct: 100 - selfPct, combos, exact: true };
}

/**
 * Outs as CARDS. An out is a single next card that leaves the player ahead.
 * `previousOuts` lets the turn pass mark what died — the narrowing draw is the drama,
 * and per BP3 a dead out gets a strikethrough, because "faded and small" also describes
 * a card that is merely further away.
 */
export function computeOuts(
  playerCards: Card[],
  botHands: Card[][],
  community: Card[],
  previousOuts?: Card[],
): OutsResult {
  const live = botHands.filter((b) => b.length >= 2);
  if (playerCards.length < 2 || live.length === 0 || community.length >= 5) {
    return { outs: [], dead: [], mode: 'chasing' };
  }

  // Where the player stands right now, on the cards actually visible.
  const standing = compareAtBoard(playerCards, live, community);
  const mode: 'chasing' | 'defending' = standing > 0 ? 'defending' : 'chasing';

  const deck = remainingDeck([...playerCards, ...live.flat(), ...community]);
  const outs: Card[] = [];
  for (const c of deck) {
    const after = compareAtBoard(playerCards, live, [...community, c]);
    // chasing: the card wins it. defending: the card loses it.
    if (mode === 'chasing' ? after > 0 : after <= 0) outs.push(c);
  }

  let dead: Card[] = [];
  if (previousOuts && previousOuts.length) {
    const stillLive = new Set(outs.map(key));
    dead = previousOuts.filter((c) => !stillLive.has(key(c)));
  }
  return { outs, dead, mode };
}

/** Stable display order: high rank first, then suit — so the row never reshuffles between renders. */
export function sortOuts(cards: Card[]): Card[] {
  const rankIdx = (r: string) => RANKS.indexOf(r as never);
  return [...cards].sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank) || SUITS.indexOf(a.suit as never) - SUITS.indexOf(b.suit as never));
}
