import { deriveHandOutcome } from '../handOutcome';

const b = (winner: string) => ({ winner });

describe('deriveHandOutcome — one definition of winning', () => {
  it('more boards than the opponent is a win', () => {
    expect(deriveHandOutcome([b('player'), b('player'), b('bot')])).toBe('win');
  });

  it('fewer boards than the opponent is a loss', () => {
    expect(deriveHandOutcome([b('bot'), b('bot'), b('player')])).toBe('loss');
  });

  it('equal boards is a TIE, not a loss', () => {
    // The whole point. A two-branch boolean over a three-way outcome is the defect class that
    // produced the original tie bug, and folding a tie into "not a win" reintroduces it.
    expect(deriveHandOutcome([b('player'), b('bot')])).toBe('tie');
  });

  it('THE PRODUCTION CASE — one board each at four players is a tie', () => {
    // Measured on real rows: a four-player, two-board hand where two seats took one board each
    // and each netted +50. Boards call it a tie; chips called it a win, and that split is what
    // fired the win overlay over a hand the record and the ladder both recorded as a tie.
    expect(deriveHandOutcome([b('player'), b('bot')])).toBe('tie');
  });

  it('a board that itself tied awards nobody', () => {
    // 'tie' boards count for neither side, so one player board against one tied board is a win.
    expect(deriveHandOutcome([b('player'), b('tie')])).toBe('win');
    // and all-tied boards make the hand a tie
    expect(deriveHandOutcome([b('tie'), b('tie')])).toBe('tie');
  });

  it('is independent of chips entirely — it never sees them', () => {
    // Expressed as a property of the signature rather than a value assertion: the function takes
    // boards and nothing else, so no caller can accidentally reintroduce a chip-derived win.
    expect(deriveHandOutcome.length).toBe(1);
  });

  it('no boards is a tie rather than a throw', () => {
    expect(deriveHandOutcome([])).toBe('tie');
  });
});

/**
 * PARITY WITH THE SERVER — ENUMERATED, NOT ASSERTED.
 *
 * The previous version of this module carried a comment claiming it matched `resolve-hand` at
 * three and four players. It did not, and no test looked: it compared my boards against the
 * opponents' COMBINED total, while the server compares against the highest SINGLE seat. Those
 * agree at two and four players and disagree at three players with one board each, where the
 * server records 'tied' for all three seats and the old rule returned 'loss' for every one.
 *
 * A sentence in a comment is exactly the kind of claim Rule 14 says is not evidence, so the claim
 * is now this: the server's rule, transcribed from supabase/functions/resolve-hand/index.ts, run
 * against EVERY distribution of every board at every table size.
 */
describe('deriveHandOutcome — parity with resolve-hand over every reachable distribution', () => {
  // Verbatim from resolve-hand/index.ts: below the max is 'lost', sharing it is 'tied',
  // holding it alone is 'won'.
  const serverRule = (boardsWonBySeat: number[]): 'win' | 'loss' | 'tie' => {
    const maxBoardsWon = Math.max(...boardsWonBySeat);
    const leaderCount = boardsWonBySeat.filter((n) => n === maxBoardsWon).length;
    const r = boardsWonBySeat[0] < maxBoardsWon ? 'lost' : leaderCount > 1 ? 'tied' : 'won';
    return r === 'won' ? 'win' : r === 'lost' ? 'loss' : 'tie';
  };

  // getBoardCount(): 2P=4, 3P=3, 4P=2. Never hardcode this anywhere but a table of expectations.
  const BOARD_COUNT: Record<number, number> = { 2: 4, 3: 3, 4: 2 };

  for (const players of [2, 3, 4]) {
    const boardCount = BOARD_COUNT[players];
    it(`${players} players / ${boardCount} boards — agrees with the server on every distribution`, () => {
      const seatOptions = [...Array(players).keys(), -1]; // a seat wins it, or the board itself ties
      const total = seatOptions.length ** boardCount;
      let checked = 0;
      for (let code = 0; code < total; code++) {
        let c = code;
        const assignment: number[] = [];
        for (let i = 0; i < boardCount; i++) {
          assignment.push(seatOptions[c % seatOptions.length]);
          c = Math.floor(c / seatOptions.length);
        }
        const boardsWonBySeat = Array(players).fill(0);
        for (const seat of assignment) if (seat >= 0) boardsWonBySeat[seat]++;

        const boards = assignment.map((seat) => ({
          winner: seat === 0 ? 'player' : seat === -1 ? 'tie' : 'bot',
          winnerSeat: seat,
        }));
        expect({ assignment, outcome: deriveHandOutcome(boards) })
          .toEqual({ assignment, outcome: serverRule(boardsWonBySeat) });
        checked++;
      }
      expect(checked).toBe(total);
    });
  }

  it('THE SHAPE THAT DISAGREED — three players, one board each, is a TIE', () => {
    // Three seats share the maximum of one board, so the server records 'tied' for all three.
    // Counting the opponents together made this 1 v 2 and returned 'loss' to every seat at the
    // table — a second definition of winning, on a shape that is reachable in a normal 3P hand.
    const oneEach = [
      { winner: 'player', winnerSeat: 0 },
      { winner: 'bot', winnerSeat: 1 },
      { winner: 'bot', winnerSeat: 2 },
    ];
    expect(deriveHandOutcome(oneEach)).toBe('tie');
    // and the loss is still a loss when a single opponent actually leads
    expect(deriveHandOutcome([
      { winner: 'player', winnerSeat: 0 },
      { winner: 'bot', winnerSeat: 1 },
      { winner: 'bot', winnerSeat: 1 },
    ])).toBe('loss');
    // and a genuine win is still a win
    expect(deriveHandOutcome([
      { winner: 'player', winnerSeat: 0 },
      { winner: 'player', winnerSeat: 0 },
      { winner: 'bot', winnerSeat: 1 },
    ])).toBe('win');
  });

  it('falls back to the collapsed count when no seat is present, and does not treat it as seat 0', () => {
    // Records written before the field existed have no winnerSeat. They must still work, and a
    // missing seat must not be read as "the local player won it".
    expect(deriveHandOutcome([{ winner: 'bot' }, { winner: 'bot' }, { winner: 'player' }])).toBe('loss');
    expect(deriveHandOutcome([{ winner: 'player' }, { winner: 'bot' }])).toBe('tie');
    // Mixed input is treated as unseated rather than half-applying the seat rule.
    expect(deriveHandOutcome([{ winner: 'player', winnerSeat: 0 }, { winner: 'bot' }])).toBe('tie');
  });
});
