/**
 * CompleteOverlay — practice-mode chip-gating regression test.
 * PRACTICE-CHIP-GATE-SWEEP 2026-07-09: the full-screen "BONUS +N" flash was the most
 * prominent unaddressed chip leak found across the S52-S55 gating passes — it fired
 * unconditionally on every COMPLETE sweep, practice or real. This locks the fix in place.
 */
import { shouldShowCompleteBonus } from '../completeOverlayGate';

describe('CompleteOverlay — shouldShowCompleteBonus', () => {
  test('hides the bonus amount in practice (XP-only, no chips actually move)', () => {
    expect(shouldShowCompleteBonus(true)).toBe(false);
  });

  test('shows the bonus amount for a real (non-practice) COMPLETE', () => {
    expect(shouldShowCompleteBonus(false)).toBe(true);
  });

  test('treats an unset isPractice (undefined) as real — never over-gate', () => {
    expect(shouldShowCompleteBonus(undefined)).toBe(true);
  });
});
