import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getDeviceId } from './leaderboard';
import { Card, CARDS_PER_BOARD, GameConfig } from '../constants/gameConfig';
import {
  CardsDealtPayload,
  BoardRevealPayload,
  HandCompletePayload,
} from '../constants/networkConfig';
import { MultiBoardState } from '../types/gameTypes';
import {
  dealNewHand,
  assignCardsRandomly,
  evaluateAllBoards,
  calculateChipDeltas,
} from './gameLogic';

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
export const WAITING_STATE_TIMEOUT_MS = 60000;

interface PendingDelivery {
  messageType: string;
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
}

export interface RealtimeServerCallbacks {
  onPlayerJoined?: (player: RealtimeConnectedClient) => void;
  onPlayerLeft?: (playerId: string) => void;
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
export interface RealtimeClientCallbacks {
  onCardsDealt?: (data: CardsDealtPayload) => void;
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
}

// ===========================================================================
// RealtimeServer — host creates a Supabase Realtime channel.
// Now includes full game state + logic, matching GameServer's public API.
// ===========================================================================
export class RealtimeServer {
  private channel: RealtimeChannel | null = null;
  private roomCode: string = '';
  private hostId: string = '';
  private hostName: string = '';
  private presenceHandler: PresenceHandler | null = null;
  private started = false;

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
      }
    }

    // Mark disconnected players + auto-ready if mid-game (CAPS 10)
    let guestDisconnectedDuringGame = false;
    for (const [id, client] of this.clients) {
      if (!presentIds.has(id) && client.connected) {
        client.connected = false;
        rtLog('SERVER', `Player disconnected: ${client.name} (${id})`, { seat: client.seat });
        this.callbacks.onPlayerLeft?.(id);

        // If game is active (handId > 0) and this guest wasn't ready yet,
        // mark them ready so the hand doesn't hang waiting forever
        if (this.handId > 0 && !client.isReady && !client.isHost) {
          client.isReady = true;
          rtLog('SERVER', `Auto-readied disconnected player ${client.name} to prevent game hang`);
          guestDisconnectedDuringGame = true;
        }

        // Count them as having requested next hand if they hadn't
        if (this.handId > 0 && !client.isHost) {
          this.nextHandRequests.add(id);
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
      case 'CHAT': {
        const msg: ChatMsg = { playerName: data?.playerName ?? 'Player', text: data?.text ?? '', timestamp: data?.timestamp ?? Date.now() };
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

  private trackDelivery(messageType: string, playerId: string, handId: number, payload: any): void {
    const key = deliveryKey(messageType, playerId);
    this.pendingDeliveries.set(key, {
      messageType,
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
      this.sendToPlayer(current.playerId, current.messageType, current.payload);
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

  private startNewHand(config: GameConfig): void {
    for (const client of this.clients.values()) {
      client.isReady = false;
      client.boardAssignments = null;
    }
    this.nextHandRequests.clear();
    this.startGame(config);
    this.callbacks.onNewHandDealt?.();
  }

  // =========================================================================
  // Public API — matches GameServer's interface expected by screens
  // =========================================================================

  /** Merge partial callbacks (same pattern as GameServer.updateCallbacks) */
  updateCallbacks(partial: Partial<RealtimeServerCallbacks>): void {
    Object.assign(this.callbacks, partial);
  }

  /** Deal cards and broadcast to all players */
  startGame(config: GameConfig): void {
    this.gameConfig = config;
    this.handId++;
    this.gamePhase = 'arranging';
    this.clearAllPendingDeliveries();

    const playerCount = this.clients.size as 2 | 3 | 4;
    const { boards, dealResult } = dealNewHand(playerCount, config);

    this.boards = boards;
    this.playerHands = dealResult.playerHands;

    const clientArray = Array.from(this.clients.values()).sort(
      (a, b) => a.seat - b.seat
    );

    rtLog('SERVER', `Starting hand ${this.handId}`, { playerCount, boardCount: boards.length });

    // Send each player their own cards
    for (let i = 0; i < clientArray.length; i++) {
      const client = clientArray[i];
      const payload: CardsDealtPayload = {
        yourCards: dealResult.playerHands[i],
        boards: boards.map((b, bi) => ({
          boardIndex: bi,
          openCards: b.openCards,
          closedCardCount: b.closedCards.length,
        })),
        cardsPerBoard: CARDS_PER_BOARD,
        timeLimit: config.arrangementTime,
        playerCount,
        boardCount: boards.length,
        yourSeat: client.seat,
      };

      if (client.isHost) {
        // Host reads via getDealtCards(), not broadcast
      } else {
        // Include playerIndex + handId so guest knows their seat and can ACK
        const fullPayload = { ...payload, playerIndex: i, handId: this.handId };
        this.sendToPlayer(client.id, 'CARDS_DEALT', fullPayload);
        rtLog('SERVER', `CARDS_DEALT sent to ${client.id}`, { handId: this.handId, seat: i });
        this.trackDelivery('CARDS_DEALT', client.id, this.handId, fullPayload);
      }
    }

    // Broadcast game start
    this.broadcastToAll('GAME_START', {
      boardCount: boards.length,
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

  /** Broadcast board reveal to all players */
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
    this.broadcastToAll('BOARD_REVEAL', payload);
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

    const snapshot: GameStateSnapshot = {
      phase: this.gamePhase,
      handId: this.handId,
      yourCards: this.playerHands[seatIndex] || [],
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
    };

    this.sendToPlayer(playerId, 'GAME_STATE_SNAPSHOT', snapshot);
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
  sendChat(text: string, playerName: string): void {
    const msg: ChatMsg = { playerName, text, timestamp: Date.now() };
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

  /** Send to a specific player (broadcast with targetId field) */
  sendToPlayer(playerId: string, type: string, payload: any): void {
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
  private roomCode: string = '';
  private playerId: string = '';
  private playerName: string = '';
  private presenceHandler: PresenceHandler | null = null;
  private connected = false;
  private callbacks: RealtimeClientCallbacks = {};

  // --- Dedup tracking (CAPS 06 + 07) ---
  private lastProcessedHandId: number = -1;
  private lastCompletedHandId: number = -1;

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
      // Ignore messages targeted to other players
      if (targetId && targetId !== this.playerId) return;
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
      case 'ALL_READY':
        this.callbacks.onAllReady?.();
        break;
      case 'BOARD_REVEAL':
        this.callbacks.onBoardReveal?.(data as BoardRevealPayload);
        break;
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
        const msg: ChatMsg = { playerName: data?.playerName ?? 'Player', text: data?.text ?? '', timestamp: data?.timestamp ?? Date.now() };
        this.callbacks.onChat?.(msg);
        break;
      }
      case 'READY_PRESSED': {
        const playerName: string = data?.playerName ?? 'Opponent';
        this.callbacks.onReadyPressed?.(playerName);
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
  sendChat(text: string, playerName: string): void {
    this.send('CHAT', { playerName, text, timestamp: Date.now() });
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
