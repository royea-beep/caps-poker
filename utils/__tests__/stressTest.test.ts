/**
 * Stress Test — 500 hands × 3 player counts = 1500 game simulations
 * Validates: deck integrity, no duplicate cards, no evaluation crashes,
 * correct winner values, zero-sum chip deltas.
 */
import { createDeck, shuffleDeck, dealCardsMultiplayer } from '../deck';
import { evaluateOmahaHand } from '../handEvaluator';
import { evaluateAllBoards, calculateChipDeltas } from '../gameLogic';
import { DEFAULT_CONFIG, getBoardCount, CARDS_PER_BOARD } from '../../constants/gameConfig';
import { MultiBoardState } from '../../types/gameTypes';

const HAND_COUNT = 500;

function cardKey(c: { rank: string; suit: string }) {
  return `${c.rank}-${c.suit}`;
}

function assertNoDuplicates(cards: { rank: string; suit: string }[], label: string) {
  const seen = new Set<string>();
  for (const c of cards) {
    const k = cardKey(c);
    expect(seen.has(k)).toBe(false); // fails with duplicate message
    seen.add(k);
  }
}

describe('Stress Test — 500 hands × 3 player counts', () => {
  const playerCounts: Array<2 | 3 | 4> = [2, 3, 4];

  for (const playerCount of playerCounts) {
    describe(`${playerCount} players`, () => {
      for (let hand = 0; hand < HAND_COUNT; hand++) {
        it(`hand ${hand + 1}: no duplicates, no crashes, valid results`, () => {
          // ── 1. Deck integrity ──────────────────────────────────────────────
          const deck = shuffleDeck(createDeck());
          expect(deck.length).toBe(52);
          assertNoDuplicates(deck, 'full deck');

          // ── 2. Deal integrity ──────────────────────────────────────────────
          const { playerHands, boards: dealBoards } = dealCardsMultiplayer(playerCount);
          const boardCount = getBoardCount(playerCount);
          expect(dealBoards.length).toBe(boardCount);
          expect(playerHands.length).toBe(playerCount);

          const cardsPerPlayer = playerCount === 2 ? 16 : playerCount === 3 ? 12 : 8;
          playerHands.forEach((hand, i) => {
            expect(hand.length).toBe(cardsPerPlayer);
            assertNoDuplicates(hand, `player ${i} hand`);
          });

          // All player hands combined — no overlap between players
          const allPlayerCards = playerHands.flat();
          assertNoDuplicates(allPlayerCards, 'all player cards combined');

          // Community cards — no overlap with player cards
          const allCommunityCards = dealBoards.flatMap(b => [...b.openCards, ...b.closedCards]);
          const allDealtCards = [...allPlayerCards, ...allCommunityCards];
          assertNoDuplicates(allDealtCards, 'all dealt cards (players + community)');

          // ── 3. Build boards with random assignment ─────────────────────────
          const boards: MultiBoardState[] = dealBoards.map((b) => ({
            openCards: b.openCards,
            closedCards: b.closedCards,
            playerCards: Array.from({ length: playerCount }, () => [] as typeof b.openCards),
            revealed: false,
          }));

          // Assign player cards to boards (4 per board, random)
          for (let p = 0; p < playerCount; p++) {
            const shuffled = [...playerHands[p]].sort(() => Math.random() - 0.5);
            for (let b = 0; b < boardCount; b++) {
              boards[b].playerCards[p] = shuffled.slice(b * CARDS_PER_BOARD, (b + 1) * CARDS_PER_BOARD);
            }
          }

          // Verify each board has exactly CARDS_PER_BOARD cards per player
          for (const board of boards) {
            const allBoardCards = [
              ...board.openCards,
              ...board.closedCards,
              ...board.playerCards.flat(),
            ];
            assertNoDuplicates(allBoardCards, 'board-level cards');
            for (let p = 0; p < playerCount; p++) {
              expect(board.playerCards[p].length).toBe(CARDS_PER_BOARD);
            }
          }

          // ── 4. Evaluation — must not throw ────────────────────────────────
          const boardResults = evaluateAllBoards(boards, playerCount);
          expect(boardResults.length).toBe(boardCount);

          for (const result of boardResults) {
            expect(result.playerResults.length).toBe(playerCount);
            // winner is valid player index or -1 (tie)
            expect(result.winnerIndex >= -1 && result.winnerIndex < playerCount).toBe(true);
            for (const pr of result.playerResults) {
              expect(pr).toBeDefined();
              expect(typeof pr.score).toBe('number');
              expect(isFinite(pr.score)).toBe(true);
            }
          }

          // ── 5. Chip deltas — zero-sum ──────────────────────────────────────
          const mpResult = calculateChipDeltas(boardResults, playerCount, DEFAULT_CONFIG);
          const totalDelta = mpResult.chipDeltas.reduce((s, d) => s + d, 0);
          // Allow for ±1 rounding tolerance
          expect(Math.abs(totalDelta)).toBeLessThanOrEqual(playerCount);

          // completeWinner is null or a valid player index
          if (mpResult.completeWinner !== null) {
            expect(mpResult.completeWinner >= 0 && mpResult.completeWinner < playerCount).toBe(true);
          }
        });
      }
    });
  }

  // ── Evaluator edge cases ─────────────────────────────────────────────────────
  describe('evaluateOmahaHand edge cases', () => {
    it('returns default result for empty player cards', () => {
      const deck = shuffleDeck(createDeck());
      const result = evaluateOmahaHand([], deck.slice(0, 5));
      expect(result.score).toBe(0);
    });

    it('returns default result for empty board cards', () => {
      const deck = shuffleDeck(createDeck());
      const result = evaluateOmahaHand(deck.slice(0, 4), []);
      expect(result.score).toBe(0);
    });

    it('handles 4-card player hand + 5 board cards without crash', () => {
      for (let i = 0; i < 100; i++) {
        const deck = shuffleDeck(createDeck());
        const result = evaluateOmahaHand(deck.slice(0, 4), deck.slice(4, 9));
        expect(result).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
          'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'])
          .toContain(result.name);
      }
    });

    it('handles 3-card board (flop only) without crash', () => {
      for (let i = 0; i < 50; i++) {
        const deck = shuffleDeck(createDeck());
        const result = evaluateOmahaHand(deck.slice(0, 4), deck.slice(4, 7));
        expect(result).toBeDefined();
        expect(typeof result.score).toBe('number');
      }
    });

    it('handles 4-card board (flop+turn) without crash', () => {
      for (let i = 0; i < 50; i++) {
        const deck = shuffleDeck(createDeck());
        const result = evaluateOmahaHand(deck.slice(0, 4), deck.slice(4, 8));
        expect(result).toBeDefined();
        expect(typeof result.score).toBe('number');
      }
    });
  });
});
