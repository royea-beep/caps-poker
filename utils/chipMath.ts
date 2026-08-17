/**
 * THE CHIP ARITHMETIC, AS A LEAF. IMPORTS NOTHING.
 *
 * WHY THIS EXISTS. Server-side adjudication must compute chips with the SAME arithmetic the client
 * computes, or the reveal disagrees with what gets recorded and paid. But `gameLogic.ts` cannot be
 * generated for an Edge Function: its import chain pulls in `deck.ts` — THE CLIENT DEALER that
 * server-side dealing exists to remove — plus the bot strategy and, through `gameConfig.ts` and
 * `theme.ts`, the whole UI palette. Pulling the dealer into the adjudicator would undo stage 1
 * while appearing to complete stage 2.
 *
 * THE SECOND REASON, AND IT IS THE IMPORTANT ONE. `getCompleteBonusPercent` reads module-level
 * mutable state that only the app's `_layout` bootstrap ever sets:
 *
 *   let _remoteBonusPctByBoards: Record<string, number> | null = null;   // constants/gameConfig.ts
 *
 * In a server runtime nothing calls the setter, so it returns the flat fallback FOREVER — paying
 * 50% where the live map says 25% at two boards and 75% at four. It would bundle green, run, and
 * be quietly wrong in the economy. Every wall before this one failed loudly; that one would have
 * passed every check and mispaid every hand.
 *
 * So the percent is a PARAMETER here. A function that is handed its input cannot silently fall
 * back to a stale default — the caller must say what it means, and a server caller reads
 * `app_config` and says so explicitly.
 *
 * THE RULE. This file imports nothing, and must keep importing nothing. If something creeps in it
 * breaks in the Edge Function and not in the app — invisible locally, which is exactly how the bug
 * above would have shipped. The algorithm below is byte-identical to the one that lived in
 * `gameLogic.ts`; only its location and the source of the bonus percent changed.
 */

/** The only board fields the arithmetic touches. Structural on purpose: importing the evaluator's
 *  `HandResult` would drag the engine in, and this computation never looks at the hands. */
export interface ChipBoardResult {
  winnerIndex: number; // player index, -1 for tie
  tiedPlayers: number[]; // player indices in case of multi-way tie
  potWon: number; // written back by this function
}

/** The only config field the arithmetic reads. Structural so `GameConfig` — and `theme.ts` behind
 *  it — stays out of the graph. */
export interface ChipConfig {
  potPerBoard: number;
}

export interface ChipDeltasResult<B extends ChipBoardResult> {
  boardResults: B[];
  chipDeltas: number[]; // net chips per player (zero-sum)
  completeWinner: number | null; // player index who won ALL boards, null if none
  completeBonusAmount: number;
}

/**
 * @param bonusPercent COMPLETE-bonus percentage for THIS board count. The caller resolves it —
 *   the app from its loaded `app_config` map, a server from its own read. Never module state.
 */
export function calculateChipDeltasCore<B extends ChipBoardResult>(
  boardResults: B[],
  playerCount: number,
  config: ChipConfig,
  bonusPercent: number
): ChipDeltasResult<B> {
  const potPerBoard = config.potPerBoard;
  const totalBoardPot = potPerBoard * playerCount; // all players contribute
  const chipDeltas = new Array(playerCount).fill(0);

  // Each player pays potPerBoard per board
  const boardCount = boardResults.length;
  const totalPaid = potPerBoard * boardCount;
  for (let p = 0; p < playerCount; p++) {
    chipDeltas[p] -= totalPaid;
  }

  for (const result of boardResults) {
    if (result.winnerIndex >= 0) {
      // Single winner takes the whole pot
      chipDeltas[result.winnerIndex] += totalBoardPot;
      result.potWon = totalBoardPot;
    } else {
      // Tie — split pot among tied players, distribute rounding remainder
      const tiedCount = result.tiedPlayers.length;
      const share = Math.floor(totalBoardPot / tiedCount);
      const tieRemainder = totalBoardPot - share * tiedCount;
      for (let t = 0; t < tiedCount; t++) {
        const extra = t < tieRemainder ? 1 : 0;
        chipDeltas[result.tiedPlayers[t]] += share + extra;
      }
      result.potWon = share;
    }
  }

  // Check COMPLETE: did any player win ALL boards?
  let completeWinner: number | null = null;
  for (let p = 0; p < playerCount; p++) {
    if (boardResults.every((r) => r.winnerIndex === p)) {
      completeWinner = p;
      break;
    }
  }

  // VAMOS-BUILD-506 2026-06-22 — COMPLETE bonus = % of the TOTAL POT (sum across ALL
  // boards and ALL players), not one player's buy-in. Heads-up this is ~2x the old value
  // (total pot = both players' buy-ins). The cost is distributed across the losers below
  // (zero-sum), so the winner effectively takes the bonus "from the opponent(s)".
  const totalPot = potPerBoard * boardCount * playerCount; // full pot: all boards × all players
  let completeBonusAmount = 0;
  if (completeWinner !== null) {
    // VAMOS S-BATCH — bonus % scales with board count. THE ONLY CHANGED LINE: the percent arrives
    // as an argument instead of being read from module state, for the reason in the header.
    completeBonusAmount = Math.floor((totalPot * bonusPercent) / 100);
    chipDeltas[completeWinner] += completeBonusAmount;
    // Distribute bonus cost to losers (zero-sum)
    const losers = playerCount - 1;
    const perLoserCost = Math.floor(completeBonusAmount / losers);
    const remainder = completeBonusAmount - perLoserCost * losers;
    for (let p = 0; p < playerCount; p++) {
      if (p !== completeWinner) {
        chipDeltas[p] -= perLoserCost;
      }
    }
    // Assign any rounding remainder to the first loser
    if (remainder > 0) {
      for (let p = 0; p < playerCount; p++) {
        if (p !== completeWinner) {
          chipDeltas[p] -= remainder;
          break;
        }
      }
    }
  }

  return { boardResults, chipDeltas, completeWinner, completeBonusAmount };
}
