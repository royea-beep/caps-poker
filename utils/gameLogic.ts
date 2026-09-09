import { Card, NUM_BOARDS, CARDS_PER_BOARD, GameConfig, getBoardCount, getCompleteBonusPercent } from '../constants/gameConfig';
import { calculateChipDeltasCore } from './chipMath';
import { dealCards, DealResult, dealCardsMultiplayer, MultiDealResult } from './deck';
import { evaluateOmahaHand, compareHands, HandResult } from './handEvaluator';
import { Player, MultiBoardState } from '../types/gameTypes';
import { placeBotCardsWithStrategy, BotDifficulty } from './botStrategy';

export interface BoardState {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  allBotCards: Card[][];       // one array per bot (index 0 = first bot)
  revealed: boolean;
  playerResult?: HandResult;
  botResult?: HandResult;
  allBotResults?: HandResult[];
  winner?: 'player' | 'bot' | 'tie';
}

export interface GameState {
  boards: BoardState[];
  playerHand: Card[];
  botHand: Card[];
  phase: 'arrangement' | 'reveal' | 'summary';
  currentRevealBoard: number;
  playerReady: boolean;
  botReady: boolean;
  timeRemaining: number;
}

export function initializeGame(): { gameState: GameState; dealResult: DealResult } {
  const dealResult = dealCards();

  const boards: BoardState[] = dealResult.boards.map((b) => ({
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: [],
    botCards: [],
    allBotCards: [[]],
    revealed: false,
  }));

  return {
    dealResult,
    gameState: {
      boards,
      playerHand: dealResult.playerHand,
      botHand: dealResult.botHand,
      phase: 'arrangement',
      currentRevealBoard: -1,
      playerReady: false,
      botReady: false,
      timeRemaining: 60,
    },
  };
}

export function placeBotCards(botHand: Card[], boards: BoardState[], difficulty: BotDifficulty = 'easy'): BoardState[] {
  const placements = placeBotCardsWithStrategy(botHand, boards, difficulty);
  return boards.map((b, i) => {
    const cards = placements[i] ?? [];
    const newAllBotCards = [...b.allBotCards];
    newAllBotCards[0] = cards;
    return { ...b, botCards: cards, allBotCards: newAllBotCards };
  });
}

/** Place a single bot's cards on all boards. botIndex is 0-based (0 = first bot). */
export function placeSingleBotCards(botHand: Card[], boards: BoardState[], botIndex: number, difficulty: BotDifficulty = 'easy'): BoardState[] {
  const placements = placeBotCardsWithStrategy(botHand, boards, difficulty);
  return boards.map((b, i) => {
    const cards = placements[i] ?? [];
    const newAllBotCards = [...b.allBotCards];
    newAllBotCards[botIndex] = cards;
    return {
      ...b,
      allBotCards: newAllBotCards,
      botCards: botIndex === 0 ? cards : b.botCards,
    };
  });
}

export function autoFillPlayerCards(
  playerHand: Card[],
  boards: BoardState[]
): { boards: BoardState[]; remainingHand: Card[] } {
  const remaining = [...playerHand];
  const updatedBoards = boards.map((board) => {
    const needed = CARDS_PER_BOARD - board.playerCards.length;
    if (needed > 0) {
      const toAdd = remaining.splice(0, needed);
      return { ...board, playerCards: [...board.playerCards, ...toAdd] };
    }
    return board;
  });
  return { boards: updatedBoards, remainingHand: remaining };
}

export interface BoardResult {
  playerResult: HandResult;
  botResult: HandResult;
  winner: 'player' | 'bot' | 'tie';
  /** Seat that won this board outright — local player 0, opponents 1..N-1, -1 = board tied.
   *  Heads-up it carries no information the token does not; it matters from three seats up,
   *  where 'bot' stops identifying WHICH opponent won. See utils/handOutcome.ts. */
  winnerSeat?: number;
}

export function evaluateBoard(board: BoardState): BoardResult | null {
  if (board.playerCards.length === 0 || board.botCards.length === 0) return null;

  const allBoardCards = [...board.openCards, ...board.closedCards];
  const playerResult = evaluateOmahaHand(board.playerCards, allBoardCards);
  const botResult = evaluateOmahaHand(board.botCards, allBoardCards);
  const comparison = compareHands(playerResult, botResult);

  let winner: 'player' | 'bot' | 'tie';
  if (comparison > 0) winner = 'player';
  else if (comparison < 0) winner = 'bot';
  else winner = 'tie';

  // Heads-up: exactly two seats, so the seat follows from the token.
  return { playerResult, botResult, winner, winnerSeat: winner === 'player' ? 0 : winner === 'bot' ? 1 : -1 };
}

export function calculateHandResults(
  boards: BoardState[],
  potPerBoard: number,
  completeBonusPercent: number
): {
  boardResults: BoardResult[];
  playerChipsWon: number;
  botChipsWon: number;
  isComplete: boolean;
  completeBonusAmount: number;
} {
  const boardResults = boards.map((b) => evaluateBoard(b)).filter((r): r is BoardResult => r !== null);

  if (boardResults.length === 0) {
    return { boardResults: [], playerChipsWon: 0, botChipsWon: 0, isComplete: false, completeBonusAmount: 0 };
  }

  let playerWins = 0;
  let botWins = 0;
  let playerChipsWon = 0;
  let botChipsWon = 0;

  // potPerBoard is each player's contribution per board.
  // The total pot per board = potPerBoard * 2 (player + bot).
  const totalBoardPot = potPerBoard * 2;

  for (const result of boardResults) {
    if (result.winner === 'player') {
      playerWins++;
      playerChipsWon += totalBoardPot;
    } else if (result.winner === 'bot') {
      botWins++;
      botChipsWon += totalBoardPot;
    } else {
      // Tie — each player gets their contribution back
      playerChipsWon += potPerBoard;
      botChipsWon += potPerBoard;
    }
  }

  // VAMOS-BUILD-506 2026-06-22 — COMPLETE bonus = % of the TOTAL POT (both players' buy-ins
  // across all boards), not one player's buy-in. NOTE: this 2-player function is legacy — the
  // LIVE path is calculateHandResultsMulti -> calculateChipDeltas — kept in sync for safety.
  const totalPot = potPerBoard * NUM_BOARDS * 2; // 2-player total pot, all boards
  const isComplete = playerWins === NUM_BOARDS || botWins === NUM_BOARDS;
  let completeBonusAmount = 0;

  if (isComplete) {
    completeBonusAmount = Math.floor((totalPot * completeBonusPercent) / 100);
    if (playerWins === NUM_BOARDS) {
      playerChipsWon += completeBonusAmount;
    } else {
      botChipsWon += completeBonusAmount;
    }
  }

  return { boardResults, playerChipsWon, botChipsWon, isComplete, completeBonusAmount };
}

/** Initialize a game for N players (1 human + N-1 bots). */
export function initializeGameMulti(numberOfPlayers: 2 | 3 | 4): {
  boards: BoardState[];
  playerHand: Card[];
  botHands: Card[][];
  boardCount: number;
} {
  const { playerHands, boards: dealBoards } = dealCardsMultiplayer(numberOfPlayers);
  const numberOfBots = numberOfPlayers - 1;

  const boards: BoardState[] = dealBoards.map((b) => ({
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: [],
    botCards: [],
    allBotCards: Array.from({ length: numberOfBots }, () => []),
    revealed: false,
  }));

  return {
    boards,
    playerHand: playerHands[0],
    botHands: playerHands.slice(1),
    boardCount: dealBoards.length,
  };
}

/** Evaluate all boards for multi-player and return results in BoardResult format. */
export function calculateHandResultsMulti(
  boards: BoardState[],
  numberOfPlayers: number,
  config: GameConfig
): {
  boardResults: BoardResult[];
  playerChipsWon: number;
  isComplete: boolean;
  completeBonusAmount: number;
  completeWinner: 'player' | 'bot' | null;
  allBotResults: HandResult[][];
} {
  // Convert to MultiBoardState for evaluation
  const multiBoards: MultiBoardState[] = boards.map((b) => ({
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: [b.playerCards, ...b.allBotCards],
    revealed: b.revealed,
  }));

  const mpBoardResults = evaluateAllBoards(multiBoards, numberOfPlayers);
  const mpResult = calculateChipDeltas(mpBoardResults, numberOfPlayers, config);

  // Convert to BoardResult format for backward compat
  const boardResults: BoardResult[] = mpBoardResults.map((r) => ({
    playerResult: r.playerResults[0],
    botResult: r.playerResults[1] || r.playerResults[0],
    winner: (r.winnerIndex === 0 ? 'player' : r.winnerIndex === -1 ? 'tie' : 'bot') as 'player' | 'bot' | 'tie',
    // Seat 0 IS the local player in solo (playerResults[0]), so the evaluator's index needs no
    // rotation here. Carried alongside the collapsed token so the outcome rule can tell two
    // opponents apart; the token itself is unchanged and every existing reader is untouched.
    winnerSeat: r.winnerIndex,
  }));

  const allBotResults = mpBoardResults.map((r) => r.playerResults.slice(1));

  // playerChipsWon is gross (add back buy-in since chipDeltas is net)
  const totalPaid = config.potPerBoard * boards.length;
  const playerChipsWon = mpResult.chipDeltas[0] + totalPaid;

  const isComplete = mpResult.completeWinner !== null;
  const completeWinner = mpResult.completeWinner === null ? null : mpResult.completeWinner === 0 ? 'player' as const : 'bot' as const;

  return {
    boardResults,
    playerChipsWon,
    isComplete,
    completeBonusAmount: mpResult.completeBonusAmount,
    completeWinner,
    allBotResults,
  };
}

// --- Multi-player functions (Sprint 05) ---

export interface MultiPlayerBoardResult {
  boardIndex: number;
  playerResults: HandResult[]; // one per player
  winnerIndex: number; // player index, -1 for tie
  tiedPlayers: number[]; // player indices in case of multi-way tie
  potWon: number; // amount won by winner (or per tied player)
}

export interface MultiPlayerHandResult {
  boardResults: MultiPlayerBoardResult[];
  chipDeltas: number[]; // net chips per player (zero-sum)
  completeWinner: number | null; // player index who won ALL boards, null if none
  completeBonusAmount: number;
}

export function createPlayers(playerCount: number, startingChips: number): Player[] {
  const players: Player[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: `player_${i}`,
      name: i === 0 ? 'You' : `Bot ${i}`,
      isHuman: i === 0,
      chips: startingChips,
      cards: [],
    });
  }
  return players;
}

export function dealNewHand(
  playerCount: 2 | 3 | 4,
  config: GameConfig
): { players: Player[]; boards: MultiBoardState[]; dealResult: MultiDealResult } {
  const dealResult = dealCardsMultiplayer(playerCount);
  const players = createPlayers(playerCount, config.startingChips);

  for (let i = 0; i < playerCount; i++) {
    players[i].cards = dealResult.playerHands[i];
  }

  const boards: MultiBoardState[] = dealResult.boards.map((b) => ({
    openCards: b.openCards,
    closedCards: b.closedCards,
    playerCards: Array.from({ length: playerCount }, () => []),
    revealed: false,
  }));

  return { players, boards, dealResult };
}

/**
 * Randomly assign a player's cards to boards (4 per board).
 * Used for bot players and simulation.
 */
export function assignCardsRandomly(
  hand: Card[],
  boardCount: number,
  cardsPerBoard: number = CARDS_PER_BOARD
): Card[][] {
  const shuffled = [...hand].sort(() => Math.random() - 0.5);
  const result: Card[][] = [];
  for (let b = 0; b < boardCount; b++) {
    result.push(shuffled.slice(b * cardsPerBoard, (b + 1) * cardsPerBoard));
  }
  return result;
}

export function evaluateAllBoards(
  boards: MultiBoardState[],
  playerCount: number
): MultiPlayerBoardResult[] {
  if (boards.length === 0 || playerCount === 0) return [];

  return boards.map((board, boardIndex) => {
    const allBoardCards = [...board.openCards, ...board.closedCards];
    const playerResults: HandResult[] = [];

    for (let p = 0; p < playerCount; p++) {
      playerResults.push(evaluateOmahaHand(board.playerCards[p], allBoardCards));
    }

    // Find winner(s)
    let bestScore = -1;
    let winnerIndex = -1;
    const tiedPlayers: number[] = [];

    for (let p = 0; p < playerCount; p++) {
      if (playerResults[p].score > bestScore) {
        bestScore = playerResults[p].score;
        winnerIndex = p;
        tiedPlayers.length = 0;
        tiedPlayers.push(p);
      } else if (playerResults[p].score === bestScore) {
        tiedPlayers.push(p);
      }
    }

    // If multi-way tie, winnerIndex = -1
    if (tiedPlayers.length > 1) {
      winnerIndex = -1;
    }

    return { boardIndex, playerResults, winnerIndex, tiedPlayers, potWon: 0 };
  });
}

/**
 * THE ARITHMETIC NOW LIVES IN `utils/chipMath.ts`, A LEAF THAT IMPORTS NOTHING, so the server can
 * run the identical computation without dragging `deck.ts` — the client dealer — into an Edge
 * Function. This wrapper is deliberately transparent: same name, same parameters, same return
 * type, so every existing consumer is untouched.
 *
 * THE ONE THING IT ADDS is resolving the COMPLETE-bonus percentage HERE and passing it in. In the
 * app that means the `app_config` map loaded by `_layout`, with the config constant as the
 * fallback — exactly as before. A server caller resolves it from its own `app_config` read. The
 * leaf can no longer silently fall back to a stale default, because it has no default to fall back
 * to; see the header of `chipMath.ts` for the bug this closes.
 */
export function calculateChipDeltas(
  boardResults: MultiPlayerBoardResult[],
  playerCount: number,
  config: GameConfig
): MultiPlayerHandResult {
  return calculateChipDeltasCore(
    boardResults,
    playerCount,
    config,
    getCompleteBonusPercent(boardResults.length, config.completeBonusPercent)
  );
}
