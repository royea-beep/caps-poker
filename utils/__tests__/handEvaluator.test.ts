import { evaluateOmahaHand, compareHands, HandRank } from '../handEvaluator';
import { Card, Suit } from '../../constants/gameConfig';

function card(rank: string, suit: string): Card {
  const suitMap: Record<string, Suit> = {
    h: 'hearts',
    d: 'diamonds',
    c: 'clubs',
    s: 'spades',
  };
  return { rank: rank as Card['rank'], suit: suitMap[suit], id: `${rank}_${suitMap[suit]}` };
}

describe('evaluateOmahaHand', () => {
  test('Royal Flush', () => {
    const player = [card('A', 'h'), card('K', 'h'), card('2', 'c'), card('3', 'd')];
    const board = [card('Q', 'h'), card('J', 'h'), card('10', 'h'), card('2', 's'), card('3', 's')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.RoyalFlush);
    expect(result.playerCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
  });

  test('Straight Flush', () => {
    const player = [card('9', 'h'), card('8', 'h'), card('2', 'c'), card('3', 'd')];
    const board = [card('7', 'h'), card('6', 'h'), card('5', 'h'), card('2', 's'), card('K', 'd')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.StraightFlush);
    expect(result.playerCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
  });

  test('Four of a Kind', () => {
    const player = [card('A', 's'), card('A', 'h'), card('2', 'c'), card('3', 'd')];
    const board = [card('A', 'd'), card('A', 'c'), card('K', 'h'), card('3', 's'), card('4', 'd')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.FourOfAKind);
  });

  test('Full House', () => {
    const player = [card('A', 'h'), card('A', 's'), card('2', 'c'), card('3', 'd')];
    const board = [card('K', 'h'), card('K', 's'), card('K', 'd'), card('7', 'c'), card('8', 'd')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.FullHouse);
  });

  test('Full House — 4s full of 7s (regression: pre-calc stale bot cards showed High Card)', () => {
    // Exact cards from bug report: bot 2♦,7♥,4♠,Q♥ vs community 4♣,7♦,A♥,6♣,4♦
    // Best: 7♥+4♠ (hand) + 4♣+7♦+4♦ (board) → trips 4s + pair 7s = Full House
    const player = [card('2', 'd'), card('7', 'h'), card('4', 's'), card('Q', 'h')];
    const board = [card('4', 'c'), card('7', 'd'), card('A', 'h'), card('6', 'c'), card('4', 'd')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.FullHouse);
    expect(result.name).toBe('Full House');
  });

  test('Flush', () => {
    const player = [card('A', 'h'), card('3', 'h'), card('2', 'c'), card('4', 'd')];
    const board = [card('K', 'h'), card('J', 'h'), card('9', 'h'), card('2', 's'), card('3', 's')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.Flush);
  });

  test('Straight', () => {
    const player = [card('A', 's'), card('K', 'h'), card('2', 'c'), card('3', 'd')];
    const board = [card('Q', 'd'), card('J', 'c'), card('10', 's'), card('2', 's'), card('3', 's')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.Straight);
  });

  test('High Card — no pairs possible', () => {
    const player = [card('2', 'h'), card('4', 's'), card('6', 'c'), card('8', 'd')];
    const board = [card('7', 'd'), card('9', 'c'), card('J', 'h'), card('3', 's'), card('K', 'd')];
    const result = evaluateOmahaHand(player, board);
    // With these cards, best could be a straight (6,7,8,9,J? No. 8,9,J? No.)
    // Let's check: player picks 2 from [2,4,6,8], board picks 3 from [7,9,J,3,K]
    // 8+6 with 7,9,3 = no straight. 8+4 with 7,9,3 = no. 8+6 with 7,9,J = 6,7,8,9,J? not consecutive
    // Actually no straights possible here. Should be High Card or maybe a pair.
    // No pairs since all ranks are unique. So it should be High Card.
    expect(result.rank).toBe(HandRank.HighCard);
  });

  test('Omaha rule enforcement — exactly 2 player + 3 board', () => {
    // All hearts: player has 4 hearts, board has 5 hearts
    // But must use exactly 2 player + 3 board
    const player = [card('A', 'h'), card('2', 'h'), card('3', 'h'), card('4', 'h')];
    const board = [card('5', 'h'), card('6', 'h'), card('7', 'h'), card('8', 'h'), card('9', 'h')];
    const result = evaluateOmahaHand(player, board);
    // Best: pick 2 from player + 3 from board for a straight flush
    // e.g. 4h+3h from player, 5h+6h+7h from board = 3,4,5,6,7 straight flush
    // or A,2 from player + 5,6,7 = not straight flush
    // or 3,4 + 5,6,7 = 3-7 straight flush
    // or 4,2 + 5,6,7 = not straight (2,4,5,6,7)
    // or 2,3 + 5,6,7 = not straight (2,3,5,6,7)
    // or 3,4 + 7,8,9 = not straight (3,4,7,8,9)
    // or 4,A + 7,8,9 = not straight
    // Best straight flushes: 3,4 + 5,6,7 = yes! 3-4-5-6-7 SF
    expect(result.rank).toBe(HandRank.StraightFlush);
    expect(result.playerCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
    expect(result.bestCards).toHaveLength(5);
  });

  test('compareHands — higher rank wins', () => {
    const player1 = [card('A', 'h'), card('K', 'h'), card('2', 'c'), card('3', 'd')];
    const board1 = [card('Q', 'h'), card('J', 'h'), card('10', 'h'), card('2', 's'), card('3', 's')];
    const royal = evaluateOmahaHand(player1, board1);

    const player2 = [card('2', 'h'), card('4', 's'), card('6', 'c'), card('8', 'd')];
    const board2 = [card('7', 'd'), card('9', 'c'), card('J', 'h'), card('3', 's'), card('K', 'd')];
    const highCard = evaluateOmahaHand(player2, board2);

    expect(compareHands(royal, highCard)).toBeGreaterThan(0);
    expect(compareHands(highCard, royal)).toBeLessThan(0);
  });

  test('Edge case — insufficient player cards returns safe default', () => {
    const player = [card('A', 'h')]; // Only 1 card
    const board = [card('K', 'h'), card('Q', 'h'), card('J', 'h'), card('10', 'h'), card('9', 'h')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.HighCard);
    expect(result.score).toBe(0);
  });

  test('Edge case — insufficient board cards returns safe default', () => {
    const player = [card('A', 'h'), card('K', 'h'), card('Q', 'h'), card('J', 'h')];
    const board = [card('10', 'h'), card('9', 'h')]; // Only 2 board cards
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.HighCard);
    expect(result.score).toBe(0);
  });

  test('Wheel straight (A-2-3-4-5)', () => {
    const player = [card('A', 's'), card('2', 'h'), card('K', 'c'), card('Q', 'd')];
    const board = [card('3', 'd'), card('4', 'c'), card('5', 's'), card('9', 'h'), card('8', 'd')];
    const result = evaluateOmahaHand(player, board);
    expect(result.rank).toBe(HandRank.Straight);
  });

  test('Ace-low straight should rank below 6-high straight', () => {
    // Wheel: A-2-3-4-5 (5-high straight)
    const wheelPlayer = [card('A', 's'), card('2', 'h'), card('K', 'c'), card('Q', 'd')];
    const wheelBoard = [card('3', 'd'), card('4', 'c'), card('5', 's'), card('9', 'h'), card('8', 'd')];
    const wheel = evaluateOmahaHand(wheelPlayer, wheelBoard);

    // 6-high straight: 2-3-4-5-6
    const sixHighPlayer = [card('6', 's'), card('2', 'h'), card('K', 'c'), card('Q', 'd')];
    const sixHighBoard = [card('3', 'd'), card('4', 'c'), card('5', 's'), card('9', 'h'), card('8', 'd')];
    const sixHigh = evaluateOmahaHand(sixHighPlayer, sixHighBoard);

    expect(wheel.rank).toBe(HandRank.Straight);
    expect(sixHigh.rank).toBe(HandRank.Straight);
    expect(compareHands(sixHigh, wheel)).toBeGreaterThan(0);
    expect(compareHands(wheel, sixHigh)).toBeLessThan(0);
  });

  test('Two Pair with same high pair but different low pair ranks correctly', () => {
    // KK-33-7
    const player1 = [card('K', 's'), card('3', 'h'), card('Q', 'c'), card('J', 'd')];
    const board1 = [card('K', 'd'), card('3', 'c'), card('7', 's'), card('9', 'h'), card('8', 'd')];
    const kk33 = evaluateOmahaHand(player1, board1);

    // KK-22-7
    const player2 = [card('K', 's'), card('2', 'h'), card('Q', 'c'), card('J', 'd')];
    const board2 = [card('K', 'd'), card('2', 'c'), card('7', 's'), card('9', 'h'), card('8', 'd')];
    const kk22 = evaluateOmahaHand(player2, board2);

    expect(kk33.rank).toBe(HandRank.TwoPair);
    expect(kk22.rank).toBe(HandRank.TwoPair);
    // KK-33 should beat KK-22 (higher low pair)
    expect(compareHands(kk33, kk22)).toBeGreaterThan(0);
    expect(compareHands(kk22, kk33)).toBeLessThan(0);
  });
});
