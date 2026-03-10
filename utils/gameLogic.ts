import { Card, NUM_BOARDS, CARDS_PER_BOARD } from '../constants/gameConfig';
import { dealCards, DealResult } from './deck';
import { evaluateOmahaHand, compareHands, HandResult } from './handEvaluator';

export interface BoardState {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  botCards: Card[];
  revealed: boolean;
  playerResult?: HandResult;
  botResult?: HandResult;
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

export function placeBotCards(botHand: Card[], boards: BoardState[]): BoardState[] {
  const shuffled = [...botHand].sort(() => Math.random() - 0.5);
  const updatedBoards = boards.map((b, i) => ({
    ...b,
    botCards: shuffled.slice(i * CARDS_PER_BOARD, (i + 1) * CARDS_PER_BOARD),
  }));
  return updatedBoards;
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
}

export function evaluateBoard(board: BoardState): BoardResult {
  const allBoardCards = [...board.openCards, ...board.closedCards];
  const playerResult = evaluateOmahaHand(board.playerCards, allBoardCards);
  const botResult = evaluateOmahaHand(board.botCards, allBoardCards);
  const comparison = compareHands(playerResult, botResult);

  let winner: 'player' | 'bot' | 'tie';
  if (comparison > 0) winner = 'player';
  else if (comparison < 0) winner = 'bot';
  else winner = 'tie';

  return { playerResult, botResult, winner };
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
  const boardResults = boards.map((b) => evaluateBoard(b));

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

  // Total pot paid by BOTH players across all boards
  const totalPotAllBoards = totalBoardPot * NUM_BOARDS;
  const isComplete = playerWins === NUM_BOARDS || botWins === NUM_BOARDS;
  let completeBonusAmount = 0;

  if (isComplete) {
    completeBonusAmount = Math.floor((totalPotAllBoards * completeBonusPercent) / 100);
    if (playerWins === NUM_BOARDS) {
      playerChipsWon += completeBonusAmount;
    } else {
      botChipsWon += completeBonusAmount;
    }
  }

  return { boardResults, playerChipsWon, botChipsWon, isComplete, completeBonusAmount };
}
