import { Card, GameConfig } from '../constants/gameConfig';

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
