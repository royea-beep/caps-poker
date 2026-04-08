/**
 * internetMultiplayer.ts (S100)
 * Thin re-export — the actual implementation lives in realtimeMultiplayer.ts
 * which uses Supabase Realtime presence channels (superior to DB polling).
 */
export {
  RealtimeServer as InternetServer,
  RealtimeClient as InternetClient,
  generateOnlineRoomCode as generateInternetRoomCode,
  isOnlineMultiplayerAvailable,
  WAITING_STATE_TIMEOUT_MS,
} from './realtimeMultiplayer';

export type {
  RealtimeConnectedClient as InternetConnectedClient,
  RealtimeServerCallbacks as InternetServerCallbacks,
  RealtimeClientCallbacks as InternetClientCallbacks,
  GameStateSnapshot,
} from './realtimeMultiplayer';
