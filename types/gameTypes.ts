import type { Card, GameConfig } from '../constants/gameConfig';
import type { SeatEquity, OutsResult } from '../utils/revealEquity';

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
  /**
   * CN-CAPTURE 2026-08-08 — equity/outs CAPTURED from the reveal, never recomputed.
   *
   * BoardReveal already computes both (components/BoardReveal.tsx:176-180, ~119-128ms per
   * board) and then throws them away when it unmounts. /results recomputing them would cost
   * ~1s of main thread for numbers the app already had. So the reveal now writes each board's
   * result into the store as it finishes computing it, and these fields carry it here.
   *
   * OPTIONAL AND OFTEN ABSENT — do not treat a missing value as zero. `calcs` only covers
   * boards the reveal actually reached, and several paths reach /results with gaps (settings
   * "skip board reveal", auto-sim, long-press skip-all, MP with the reveal flag off, and a
   * fast advance that cancels the pending prefetch). A wrong equity number is worse than no
   * equity number: render nothing when these are undefined.
   */
  equity?: RevealBoardEquity;
  outs?: RevealBoardOuts;
}

/** Per-seat equity at each street the reveal computes. Seats sum to exactly 100. */
export interface RevealBoardEquity {
  flop: SeatEquity[];
  turn: SeatEquity[];
}

/** Outs as cards, per street. `turn` carries the `dead` set the flop's outs lost. */
export interface RevealBoardOuts {
  flop: OutsResult;
  turn: OutsResult;
}

/** What the reveal hands to the store for a single board. */
export interface RevealBoardCalcCapture {
  equity: RevealBoardEquity;
  outs: RevealBoardOuts;
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
