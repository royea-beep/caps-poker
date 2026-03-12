import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

// Lazy-load TcpSocket — crashes on web where native modules aren't available
let TcpSocket: any = null;
function getTcpSocket() {
  if (!TcpSocket) {
    if (Platform.OS === 'web') throw new Error('TCP not available on web');
    TcpSocket = require('react-native-tcp-socket').default;
  }
  return TcpSocket;
}
import { Card, CARDS_PER_BOARD } from '../constants/gameConfig';
import {
  NETWORK_CONFIG,
  NetworkMessage,
  createMessage,
  RoomJoinPayload,
  RoomJoinAckPayload,
  RoomStatePayload,
  CardsDealtPayload,
  PlayerReadyPayload,
  BoardRevealPayload,
  HandCompletePayload,
} from '../constants/networkConfig';
import { generateRoomCode } from './roomCode';
import { MultiBoardState } from '../types/gameTypes';
import {
  dealNewHand,
  assignCardsRandomly,
  evaluateAllBoards,
  calculateChipDeltas,
} from './gameLogic';
import { GameConfig } from '../constants/gameConfig';

export interface ConnectedClient {
  id: string;
  name: string;
  deviceId: string;
  socket: any;
  seat: number;
  isReady: boolean;
  isHost: boolean;
  connected: boolean;
  boardAssignments: Card[][] | null;
  lastHeartbeat: number;
}

export interface GameServerCallbacks {
  onPlayerJoined: (player: ConnectedClient) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerReady: (playerId: string) => void;
  onAllPlayersReady: () => void;
  onError: (error: Error) => void;
  onRoomStateChanged: (players: ConnectedClient[]) => void;
  onNewHandDealt?: () => void;
}

const MAX_BUFFER_SIZE = 1024 * 64; // 64KB max buffer

export class GameServer {
  private server: any = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private callbacks: GameServerCallbacks;
  private roomCode: string = '';
  private hostId: string;
  private hostName: string;
  private maxPlayers: number;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private boards: MultiBoardState[] = [];
  private playerHands: Card[][] = [];
  private stopping: boolean = false;
  private lastHeartbeatCheck: number = Date.now();
  private nextHandRequests: Set<string> = new Set();
  private gameConfig: GameConfig | null = null;

  constructor(
    callbacks: GameServerCallbacks,
    hostName: string,
    maxPlayers: 2 | 3 | 4 = 2
  ) {
    this.callbacks = callbacks;
    this.hostId = uuidv4();
    this.hostName = hostName;
    this.maxPlayers = maxPlayers;
  }

  getHostId(): string {
    return this.hostId;
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  getClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  async start(port: number = NETWORK_CONFIG.port): Promise<string> {
    this.roomCode = generateRoomCode();
    this.stopping = false;

    // Add host as first player (seat 0)
    this.clients.set(this.hostId, {
      id: this.hostId,
      name: this.hostName,
      deviceId: '',
      socket: null, // host doesn't have a socket to itself
      seat: 0,
      isReady: false,
      isHost: true,
      connected: true,
      boardAssignments: null,
      lastHeartbeat: Date.now(),
    });

    return new Promise((resolve, reject) => {
      try {
        this.server = getTcpSocket().createServer((socket: any) => {
          this.handleNewConnection(socket);
        });

        this.server.listen({ port, host: '0.0.0.0' }, () => {
          const address = this.server.address();
          const hostIP = address?.address || '0.0.0.0';
          this.startHeartbeatMonitor();
          resolve(hostIP);
        });

        this.server.on('error', (err: Error) => {
          this.callbacks.onError(err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleNewConnection(socket: any): void {
    // Fix 5: Reject connections while stopping
    if (this.stopping) {
      try {
        socket.destroy();
      } catch {
        // Ignore
      }
      return;
    }

    let buffer = '';

    socket.on('data', (data: Buffer | string) => {
      buffer += data.toString();

      // Fix 4: Message size limit to prevent memory exhaustion
      if (buffer.length > MAX_BUFFER_SIZE) {
        buffer = ''; // Drop oversized buffer
        return;
      }

      // Process complete JSON messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: NetworkMessage = JSON.parse(line);
            this.handleMessage(message, socket);
          } catch {
            // Ignore malformed messages
          }
        }
      }
    });

    socket.on('error', (err: Error) => {
      this.handleSocketDisconnect(socket);
    });

    socket.on('close', () => {
      this.handleSocketDisconnect(socket);
    });
  }

  // Fix 3: Payload validation helper
  private validatePayload(message: NetworkMessage): boolean {
    if (!message || typeof message.type !== 'string') return false;
    if (!message.payload || typeof message.payload !== 'object') return false;
    return true;
  }

  private handleMessage(message: NetworkMessage, socket: any): void {
    // Fix 3: Validate payload before processing
    if (!this.validatePayload(message)) return;

    switch (message.type) {
      case 'ROOM_JOIN': {
        const payload = message.payload as RoomJoinPayload;

        // Fix 3: Validate ROOM_JOIN specific fields
        if (
          typeof payload.playerName !== 'string' ||
          !payload.playerName.trim() ||
          typeof payload.roomCode !== 'string' ||
          typeof payload.deviceId !== 'string' ||
          !payload.deviceId.trim()
        ) {
          this.sendToSocket(socket, createMessage('ERROR', {
            code: 'INVALID_PAYLOAD',
            message: 'Invalid join payload',
          }, this.hostId));
          return;
        }

        // Truncate playerName to 20 chars max
        const playerName = payload.playerName.trim().slice(0, 20);

        if (payload.roomCode !== this.roomCode) {
          this.sendToSocket(socket, createMessage('ERROR', {
            code: 'INVALID_CODE',
            message: 'Invalid room code',
          }, this.hostId));
          return;
        }

        // Fix 2: Check for reconnection by deviceId
        let existingClient: ConnectedClient | undefined;
        for (const client of this.clients.values()) {
          if (!client.isHost && !client.connected && client.deviceId === payload.deviceId) {
            existingClient = client;
            break;
          }
        }

        if (existingClient) {
          // Reconnection — restore existing seat
          existingClient.socket = socket;
          existingClient.connected = true;
          existingClient.name = playerName;
          existingClient.lastHeartbeat = Date.now();
          existingClient.isReady = false;
          existingClient.boardAssignments = null;

          const ack: RoomJoinAckPayload = {
            playerId: existingClient.id,
            seat: existingClient.seat,
            roomCode: this.roomCode,
            hostName: this.hostName,
          };
          this.sendToSocket(socket, createMessage('ROOM_JOIN_ACK', ack, this.hostId));
          this.broadcastRoomState();
          this.callbacks.onPlayerJoined(existingClient);
          break;
        }

        if (this.clients.size >= this.maxPlayers) {
          this.sendToSocket(socket, createMessage('ERROR', {
            code: 'ROOM_FULL',
            message: `Room is full (${this.maxPlayers}/${this.maxPlayers} players)`,
          }, this.hostId));
          return;
        }

        const playerId = uuidv4();
        const seat = this.getNextSeat();
        const client: ConnectedClient = {
          id: playerId,
          name: playerName,
          deviceId: payload.deviceId,
          socket,
          seat,
          isReady: false,
          isHost: false,
          connected: true,
          boardAssignments: null,
          lastHeartbeat: Date.now(),
        };

        this.clients.set(playerId, client);

        // Send ack to the new player
        const ack: RoomJoinAckPayload = {
          playerId,
          seat,
          roomCode: this.roomCode,
          hostName: this.hostName,
        };
        this.sendToSocket(socket, createMessage('ROOM_JOIN_ACK', ack, this.hostId));

        // Broadcast room state to all
        this.broadcastRoomState();
        this.callbacks.onPlayerJoined(client);
        break;
      }

      case 'PLAYER_READY': {
        const readyPayload = message.payload as PlayerReadyPayload;

        // Fix 3: Validate PLAYER_READY specific fields
        if (!Array.isArray(readyPayload.boardAssignments)) {
          return;
        }

        const client = this.findClientBySocket(socket);
        if (client) {
          client.isReady = true;
          client.boardAssignments = readyPayload.boardAssignments;
          this.callbacks.onPlayerReady(client.id);
          this.broadcastRoomState();
          this.checkAllReady();
        }
        break;
      }

      case 'NEXT_HAND_REQUEST': {
        const nhClient = this.findClientBySocket(socket);
        if (nhClient) {
          this.nextHandRequests.add(nhClient.id);
          this.checkNextHandReady();
        }
        break;
      }

      case 'HEARTBEAT': {
        const client = this.findClientBySocket(socket);
        if (client) {
          client.lastHeartbeat = Date.now();
          this.sendToSocket(socket, createMessage('HEARTBEAT_ACK', {}, this.hostId));
        }
        break;
      }
    }
  }

  private findClientBySocket(socket: any): ConnectedClient | undefined {
    for (const client of this.clients.values()) {
      if (client.socket === socket) return client;
    }
    return undefined;
  }

  // Fix 1: Guard against double disconnect
  private handleSocketDisconnect(socket: any): void {
    const client = this.findClientBySocket(socket);
    if (client && client.connected) {  // Only process if still marked connected
      client.connected = false;
      client.socket = null;  // Clear socket reference to prevent re-matching
      this.callbacks.onPlayerLeft(client.id);
      this.broadcastRoomState();
      // Broadcast disconnection to other players
      this.broadcast(createMessage('PLAYER_DISCONNECTED', {
        playerId: client.id,
        playerName: client.name,
      }, this.hostId));
    }
  }

  private getNextSeat(): number {
    const takenSeats = new Set(Array.from(this.clients.values()).map((c) => c.seat));
    for (let s = 0; s < this.maxPlayers; s++) {
      if (!takenSeats.has(s)) return s;
    }
    return this.clients.size;
  }

  private broadcastRoomState(): void {
    const players = Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      seat: c.seat,
      connected: c.connected,
      isReady: c.isReady,
    }));

    const state: RoomStatePayload = {
      roomCode: this.roomCode,
      hostName: this.hostName,
      players,
      playerCount: this.clients.size,
      maxPlayers: this.maxPlayers,
    };

    this.broadcast(createMessage('ROOM_STATE', state, this.hostId));
    this.callbacks.onRoomStateChanged(Array.from(this.clients.values()));
  }

  private checkAllReady(): void {
    const allReady = Array.from(this.clients.values())
      .filter((c) => c.connected)
      .every((c) => c.isReady);

    if (allReady) {
      this.broadcast(createMessage('ALL_READY', {}, this.hostId));
      this.callbacks.onAllPlayersReady();
    }
  }

  // --- Game flow methods (called by host game logic) ---

  startGame(config: GameConfig): void {
    const playerCount = this.clients.size as 2 | 3 | 4;
    const { players, boards, dealResult } = dealNewHand(playerCount, config);

    this.boards = boards;
    this.playerHands = dealResult.playerHands;

    // Send each player only their own cards
    const clientArray = Array.from(this.clients.values()).sort((a, b) => a.seat - b.seat);
    const boardCount = boards.length;

    for (let i = 0; i < clientArray.length; i++) {
      const client = clientArray[i];
      const dealtPayload: CardsDealtPayload = {
        yourCards: dealResult.playerHands[i],
        boards: boards.map((b, bi) => ({
          boardIndex: bi,
          openCards: b.openCards,
          closedCardCount: b.closedCards.length,
        })),
        cardsPerBoard: CARDS_PER_BOARD,
        timeLimit: config.arrangementTime,
        playerCount,
        boardCount,
      };

      if (client.isHost) {
        // Host receives via callback, not socket
        // The host screen will read this from the return value
      } else {
        this.sendTo(client.id, createMessage('CARDS_DEALT', dealtPayload, this.hostId));
      }
    }

    // Broadcast game start
    this.broadcast(createMessage('GAME_START', { boardCount, playerCount }, this.hostId));
  }

  getDealtCards(): { boards: MultiBoardState[]; playerHands: Card[][] } {
    return { boards: this.boards, playerHands: this.playerHands };
  }

  setHostReady(boardAssignments: Card[][]): void {
    const host = this.clients.get(this.hostId);
    if (host) {
      host.isReady = true;
      host.boardAssignments = boardAssignments;
      this.callbacks.onPlayerReady(this.hostId);
      this.broadcastRoomState();
      this.checkAllReady();
    }
  }

  updateCallbacks(partial: Partial<GameServerCallbacks>): void {
    Object.assign(this.callbacks, partial);
  }

  getBoards(): MultiBoardState[] {
    return this.boards;
  }

  requestNextHand(config: GameConfig): void {
    this.gameConfig = config;
    this.nextHandRequests.add(this.hostId);
    this.checkNextHandReady();
  }

  private checkNextHandReady(): void {
    const connectedClients = Array.from(this.clients.values()).filter((c) => c.connected);
    if (this.nextHandRequests.size >= connectedClients.length && this.gameConfig) {
      this.startNewHand(this.gameConfig);
    }
  }

  private startNewHand(config: GameConfig): void {
    // Reset all player states
    for (const client of this.clients.values()) {
      client.isReady = false;
      client.boardAssignments = null;
    }
    this.nextHandRequests.clear();

    // Re-deal and broadcast
    this.startGame(config);
    this.callbacks.onNewHandDealt?.();
  }

  runRevealSequence(config: GameConfig): {
    boardResults: any[];
    handResult: any;
  } {
    // Collect all card assignments
    const clientArray = Array.from(this.clients.values()).sort((a, b) => a.seat - b.seat);
    const boardCount = this.boards.length;

    for (let i = 0; i < clientArray.length; i++) {
      const assignments = clientArray[i].boardAssignments;
      if (assignments) {
        for (let b = 0; b < boardCount; b++) {
          this.boards[b].playerCards[i] = assignments[b];
        }
      } else {
        // Auto-fill disconnected player
        const cardsPerPlayer = this.playerHands[i].length;
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

    // Evaluate
    const boardResults = evaluateAllBoards(this.boards, clientArray.length);
    const handResult = calculateChipDeltas(boardResults, clientArray.length, config);

    return { boardResults, handResult };
  }

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
    this.broadcast(createMessage('BOARD_REVEAL', payload, this.hostId));
  }

  sendHandComplete(result: HandCompletePayload): void {
    this.broadcast(createMessage('HAND_COMPLETE', result, this.hostId));
  }

  // --- Networking primitives ---

  broadcast(message: NetworkMessage): void {
    const json = JSON.stringify(message) + '\n';
    for (const client of this.clients.values()) {
      if (client.socket && client.connected) {
        try {
          client.socket.write(json);
        } catch {
          client.connected = false;
        }
      }
    }
  }

  sendTo(playerId: string, message: NetworkMessage): void {
    const client = this.clients.get(playerId);
    if (client?.socket && client.connected) {
      try {
        client.socket.write(JSON.stringify(message) + '\n');
      } catch {
        client.connected = false;
      }
    }
  }

  private sendToSocket(socket: any, message: NetworkMessage): void {
    try {
      socket.write(JSON.stringify(message) + '\n');
    } catch {
      // Socket may have closed
    }
  }

  // Fix 6: Heartbeat with app-background grace period
  private startHeartbeatMonitor(): void {
    this.lastHeartbeatCheck = Date.now();

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastHeartbeatCheck;
      this.lastHeartbeatCheck = now;

      // If we were backgrounded (gap > 2x interval), reset all heartbeat timestamps
      if (elapsed > NETWORK_CONFIG.heartbeatIntervalMs * 2) {
        for (const client of this.clients.values()) {
          if (!client.isHost && client.connected) {
            client.lastHeartbeat = now;
          }
        }
        return; // Skip this check cycle
      }

      for (const client of this.clients.values()) {
        if (
          !client.isHost &&
          client.connected &&
          now - client.lastHeartbeat > NETWORK_CONFIG.heartbeatTimeoutMs
        ) {
          client.connected = false;
          this.callbacks.onPlayerLeft(client.id);
          this.broadcastRoomState();
        }
      }
    }, NETWORK_CONFIG.heartbeatIntervalMs);
  }

  stop(): void {
    // Fix 5: Set stopping flag to reject new connections
    this.stopping = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const client of this.clients.values()) {
      if (client.socket) {
        try {
          client.socket.destroy();
        } catch {
          // Ignore
        }
      }
    }
    this.clients.clear();

    if (this.server) {
      try {
        this.server.close();
      } catch {
        // Ignore
      }
      this.server = null;
    }
  }
}
