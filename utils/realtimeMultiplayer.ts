import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { PrivateChannelHub, PRIVATE_MESSAGE_TYPES, isChannelAuthzEnforced, ensureChannelAuthzLoaded, privateTopic } from './privateChannel';
import { getDeviceId } from './leaderboard';
import { Card, CARDS_PER_BOARD, GameConfig } from '../constants/gameConfig';
import {
  CardsDealtPayload,
  BoardRevealPayload,
  HandCompletePayload,
} from '../constants/networkConfig';
import { MultiBoardState } from '../types/gameTypes';
import {
  assignCardsRandomly,
  evaluateAllBoards,
  calculateChipDeltas,
} from './gameLogic';
import { dealHandFull, dealHandSlice } from './serverDeal';

type PresenceHandler = (players: { id: string; name: string }[]) => void;

// ---------------------------------------------------------------------------
// Connection + delivery config
// ---------------------------------------------------------------------------
const SUBSCRIBE_TIMEOUT_MS = 10000;
const HOST_PRESENCE_WAIT_MS = 3000;
const HOST_PRESENCE_POLL_MS = 300;
const DELIVERY_RETRY_INTERVAL_MS = 2000;
const DELIVERY_MAX_RETRIES = 5;
const HOST_LOST_GRACE_MS = 10000; // 10s grace for real-world WiFi hiccups (was 5s)
/**
 * GRACE WINDOW 2026-08-17 — how long a dropped player has to come back before the hand resolves
 * without them. Measured from PRESENCE LOSS, not from the start of the hand. On expiry their cards
 * are auto-placed (never forfeited) exactly as before; only the timing changed.
 */
const DISCONNECT_GRACE_MS = 30000;
export const WAITING_STATE_TIMEOUT_MS = 60000;

interface PendingDelivery {
  messageType: string;
  // MP-STABILITY 2026-07-06 — the retry-tracking KEY (messageType, above) and the actual
  // wire message.type sent to the client can now differ. BOARD_REVEAL needs a per-board
  // tracking key (e.g. "BOARD_REVEAL_2") so 4 boards' pending deliveries don't collide and
  // overwrite each other under the SAME messageType — but the wire type must stay the
  // plain "BOARD_REVEAL" the client already switches on. Defaults to messageType for the
  // existing CARDS_DEALT/HAND_COMPLETE callers, which don't need the distinction.
  wireType: string;
  playerId: string;
  handId: number;
  payload: any;
  retryCount: number;
  timerId: ReturnType<typeof setTimeout> | null;
  sentAt: number;
}

/** Composite key for pending delivery map: messageType:playerId */
function deliveryKey(messageType: string, playerId: string): string {
  return `${messageType}:${playerId}`;
}

function rtLog(tag: string, msg: string, data?: any): void {
  const ts = new Date().toISOString().slice(11, 23);
  const extra = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  console.log(`[RT ${tag}] ${ts} ${msg}${extra}`);
}

// ---------------------------------------------------------------------------
// Shared client info — mirrors GameServer's ConnectedClient (subset needed by screens)
// ---------------------------------------------------------------------------
export interface RealtimeConnectedClient {
  id: string;
  name: string;
  seat: number;
  isReady: boolean;
  isHost: boolean;
  connected: boolean;
  boardAssignments: Card[][] | null;
}

// ---------------------------------------------------------------------------
// Server callback interface — mirrors GameServerCallbacks
// ---------------------------------------------------------------------------
export interface ChatMsg {
  playerName: string;
  text: string;
  timestamp: number;
  /** Sender's seat — stable identity for isMe (names collide: all anon players are "Player"). */
  seat: number;
}

export interface RealtimeServerCallbacks {
  onPlayerJoined?: (player: RealtimeConnectedClient) => void;
  onPlayerLeft?: (playerId: string) => void;
  /** GRACE WINDOW — same signal the guests get by broadcast, fired locally for the host. */
  onPlayerAway?: (data: { playerId: string; name: string; away: boolean }) => void;
  onPlayerReady?: (playerId: string) => void;
  onAllPlayersReady?: () => void;
  onError?: (error: Error) => void;
  onRoomStateChanged?: (players: RealtimeConnectedClient[]) => void;
  onNewHandDealt?: () => void;
  onDisconnected?: () => void;
  onChat?: (msg: ChatMsg) => void;
  onReadyPressed?: (playerName: string) => void;
}

// ---------------------------------------------------------------------------
// Client callback interface — mirrors GameClientCallbacks
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Game state snapshot — sent to reconnecting guests (CAPS 12)
// ---------------------------------------------------------------------------
export type GamePhase = 'lobby' | 'arranging' | 'waiting' | 'complete';

export interface GameStateSnapshot {
  phase: GamePhase;
  handId: number;
  yourCards: Card[];
  boards: { boardIndex: number; openCards: Card[]; closedCardCount: number }[];
  playerIndex: number;
  playerCount: number;
  cardsPerBoard: number;
  timeLimit: number;
  boardCount: number;
  alreadyReady: boolean;
}

// ---------------------------------------------------------------------------
// Spectator snapshot — broadcast to spectate:{roomCode} channel
// Player hole cards are NEVER included until reveal phase
// ---------------------------------------------------------------------------
export interface SpectatorSnapshot {
  phase: 'arranging' | 'revealing' | 'results';
  boardCount: number;
  players: { id: string; name: string; isReady: boolean; }[];
  communityCards: { rank: string; suit: string }[][];
  revealedBoards?: {
    boardIndex: number;
    winnerName: string;
    playerHands: { playerName: string; handRank: string; }[];
  }[];
  spectatorCount: number;
}

// ---------------------------------------------------------------------------
// Client callback interface — mirrors GameClientCallbacks
// ---------------------------------------------------------------------------
export interface HandReadyPayload {
  handId: number;
  playerCount: number;
  boardCount: number;
  cardsPerBoard: number;
  timeLimit: number;
  seats: { id: string; playerIndex: number; seat: number }[];
  boards: { boardIndex: number; openCards: Card[]; closedCardCount: number }[];
}

export interface RealtimeClientCallbacks {
  onCardsDealt?: (data: CardsDealtPayload) => void;
  /**
   * STAGE 1 — the card-free start signal on the SHARED channel. The guest reacts by calling
   * deal_hand for its OWN cards; nothing about anyone else's hand travels here.
   */
  onHandReady?: (data: HandReadyPayload) => void;
  /**
   * GRACE WINDOW — a seat went away or came back. Card-free; it exists so the remaining player is
   * not staring at a frozen table for thirty unexplained seconds.
   */
  onPlayerAway?: (data: { playerId: string; name: string; away: boolean }) => void;
  onAllReady?: () => void;
  onBoardReveal?: (data: BoardRevealPayload) => void;
  onHandComplete?: (data: HandCompletePayload) => void;
  onRoomState?: (players: { id: string; name: string; seat: number; isHost: boolean }[]) => void;
  onGameStateSnapshot?: (snapshot: GameStateSnapshot) => void;
  onHostLost?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onChat?: (msg: ChatMsg) => void;
  onReadyPressed?: (playerName: string) => void;
  // PRACTICE-TO-LIVE — host broadcasts these while both peers run local practice as
  // filler; the actual jump reuses the normal onCardsDealt path (host startGame()).
  onJumpCountdown?: (deadline: number) => void;
  onJumpCancelled?: () => void;
}

// ===========================================================================
// RealtimeServer — host creates a Supabase Realtime channel.
// Now includes full game state + logic, matching GameServer's public API.
// ===========================================================================
export class RealtimeServer {
  private channel: RealtimeChannel | null = null;
  /**
   * HOLE-CARD FIX 2026-08-13. CARDS_DEALT and GAME_STATE_SNAPSHOT go here, one channel per
   * player, instead of onto the shared room channel with a client-side targetId filter.
   * See utils/privateChannel.ts — gated at runtime by app_config.phase0_channel_authz_enforced,
   * the same merge as the realtime.messages policy.
   */
  private privateHub = new PrivateChannelHub();
  private roomCode: string = '';
  private hostId: string = '';
  private hostName: string = '';
  private presenceHandler: PresenceHandler | null = null;
  private started = false;
  /** GRACE WINDOW — per-player timers armed on presence loss, cancelled on return. */
  private graceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // --- Game state (mirrors GameServer) ---
  private clients: Map<string, RealtimeConnectedClient> = new Map();
  private boards: MultiBoardState[] = [];
  private playerHands: Card[][] = [];
  private gameConfig: GameConfig | null = null;
  private nextHandRequests: Set<string> = new Set();
  private callbacks: RealtimeServerCallbacks = {};

  // --- ACK + Retry delivery tracking (CAPS 06) ---
  private handId: number = 0;
  private pendingDeliveries: Map<string, PendingDelivery> = new Map();

  // --- Game phase tracking (CAPS 12) ---
  private gamePhase: GamePhase = 'lobby';

  // --- Spectator channel ---
  private spectateChannel: RealtimeChannel | null = null;
  private spectatorCount: number = 0;
  private spectatorCountHandler: ((count: number) => void) | null = null;

  async start(roomCode: string, hostName: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) {
      rtLog('SERVER', 'Supabase not available');
      return false;
    }

    this.roomCode = roomCode;
    this.privateHub.setRoom(roomCode);
    this.hostId = await getDeviceId();
    this.hostName = hostName;

    // Add host as first client (seat 0)
    this.clients.set(this.hostId, {
      id: this.hostId,
      name: this.hostName,
      seat: 0,
      isReady: false,
      isHost: true,
      connected: true,
      boardAssignments: null,
    });

    this.channel = supabase.channel(`caps-room-${roomCode}`, {
      config: { presence: { key: this.hostId } },
    });

    // Track presence — sync client list from presence state
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState();
      const players = Object.entries(state).map(([key, presences]) => ({
        id: key,
        name: (presences as any)[0]?.name || key,
      }));

      // Update internal client map from presence
      this.syncClientsFromPresence(players);
      this.presenceHandler?.(players);
    });

    // Listen for broadcast messages from guests
    this.channel.on('broadcast', { event: 'game_message' }, ({ payload }) => {
      if (!payload) return;
      const { type, data, senderId } = payload;
      this.handleIncomingMessage(type, data, senderId);
    });

    // Subscribe with timeout — wait for SUBSCRIBED confirmation
    const subscribed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        rtLog('SERVER', 'Subscribe timeout — Supabase did not confirm within deadline');
        resolve(false);
      }, SUBSCRIBE_TIMEOUT_MS);

      this.channel!.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          await this.channel!.track({ name: this.hostName, isHost: true });
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          rtLog('SERVER', `Subscribe failed with status: ${status}`);
          resolve(false);
        }
      });
    });

    if (!subscribed) {
      this.channel.unsubscribe();
      this.channel = null;
      this.clients.clear();
      return false;
    }

    // Monitor for post-subscribe channel errors (CAPS 10)
    this.channel.on('system', {} as any, (payload: any) => {
      const status = payload?.status;
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        rtLog('SERVER', `Channel ${status} after subscribe — room disconnected`);
        this.callbacks.onDisconnected?.();
      }
    });

    rtLog('SERVER', `Room ${roomCode} created`, { hostId: this.hostId });
    this.started = true;
    return true;
  }

  // --- Presence → client sync ---
  private syncClientsFromPresence(
    players: { id: string; name: string }[]
  ): void {
    const presentIds = new Set(players.map((p) => p.id));

    // Add new players / detect reconnecting players (CAPS 12)
    const reconnectedIds: string[] = [];
    for (const p of players) {
      if (!this.clients.has(p.id)) {
        const client: RealtimeConnectedClient = {
          id: p.id,
          name: p.name,
          seat: this.getNextSeat(),
          isReady: false,
          isHost: p.id === this.hostId,
          connected: true,
          boardAssignments: null,
        };
        this.clients.set(p.id, client);
        this.callbacks.onPlayerJoined?.(client);
      } else {
        const existing = this.clients.get(p.id)!;
        const wasDisconnected = !existing.connected;
        existing.name = p.name;
        existing.connected = true;
        // Track reconnection for snapshot send
        if (wasDisconnected && !existing.isHost) {
          reconnectedIds.push(p.id);
          rtLog('SERVER', `Player reconnected: ${existing.name} (${p.id})`, { seat: existing.seat });
        }
        // GRACE WINDOW — a return inside the window cancels it, and the rejoin path (STATE_SNAPSHOT
        // + deal_hand) takes over from here. Cleared for the host too, harmlessly.
        const grace = this.graceTimers.get(p.id);
        if (grace) {
          clearTimeout(grace);
          this.graceTimers.delete(p.id);
          this.broadcastToAll('PLAYER_AWAY', { playerId: p.id, name: existing.name, away: false });
          this.callbacks.onPlayerAway?.({ playerId: p.id, name: existing.name, away: false });
          rtLog('SERVER', `Grace window cancelled — ${existing.name} returned in time`);
        }
      }
    }

    // Mark disconnected players + auto-ready if mid-game (CAPS 10)
    let guestDisconnectedDuringGame = false;
    for (const [id, client] of this.clients) {
      if (!presentIds.has(id) && client.connected) {
        client.connected = false;
        rtLog('SERVER', `Player disconnected: ${client.name} (${id})`, { seat: client.seat });
        this.callbacks.onPlayerLeft?.(id);

        // GRACE WINDOW 2026-08-17 — wait 30 seconds before resolving the hand without them.
        //
        // This used to auto-ready the moment presence dropped, so the hand resolved in about five
        // seconds (measured: 5.2s between hand 1 and hand 2) and a returning player landed in the
        // NEXT hand rather than the one they left. With the rejoin path now working, half a minute
        // is enough for a locked phone or a dropped connection to come back and finish the hand
        // they were in.
        //
        // WHAT HAPPENS ON EXPIRY IS UNCHANGED — the same auto-ready, the same nextHandRequests, the
        // same checks. Only WHEN it fires moved. Auto-ready leaves boardAssignments null, which
        // runRevealSequence auto-fills from the player's dealt hand: they are AUTO-PLACED, never
        // forfeited, and can still win the hand on the cards they were given.
        if (this.handId > 0 && !client.isHost && !this.graceTimers.has(id)) {
          this.broadcastToAll('PLAYER_AWAY', { playerId: id, name: client.name, away: true });
          this.callbacks.onPlayerAway?.({ playerId: id, name: client.name, away: true });
          const timer = setTimeout(() => {
            this.graceTimers.delete(id);
            const c = this.clients.get(id);
            if (!c || c.connected) return; // came back — nothing to do
            let resolved = false;
            if (!c.isReady) {
              c.isReady = true;
              rtLog('SERVER', `Grace expired — auto-readied ${c.name} (auto-place, not forfeit)`);
              resolved = true;
            }
            this.nextHandRequests.add(id);
            if (resolved) this.checkAllReady();
            this.checkNextHandReady();
          }, DISCONNECT_GRACE_MS);
          this.graceTimers.set(id, timer);
          rtLog('SERVER', `Grace window started for ${client.name}`, { ms: DISCONNECT_GRACE_MS });
        }
      }
    }

    // Re-check ready states if a guest disconnected mid-game
    if (guestDisconnectedDuringGame) {
      this.checkAllReady();
      this.checkNextHandReady();
    }

    this.callbacks.onRoomStateChanged?.(this.getClients());

    // Broadcast authoritative seat mapping to all guests (CAPS 09)
    this.broadcastRoomState();

    // Send game state snapshot to reconnecting guests (CAPS 12)
    for (const id of reconnectedIds) {
      if (this.gamePhase !== 'lobby') {
        this.sendGameStateSnapshot(id);
      }
    }
  }

  /** Broadcast authoritative ROOM_STATE with seat assignments to all players */
  private broadcastRoomState(): void {
    const seatMap = this.getClients().map((c) => ({
      id: c.id,
      name: c.name,
      seat: c.seat,
      isHost: c.isHost,
    }));
    this.broadcastToAll('ROOM_STATE', { players: seatMap });
  }

  private getNextSeat(): number {
    const taken = new Set(
      Array.from(this.clients.values()).map((c) => c.seat)
    );
    for (let s = 0; s < 10; s++) {
      if (!taken.has(s)) return s;
    }
    return this.clients.size;
  }

  // --- Incoming message handler (from guests) ---
  private handleIncomingMessage(
    type: string,
    data: any,
    senderId: string
  ): void {
    // Ignore own broadcasts (Supabase sends to all subscribers including sender)
    if (senderId === this.hostId) return;

    switch (type) {
      case 'PLAYER_READY': {
        const client = this.clients.get(senderId);
        if (client && Array.isArray(data?.boardAssignments)) {
          client.isReady = true;
          client.boardAssignments = data.boardAssignments;
          this.callbacks.onPlayerReady?.(senderId);
          this.checkAllReady();
        }
        break;
      }
      case 'NEXT_HAND_REQUEST': {
        this.nextHandRequests.add(senderId);
        this.checkNextHandReady();
        break;
      }
      case 'CARDS_DEALT_ACK': {
        this.handleDeliveryAck('CARDS_DEALT', senderId, data);
        break;
      }
      case 'HAND_COMPLETE_ACK': {
        this.handleDeliveryAck('HAND_COMPLETE', senderId, data);
        break;
      }
      case 'BOARD_REVEAL_ACK': {
        const ackBoardIndex = data?.boardIndex;
        if (typeof ackBoardIndex === 'number') {
          this.handleDeliveryAck(`BOARD_REVEAL_${ackBoardIndex}`, senderId, data);
        }
        break;
      }
      case 'CHAT': {
        const msg: ChatMsg = { playerName: data?.playerName ?? 'Player', text: data?.text ?? '', timestamp: data?.timestamp ?? Date.now(), seat: data?.seat ?? -1 };
        this.callbacks.onChat?.(msg);
        // Re-broadcast to all so everyone sees it
        this.broadcastToAll('CHAT', msg);
        break;
      }
      case 'READY_PRESSED': {
        const playerName: string = data?.playerName ?? 'Opponent';
        this.callbacks.onReadyPressed?.(playerName);
        // Re-broadcast to all guests so they start countdown
        this.broadcastToAll('READY_PRESSED', { playerName });
        break;
      }
    }
  }

  // --- Generic ACK + Retry handling (CAPS 06, generalized CAPS 07) ---
  private handleDeliveryAck(messageType: string, senderId: string, data: any): void {
    const ackHandId = data?.handId;
    const key = deliveryKey(messageType, senderId);
    const pending = this.pendingDeliveries.get(key);
    if (!pending) return;
    if (ackHandId !== pending.handId) {
      rtLog('SERVER', `Stale ${messageType}_ACK from ${senderId} — expected handId ${pending.handId}, got ${ackHandId}`);
      return;
    }
    if (pending.timerId) clearTimeout(pending.timerId);
    this.pendingDeliveries.delete(key);
    rtLog('SERVER', `${messageType} ACK received from ${senderId} for handId ${pending.handId}`);
  }

  private trackDelivery(messageType: string, playerId: string, handId: number, payload: any, wireType: string = messageType): void {
    const key = deliveryKey(messageType, playerId);
    this.pendingDeliveries.set(key, {
      messageType,
      wireType,
      playerId,
      handId,
      payload,
      retryCount: 0,
      timerId: null,
      sentAt: Date.now(),
    });
    this.scheduleRetry(key);
  }

  private scheduleRetry(key: string): void {
    const pending = this.pendingDeliveries.get(key);
    if (!pending) return;

    pending.timerId = setTimeout(() => {
      const current = this.pendingDeliveries.get(key);
      if (!current || current.handId !== pending.handId) return;

      if (current.retryCount >= DELIVERY_MAX_RETRIES) {
        rtLog('SERVER', `${current.messageType} delivery FAILED for ${current.playerId} after ${DELIVERY_MAX_RETRIES} retries`);
        this.pendingDeliveries.delete(key);
        this.callbacks.onError?.(
          new Error(`Failed to deliver ${current.messageType} to player ${current.playerId} after ${DELIVERY_MAX_RETRIES} retries`)
        );
        return;
      }

      current.retryCount++;
      rtLog('SERVER', `Retrying ${current.messageType} to ${current.playerId}`, {
        attempt: current.retryCount,
        maxRetries: DELIVERY_MAX_RETRIES,
        handId: current.handId,
      });
      this.sendToPlayer(current.playerId, current.wireType, current.payload);
      this.scheduleRetry(key);
    }, DELIVERY_RETRY_INTERVAL_MS);
  }

  private clearAllPendingDeliveries(): void {
    for (const pending of this.pendingDeliveries.values()) {
      if (pending.timerId) clearTimeout(pending.timerId);
    }
    this.pendingDeliveries.clear();
  }

  private checkAllReady(): void {
    const connected = Array.from(this.clients.values()).filter(
      (c) => c.connected
    );
    if (connected.length > 0 && connected.every((c) => c.isReady)) {
      this.gamePhase = 'waiting';
      this.broadcastToAll('ALL_READY', {});
      this.callbacks.onAllPlayersReady?.();
    }
  }

  /**
   * MP-LEAVE-RECOVERY 2026-06-29 — host-authoritative backstop. Force the current hand to
   * complete by marking every CONNECTED client ready, then running the normal all-ready path.
   * Not-ready clients keep boardAssignments=null, which runRevealSequence() auto-fills from
   * their dealt hand. No-op once the hand is already resolving/over. Called by the host
   * deal-clock when a peer leaves/idles without readying and presence never dropped to
   * auto-resolve it — so a hand can never wedge in 'playing' forever.
   */
  forceReadyAllConnected(): void {
    if (this.gamePhase === 'complete' || this.gamePhase === 'lobby') return;
    for (const client of this.clients.values()) {
      if (client.connected) client.isReady = true;
    }
    rtLog('SERVER', 'Deal-clock backstop: force-readying all connected clients');
    this.checkAllReady();
  }

  private checkNextHandReady(): void {
    const connected = Array.from(this.clients.values()).filter(
      (c) => c.connected
    );
    if (
      this.nextHandRequests.size >= connected.length &&
      this.gameConfig
    ) {
      this.startNewHand(this.gameConfig);
    }
  }

  private async startNewHand(config: GameConfig): Promise<void> {
    for (const client of this.clients.values()) {
      client.isReady = false;
      client.boardAssignments = null;
    }
    this.nextHandRequests.clear();
    // A failed deal must NOT leave the table silently wedged mid-hand, and must not fall back to
    // the local dealer either: surface it the same way a lost host is surfaced.
    try {
      await this.startGame(config);
    } catch (e) {
      rtLog('SERVER', `startNewHand: deal failed — ${String(e)}`);
      this.callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    this.callbacks.onNewHandDealt?.();
  }

  // =========================================================================
  // Public API — matches GameServer's interface expected by screens
  // =========================================================================

  /** Merge partial callbacks (same pattern as GameServer.updateCallbacks) */
  updateCallbacks(partial: Partial<RealtimeServerCallbacks>): void {
    Object.assign(this.callbacks, partial);
  }

  /**
   * STAGE 1 — THE SERVER DEALS. Asks `deal_hand` instead of running the local dealer.
   *
   * THROWS on a failed deal. There is deliberately no fallback to dealNewHand(): a blip that
   * silently restored client dealing would reopen the hole-card leak invisibly, and the caller
   * (dealAndGo) already has an error path that tells the player the table could not open.
   *
   * NOTE: `dealNewHand` / `dealCardsMultiplayer` are NOT removed — practice still uses them, and
   * they are the revert path for this stage.
   */
  async startGame(config: GameConfig): Promise<void> {
    this.gameConfig = config;
    this.handId++;
    this.gamePhase = 'arranging';
    this.clearAllPendingDeliveries();

    const playerCount = this.clients.size as 2 | 3 | 4;
    const clientArray = Array.from(this.clients.values()).sort(
      (a, b) => a.seat - b.seat
    );

    // p_full: the host still adjudicates this stage, and evaluateAllBoards needs every seat's
    // cards plus the closed cards. Stage 2 deletes both this branch and client adjudication.
    const deal = await dealHandFull(this.roomCode, this.hostId, this.handId);

    // The presence key IS the device id (start() sets hostId = getDeviceId()), so seats are matched
    // by device rather than by array position — a positional map would silently mis-deal if the
    // server's client order and room_players.seat_index ever disagreed.
    const cardsFor = (deviceId: string): Card[] =>
      deal.full.seats.find((s) => s.device_id === deviceId)?.cards ?? [];

    this.boards = deal.full.boards
      .slice()
      .sort((a, b) => a.board_index - b.board_index)
      .map((b) => ({
        openCards: b.open,
        closedCards: b.closed,
        playerCards: Array.from({ length: clientArray.length }, () => [] as Card[]),
        revealed: false,
      }));
    this.playerHands = clientArray.map((c) => cardsFor(c.id));

    rtLog('SERVER', `Starting hand ${this.handId} (server-dealt)`, {
      playerCount, boardCount: this.boards.length, handNo: deal.hand_no,
    });

    // THE GUEST TRIGGER — card-free, on the SHARED channel.
    //
    // CARDS_DEALT is in PRIVATE_MESSAGE_TYPES and routes to caps-room-{CODE}-p-{device}, which is
    // denied for a device-anonymous player. That constant is left exactly as it is; this message is
    // simply not one of its types, so it travels the public room channel that demonstrably works
    // (measured: the shared topic joins ok, the private one returns Unauthorized). It carries NO
    // cards — each guest fetches its own from deal_hand.
    //
    // The per-player private topic now carries nothing. It is DEAD, and left in place.
    this.broadcastToAll('HAND_READY', {
      handId: this.handId,
      playerCount,
      boardCount: this.boards.length,
      cardsPerBoard: CARDS_PER_BOARD,
      timeLimit: config.arrangementTime,
      seats: clientArray.map((c, i) => ({ id: c.id, playerIndex: i, seat: c.seat })),
      boards: this.boards.map((b, bi) => ({
        boardIndex: bi,
        openCards: b.openCards,
        closedCardCount: b.closedCards.length,
      })),
    });

    // Broadcast game start
    this.broadcastToAll('GAME_START', {
      boardCount: this.boards.length,
      playerCount,
    });
  }

  /** Return dealt cards (host reads this instead of receiving broadcast) */
  getDealtCards(): { boards: MultiBoardState[]; playerHands: Card[][] } {
    return { boards: this.boards, playerHands: this.playerHands };
  }

  /** Return board state */
  getBoards(): MultiBoardState[] {
    return this.boards;
  }

  /** Return all clients sorted by seat */
  getClients(): RealtimeConnectedClient[] {
    return Array.from(this.clients.values()).sort(
      (a, b) => a.seat - b.seat
    );
  }

  /** Mark host as ready with card assignments */
  setHostReady(boardAssignments: Card[][]): void {
    const host = this.clients.get(this.hostId);
    if (host) {
      host.isReady = true;
      host.boardAssignments = boardAssignments;
      this.callbacks.onPlayerReady?.(this.hostId);
      this.checkAllReady();
    }
  }

  /** The hand number THIS SERVER dealt — identical to game_hands.hand_no, being the third
   *  argument to dealHandFull() below. Read-only: submit_placements must name the hand the server
   *  named, and a client-side guess would defeat the point of the server dealing at all. */
  getHandNo(): number {
    return this.handId;
  }

  /** Collect all assignments, evaluate hands, return results */
  runRevealSequence(config: GameConfig): {
    boardResults: any[];
    handResult: any;
  } {
    const clientArray = this.getClients();
    const boardCount = this.boards.length;

    for (let i = 0; i < clientArray.length; i++) {
      const assignments = clientArray[i].boardAssignments;
      if (assignments) {
        for (let b = 0; b < boardCount; b++) {
          this.boards[b].playerCards[i] = assignments[b];
        }
      } else {
        // Auto-fill for disconnected/missing player
        const autoAssignments = assignCardsRandomly(
          this.playerHands[i],
          boardCount,
          CARDS_PER_BOARD
        );
        for (let b = 0; b < boardCount; b++) {
          this.boards[b].playerCards[i] = autoAssignments[b];
        }
      }
    }

    const boardResults = evaluateAllBoards(this.boards, clientArray.length);
    const handResult = calculateChipDeltas(
      boardResults,
      clientArray.length,
      config
    );

    return { boardResults, handResult };
  }

  /** Send board reveal to each guest with per-board ACK tracking (MP-STABILITY 2026-07-06 —
   * previously a fire-and-forget broadcastToAll with no retry; a single dropped BOARD_REVEAL
   * over a real network silently produced a blank/tied board for the guest since
   * buildGuestRevealDataAndNavigate falls back to a placeholder when a board's data is missing). */
  sendBoardReveal(
    boardIndex: number,
    closedCards: Card[],
    playerHands: BoardRevealPayload['playerHands'],
    winnerIndex: number,
    winnerName: string
  ): void {
    const payload: BoardRevealPayload = {
      boardIndex,
      closedCards,
      playerHands,
      winnerIndex,
      winnerName,
    };
    const fullPayload = { ...payload, handId: this.handId };

    for (const client of this.clients.values()) {
      if (client.isHost) continue;
      if (!client.connected) continue;
      this.sendToPlayer(client.id, 'BOARD_REVEAL', fullPayload);
      rtLog('SERVER', `BOARD_REVEAL sent to ${client.id}`, { boardIndex, handId: this.handId });
      this.trackDelivery(`BOARD_REVEAL_${boardIndex}`, client.id, this.handId, fullPayload, 'BOARD_REVEAL');
    }
  }

  /** Send hand complete to each guest with ACK tracking */
  sendHandComplete(result: HandCompletePayload): void {
    this.gamePhase = 'complete';
    const fullPayload = { ...result, handId: this.handId };

    // Send per-player so we can track ACK per guest
    for (const client of this.clients.values()) {
      if (client.isHost) continue;
      if (!client.connected) continue;
      this.sendToPlayer(client.id, 'HAND_COMPLETE', fullPayload);
      rtLog('SERVER', `HAND_COMPLETE sent to ${client.id}`, { handId: this.handId });
      this.trackDelivery('HAND_COMPLETE', client.id, this.handId, fullPayload);
    }
  }

  /** Return current game phase */
  getGamePhase(): GamePhase {
    return this.gamePhase;
  }

  /** Send game state snapshot to a reconnecting guest (CAPS 12) */
  sendGameStateSnapshot(playerId: string): void {
    const client = this.clients.get(playerId);
    if (!client || client.isHost) return;
    if (this.gamePhase === 'lobby') return; // No snapshot needed in lobby

    const clientArray = this.getClients();
    const seatIndex = clientArray.findIndex((c) => c.id === playerId);
    if (seatIndex < 0) return;

    // MID-GAME REJOIN 2026-08-17 — CARD-FREE, on the SHARED channel.
    //
    // This used to go through sendToPlayer('GAME_STATE_SNAPSHOT'), which is a PRIVATE_MESSAGE_TYPE
    // and therefore rode caps-room-{CODE}-p-{device} — the topic a device-anonymous player is
    // denied. That is why a friend whose phone locked could never get back into a hand they were
    // already seated in. Stage 1 routed dealing around that denial; this routes rejoin around it
    // the same way.
    //
    // ONLY `yourCards` was private in this payload. Everything else is either community state every
    // seat already sees (openCards, closedCardCount, phase, handId, counts, the clock) or a
    // non-secret scalar about one seat (playerIndex, alreadyReady). With the cards removed there is
    // nothing left to protect, so it travels the public room channel — the same shape HAND_READY
    // already proved. The rejoining client calls deal_hand for its own slice, and because that RPC
    // is idempotent per (room, hand_no) it gets back the hand it was ORIGINALLY dealt, not a new one.
    //
    // sendToPlayer and PRIVATE_MESSAGE_TYPES are untouched — this path simply stops using them.
    this.broadcastToAll('STATE_SNAPSHOT', {
      forPlayerId: playerId,
      phase: this.gamePhase,
      handId: this.handId,
      boards: this.boards.map((b, bi) => ({
        boardIndex: bi,
        openCards: b.openCards,
        closedCardCount: b.closedCards.length,
      })),
      playerIndex: seatIndex,
      playerCount: clientArray.length,
      cardsPerBoard: CARDS_PER_BOARD,
      timeLimit: this.gameConfig?.arrangementTime ?? 60,
      boardCount: this.boards.length,
      alreadyReady: client.isReady,
    });
    rtLog('SERVER', `GAME_STATE_SNAPSHOT sent to ${client.name}`, {
      phase: this.gamePhase,
      handId: this.handId,
      seat: seatIndex,
      alreadyReady: client.isReady,
    });
  }

  /** Host requests next hand */
  requestNextHand(config: GameConfig): void {
    this.gameConfig = config;
    this.nextHandRequests.add(this.hostId);
    this.checkNextHandReady();
  }

  // =========================================================================
  // Transport primitives (existing, preserved)
  // =========================================================================

  /** Broadcast a message to all players in the room */
  sendChat(text: string, playerName: string, seat: number = 0): void {
    const msg: ChatMsg = { playerName, text, timestamp: Date.now(), seat };
    this.callbacks.onChat?.(msg);
    this.broadcastToAll('CHAT', msg);
  }

  broadcastToAll(type: string, payload: any): void {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'game_message',
      payload: { type, data: payload, senderId: this.hostId },
    });
  }

  /**
   * Send to a specific player.
   *
   * HOLE-CARD FIX 2026-08-13. This used to be a single shared-channel broadcast carrying a
   * targetId that the guest filtered on — i.e. every subscriber received every seat's cards
   * and was merely asked not to look. Private types now leave via a per-player channel; public
   * types (BOARD_REVEAL, HAND_COMPLETE) keep the original shared-channel path unchanged.
   *
   * Routing lives HERE, at the single transport primitive, rather than at the three call sites.
   * That is deliberate: the retry path at trackDelivery/flush re-sends CARDS_DEALT through this
   * same method, so routing per-call-site would have leaked on every retry — precisely what a
   * flaky connection triggers, and the likeliest case in a real tester round.
   */
  sendToPlayer(playerId: string, type: string, payload: any): void {
    if (PRIVATE_MESSAGE_TYPES.has(type)) {
      void this.privateHub.send(playerId, type, payload, this.hostId).then((delivered) => {
        if (!delivered) {
          // Do NOT silently fall back to the shared channel — that would re-open the leak at
          // exactly the moment it is least observable. A missed deal surfaces through the
          // existing ACK/retry machinery instead.
          rtLog('SERVER', `PRIVATE SEND FAILED — ${type} not delivered to ${playerId}`, {
            handId: this.handId,
          });
        }
      });
      return;
    }
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'game_message',
      payload: {
        type,
        data: payload,
        senderId: this.hostId,
        targetId: playerId,
      },
    });
  }

  onPresenceChange(handler: PresenceHandler): void {
    this.presenceHandler = handler;
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  isStarted(): boolean {
    return this.started;
  }

  // ---------------------------------------------------------------------------
  // Spectator channel methods
  // ---------------------------------------------------------------------------

  /** Initialize spectate:{roomCode} channel — called by host after game screen mounts */
  async setupSpectatorChannel(roomCode: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || this.spectateChannel) return;

    this.spectateChannel = supabase.channel(`spectate:${roomCode}`, {
      config: { presence: { key: `host-${this.hostId}` } },
    });

    this.spectateChannel.on('presence', { event: 'sync' }, () => {
      if (!this.spectateChannel) return;
      const state = this.spectateChannel.presenceState();
      // Count presences that are NOT the host
      const count = Object.keys(state).filter((k) => !k.startsWith('host-')).length;
      this.spectatorCount = count;
      this.spectatorCountHandler?.(count);
    });

    await this.spectateChannel.subscribe();
    rtLog('SERVER', `Spectator channel ready: spectate:${roomCode}`);
  }

  /** Broadcast a game state snapshot to all spectators */
  broadcastToSpectators(snapshot: SpectatorSnapshot): void {
    if (!this.spectateChannel) return;
    this.spectateChannel.send({
      type: 'broadcast',
      event: 'game_state',
      payload: snapshot,
    });
  }

  /** Current spectator count (via presence) */
  getSpectatorCount(): number {
    return this.spectatorCount;
  }

  /** Register callback for spectator count changes */
  onSpectatorCountChange(handler: (count: number) => void): void {
    this.spectatorCountHandler = handler;
  }

  stop(): void {
    this.clearAllPendingDeliveries();
    // GRACE WINDOW — the timers live on the host, so they die with it. See the handoff: if the HOST
    // is the one that drops, nothing is left to fire them.
    for (const t of this.graceTimers.values()) clearTimeout(t);
    this.graceTimers.clear();
    // Per-player channels outlive nothing: a host restart must not leave subscriptions open,
    // or the next room reuses stale topics for players who are no longer seated.
    this.privateHub.teardown();
    if (this.spectateChannel) {
      this.spectateChannel.unsubscribe();
      this.spectateChannel = null;
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.started = false;
    this.gamePhase = 'lobby';
    this.clients.clear();
    this.boards = [];
    this.playerHands = [];
    this.nextHandRequests.clear();
    this.callbacks = {};
    this.presenceHandler = null;
    this.spectatorCountHandler = null;
  }
}

// ===========================================================================
// RealtimeClient — guest joins a Supabase Realtime channel.
// Now includes callback routing + game methods, matching GameClient's API.
// ===========================================================================
export class RealtimeClient {
  private channel: RealtimeChannel | null = null;
  /** HOLE-CARD FIX 2026-08-13 — this player's own private topic; see utils/privateChannel.ts */
  private privateChannel: RealtimeChannel | null = null;
  private roomCode: string = '';
  private playerId: string = '';
  private playerName: string = '';
  private presenceHandler: PresenceHandler | null = null;
  private connected = false;
  private callbacks: RealtimeClientCallbacks = {};

  // --- Dedup tracking (CAPS 06 + 07) ---
  private lastProcessedHandId: number = -1;
  private lastCompletedHandId: number = -1;

  /** The hand number the HOST announced in HAND_READY — the server's number, never invented here.
   *  Returns -1 before the first HAND_READY, which callers must treat as "no hand yet". A guest
   *  cannot arrange cards before HAND_READY (its cards come from onHandReady -> deal_hand), so by
   *  the time Ready is pressable this is always the current hand. */
  getHandNo(): number {
    return this.lastProcessedHandId;
  }

  // --- Host-alive monitoring (CAPS 10) ---
  private hostLostTimer: ReturnType<typeof setTimeout> | null = null;
  private hostLostFired = false;

  async connect(roomCode: string, playerName: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) {
      rtLog('CLIENT', 'Supabase not available');
      return false;
    }

    this.roomCode = roomCode;
    this.playerId = await getDeviceId();
    this.playerName = playerName;

    this.channel = supabase.channel(`caps-room-${roomCode}`, {
      config: { presence: { key: this.playerId } },
    });

    // Track presence + host-alive monitoring (CAPS 10)
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState();
      const players = Object.entries(state).map(([key, presences]) => ({
        id: key,
        name: (presences as any)[0]?.name || key,
      }));
      this.presenceHandler?.(players);
      this.checkHostAlive();
    });

    // Listen for broadcast messages — route to callbacks
    this.channel.on('broadcast', { event: 'game_message' }, ({ payload }) => {
      if (!payload) return;
      const { type, data, targetId } = payload;
      // Ignore messages targeted to other players. Retained for the PUBLIC types only — the
      // private ones no longer arrive here at all, so this filter is no longer load-bearing
      // for secrecy. It never was: it ran after delivery.
      if (targetId && targetId !== this.playerId) return;
      this.handleIncomingMessage(type, data);
    });

    // HOLE-CARD FIX 2026-08-13 — this player's own private channel. CARDS_DEALT and
    // GAME_STATE_SNAPSHOT arrive here and nowhere else. Same handler, so every downstream
    // guard (duplicate-handId suppression, ACK emission, stale-snapshot rejection) is unchanged.
    // Same ordering rule as the host hub: resolve the runtime flag before building the channel.
    await ensureChannelAuthzLoaded();
    this.privateChannel = supabase.channel(
      privateTopic(roomCode, this.playerId),
      isChannelAuthzEnforced() ? { config: { private: true } } : undefined,
    );
    this.privateChannel.on('broadcast', { event: 'game_message' }, ({ payload }) => {
      if (!payload) return;
      const { type, data } = payload;
      this.handleIncomingMessage(type, data);
    });

    // Subscribe with timeout — wait for SUBSCRIBED confirmation
    const subscribed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        rtLog('CLIENT', 'Subscribe timeout — Supabase did not confirm within deadline');
        resolve(false);
      }, SUBSCRIBE_TIMEOUT_MS);

      this.channel!.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          await this.channel!.track({ name: this.playerName, isHost: false });
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          rtLog('CLIENT', `Subscribe failed with status: ${status}`);
          resolve(false);
        }
      });
    });

    if (!subscribed) {
      rtLog('CLIENT', 'Failed to subscribe to channel');
      this.cleanupChannel();
      return false;
    }

    // The private channel must be up BEFORE the host deals, or the first CARDS_DEALT is missed.
    // Joining the room while unable to receive cards is a dead seat, so this failure is fatal to
    // connect() and surfaces through the existing "failed to join" path rather than as a player
    // sitting at a table that never deals to them.
    const privateOk = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), SUBSCRIBE_TIMEOUT_MS);
      this.privateChannel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          rtLog('CLIENT', `Private channel subscribe failed: ${status}`);
          resolve(false);
        }
      });
    });

    if (!privateOk) {
      rtLog('CLIENT', 'Failed to subscribe to private channel — refusing to join a seat that cannot be dealt to');
      this.cleanupChannel();
      return false;
    }

    // Wait for host presence — poll until host appears or timeout
    const hostFound = await this.waitForHostPresence();
    if (!hostFound) {
      rtLog('CLIENT', `No host found in room ${roomCode} — room may not exist`);
      this.cleanupChannel();
      return false;
    }

    // Monitor for post-subscribe channel errors (CAPS 10)
    this.channel.on('system', {} as any, (payload: any) => {
      const status = payload?.status;
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        rtLog('CLIENT', `Channel ${status} — connection lost`);
        this.connected = false;
        this.callbacks.onDisconnected?.();
      }
    });

    this.connected = true;
    rtLog('CLIENT', `Connected to room ${roomCode}`, { playerId: this.playerId });
    return true;
  }

  /** Poll presence state for a host entry within timeout */
  private waitForHostPresence(): Promise<boolean> {
    return new Promise((resolve) => {
      // Check immediately first
      if (this.hasHostInPresence()) {
        resolve(true);
        return;
      }

      const deadline = setTimeout(() => {
        clearInterval(poll);
        resolve(false);
      }, HOST_PRESENCE_WAIT_MS);

      const poll = setInterval(() => {
        if (this.hasHostInPresence()) {
          clearInterval(poll);
          clearTimeout(deadline);
          resolve(true);
        }
      }, HOST_PRESENCE_POLL_MS);
    });
  }

  private hasHostInPresence(): boolean {
    if (!this.channel) return false;
    const state = this.channel.presenceState();
    // Look for any presence entry with isHost: true
    for (const presences of Object.values(state)) {
      if ((presences as any)[0]?.isHost === true) return true;
    }
    return false;
  }

  private cleanupChannel(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.privateChannel) {
      this.privateChannel.unsubscribe();
      this.privateChannel = null;
    }
    this.connected = false;
  }

  /** Monitor host presence — start grace timer when host disappears, cancel when host returns (CAPS 10) */
  private checkHostAlive(): void {
    if (!this.connected || this.hostLostFired) return;

    const hostPresent = this.hasHostInPresence();

    if (hostPresent) {
      // Host is back or still here — cancel any pending grace timer
      if (this.hostLostTimer) {
        clearTimeout(this.hostLostTimer);
        this.hostLostTimer = null;
        rtLog('CLIENT', 'Host presence restored — grace timer cancelled');
      }
    } else if (!this.hostLostTimer) {
      // Host just disappeared — start grace timer
      rtLog('CLIENT', `Host not in presence — starting ${HOST_LOST_GRACE_MS}ms grace period`);
      this.hostLostTimer = setTimeout(() => {
        this.hostLostTimer = null;
        // Re-check one more time before firing
        if (this.hasHostInPresence()) {
          rtLog('CLIENT', 'Host returned before grace expired');
          return;
        }
        this.hostLostFired = true;
        rtLog('CLIENT', 'Host lost — firing onHostLost callback');
        this.callbacks.onHostLost?.();
      }, HOST_LOST_GRACE_MS);
    }
  }

  /** Clear host-monitoring timers */
  private clearHostMonitoring(): void {
    if (this.hostLostTimer) {
      clearTimeout(this.hostLostTimer);
      this.hostLostTimer = null;
    }
  }

  // --- Incoming message router ---
  private handleIncomingMessage(type: string, data: any): void {
    switch (type) {
      case 'CARDS_DEALT': {
        const handId = data?.handId;

        // Always ACK immediately, even if duplicate (server may not have received prior ACK)
        if (typeof handId === 'number') {
          this.send('CARDS_DEALT_ACK', { handId });
          rtLog('CLIENT', `ACK sent for handId ${handId}`);
        }

        // Dedup: only process once per handId
        if (typeof handId === 'number' && handId <= this.lastProcessedHandId) {
          rtLog('CLIENT', `Duplicate CARDS_DEALT ignored`, { handId, lastProcessed: this.lastProcessedHandId });
          break;
        }

        if (typeof handId === 'number') {
          this.lastProcessedHandId = handId;
        }
        rtLog('CLIENT', `CARDS_DEALT received`, { handId });
        this.callbacks.onCardsDealt?.(data as CardsDealtPayload);
        break;
      }
      case 'PLAYER_AWAY': {
        if (data?.playerId === this.playerId) break; // never announce yourself
        this.callbacks.onPlayerAway?.(data);
        break;
      }
      case 'STATE_SNAPSHOT': {
        // MID-GAME REJOIN — card-free and shared, so every client sees it; only the one it names
        // acts on it. A client already inside /multiplayer-game is on a different screen with
        // different callbacks and never reaches here, so there is no risk of it re-entering.
        if (data?.forPlayerId !== this.playerId) break;
        rtLog('CLIENT', `STATE_SNAPSHOT received`, { handId: data?.handId, phase: data?.phase });
        void (async () => {
          try {
            // The cards come from the server, not from the wire — and idempotency per
            // (room, hand_no) means these are the ORIGINAL cards, not a fresh deal.
            const slice = await dealHandSlice(this.roomCode, this.playerId, data.handId);
            this.callbacks.onGameStateSnapshot?.({
              ...(data as Omit<GameStateSnapshot, 'yourCards'>),
              yourCards: slice.your_cards,
            } as GameStateSnapshot);
          } catch (e) {
            // No cards, no rejoin. Surfacing beats silently dropping someone back into a hand
            // holding nothing.
            rtLog('CLIENT', `STATE_SNAPSHOT: deal_hand failed — ${String(e)}`);
            this.callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
          }
        })();
        break;
      }
      case 'HAND_READY': {
        // Card-free: it says a hand exists and which seat this client is. The cards come from
        // deal_hand, which returns only this device's slice.
        const hrHandId = data?.handId;
        if (typeof hrHandId === 'number' && hrHandId <= this.lastProcessedHandId) {
          rtLog('CLIENT', `Duplicate HAND_READY ignored`, { handId: hrHandId });
          break;
        }
        if (typeof hrHandId === 'number') this.lastProcessedHandId = hrHandId;
        rtLog('CLIENT', `HAND_READY received`, { handId: hrHandId });
        this.callbacks.onHandReady?.(data as HandReadyPayload);
        break;
      }
      case 'ALL_READY':
        this.callbacks.onAllReady?.();
        break;
      case 'BOARD_REVEAL': {
        this.callbacks.onBoardReveal?.(data as BoardRevealPayload);
        // Always ACK immediately, even if duplicate (MP-STABILITY 2026-07-06 — lets the host's
        // per-board retry/delivery tracking stop retrying this board once received)
        const brHandId = data?.handId;
        const brBoardIndex = data?.boardIndex;
        if (typeof brHandId === 'number' && typeof brBoardIndex === 'number') {
          this.send('BOARD_REVEAL_ACK', { handId: brHandId, boardIndex: brBoardIndex });
        }
        break;
      }
      case 'ROOM_STATE': {
        const players = data?.players;
        if (Array.isArray(players)) {
          this.callbacks.onRoomState?.(players);
        }
        break;
      }
      case 'GAME_STATE_SNAPSHOT': {
        const snapshot = data as GameStateSnapshot;
        const snapHandId = snapshot?.handId;
        // Stale snapshot guard: don't apply if handId is older than what we already processed
        if (typeof snapHandId === 'number' && snapHandId < this.lastProcessedHandId) {
          rtLog('CLIENT', `Stale GAME_STATE_SNAPSHOT ignored`, { snapHandId, lastProcessed: this.lastProcessedHandId });
          break;
        }
        // Update dedup tracking to match snapshot hand
        if (typeof snapHandId === 'number') {
          this.lastProcessedHandId = snapHandId;
        }
        rtLog('CLIENT', `GAME_STATE_SNAPSHOT received`, { phase: snapshot.phase, handId: snapHandId, seat: snapshot.playerIndex });
        this.callbacks.onGameStateSnapshot?.(snapshot);
        break;
      }
      case 'HAND_COMPLETE': {
        const hcHandId = data?.handId;

        // Always ACK immediately, even if duplicate
        if (typeof hcHandId === 'number') {
          this.send('HAND_COMPLETE_ACK', { handId: hcHandId });
          rtLog('CLIENT', `HAND_COMPLETE_ACK sent for handId ${hcHandId}`);
        }

        // Dedup: only process once per handId
        if (typeof hcHandId === 'number' && hcHandId <= this.lastCompletedHandId) {
          rtLog('CLIENT', `Duplicate HAND_COMPLETE ignored`, { handId: hcHandId, lastCompleted: this.lastCompletedHandId });
          break;
        }

        if (typeof hcHandId === 'number') {
          this.lastCompletedHandId = hcHandId;
        }
        rtLog('CLIENT', `HAND_COMPLETE received`, { handId: hcHandId });
        this.callbacks.onHandComplete?.(data as HandCompletePayload);
        break;
      }
      case 'CHAT': {
        const msg: ChatMsg = { playerName: data?.playerName ?? 'Player', text: data?.text ?? '', timestamp: data?.timestamp ?? Date.now(), seat: data?.seat ?? -1 };
        this.callbacks.onChat?.(msg);
        break;
      }
      case 'READY_PRESSED': {
        const playerName: string = data?.playerName ?? 'Opponent';
        this.callbacks.onReadyPressed?.(playerName);
        break;
      }
      // PRACTICE-TO-LIVE — host is the single clock; guest renders the same deadline.
      case 'JUMP_COUNTDOWN': {
        const deadline = data?.deadline;
        if (typeof deadline === 'number') this.callbacks.onJumpCountdown?.(deadline);
        break;
      }
      case 'JUMP_CANCELLED': {
        this.callbacks.onJumpCancelled?.();
        break;
      }
    }
  }

  // =========================================================================
  // Public API — matches GameClient's interface expected by screens
  // =========================================================================

  /** Merge partial callbacks (same pattern as GameClient.updateCallbacks) */
  updateCallbacks(partial: Partial<RealtimeClientCallbacks>): void {
    Object.assign(this.callbacks, partial);
  }

  /** Send board assignments to host (PLAYER_READY) */
  sendReady(boardAssignments: Card[][]): void {
    this.send('PLAYER_READY', { boardAssignments });
  }

  /** Send a chat message to the room (host will re-broadcast to all) */
  sendChat(text: string, playerName: string, seat: number = -1): void {
    this.send('CHAT', { playerName, text, timestamp: Date.now(), seat });
  }

  /** Request next hand from host */
  sendNextHandRequest(): void {
    this.send('NEXT_HAND_REQUEST', {});
  }

  /** Send a message to the room */
  send(type: string, payload: any): void {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'game_message',
      payload: { type, data: payload, senderId: this.playerId },
    });
  }

  onPresenceChange(handler: PresenceHandler): void {
    this.presenceHandler = handler;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.clearHostMonitoring();
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.connected = false;
    this.hostLostFired = false;
    this.callbacks = {};
    this.presenceHandler = null;
    this.lastProcessedHandId = -1;
    this.lastCompletedHandId = -1;
  }
}

/** Generate a 6-digit numeric room code */
export function generateOnlineRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  // Avoid leading zero — replace with random 1-9
  if (code[0] === '0') {
    code = (Math.floor(Math.random() * 9) + 1).toString() + code.slice(1);
  }
  return code;
}

/** Check if Supabase Realtime is available */
export function isOnlineMultiplayerAvailable(): boolean {
  return isSupabaseConfigured;
}