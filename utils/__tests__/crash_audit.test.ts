import { initializeGameMulti, placeSingleBotCards, autoFillPlayerCards, calculateHandResultsMulti } from '../gameLogic';
import { DEFAULT_CONFIG } from '../../constants/gameConfig';

describe('Crash Audit — 5000 games', () => {
  it('completes 5000 games without error (2 players)', () => {
    for (let i = 0; i < 5000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(2);
      const { boards: filledBoards } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5),
        boards
      );
      const finalBoards = placeSingleBotCards(botHands[0], filledBoards, 0);
      const results = calculateHandResultsMulti(finalBoards, 2, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(4);
      expect(typeof results.playerChipsWon).toBe('number');
    }
  });

  it('completes 2000 games without error (3 players)', () => {
    for (let i = 0; i < 2000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(3);
      const { boards: filledBoards } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5),
        boards
      );
      let finalBoards = filledBoards;
      for (let b = 0; b < botHands.length; b++) {
        finalBoards = placeSingleBotCards(botHands[b], finalBoards, b);
      }
      const results = calculateHandResultsMulti(finalBoards, 3, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(3);
    }
  });

  it('completes 1000 games without error (4 players)', () => {
    for (let i = 0; i < 1000; i++) {
      const { boards, playerHand, botHands } = initializeGameMulti(4);
      const { boards: filledBoards } = autoFillPlayerCards(
        [...playerHand].sort(() => Math.random() - 0.5),
        boards
      );
      let finalBoards = filledBoards;
      for (let b = 0; b < botHands.length; b++) {
        finalBoards = placeSingleBotCards(botHands[b], finalBoards, b);
      }
      const results = calculateHandResultsMulti(finalBoards, 4, DEFAULT_CONFIG);
      expect(results.boardResults).toHaveLength(2);
    }
  });
});
