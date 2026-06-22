import { isLocalComplete, isOpponentComplete } from '../resultsGating';

/**
 * GATE 2 (VAMOS-CAPS-PR37) — the win-case Claude could not produce via autoSim.
 * isLocalComplete is the single predicate that gates EVERY COMPLETE surface on the
 * results screen: CompleteOverlay, "COMPLETE! ALL BOARDS!", the bonus banner,
 * "Share COMPLETE!", the complete sound, CapsHooks.bonusAchieved, the complete-XP
 * award and mission progress, and the share-card/share-text isComplete. Therefore
 * testing this predicate verifies the render/gating in both directions.
 */
describe('results COMPLETE gating', () => {
  // ── WIN direction: the celebration + bonus/XP MUST render ──────────────────
  describe('isLocalComplete — celebration shows only when the local player swept', () => {
    it('returns true when the game completed and the local player won every board (4/4)', () => {
      // Arrange
      const isComplete = true;
      const playerWins = 4;
      const boardCount = 4;

      // Act
      const result = isLocalComplete(isComplete, playerWins, boardCount);

      // Assert
      expect(result).toBe(true);
    });

    it('returns true for a 2-board sweep (2/2)', () => {
      expect(isLocalComplete(true, 2, 2)).toBe(true);
    });

    // ── LOSS direction: NO celebration / no bonus / no "Share COMPLETE!" ──────
    it('returns false when the opponent swept all boards (local 0/4)', () => {
      // Arrange — isComplete is true (a complete happened) but the LOCAL player won nothing
      const isComplete = true;
      const playerWins = 0;
      const boardCount = 4;

      // Act
      const result = isLocalComplete(isComplete, playerWins, boardCount);

      // Assert — this is the COMPLETE-on-loss bug: must NOT celebrate
      expect(result).toBe(false);
    });

    it('returns false on a partial local result (3/4) even though it is not a complete', () => {
      expect(isLocalComplete(false, 3, 4)).toBe(false);
    });

    it('returns false when no complete happened, regardless of board wins', () => {
      expect(isLocalComplete(false, 4, 4)).toBe(false);
    });

    it('returns false for an empty board set (guards divide-by-zero / vacuous truth)', () => {
      expect(isLocalComplete(true, 0, 0)).toBe(false);
    });
  });

  // ── Opponent-complete: drives the "Opponent swept all boards" loss framing ──
  describe('isOpponentComplete — loss framing shows only when the opponent swept', () => {
    it('returns true when a complete happened but the local player did not sweep (0/4)', () => {
      expect(isOpponentComplete(true, 0, 4)).toBe(true);
    });

    it('returns false when the LOCAL player completed (4/4) — that is a win, not a sweep against us', () => {
      expect(isOpponentComplete(true, 4, 4)).toBe(false);
    });

    it('returns false when no complete happened at all', () => {
      expect(isOpponentComplete(false, 0, 4)).toBe(false);
    });
  });

  // ── The two predicates are mutually exclusive on a real complete ───────────
  it('local and opponent complete are never both true', () => {
    for (const [pw, bc] of [[0, 4], [1, 4], [3, 4], [4, 4], [2, 2], [0, 2]] as const) {
      const local = isLocalComplete(true, pw, bc);
      const opp = isOpponentComplete(true, pw, bc);
      expect(local && opp).toBe(false);
    }
  });
});
