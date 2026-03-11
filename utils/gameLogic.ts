import { Card, NUM_BOARDS, CARDS_PER_BOARD, GameConfig } from '../constants/gameConfig';
import { dealCards, DealResult, dealCardsMultiplayer, MultiDealResult } from './deck';
import { evaluateOmahaHand, compareHands, HandResult } from './handEvaluator';
import { Player, MultiBoardState } from '../types/gameTypes';

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

export function calculateChipDeltas(
  boardResults: MultiPlayerBoardResult[],
  playerCount: number,
  config: GameConfig
): MultiPlayerHandResult {
  const potPerBoard = config.potPerBoard;
  const totalBoardPot = potPerBoard * playerCount; // all players contribute
  const chipDeltas = new Array(playerCount).fill(0);

  // Each player pays potPerBoard per board
  const boardCount = boardResults.length;
  const totalPaid = potPerBoard * boardCount;
  for (let p = 0; p < playerCount; p++) {
    chipDeltas[p] -= totalPaid;
  }

  for (const result of boardResults) {
    if (result.winnerIndex >= 0) {
      // Single winner takes the whole pot
      chipDeltas[result.winnerIndex] += totalBoardPot;
      result.potWon = totalBoardPot;
    } else {
      // Tie — split pot among tied players, distribute rounding remainder
      const tiedCount = result.tiedPlayers.length;
      const share = Math.floor(totalBoardPot / tiedCount);
      const tieRemainder = totalBoardPot - share * tiedCount;
      for (let t = 0; t < tiedCount; t++) {
        const extra = t < tieRemainder ? 1 : 0;
        chipDeltas[result.tiedPlayers[t]] += share + extra;
      }
      result.potWon = share;
    }
  }

  // Check COMPLETE: did any player win ALL boards?
  let completeWinner: number | null = null;
  for (let p = 0; p < playerCount; p++) {
    if (boardResults.every((r) => r.winnerIndex === p)) {
      completeWinner = p;
      break;
    }
  }

  const totalPotAllBoards = totalBoardPot * boardCount;
  let completeBonusAmount = 0;
  if (completeWinner !== null) {
    completeBonusAmount = Math.floor(
      (totalPotAllBoards * config.completeBonusPercent) / 100
    );
    chipDeltas[completeWinner] += completeBonusAmount;
    // Distribute bonus cost to losers (zero-sum)
    const losers = playerCount - 1;
    const perLoserCost = Math.floor(completeBonusAmount / losers);
    const remainder = completeBonusAmount - perLoserCost * losers;
    for (let p = 0; p < playerCount; p++) {
      if (p !== completeWinner) {
        chipDeltas[p] -= perLoserCost;
      }
    }
    // Assign any rounding remainder to the first loser
    if (remainder > 0) {
      for (let p = 0; p < playerCount; p++) {
        if (p !== completeWinner) {
          chipDeltas[p] -= remainder;
          break;
        }
      }
    }
  }

  return { boardResults, chipDeltas, completeWinner, completeBonusAmount };
}
