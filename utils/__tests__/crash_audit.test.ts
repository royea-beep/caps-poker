import { initializeGameMulti, placeSingleBotCards, autoFillPlayerCards, calculateHandResultsMulti } from '../gameLogic';
import { DEFAULT_CONFIG } from '../../constants/gameConfig';

describe('Crash Audit', () => {
  it('5000 games with 2 players - no crash', () => {
    for (let i = 0; i < 5000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(2);
      const { boards: filled } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5), boards
      );
      const final = placeSingleBotCards(botHands[0], filled, 0);
      const results = calculateHandResultsMulti(final, 2, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(4);
      results.boardResults.forEach(r => {
        expect(r).toBeDefined();
        expect(['player', 'bot', 'tie']).toContain(r.winner);
      });
    }
  });

  it('2000 games with 3 players - no crash', () => {
    for (let i = 0; i < 2000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(3);
      const { boards: filled } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5), boards
      );
      let final = filled;
      for (let b = 0; b < botHands.length; b++) {
        final = placeSingleBotCards(botHands[b], final, b);
      }
      const results = calculateHandResultsMulti(final, 3, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(3);
    }
  });

  it('1000 games with 4 players - no crash', () => {
    for (let i = 0; i < 1000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(4);
      const { boards: filled } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5), boards
      );
      let final = filled;
      for (let b = 0; b < botHands.length; b++) {
        final = placeSingleBotCards(botHands[b], final, b);
      }
      const results = calculateHandResultsMulti(final, 4, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(2);
    }
  });
});
