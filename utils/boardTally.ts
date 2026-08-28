/**
 * EVERY BOARD IS ACCOUNTED FOR.
 *
 * A four-board hand with one tied board displayed "3 — 0". Three plus zero is three; the fourth
 * board vanished, and the player who hit it could not tell what had happened. That is the FOURTH
 * appearance of a binary count laid over a three-way outcome, in four separate files — results,
 * hand history, replay and the share card each wrote their own `filter(w==='player').length` /
 * `filter(w==='bot').length` pair, and a tied board is in NEITHER bucket.
 *
 * Writing the fix four times would have set up the fifth. So the tally lives here once and the
 * screens read it.
 *
 * ── WHY `tied` IS A REMAINDER AND NOT A THIRD FILTER ────────────────────────────────────────
 * `tied: boards.filter(b => b.winner === 'tie').length` would be a THIRD independent count, and
 * three independent counts can disagree with the total exactly the way two did. Deriving it as
 * `total - won - lost` makes
 *
 *     won + tied + lost === total
 *
 * true BY CONSTRUCTION, for any value `winner` ever takes. The brief's requirement — "the numbers
 * must add up to the board count" — is then a property of the function rather than a thing to
 * re-check whenever a producer changes.
 *
 * The explicit count is still taken, and in __DEV__ the two are compared: if they ever diverge,
 * some board carries a `winner` that is neither 'player' nor 'bot' nor 'tie', and that is worth
 * knowing loudly rather than absorbing into the remainder in silence.
 *
 * ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────────────────────
 * It does not decide who won the hand. deriveHandOutcome() in utils/handOutcome.ts is the single
 * derivation and it is settled — measured against the server seat by seat, including the three
 * player / three board / one board each shape where a combined count disagrees. This is a DISPLAY
 * tally, and `lost` here is deliberately the same collapsed "opponents combined" figure the
 * scoreboards have always shown. Changing THAT is a rules question, not a display gap, and it is
 * not this one.
 */

export interface TallyBoard {
  winner: string;
}

export interface BoardTally {
  /** Boards this player took outright. */
  won: number;
  /** Boards an opponent took — collapsed across opponents, as the scoreboards have always shown. */
  lost: number;
  /** Boards that awarded nobody. A REMAINDER, so the three always sum to `total`. */
  tied: number;
  /** How many boards the hand had. Dynamic: 2P=4, 3P=3, 4P=2 — never assume four. */
  total: number;
  /** True when at least one board tied, i.e. when a two-number score would be incomplete. */
  hasTie: boolean;
}

export function tallyBoards(boards: readonly TallyBoard[] | null | undefined): BoardTally {
  const list = boards ?? [];
  const total = list.length;
  const won = list.filter((b) => b.winner === 'player').length;
  const lost = list.filter((b) => b.winner === 'bot').length;
  const tied = total - won - lost;

  if (__DEV__) {
    const explicit = list.filter((b) => b.winner === 'tie').length;
    if (explicit !== tied) {
      // Not thrown: a bad `winner` must not blank the results screen. But it must not be quiet.
      console.warn(
        `[boardTally] ${tied} board(s) are neither won nor lost but only ${explicit} say 'tie'. ` +
        `Unexpected winner values: ${JSON.stringify(
          list.map((b) => b.winner).filter((w) => w !== 'player' && w !== 'bot' && w !== 'tie'))}`,
      );
    }
  }

  return { won, lost, tied, total, hasTie: tied > 0 };
}

/**
 * The line that makes the score add up, or null when a two-number score already does.
 *
 * FORM, AND WHY. The scoreboard numerals stay "3 — 0": that is the win-loss headline, it is what
 * players already read, and widening it to a three-number "3 — 1 — 0" borrows a football notation
 * whose middle term is ambiguous to anyone who has not seen a league table.
 *
 * Instead the accounting is spelled out underneath, LABELLED, and only when there is something to
 * account for:
 *
 *        3 — 0
 *    3 WON · 1 TIED · 0 LOST
 *
 * Every number carries its own word, so nothing has to be inferred from position; the three add to
 * the board count on their face; and it costs a returning player nothing, because a hand with no
 * tied board never renders it. The repetition of 3 and 0 is deliberate — the reader who is
 * confused by "3 — 0" is exactly the reader who needs the complete sentence, not a fragment of it.
 */
export function tallyLine(t: BoardTally): string | null {
  if (!t.hasTie) return null;
  return `${t.won} WON · ${t.tied} TIED · ${t.lost} LOST`;
}

/** Spoken form, for accessibilityLabel — screen readers should not have to parse "·" or an em dash. */
export function tallySpoken(t: BoardTally): string {
  const b = (n: number) => `${n} board${n === 1 ? '' : 's'}`;
  return t.hasTie
    ? `Won ${b(t.won)}, tied ${b(t.tied)}, lost ${b(t.lost)}, of ${t.total}`
    : `Won ${b(t.won)}, lost ${b(t.lost)}, of ${t.total}`;
}
