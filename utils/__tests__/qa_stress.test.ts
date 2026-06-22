import { simulateHand, SimulationResult } from '../simulate';
import { DEFAULT_CONFIG, getBoardCount, CARDS_PER_BOARD, Card } from '../../constants/gameConfig';
import { evaluateOmahaHand } from '../handEvaluator';
import { calculateChipDeltas, evaluateAllBoards } from '../gameLogic';
import { MultiBoardState } from '../../types/gameTypes';

describe('QA Stress Tests', () => {
  // Helper: collect all card ids from a SimulationResult to check for duplicates
  function getAllCardIds(result: SimulationResult): string[] {
    // We can't directly access dealt cards from SimulationResult,
    // but we can verify board-level card counts and player hand counts
    return [];
  }

  // Helper: run N hands for a given player count and validate each
  function runAndValidateHands(
    playerCount: 2 | 3 | 4,
    handCount: number
  ): {
    results: SimulationResult[];
    winCounts: number[]; // wins per player index
    tieCounts: number; // boards that were ties
    completeCount: number;
    totalChipDeltas: number[];
  } {
    const expectedBoardCount = getBoardCount(playerCount);
    const results: SimulationResult[] = [];
    const winCounts = new Array(playerCount).fill(0);
    let tieCounts = 0;
    let completeCount = 0;
    const totalChipDeltas = new Array(playerCount).fill(0);

    for (let i = 0; i < handCount; i++) {
      const result = simulateHand(playerCount, DEFAULT_CONFIG);
      results.push(result);

      // Validate board count
      expect(result.boardCount).toBe(expectedBoardCount);
      expect(result.boards.length).toBe(expectedBoardCount);

      // Validate chipDeltas
      expect(result.chipDeltas.length).toBe(playerCount);
      for (const delta of result.chipDeltas) {
        expect(Number.isFinite(delta)).toBe(true);
        expect(Number.isNaN(delta)).toBe(false);
      }

      // Validate zero-sum
      const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);

      // Validate each board
      for (const board of result.boards) {
        // Winner is player index (0..playerCount-1) or -1 for tie
        expect(board.winner).toBeGreaterThanOrEqual(-1);
        expect(board.winner).toBeLessThan(playerCount);

        // Each board has results for exactly playerCount players
        expect(board.playerHands.length).toBe(playerCount);

        // Each player hand result has a rank string and numeric score
        for (const ph of board.playerHands) {
          expect(typeof ph.rank).toBe('string');
          expect(ph.rank.length).toBeGreaterThan(0);
          expect(typeof ph.score).toBe('number');
          expect(Number.isFinite(ph.score)).toBe(true);
        }

        // Track wins
        if (board.winner >= 0) {
          winCounts[board.winner]++;
        } else {
          tieCounts++;
        }
      }

      // Track completes
      if (result.completeWinner !== null) {
        completeCount++;
      }

      // Accumulate chip deltas
      for (let p = 0; p < playerCount; p++) {
        totalChipDeltas[p] += result.chipDeltas[p];
      }
    }

    return { results, winCounts, tieCounts, completeCount, totalChipDeltas };
  }

  // ---- Test 1: 500 hands — 2 players ----
  it('500 hands — 2 players', () => {
    const { results, winCounts, completeCount, totalChipDeltas } = runAndValidateHands(2, 500);

    const totalBoards = 500 * getBoardCount(2); // 500 * 4 = 2000
    const player0WinRate = ((winCounts[0] / totalBoards) * 100).toFixed(1);
    const player1WinRate = ((winCounts[1] / totalBoards) * 100).toFixed(1);
    const avgDelta0 = (totalChipDeltas[0] / 500).toFixed(1);
    const completeRate = ((completeCount / 500) * 100).toFixed(1);

    console.log(`[2P] Player win rate: ${player0WinRate}%, Bot win rate: ${player1WinRate}%`);
    console.log(`[2P] Avg chipDelta player: ${avgDelta0}`);
    console.log(`[2P] COMPLETE bonus frequency: ${completeCount}/500 (${completeRate}%)`);

    expect(results.length).toBe(500);
  });

  // ---- Test 2: 500 hands — 3 players ----
  it('500 hands — 3 players', () => {
    const { results, winCounts, completeCount, totalChipDeltas } = runAndValidateHands(3, 500);

    const totalBoards = 500 * getBoardCount(3); // 500 * 3 = 1500
    const winRates = winCounts.map((w) => ((w / totalBoards) * 100).toFixed(1));
    const avgDelta0 = (totalChipDeltas[0] / 500).toFixed(1);
    const completeRate = ((completeCount / 500) * 100).toFixed(1);

    console.log(`[3P] Win rates: P0=${winRates[0]}%, P1=${winRates[1]}%, P2=${winRates[2]}%`);
    console.log(`[3P] Avg chipDelta player: ${avgDelta0}`);
    console.log(`[3P] COMPLETE bonus frequency: ${completeCount}/500 (${completeRate}%)`);

    expect(results.length).toBe(500);
  });

  // ---- Test 3: 500 hands — 4 players ----
  it('500 hands — 4 players', () => {
    const { results, winCounts, completeCount, totalChipDeltas } = runAndValidateHands(4, 500);

    const totalBoards = 500 * getBoardCount(4); // 500 * 2 = 1000
    const winRates = winCounts.map((w) => ((w / totalBoards) * 100).toFixed(1));
    const avgDelta0 = (totalChipDeltas[0] / 500).toFixed(1);
    const completeRate = ((completeCount / 500) * 100).toFixed(1);

    console.log(`[4P] Win rates: P0=${winRates[0]}%, P1=${winRates[1]}%, P2=${winRates[2]}%, P3=${winRates[3]}%`);
    console.log(`[4P] Avg chipDelta player: ${avgDelta0}`);
    console.log(`[4P] COMPLETE bonus frequency: ${completeCount}/500 (${completeRate}%)`);

    expect(results.length).toBe(500);
  });

  // ---- Test 4: Edge case — all same suit flush board ----
  it('Edge case: all same suit flush board', () => {
    // Create 5 community cards all of the same suit (hearts)
    const boardCards: Card[] = [
      { suit: 'hearts', rank: '2', id: '2_hearts' },
      { suit: 'hearts', rank: '5', id: '5_hearts' },
      { suit: 'hearts', rank: '8', id: '8_hearts' },
      { suit: 'hearts', rank: 'J', id: 'J_hearts' },
      { suit: 'hearts', rank: 'A', id: 'A_hearts' },
    ];

    // Player cards — 2 hearts + 2 non-hearts
    const playerCards: Card[] = [
      { suit: 'hearts', rank: 'K', id: 'K_hearts' },
      { suit: 'hearts', rank: 'Q', id: 'Q_hearts' },
      { suit: 'clubs', rank: '3', id: '3_clubs' },
      { suit: 'diamonds', rank: '7', id: '7_diamonds' },
    ];

    // Should not crash and should produce a valid result
    const result = evaluateOmahaHand(playerCards, boardCards);
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
    expect(result.name.length).toBeGreaterThan(0);

    // With 2 hearts from player + 3 hearts from board, should be a flush or better
    expect(result.rank).toBeGreaterThanOrEqual(5); // HandRank.Flush = 5

    // Test with no player hearts — should still evaluate without crash
    const noFlushPlayer: Card[] = [
      { suit: 'clubs', rank: 'K', id: 'K_clubs' },
      { suit: 'diamonds', rank: 'Q', id: 'Q_diamonds' },
      { suit: 'spades', rank: '3', id: '3_spades' },
      { suit: 'clubs', rank: '7', id: '7_clubs' },
    ];
    const noFlushResult = evaluateOmahaHand(noFlushPlayer, boardCards);
    expect(noFlushResult).toBeDefined();
    expect(noFlushResult.score).toBeGreaterThan(0);
  });

  // ---- Test 5: Edge case — minimum arrangement time ----
  it('Edge case: minimum arrangement time', () => {
    const minTimeConfig = { ...DEFAULT_CONFIG, arrangementTime: 1 };

    // Run 10 hands with minimum arrangement time — should not affect simulation
    for (let i = 0; i < 10; i++) {
      const result = simulateHand(2, minTimeConfig);
      expect(result.boardCount).toBe(4);
      expect(result.chipDeltas.length).toBe(2);
      const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    }
  });

  // ---- Test 6: Edge case — chips at exactly buy-in then lose ----
  it('Edge case: chips at exactly buy-in then lose', () => {
    // With default config: potPerBoard=25, 4 boards → buy-in = 100
    const potPerBoard = DEFAULT_CONFIG.potPerBoard;
    const boardCount = getBoardCount(2);
    const buyIn = potPerBoard * boardCount; // 25 * 4 = 100

    // Simulate many hands and find one where player (index 0) loses
    let foundLoss = false;
    for (let i = 0; i < 200; i++) {
      const result = simulateHand(2, DEFAULT_CONFIG);
      if (result.chipDeltas[0] < 0) {
        foundLoss = true;
        // Player starts with exactly buyIn (100) chips
        const startChips = buyIn;
        const endChips = startChips + result.chipDeltas[0];

        // End chips should be >= 0 (can't go below 0 in a single hand with buy-in = 100)
        // Actually with default potPerBoard=25 and 4 boards, max loss = 100 (lose all boards)
        // Plus possible COMPLETE bonus paid to opponent
        // So endChips could be negative if COMPLETE bonus applies
        expect(Number.isFinite(endChips)).toBe(true);
        expect(typeof endChips).toBe('number');

        // Without COMPLETE, losing all 4 boards means losing exactly 100
        // With COMPLETE bonus (50%), losing all 4 means losing 100 + 50 = -150
        if (result.completeWinner === 1) {
          // Bot won all boards — player loses buy-in + bonus
          expect(result.chipDeltas[0]).toBe(-(buyIn + result.chipDeltas[1] - buyIn));
        }
        break;
      }
    }
    expect(foundLoss).toBe(true);
  });

  // ---- Test 7: Edge case — COMPLETE bonus math ----
  it('Edge case: COMPLETE bonus math', () => {
    // With 2 players: potPerBoard=25, 4 boards
    // Buy-in per player = 25 * 4 = 100
    // Total board pot per board = 25 * 2 = 50
    // Win all 4 boards: gross = 50*4 = 200, net from boards = 200 - 100 = +100
    // COMPLETE bonus: 50% of buy-in * (playerCount-1) = 50% * 100 * 1 = 50
    // Total net for winner = +100 + 50 = +150, loser = -150

    const potPerBoard = DEFAULT_CONFIG.potPerBoard;
    const boardCount = getBoardCount(2);
    const buyIn = potPerBoard * boardCount; // 100
    const totalBoardPot = potPerBoard * 2; // 50 per board
    // VAMOS-BUILD-506 — bonus is % of TOTAL POT (both buy-ins = buyIn * 2), not one buy-in.
    const expectedBonusAmount = Math.floor((buyIn * 2 * DEFAULT_CONFIG.completeBonusPercent) / 100); // 100

    // Run hands until we find a COMPLETE
    let foundComplete = false;
    for (let i = 0; i < 1000; i++) {
      const result = simulateHand(2, DEFAULT_CONFIG);
      if (result.completeWinner !== null) {
        foundComplete = true;
        const winner = result.completeWinner;
        const loser = winner === 0 ? 1 : 0;

        // Winner: won all boards (gross 200) minus buy-in (100) + bonus (50) = +150
        const expectedWinnerDelta = (totalBoardPot * boardCount) - buyIn + expectedBonusAmount;
        expect(result.chipDeltas[winner]).toBe(expectedWinnerDelta); // +150

        // Loser: paid buy-in (100) + bonus (50) = -150
        expect(result.chipDeltas[loser]).toBe(-expectedWinnerDelta); // -150

        // Verify zero-sum
        expect(result.chipDeltas[0] + result.chipDeltas[1]).toBe(0);

        console.log(`[COMPLETE] Winner idx=${winner}, delta=+${result.chipDeltas[winner]}, bonus=${expectedBonusAmount}`);
        break;
      }
    }
    if (!foundComplete) {
      console.log('Note: no COMPLETE occurred in 1000 hands — extremely unlikely');
    }
    expect(foundComplete).toBe(true);
  });

  // ---- Test 8: Chip conservation — zero-sum across 100 hands ----
  it('Chip conservation — zero-sum across 100 hands', () => {
    let cumulativeDelta0 = 0;
    let cumulativeDelta1 = 0;

    for (let i = 0; i < 100; i++) {
      const result = simulateHand(2, DEFAULT_CONFIG);

      // Each hand must be zero-sum individually
      const handSum = result.chipDeltas[0] + result.chipDeltas[1];
      expect(handSum).toBe(0);

      cumulativeDelta0 += result.chipDeltas[0];
      cumulativeDelta1 += result.chipDeltas[1];
    }

    // Cumulative must also sum to zero
    expect(cumulativeDelta0 + cumulativeDelta1).toBe(0);

    console.log(`[ZeroSum] After 100 hands: Player net=${cumulativeDelta0}, Bot net=${cumulativeDelta1}`);
  });
});
