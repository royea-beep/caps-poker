/**
 * COMPLETE celebration gating — VAMOS-COMPLETE-ON-LOSS 2026-06-22.
 *
 * The COMPLETE celebration (overlay, "COMPLETE! ALL BOARDS!", bonus banner, "Share
 * COMPLETE!", complete sound, complete-XP award, complete mission progress) must reflect
 * whether the LOCAL player swept every board — NOT `revealData.isComplete`, which is true
 * whenever EITHER player completes. gameLogic computes `completeWinner` but `RevealData`
 * drops it, so the results screen derives local-vs-opponent completion from the local
 * board-win count instead.
 *
 * A "complete" requires winning ALL boards (no ties), i.e. playerWins === boardCount.
 */

/** True when the LOCAL player won every board (the only case that should celebrate). */
export function isLocalComplete(
  isComplete: boolean,
  playerWins: number,
  boardCount: number,
): boolean {
  return isComplete && boardCount > 0 && playerWins === boardCount;
}

/** True when a complete happened but the LOCAL player did NOT sweep — i.e. the opponent did. */
export function isOpponentComplete(
  isComplete: boolean,
  playerWins: number,
  boardCount: number,
): boolean {
  return isComplete && !isLocalComplete(isComplete, playerWins, boardCount);
}
