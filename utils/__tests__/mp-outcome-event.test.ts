/**
 * THE MULTIPLAYER TIE — `mp_game_ended` must carry an outcome derived from BOARDS.
 *
 * MEASURED BASELINE, production, 2026-09-06: 55 `mp_game_ended` rows across 47 devices and 30
 * rooms, 0 of them carrying `outcome`, 20 with `won:true`. Every one of those 55 decided the
 * result from `won: myDelta > 0` — a statement about CHIPS. A hand whose boards tie therefore
 * records `won:false` for every seat at the table, so in the event stream a tie is
 * indistinguishable from a loss. That is a FIFTH place deciding who won from chips, after the
 * screen, the ladder, the record and the local achievement check were all moved onto boards.
 *
 * THE OLD ROWS ARE NOT BACKFILLED. `mp_game_ended` never stored per-board data, so those 19
 * pre-cutoff hands cannot be adjudicated at all — the same reason the solo tie backfill was
 * refused (hand_history.boards_data is NULL in 100% of production rows). CUTOFF: events emitted
 * from 2026-09-06 carry `outcome`; anything earlier has `won` only, and a `won:false` there means
 * "did not net positive chips", NOT "lost".
 *
 * WHY THIS IS A TEST AND NOT A LIVE TIE. Forcing a real multiplayer tie needs two connected
 * clients to complete a hand where the boards split evenly, and no room has ever reached a
 * finished state — game_rooms shows 0 completed rooms, which is why no MP hand could be filmed
 * for the explainer clips either. Rather than stage something misleading, the tie branch is
 * proven here on the exact board shapes the two call sites construct, plus a source guard that
 * both sites feed `revealBoards` (boards) and not `myDelta` (chips) into the derivation.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { deriveHandOutcome } from '../handOutcome';

const SRC = join(__dirname, '..', '..', 'app', 'multiplayer-game.tsx');

/** Strip comments before matching. The fix's own comments quote the expression they replaced, so
 *  a raw text scan finds the defect inside the note saying the defect is gone. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The shape both call sites build: `winner` collapses opponents, `winnerSeat` does not.
 *  Seat 0 is always the local player after the rotation both paths apply. */
const board = (winnerSeat: number) => ({
  winner: winnerSeat === 0 ? 'player' : winnerSeat === -1 ? 'tie' : 'bot',
  winnerSeat,
});

describe('mp_game_ended carries a board-derived outcome', () => {
  it('the three-way split the collapsed count got wrong is a TIE', () => {
    // 3 players, 3 boards, one board each. The server calls this a tie (three seats share the
    // max). Counting the collapsed `winner` token gives me 1 and "bot" 2, i.e. a LOSS.
    const boards = [board(0), board(1), board(2)];
    expect(deriveHandOutcome(boards)).toBe('tie');
    expect(boards.filter((b) => b.winner === 'player').length).toBe(1);
    expect(boards.filter((b) => b.winner === 'bot').length).toBe(2);
  });

  it('an evenly split heads-up hand is a TIE, not a loss', () => {
    expect(deriveHandOutcome([board(0), board(1)])).toBe('tie');
  });

  it('boards that themselves tie do not hand the hand to an opponent', () => {
    expect(deriveHandOutcome([board(-1), board(-1)])).toBe('tie');
    expect(deriveHandOutcome([board(0), board(-1)])).toBe('win');
    expect(deriveHandOutcome([board(1), board(-1)])).toBe('loss');
  });

  it('win and loss still resolve the way the server does', () => {
    expect(deriveHandOutcome([board(0), board(0), board(1)])).toBe('win');
    expect(deriveHandOutcome([board(1), board(1), board(0)])).toBe('loss');
    // 4 players, 4 boards, 2 to me and 1 each to two opponents: a WIN against the best single
    // opponent, though the opponents' COMBINED count equals mine.
    expect(deriveHandOutcome([board(0), board(0), board(1), board(2)])).toBe('win');
  });

  it('outcome and won can legitimately disagree — that is the point', () => {
    // A tie pays out, so `won: myDelta > 0` may be false while the boards say tie. The event
    // must be able to say both things; folding the tie into `won` is what loses the signal.
    const outcome = deriveHandOutcome([board(0), board(1)]);
    const wonFromChips = 0 > 0;
    expect(outcome).toBe('tie');
    expect(wonFromChips).toBe(false);
    expect(outcome === 'win').toBe(false);
  });

  describe('both call sites, host and guest', () => {
    const src = code(SRC);

    it('fires mp_game_ended exactly twice and both carry outcome', () => {
      const fires = src.match(/track\(\s*'mp_game_ended'/g) ?? [];
      expect(fires.length).toBe(2);
      const withOutcome = src.match(/track\(\s*'mp_game_ended'[\s\S]{0,400}?\n\s*outcome,/g) ?? [];
      expect(withOutcome.length).toBe(2);
    });

    it('derives from revealBoards (boards), never from myDelta (chips)', () => {
      const derivations = src.match(/const outcome = deriveHandOutcome\(revealBoards\);/g) ?? [];
      expect(derivations.length).toBe(2);
      expect(src).toContain("import { deriveHandOutcome } from '../utils/handOutcome';");
      // No second definition of winning may creep back in beside it.
      expect(src).not.toMatch(/outcome[^\n]*myDelta\s*>\s*0/);
      expect(src).not.toMatch(/outcome:\s*[^\n,]*net_chips/);
    });

    it('keeps `won` for compatibility with the 55 rows already recorded', () => {
      const kept = src.match(/won: myDelta > 0,/g) ?? [];
      expect(kept.length).toBe(2);
    });
  });
});
