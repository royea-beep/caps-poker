import { GameConfig, DEFAULT_CONFIG, CARDS_PER_BOARD } from '../constants/gameConfig';
import {
  dealNewHand,
  assignCardsRandomly,
  evaluateAllBoards,
  calculateChipDeltas,
  MultiPlayerBoardResult,
} from './gameLogic';

export interface SimulationResult {
  playerCount: number;
  boardCount: number;
  boards: {
    index: number;
    winner: number; // player index, -1 for tie
    playerHands: { rank: string; score: number }[];
    potWon: number;
  }[];
  completeWinner: number | null; // player index who won all boards, null if none
  chipDeltas: number[]; // net chips per player
  durationMs: number;
}

export function simulateHand(
  playerCount: 2 | 3 | 4,
  config: GameConfig = DEFAULT_CONFIG
): SimulationResult {
  const start = performance.now();

  const { players, boards } = dealNewHand(playerCount, config);
  const boardCount = boards.length;

  // Each player randomly assigns their cards to boards
  for (let p = 0; p < playerCount; p++) {
    const assignments = assignCardsRandomly(players[p].cards, boardCount, CARDS_PER_BOARD);
    for (let b = 0; b < boardCount; b++) {
      boards[b].playerCards[p] = assignments[b];
    }
  }

  // Evaluate all boards
  const boardResults = evaluateAllBoards(boards, playerCount);

  // Calculate chip deltas
  const handResult = calculateChipDeltas(boardResults, playerCount, config);

  const durationMs = performance.now() - start;

  return {
    playerCount,
    boardCount,
    boards: handResult.boardResults.map((br: MultiPlayerBoardResult) => ({
      index: br.boardIndex,
      winner: br.winnerIndex,
      playerHands: br.playerResults.map((pr) => ({
        rank: pr.name,
        score: pr.score,
      })),
      potWon: br.potWon,
    })),
    completeWinner: handResult.completeWinner,
    chipDeltas: handResult.chipDeltas,
    durationMs,
  };
}

export interface BatchSimulationResult {
  playerCount: number;
  handsRun: number;
  zeroSumVerified: boolean;
  completeCount: number;
  completeRate: number;
  avgChipDeltaPerHand: number[];
  errors: string[];
  totalDurationMs: number;
}

export function simulateBatch(
  playerCount: 2 | 3 | 4,
  handCount: number,
  config: GameConfig = DEFAULT_CONFIG
): BatchSimulationResult {
  const start = performance.now();
  const errors: string[] = [];
  let completeCount = 0;
  let zeroSumVerified = true;
  const totalChipDeltas = new Array(playerCount).fill(0);

  for (let i = 0; i < handCount; i++) {
    try {
      const result = simulateHand(playerCount, config);

      // Verify zero-sum
      const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
      if (sum !== 0) {
        zeroSumVerified = false;
        errors.push(`Hand ${i}: chipDeltas sum = ${sum} (expected 0)`);
      }

      if (result.completeWinner !== null) {
        completeCount++;
      }

      for (let p = 0; p < playerCount; p++) {
        totalChipDeltas[p] += result.chipDeltas[p];
      }
    } catch (e) {
      errors.push(`Hand ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const totalDurationMs = performance.now() - start;

  return {
    playerCount,
    handsRun: handCount,
    zeroSumVerified,
    completeCount,
    completeRate: handCount > 0 ? (completeCount / handCount) * 100 : 0,
    avgChipDeltaPerHand: totalChipDeltas.map((d) => d / handCount),
    errors,
    totalDurationMs,
  };
}
