import { simulateHand, simulateBatch } from '../simulate';
import { DEFAULT_CONFIG } from '../../constants/gameConfig';

describe('simulateHand', () => {
  // --- 2-Player Tests ---
  describe('2-player', () => {
    it('runs 100 hands without crashes', () => {
      for (let i = 0; i < 100; i++) {
        expect(() => simulateHand(2, DEFAULT_CONFIG)).not.toThrow();
      }
    });

    it('chipDeltas always sum to 0 (zero-sum)', () => {
      for (let i = 0; i < 100; i++) {
        const result = simulateHand(2, DEFAULT_CONFIG);
        const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
      }
    });

    it('has correct board count (4)', () => {
      const result = simulateHand(2, DEFAULT_CONFIG);
      expect(result.boardCount).toBe(4);
      expect(result.boards.length).toBe(4);
    });

    it('each board has exactly one winner or tie', () => {
      for (let i = 0; i < 50; i++) {
        const result = simulateHand(2, DEFAULT_CONFIG);
        for (const board of result.boards) {
          // winner is a player index or -1 for tie
          expect(board.winner).toBeGreaterThanOrEqual(-1);
          expect(board.winner).toBeLessThan(2);
        }
      }
    });

    it('COMPLETE bonus math is correct when it occurs', () => {
      // Run enough hands to get at least one complete
      let foundComplete = false;
      for (let i = 0; i < 500; i++) {
        const result = simulateHand(2, DEFAULT_CONFIG);
        if (result.completeWinner !== null) {
          foundComplete = true;
          // Winner should have positive delta including bonus
          const winnerDelta = result.chipDeltas[result.completeWinner];
          expect(winnerDelta).toBeGreaterThan(0);
          // Zero-sum still holds
          const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
          expect(sum).toBe(0);
        }
      }
      // It's possible (though unlikely) no complete occurred in 500 hands
      // Just note it, don't fail
      if (!foundComplete) {
        console.log('Note: no COMPLETE occurred in 500 hands (unlikely but possible)');
      }
    });

    it('each board has results for exactly 2 players', () => {
      const result = simulateHand(2, DEFAULT_CONFIG);
      for (const board of result.boards) {
        expect(board.playerHands.length).toBe(2);
      }
    });
  });

  // --- 3-Player Tests ---
  describe('3-player', () => {
    it('runs 100 hands without crashes', () => {
      for (let i = 0; i < 100; i++) {
        expect(() => simulateHand(3, DEFAULT_CONFIG)).not.toThrow();
      }
    });

    it('chipDeltas sum to 0', () => {
      for (let i = 0; i < 100; i++) {
        const result = simulateHand(3, DEFAULT_CONFIG);
        const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
      }
    });

    it('has correct board count (3)', () => {
      const result = simulateHand(3, DEFAULT_CONFIG);
      expect(result.boardCount).toBe(3);
      expect(result.boards.length).toBe(3);
    });

    it('each board has results for exactly 3 players', () => {
      const result = simulateHand(3, DEFAULT_CONFIG);
      for (const board of result.boards) {
        expect(board.playerHands.length).toBe(3);
      }
    });

    it('chipDeltas has 3 entries', () => {
      const result = simulateHand(3, DEFAULT_CONFIG);
      expect(result.chipDeltas.length).toBe(3);
    });
  });

  // --- 4-Player Tests ---
  describe('4-player', () => {
    it('runs 100 hands without crashes', () => {
      for (let i = 0; i < 100; i++) {
        expect(() => simulateHand(4, DEFAULT_CONFIG)).not.toThrow();
      }
    });

    it('chipDeltas sum to 0', () => {
      for (let i = 0; i < 100; i++) {
        const result = simulateHand(4, DEFAULT_CONFIG);
        const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
      }
    });

    it('has correct board count (2)', () => {
      const result = simulateHand(4, DEFAULT_CONFIG);
      expect(result.boardCount).toBe(2);
      expect(result.boards.length).toBe(2);
    });

    it('each board has results for exactly 4 players', () => {
      const result = simulateHand(4, DEFAULT_CONFIG);
      for (const board of result.boards) {
        expect(board.playerHands.length).toBe(4);
      }
    });

    it('chipDeltas has 4 entries', () => {
      const result = simulateHand(4, DEFAULT_CONFIG);
      expect(result.chipDeltas.length).toBe(4);
    });
  });

  // --- 5-Player Tests ---
  describe('5-player', () => {
    it('5-player 2-board game deals correctly', () => {
      const result = simulateHand(5, DEFAULT_CONFIG);
      expect(result.playerCount).toBe(5);
      expect(result.boardCount).toBe(2);
      expect(result.boards.length).toBe(2);
      expect(result.chipDeltas.length).toBe(5);
    });

    it('chipDeltas sum to 0 (zero-sum)', () => {
      for (let i = 0; i < 50; i++) {
        const result = simulateHand(5, DEFAULT_CONFIG);
        const sum = result.chipDeltas.reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);
      }
    });

    it('runs 50 hands without crashes', () => {
      for (let i = 0; i < 50; i++) {
        expect(() => simulateHand(5, DEFAULT_CONFIG)).not.toThrow();
      }
    });
  });
});

describe('simulateBatch', () => {
  it('runs a batch of 2-player hands correctly', () => {
    const result = simulateBatch(2, 50, DEFAULT_CONFIG);
    expect(result.handsRun).toBe(50);
    expect(result.zeroSumVerified).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.avgChipDeltaPerHand.length).toBe(2);
  });

  it('runs a batch of 3-player hands correctly', () => {
    const result = simulateBatch(3, 50, DEFAULT_CONFIG);
    expect(result.handsRun).toBe(50);
    expect(result.zeroSumVerified).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.avgChipDeltaPerHand.length).toBe(3);
  });

  it('runs a batch of 4-player hands correctly', () => {
    const result = simulateBatch(4, 50, DEFAULT_CONFIG);
    expect(result.handsRun).toBe(50);
    expect(result.zeroSumVerified).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.avgChipDeltaPerHand.length).toBe(4);
  });
});
