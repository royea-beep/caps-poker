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
}

/**
 * Boards won OUTRIGHT decide it. A board that itself tied awards nobody, which is why this counts
 * 'player' and 'bot' separately rather than treating "not mine" as the opponent's.
 *
 * At two players this is solo's original rule unchanged. At three and four it matches the server's
 * rule in resolve-hand: share the maximum and it is a tie.
 */
export function deriveHandOutcome(boards: readonly OutcomeBoard[]): HandOutcome {
  const mine = boards.filter((b) => b.winner === 'player').length;
  const theirs = boards.filter((b) => b.winner === 'bot').length;
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'tie';
}
