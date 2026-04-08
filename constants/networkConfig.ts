import { Card } from './gameConfig';
import { HandResult } from '../utils/handEvaluator';

export const NETWORK_CONFIG = {
  port: 8765,
  roomCodeLength: 4,
  connectionTimeoutMs: 30000,
  heartbeatIntervalMs: 5000,
  reconnectAttempts: 3,
  reconnectWindowMs: 30000,
  heartbeatTimeoutMs: 15000,
  maxMessageSize: 65536, // 64KB max buffer per connection
  maxPlayerNameLength: 20,
};

export type MessageType =
  | 'ROOM_JOIN'
  | 'ROOM_JOIN_ACK'
  | 'ROOM_STATE'
  | 'GAME_START'
  | 'CARDS_DEALT'
  | 'PLAYER_READY'
  | 'ALL_READY'
  | 'BOARD_REVEAL'
  | 'HAND_COMPLETE'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'ERROR'
  | 'PLAYER_DISCONNECTED'
  | 'NEXT_HAND_REQUEST';

export interface NetworkMessage {
  type: MessageType;
  payload: unknown;
  senderId: string;
  timestamp: number;
}

// --- Payload types ---

export interface RoomJoinPayload {
  roomCode: string;
  playerName: string;
  deviceId: string;
}

export interface RoomJoinAckPayload {
  playerId: string;
  seat: number;
  roomCode: string;
  hostName: string;
}

export interface RoomStatePayload {
  roomCode: string;
  hostName: string;
  players: {
    id: string;
    name: string;
    seat: number;
    connected: boolean;
    isReady: boolean;
  }[];
  playerCount: number;
  maxPlayers: number;
}

export interface CardsDealtPayload {
  yourCards: Card[];
  boards: {
    boardIndex: number;
    openCards: Card[];
    closedCardCount: number;
  }[];
  cardsPerBoard: number;
  timeLimit: number;
  playerCount: number;
  boardCount: number;
  yourSeat: number;
}

export interface PlayerReadyPayload {
  boardAssignments: Card[][];
}

export interface BoardRevealPayload {
  boardIndex: number;
  closedCards: Card[];
  playerHands: {
    playerId: string;
    playerName: string;
    cards: Card[];
    handRank: string;
    score: number;
  }[];
  winnerIndex: number;
  winnerName: string;
}

export interface HandCompletePayload {
  boardResults: {
    boardIndex: number;
    winnerIndex: number;
    winnerName: string;
  }[];
  chipDeltas: number[];
  playerNames: string[];
  isComplete: boolean;
  completeWinnerIndex: number | null;
  completeBonusAmount: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export function createMessage(
  type: MessageType,
  payload: unknown,
  senderId: string
): NetworkMessage {
  return { type, payload, senderId, timestamp: Date.now() };
}
