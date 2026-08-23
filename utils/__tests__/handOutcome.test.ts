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
