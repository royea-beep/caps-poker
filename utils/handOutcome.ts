/**
 * ONE DEFINITION OF WINNING.
 *
 * Boards decide who won — in solo, in multiplayer, on the server and on the screen. This is the
 * single derivation; everything that needs to know the outcome READS it. Nobody converts.
 *
 * WHY THIS FILE EXISTS. The record, the ladder, /rank, /stats and the server achievements have
 * derived a win from BOARDS since the boards rule shipped. The celebration kept deriving it from
 * CHIPS — seven separate `netChips > 0` decisions across the results screen and the local
 * achievement check. Two definitions of winning in one game is the exact split that produced the
 * tie defect, and it was measured diverging on real production rows: a four-player hand where two
 * seats each took one board and each netted +50. Boards call that a tie. Chips called it a win, so
 * the screen fired the win overlay, credited win XP, ticked games_won and logged analytics 'win'
 * over a hand the record and the ladder both called a tie.
 *
 * A TIE IS A THIRD STATE, never "not a win". Every reader gets all three and decides for itself
 * what a tie means — the overlay neither celebrates nor mourns it, the sounds stay silent, and
 * analytics carries 'tie' as its own value rather than folding it into a loss.
 *
 * CHIPS STILL SETTLE FROM CHIPS. record_hand_net is zero-sum and untouched. This changes what is
 * CELEBRATED, not what is PAID — and a figure quoted about money still comes from netChips, which
 * is why a few `netChips > 0` checks legitimately remain (the "+N chips earned" line, the tie
 * bonus, biggest-win). Those are statements about money, not about who won.
 */

export type HandOutcome = 'win' | 'loss' | 'tie';

/** Structural on purpose — every caller already holds boards with a `winner`, and importing the
 *  full RevealData type here would make this module depend on the screens that read it. */
export interface OutcomeBoard {
  winner: string;
  /**
   * THE SEAT THAT WON THIS BOARD OUTRIGHT, normalised to the local player's viewpoint:
   * `0` = me, `1..N-1` = a SPECIFIC opponent (stable within the hand), `-1` = the board tied.
   *
   * WHY THIS EXISTS — `winner` collapses every opponent into the single token 'bot', which is
   * lossy the moment there is more than one of them. Counting 'bot' boards yields the opponents'
   * COMBINED total, but the server compares against the HIGHEST SINGLE seat. Those are different
   * functions, and they disagree on exactly one reachable shape: three players, three boards,
   * one board each. The server calls that a tie (three seats share the max); the collapsed count
   * called it a loss (mine 1 < theirs 2). Optional because the fallback below is provably
   * identical wherever it is absent.
   */
  winnerSeat?: number;
}

/**
 * Boards won OUTRIGHT decide it. A board that itself tied awards nobody, which is why a tied board
 * is never credited to either side.
 *
 * MEASURED AGAINST THE SERVER, NOT ASSERTED TO MATCH IT. The first version of this function
 * compared my boards against the opponents' COMBINED total and this comment claimed it matched
 * resolve-hand at three and four players. Enumerating every reachable distribution disproved that:
 * at three players with three boards and one board each, the server records 'tied' for all three
 * seats while the combined count returned 'loss' for every one of them. The comparison is now
 * against the best SINGLE opponent, which is the server's rule exactly, and the enumeration is a
 * test rather than a sentence.
 */
export function deriveHandOutcome(boards: readonly OutcomeBoard[]): HandOutcome {
  // THE SERVER'S RULE, APPLIED SEAT BY SEAT. resolve-hand decides a seat's result by comparing
  // its boards-won against the HIGHEST count held by any seat: sole holder of the max is 'won',
  // sharing the max is 'tied', below it is 'lost'. Comparing my count against the best SINGLE
  // opponent is the same function, which is what this is.
  const seated = boards.every((b) => typeof b.winnerSeat === 'number');
  if (seated && boards.length > 0) {
    const perSeat = new Map<number, number>();
    for (const b of boards) {
      const seat = b.winnerSeat as number;
      if (seat >= 0) perSeat.set(seat, (perSeat.get(seat) ?? 0) + 1); // -1 = board tied, awards nobody
    }
    const mine = perSeat.get(0) ?? 0;
    let bestOpponent = 0; // a seat that won no board still holds 0, so this starts there
    for (const [seat, won] of perSeat) if (seat !== 0 && won > bestOpponent) bestOpponent = won;
    return mine > bestOpponent ? 'win' : mine < bestOpponent ? 'loss' : 'tie';
  }

  // FALLBACK — no per-seat data (hand records written before the field existed, and any producer
  // that has only the collapsed token). Enumerated against the server rule over EVERY reachable
  // distribution: identical at two players (4 boards) and at four players (2 boards); the only
  // shape it gets wrong is three players / three boards / one board each. See handOutcome.test.ts.
  const mine = boards.filter((b) => b.winner === 'player').length;
  const theirs = boards.filter((b) => b.winner === 'bot').length;
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'tie';
}
