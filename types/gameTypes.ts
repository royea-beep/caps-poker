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
  // VAMOS-HAND-LABELS-ENGLISH 2026-06-17 — precomputed best-5 cards per side
  // so the reveal/results screens can derive rank-specific labels
  // ("Pair of Kings", "Ace-High Flush") WITHOUT re-running evaluateOmahaHand.
  // Sourced from result.playerResult.playerCardsUsed + boardCardsUsed in
  // game.tsx, captured ONCE per hand during the navigation calc.
  playerBestCards?: Card[];
  botBestCards?: Card[];
}

export interface RevealData {
  boards: RevealBoardData[];
  /** ECON-SW P1.1 (S62) — stable per-hand id, generated ONCE when the hand ends (at each
   *  setRevealData site). Passed to record_hand_net as p_hand_id for server-side dedup, so a
   *  results re-mount reading the same revealData can't double-count the net. In-memory only
   *  (RevealData is not persisted). */
  handId?: string;
  /** LOBBY-BOT-PRACTICE — practice game vs bot: XP only, ZERO real chips (results.tsx skips every credit path) */
  isPractice?: boolean;
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
