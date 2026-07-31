/**
 * PRACTICE-TO-LIVE — practice-while-waiting with a live jump to real multiplayer.
 *
 * A player taps a 2P bot_practice table and, instead of a blank waiting room, plays
 * LOCAL practice as filler while holding a REAL realtime seat. When a 2nd real human
 * joins the same table, both peers run a synced 30s countdown and then CUT their bot
 * hand and jump into the unified /multiplayer-game on the real bankroll.
 *
 * Why a module singleton (not a screen): the seat-hold (RealtimeServer + heartbeat +
 * presence subscription) must survive the game.tsx ⇄ results.tsx navigation that happens
 * between practice hands. A screen useEffect would tear it down on every hand boundary.
 * The screen (game.tsx) SUBSCRIBES to this coordinator to render the countdown overlay
 * and to perform the actual router navigation on jump (router lives in the component).
 *
 * Scope: 2P (Heads-Up) only — clean "one opponent" semantics. 3P/4P bot rows stay pure
 * local practice. Depends on the strategist seeding fix (bot_practice current_players=0)
 * so the practicer's join doesn't autostart the table out of the waiting pool.
 *
 * Hard parts (see docs/PENDING_practice_to_live.md a–e):
 *   a. seat-hold      → joinTable + RealtimeServer + touchRoomPlayer @25s heartbeat
 *   b. synced 30s     → host is the single clock; broadcasts JUMP_COUNTDOWN{deadline}
 *   c. cut & jump     → reuse startGame()→onCardsDealt; screen router.replace on 'jump'
 *   d. joiner leaves  → presence back to 1 → JUMP_CANCELLED (10s host-lost grace upstream)
 *   e. between hands  → requestJumpNow() from the results screen jumps immediately
 */
import {
  RealtimeServer,
  RealtimeClient,
  isOnlineMultiplayerAvailable,
} from './realtimeMultiplayer';
import { leaveTable, touchRoomPlayer } from './lobbyApi';
import { getDeviceId } from './leaderboard';
import { getSupabase } from './supabase';
import { getMatchCost, canAffordMatch } from './economy';
import { ECONOMY_FLAGS } from '../constants/economyConfig';
import { JUMP_COUNTDOWN_MS } from '../constants/networkConfig';
import { PRACTICE_LIVE_ENABLED } from '../constants/featureFlags';
import { getBoardCount } from '../constants/gameConfig';
import { track } from './analytics';
import { useGameStore } from '../store/gameStore';

const HEARTBEAT_MS = 25_000; // evict_ghost_seats reaps >90s → ~3 beats of headroom
const LIVE_PLAYER_COUNT = 2; // Heads-Up scope

export type PracticeLivePhase = 'idle' | 'holding' | 'countdown' | 'jumping';

/** High-level events the screen maps to overlay state / navigation. */
export type PracticeLiveEvent =
  | { kind: 'countdown'; deadline: number }
  | { kind: 'cancelled' }
  | { kind: 'jump'; params: Record<string, string> }
  | { kind: 'ended'; reason: string };

type Listener = (e: PracticeLiveEvent) => void;

interface Internal {
  roomCode: string;
  deviceId: string | null;
  userId: string | null;
  isHost: boolean;
  server: RealtimeServer | null;
  client: RealtimeClient | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  deadlineTimer: ReturnType<typeof setTimeout> | null;
  phase: PracticeLivePhase;
  deadline: number | null;
  launched: boolean; // navigated into the live game — do NOT tear down on end()
}

const listeners = new Set<Listener>();

let s: Internal = freshState();

function freshState(): Internal {
  return {
    roomCode: '',
    deviceId: null,
    userId: null,
    isHost: false,
    server: null,
    client: null,
    heartbeat: null,
    deadlineTimer: null,
    phase: 'idle',
    deadline: null,
    launched: false,
  };
}

function emit(e: PracticeLiveEvent): void {
  for (const l of Array.from(listeners)) {
    try { l(e); } catch { /* a bad subscriber must not break the session */ }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isPracticeLiveActive(): boolean {
  return s.phase !== 'idle';
}

export function getPracticeLiveState(): { phase: PracticeLivePhase; deadline: number | null; roomCode: string } {
  return { phase: s.phase, deadline: s.deadline, roomCode: s.roomCode };
}

/** Subscribe to coordinator events. Returns an unsubscribe fn. */
export function subscribePracticeLive(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Join a 2P bot_practice table and open the realtime seat-hold. `isHost` comes from
 * join_table's response (first joiner = host). Returns false if realtime is unavailable
 * or the connection fails — the caller then falls back to pure local practice.
 */
export async function beginPracticeLive(opts: {
  roomCode: string;
  isHost: boolean;
  playerName: string;
}): Promise<boolean> {
  // Dormant until a 2-device pass verifies cross-device sync — defensive guard so nothing
  // holds a realtime seat even if a caller reaches here with the flag off.
  if (!PRACTICE_LIVE_ENABLED) return false;
  if (!isOnlineMultiplayerAvailable() || !opts.roomCode) return false;

  // Tear down any prior session first (defensive — should already be idle).
  await endPracticeLive('restart');

  s = freshState();
  s.roomCode = opts.roomCode.toUpperCase();
  s.isHost = opts.isHost;
  s.phase = 'holding';

  s.deviceId = await getDeviceId().catch(() => null);
  s.userId = await getSupabase()?.auth.getUser().then(({ data }) => data?.user?.id ?? null).catch(() => null) ?? null;

  const store = useGameStore.getState();
  store.setRoomCode(s.roomCode);

  const ok = opts.isHost ? await startAsHost(opts.playerName) : await startAsGuest(opts.playerName);
  if (!ok) {
    await endPracticeLive('connect_failed');
    return false;
  }

  startHeartbeat();
  track('practice_live_seat_held', { room_code: s.roomCode, role: opts.isHost ? 'host' : 'guest' }, 'practice-live');
  return true;
}

/**
 * Ask the coordinator to jump NOW if a countdown is running. Called by the screen at a
 * bot-hand boundary (cut early — don't make players wait the full 30s) and on the results
 * screen when a countdown fires between hands (edge e). Host performs the game start; the
 * guest is a no-op here (it jumps when the host's CARDS_DEALT arrives).
 */
export function requestPracticeLiveJumpNow(): void {
  if (s.phase !== 'countdown') return;
  if (s.isHost) hostJump();
}

/** Tear down the seat-hold and realtime. No-op teardown if we already launched into the live game. */
export async function endPracticeLive(reason: string): Promise<void> {
  if (s.phase === 'idle') return;
  clearDeadlineTimer();
  stopHeartbeat();

  if (!s.launched) {
    // Free the DB seat + tear down realtime so no ghost table lingers.
    try { await leaveTable(s.roomCode, s.userId, s.deviceId); } catch { /* fire-and-forget */ }
    try { s.server?.stop(); } catch { /* already gone */ }
    try { s.client?.disconnect(); } catch { /* already gone */ }
    useGameStore.getState().resetMultiplayer();
  }

  // We returned early above if already idle, so this session was genuinely active.
  s = freshState();
  emit({ kind: 'ended', reason });
}

/** Called by the screen immediately before it navigates into /multiplayer-game. */
export function markPracticeLiveLaunched(): void {
  s.launched = true;
  stopHeartbeat();
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

async function startAsHost(playerName: string): Promise<boolean> {
  const server = new RealtimeServer();
  s.server = server;

  server.onPresenceChange((p) => {
    if (s.phase === 'idle' || s.launched) return;
    // Mirror the authoritative seat map for the eventual live game.
    useGameStore.getState().setConnectedPlayers(
      server.getClients().map((c) => ({ id: c.id, name: c.name, isHost: c.isHost, isReady: c.isReady, seat: c.seat, connected: c.connected }))
    );
    if (p.length >= LIVE_PLAYER_COUNT && s.phase === 'holding') {
      startCountdown(); // a real opponent arrived
    } else if (p.length < LIVE_PLAYER_COUNT && s.phase === 'countdown') {
      cancelCountdown(); // edge d — the joiner left during the countdown
    }
  });

  const ok = await server.start(s.roomCode, playerName).catch(() => false);
  if (!ok) { s.server = null; return false; }

  const store = useGameStore.getState();
  store.setMpServer(server);
  store.setMultiplayerMode('host');
  return true;
}

function startCountdown(): void {
  s.phase = 'countdown';
  s.deadline = Date.now() + JUMP_COUNTDOWN_MS;
  s.server?.broadcastToAll('JUMP_COUNTDOWN', { deadline: s.deadline });
  track('practice_live_countdown_started', { room_code: s.roomCode }, 'practice-live');
  clearDeadlineTimer();
  s.deadlineTimer = setTimeout(() => { if (s.phase === 'countdown') hostJump(); }, JUMP_COUNTDOWN_MS);
  emit({ kind: 'countdown', deadline: s.deadline });
}

function cancelCountdown(): void {
  s.phase = 'holding';
  s.deadline = null;
  clearDeadlineTimer();
  s.server?.broadcastToAll('JUMP_CANCELLED', {});
  track('practice_live_countdown_cancelled', { room_code: s.roomCode }, 'practice-live');
  emit({ kind: 'cancelled' });
}

function hostJump(): void {
  if (!s.server || s.phase === 'jumping' || s.launched) return;
  const store = useGameStore.getState();

  // Live game runs on the real bankroll — mirror the normal table.tsx match-cost gate.
  store.updateConfig({ numberOfPlayers: LIVE_PLAYER_COUNT });
  const config = useGameStore.getState().config;
  if (ECONOMY_FLAGS.matchCostEnabled) {
    const cost = getMatchCost(config.potPerBoard, getBoardCount(LIVE_PLAYER_COUNT));
    if (!canAffordMatch(useGameStore.getState().chips, cost)) {
      // Can't afford the live buy-in — stay in practice rather than jump into a game
      // the host can't pay for. Cancel the countdown for both peers.
      cancelCountdown();
      return;
    }
  }

  s.phase = 'jumping';
  clearDeadlineTimer();
  store.resetPracticeSessionNet(); // discard the practice demo counter — real game starts clean
  s.server.startGame(config);
  const { boards, playerHands } = s.server.getDealtCards();
  track('practice_live_jump', { room_code: s.roomCode, role: 'host' }, 'practice-live');

  emit({
    kind: 'jump',
    params: {
      isHost: 'true',
      playerIndex: '0',
      playerCount: String(LIVE_PLAYER_COUNT),
      yourCards: JSON.stringify(playerHands[0]),
      boards: JSON.stringify(
        boards.map((b, i) => ({ boardIndex: i, openCards: b.openCards, closedCardCount: b.closedCards.length }))
      ),
    },
  });
}

// ---------------------------------------------------------------------------
// Guest
// ---------------------------------------------------------------------------

async function startAsGuest(playerName: string): Promise<boolean> {
  const client = new RealtimeClient();
  s.client = client;

  const store = useGameStore.getState();
  // CRITICAL (same as table.tsx guest path): put the client in the store BEFORE connect,
  // so /multiplayer-game finds a live client if onCardsDealt fires mid-connect.
  store.setMpClient(client);
  store.setMultiplayerMode('guest');

  client.updateCallbacks({
    onJumpCountdown: (deadline: number) => {
      if (s.phase === 'idle' || s.launched) return;
      s.phase = 'countdown';
      s.deadline = deadline;
      emit({ kind: 'countdown', deadline });
    },
    onJumpCancelled: () => {
      if (s.phase !== 'countdown') return;
      s.phase = 'holding';
      s.deadline = null;
      emit({ kind: 'cancelled' });
    },
    onCardsDealt: (data: any) => {
      // The host cut its hand and started the live game — jump as guest.
      s.phase = 'jumping';
      clearDeadlineTimer();
      useGameStore.getState().resetPracticeSessionNet();
      track('practice_live_jump', { room_code: s.roomCode, role: 'guest' }, 'practice-live');
      emit({
        kind: 'jump',
        params: {
          isHost: 'false',
          playerIndex: String(data.playerIndex ?? 1),
          playerCount: String(data.playerCount ?? LIVE_PLAYER_COUNT),
          yourCards: JSON.stringify(data.yourCards),
          boards: JSON.stringify(data.boards),
        },
      });
    },
    onRoomState: (pl: { id: string; name: string; seat: number; isHost: boolean }[]) => {
      useGameStore.getState().setConnectedPlayers(
        pl.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost, isReady: false, seat: p.seat, connected: true }))
      );
    },
    onHostLost: () => { void endPracticeLive('host_lost'); },
    onDisconnected: () => { void endPracticeLive('disconnected'); },
  });

  const ok = await client.connect(s.roomCode, playerName).catch(() => false);
  if (!ok) { s.client = null; return false; }
  return true;
}

// ---------------------------------------------------------------------------
// Heartbeat + timers
// ---------------------------------------------------------------------------

function startHeartbeat(): void {
  stopHeartbeat();
  if (s.deviceId) void touchRoomPlayer(s.roomCode, s.deviceId, s.userId);
  s.heartbeat = setInterval(() => {
    if (s.launched || s.phase === 'idle') return;
    void touchRoomPlayer(s.roomCode, s.deviceId, s.userId);
  }, HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (s.heartbeat) { clearInterval(s.heartbeat); s.heartbeat = null; }
}

function clearDeadlineTimer(): void {
  if (s.deadlineTimer) { clearTimeout(s.deadlineTimer); s.deadlineTimer = null; }
}
