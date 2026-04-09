/**
 * internetMultiplayer.ts (S100/S104)
 * Thin re-export — the actual implementation lives in realtimeMultiplayer.ts
 * which uses Supabase Realtime presence channels (superior to DB polling).
 *
 * G2: Client-side rate limiting — max 5 room creations per 10 minutes.
 */
export {
  RealtimeServer as InternetServer,
  RealtimeClient as InternetClient,
  generateOnlineRoomCode as generateInternetRoomCode,
  isOnlineMultiplayerAvailable,
  WAITING_STATE_TIMEOUT_MS,
} from './realtimeMultiplayer';

// ── G2: Rate limiting ──────────────────────────────────────────────────────────
const ROOM_CREATION_TIMESTAMPS: number[] = [];
const MAX_ROOMS_PER_10_MIN = 5;

export function canCreateRoom(): boolean {
  const now = Date.now();
  const tenMinAgo = now - 10 * 60 * 1000;
  // Evict old timestamps
  while (ROOM_CREATION_TIMESTAMPS.length && ROOM_CREATION_TIMESTAMPS[0] < tenMinAgo) {
    ROOM_CREATION_TIMESTAMPS.shift();
  }
  return ROOM_CREATION_TIMESTAMPS.length < MAX_ROOMS_PER_10_MIN;
}

export function recordRoomCreation(): void {
  ROOM_CREATION_TIMESTAMPS.push(Date.now());
}

export type {
  RealtimeConnectedClient as InternetConnectedClient,
  RealtimeServerCallbacks as InternetServerCallbacks,
  RealtimeClientCallbacks as InternetClientCallbacks,
  GameStateSnapshot,
} from './realtimeMultiplayer';
