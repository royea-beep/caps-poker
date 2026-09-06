/**
 * ONE DERIVATION, EVERYWHERE — the regression guard for TOTAL-AUDIT C1.
 *
 * C1 was "two sources of truth on the hand outcome": app/hand-history.tsx and app/replay.tsx
 * decided win/loss/tie from the COLLAPSED board count (`playerWins > botWins ? … : … : 'tie'`),
 * which merges every opponent into one bucket, while results.tsx, statsEngine, shareHand and
 * achievements all read `deriveHandOutcome()`. One stored hand, two answers — and the reachable
 * divergence is three players / three boards / one board each, which the server calls a TIE and
 * the collapsed count called a LOSS.
 *
 * A unit test cannot mount those screens here, so this pins the two things that actually broke:
 * the screens must IMPORT the one derivation, and must not carry the collapsed comparison that
 * replaced it. It is a source guard on purpose — the defect was a line of code, not a value.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { deriveHandOutcome } from '../handOutcome';
import { getBoardCount } from '../../constants/gameConfig';

const SCREENS = ['app/hand-history.tsx', 'app/replay.tsx'];
/**
 * COMMENTS ARE STRIPPED FIRST, and that is not a detail. The first version of this guard failed
 * immediately: the fix's own comment QUOTES the expression it replaced, so a raw text match found
 * the defect inside the note explaining that the defect is gone. A source guard that cannot tell
 * code from prose reports the wrong thing — the same "right name, wrong content" shape this
 * project keeps hitting. It reads code only.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', '..', p), 'utf-8'));

describe('C1 — one outcome derivation', () => {
  it.each(SCREENS)('%s reads deriveHandOutcome', (p) => {
    expect(read(p)).toMatch(/deriveHandOutcome\s*\(/);
  });

  it.each(SCREENS)('%s does not decide the outcome from the collapsed count', (p) => {
    // The exact shape that was there: a ternary comparing the two collapsed totals to a verdict.
    const collapsed = /playerWins\s*[<>]\s*botWins\s*\?\s*['"](win|loss)['"]/;
    expect(read(p)).not.toMatch(collapsed);
  });

  it('the shape C1 named still resolves to a tie', () => {
    // 3 players, 3 boards, one board each: seat 0 = me, seats 1 and 2 = the two opponents.
    const boards = [
      { winner: 'player', winnerSeat: 0 },
      { winner: 'bot', winnerSeat: 1 },
      { winner: 'bot', winnerSeat: 2 },
    ];
    expect(deriveHandOutcome(boards)).toBe('tie');
    // and the collapsed count — what the screens used to do — disagrees, which is the whole point
    const mine = boards.filter((b) => b.winner === 'player').length;
    const theirs = boards.filter((b) => b.winner === 'bot').length;
    expect(mine > theirs ? 'win' : mine < theirs ? 'loss' : 'tie').toBe('loss');
  });

  it('old rows without winnerSeat are unaffected — the fallback IS the collapsed count', () => {
    const boards = [{ winner: 'player' }, { winner: 'bot' }, { winner: 'bot' }];
    expect(deriveHandOutcome(boards)).toBe('loss');
  });
});

/**
 * ONE BOARD-COUNT RULE, TOO. app/lobby/index.tsx used to restate 4 / 3 / 2 as literals — a second
 * source of truth for the rule CLAUDE.md makes a hard rule. Same family as C1: the numbers were
 * right, and a duplicated rule is a rule waiting to disagree with itself. The lobby is the screen
 * that TELLS a player what a table will deal them, so it reads getBoardCount() now.
 */
describe('the lobby reads the board-count rule rather than restating it', () => {
  it('app/lobby/index.tsx has no hardcoded board literals in its table list', () => {
    const src = read('app/lobby/index.tsx');
    expect(src).toMatch(/boards:\s*getBoardCount\(/);
    expect(src).not.toMatch(/label:\s*'Heads-Up',\s*boards:\s*4/);
  });

  it('and the rule itself is unchanged: 2P=4, 3P=3, 4P=2', () => {
    expect([getBoardCount(2), getBoardCount(3), getBoardCount(4)]).toEqual([4, 3, 2]);
  });
});
