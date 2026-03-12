import type { Card, GameConfig } from '../constants/gameConfig';

export type GamePhase =
  | { type: 'idle' }
  | { type: 'arranging'; timeLeft: number }
  | { type: 'waiting_for_bot' }
  | { type: 'revealing'; boardIndex: number }
  | { type: 'complete'; winnerId: 'player' | 'bot' | null }
  | { type: 'summary' };

// --- Multi-player types (Sprint 05) ---

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  chips: number;
  cards: Card[]; // hand cards not yet placed
}

export interface MultiBoardState {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[][]; // index 0 = human, 1..N-1 = bots/opponents
  revealed: boolean;
}

export interface GameSession {
  players: Player[];
  boards: MultiBoardState[];
  phase: GamePhase;
  config: GameConfig;
}

// --- Reveal screen data (Sprint 30) ---

export interface RevealBoardData {
  openCards: Card[];
  closedCards: Card[];
  playerCards: Card[];
  allBotCards: Card[][];
  winner: 'player' | 'bot' | 'tie';
  playerHandName: string;
  botHandName: string;
  allBotHandNames: string[];
  playerHighlightIds: string[];
  botHighlightIds: string[];
  boardHighlightIds: string[];
  potAmount: number;
}

export interface RevealData {
  boards: RevealBoardData[];
  netChips: number;
  playerChipsWon: number;
  isComplete: boolean;
  completeBonusAmount: number;
  completeWinner: 'player' | 'bot' | null;
  boardRevealDuration: number;
  completeBonusDisplay: number;
  turnRevealDelay: number;
  potPerBoard: number;
  numberOfPlayers: number;
  boardCount: number;
}

// --- Multiplayer networking types (Sprint 06) ---

export interface ConnectedPlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  seat: number;
  connected: boolean;
}
