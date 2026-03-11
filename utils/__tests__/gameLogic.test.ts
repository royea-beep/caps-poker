import { DEFAULT_CONFIG } from '../../constants/gameConfig';
import { dealNewHand, initializeGame, placeBotCards, autoFillPlayerCards, evaluateBoard, calculateHandResults } from '../gameLogic';

describe('dealNewHand', () => {
  it('deals correct cards for 2 players', () => {
    const result = dealNewHand(2, DEFAULT_CONFIG);
    expect(result.boards.length).toBe(4);
    result.boards.forEach((board) => {
      expect(board.openCards.length).toBe(3);
      expect(board.closedCards.length).toBe(2);
    });
    expect(result.players[0].cards.length).toBe(16);
    expect(result.players[1].cards.length).toBe(16);
    // No duplicate cards
    const allCards = [
      ...result.players[0].cards,
      ...result.players[1].cards,
      ...result.boards.flatMap((b) => [...b.openCards, ...b.closedCards]),
    ];
    const ids = allCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(52); // full deck used
  });

  it('deals correct cards for 3 players', () => {
    const result = dealNewHand(3, DEFAULT_CONFIG);
    expect(result.boards.length).toBe(3);
    result.boards.forEach((board) => {
      expect(board.openCards.length).toBe(3);
      expect(board.closedCards.length).toBe(2);
    });
    expect(result.players[0].cards.length).toBe(12);
    expect(result.players[1].cards.length).toBe(12);
    expect(result.players[2].cards.length).toBe(12);
    const allCards = [
      ...result.players.flatMap((p) => p.cards),
      ...result.boards.flatMap((b) => [...b.openCards, ...b.closedCards]),
    ];
    const ids = allCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(51); // 52 - 1 discarded
  });

  it('deals correct cards for 4 players', () => {
    const result = dealNewHand(4, DEFAULT_CONFIG);
    expect(result.boards.length).toBe(2);
    result.boards.forEach((board) => {
      expect(board.openCards.length).toBe(3);
      expect(board.closedCards.length).toBe(2);
    });
    expect(result.players[0].cards.length).toBe(8);
    expect(result.players[1].cards.length).toBe(8);
    expect(result.players[2].cards.length).toBe(8);
    expect(result.players[3].cards.length).toBe(8);
    const allCards = [
      ...result.players.flatMap((p) => p.cards),
      ...result.boards.flatMap((b) => [...b.openCards, ...b.closedCards]),
    ];
    const ids = allCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(42); // 32 player + 10 board
  });

  it('player cards arrays initialized empty on boards', () => {
    const result = dealNewHand(2, DEFAULT_CONFIG);
    result.boards.forEach((board) => {
      expect(board.playerCards.length).toBe(2); // 2 players
      board.playerCards.forEach((pc) => {
        expect(pc.length).toBe(0); // no cards assigned yet
      });
    });
  });
});

describe('initializeGame (2-player)', () => {
  it('creates 4 boards with correct community cards', () => {
    const { gameState } = initializeGame();
    expect(gameState.boards.length).toBe(4);
    gameState.boards.forEach((board) => {
      expect(board.openCards.length).toBe(3);
      expect(board.closedCards.length).toBe(2);
      expect(board.playerCards.length).toBe(0);
      expect(board.botCards.length).toBe(0);
      expect(board.revealed).toBe(false);
    });
  });

  it('deals 16 cards to player and bot', () => {
    const { gameState } = initializeGame();
    expect(gameState.playerHand.length).toBe(16);
    expect(gameState.botHand.length).toBe(16);
  });

  it('no duplicate cards across all dealt cards', () => {
    const { gameState } = initializeGame();
    const allCards = [
      ...gameState.playerHand,
      ...gameState.botHand,
      ...gameState.boards.flatMap((b) => [...b.openCards, ...b.closedCards]),
    ];
    const ids = allCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(52);
  });
});

describe('placeBotCards', () => {
  it('places 4 cards per board from bot hand', () => {
    const { gameState } = initializeGame();
    const updated = placeBotCards(gameState.botHand, gameState.boards);
    updated.forEach((board) => {
      expect(board.botCards.length).toBe(4);
    });
    // All 16 bot cards placed
    const placedIds = updated.flatMap((b) => b.botCards.map((c) => c.id));
    expect(new Set(placedIds).size).toBe(16);
  });
});

describe('autoFillPlayerCards', () => {
  it('fills empty boards with remaining hand cards', () => {
    const { gameState } = initializeGame();
    const { boards, remainingHand } = autoFillPlayerCards(gameState.playerHand, gameState.boards);
    boards.forEach((board) => {
      expect(board.playerCards.length).toBe(4);
    });
    expect(remainingHand.length).toBe(0);
  });

  it('respects already-placed cards', () => {
    const { gameState } = initializeGame();
    // Place 2 cards on board 0 manually
    const boardsCopy = gameState.boards.map((b, i) =>
      i === 0 ? { ...b, playerCards: gameState.playerHand.slice(0, 2) } : b
    );
    const handWithout = gameState.playerHand.slice(2);
    const { boards, remainingHand } = autoFillPlayerCards(handWithout, boardsCopy);
    expect(boards[0].playerCards.length).toBe(4); // 2 existing + 2 filled
    expect(remainingHand.length).toBe(0);
  });
});

describe('evaluateBoard', () => {
  it('produces a winner for a complete board', () => {
    const { gameState } = initializeGame();
    const withBot = placeBotCards(gameState.botHand, gameState.boards);
    const { boards } = autoFillPlayerCards(gameState.playerHand, withBot);
    const result = evaluateBoard(boards[0]);
    expect(['player', 'bot', 'tie']).toContain(result.winner);
    expect(result.playerResult.name).toBeTruthy();
    expect(result.botResult.name).toBeTruthy();
  });
});

describe('calculateHandResults', () => {
  it('returns results for all boards with correct chip math', () => {
    const { gameState } = initializeGame();
    const withBot = placeBotCards(gameState.botHand, gameState.boards);
    const { boards } = autoFillPlayerCards(gameState.playerHand, withBot);
    const results = calculateHandResults(boards, DEFAULT_CONFIG.potPerBoard, DEFAULT_CONFIG.completeBonusPercent);
    expect(results.boardResults.length).toBe(4);
    // Total chips won by both sides should equal total pot (plus bonus if complete)
    const totalPot = DEFAULT_CONFIG.potPerBoard * 2 * 4; // each player pays potPerBoard per board
    const totalWon = results.playerChipsWon + results.botChipsWon;
    if (results.isComplete) {
      expect(totalWon).toBe(totalPot + results.completeBonusAmount);
    } else {
      expect(totalWon).toBe(totalPot);
    }
  });
});
