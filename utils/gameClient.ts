import TcpSocket from 'react-native-tcp-socket';
import { v4 as uuidv4 } from 'uuid';
import {
  NETWORK_CONFIG,
  NetworkMessage,
  createMessage,
  RoomJoinPayload,
  RoomJoinAckPayload,
  RoomStatePayload,
  CardsDealtPayload,
  BoardRevealPayload,
  HandCompletePayload,
  ErrorPayload,
  PlayerReadyPayload,
} from '../constants/networkConfig';
import { Card } from '../constants/gameConfig';

export interface GameClientCallbacks {
  onConnected: (ack: RoomJoinAckPayload) => void;
  onRoomState: (state: RoomStatePayload) => void;
  onGameStart: (data: { boardCount: number; playerCount: number }) => void;
  onCardsDealt: (data: CardsDealtPayload) => void;
  onAllReady: () => void;
  onBoardReveal: (data: BoardRevealPayload) => void;
  onHandComplete: (data: HandCompletePayload) => void;
  onPlayerDisconnected: (playerId: string, playerName: string) => void;
  onReconnecting: (attempt: number) => void;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export class GameClient {
  private socket: any = null;
  private callbacks: GameClientCallbacks;
  private playerId: string = '';
  private deviceId: string;
  private playerName: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatAck: number = Date.now();
  private connected: boolean = false;
  private reconnecting: boolean = false;
  private reconnectAttempt: number = 0;
  private lastHostIP: string = '';
  private lastRoomCode: string = '';
  private lastPort: number = NETWORK_CONFIG.port;

  constructor(callbacks: GameClientCallbacks, playerName: string) {
    this.callbacks = callbacks;
    this.deviceId = uuidv4();
    this.playerName = playerName;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  connect(
    hostIP: string,
    roomCode: string,
    port: number = NETWORK_CONFIG.port
  ): Promise<void> {
    this.lastHostIP = hostIP;
    this.lastRoomCode = roomCode;
    this.lastPort = port;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, NETWORK_CONFIG.connectionTimeoutMs);

      try {
        this.socket = TcpSocket.createConnection(
          { host: hostIP, port },
          () => {
            // Connected — send join request
            const joinPayload: RoomJoinPayload = {
              roomCode,
              playerName: this.playerName,
              deviceId: this.deviceId,
            };
            this.send(createMessage('ROOM_JOIN', joinPayload, this.deviceId));
          }
        );

        let buffer = '';

        this.socket.on('data', (data: Buffer | string) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message: NetworkMessage = JSON.parse(line);

                // Handle ROOM_JOIN_ACK specially during connection
                if (message.type === 'ROOM_JOIN_ACK') {
                  clearTimeout(timeout);
                  const ack = message.payload as RoomJoinAckPayload;
                  this.playerId = ack.playerId;
                  this.connected = true;
                  this.startHeartbeat();
                  this.callbacks.onConnected(ack);
                  resolve();
                } else if (message.type === 'ERROR') {
                  clearTimeout(timeout);
                  const err = message.payload as ErrorPayload;
                  reject(new Error(err.message));
                } else {
                  this.handleMessage(message);
                }
              } catch {
                // Ignore malformed messages
              }
            }
          }
        });

        this.socket.on('error', (err: Error) => {
          clearTimeout(timeout);
          this.connected = false;
          this.stopHeartbeat();
          this.callbacks.onError(err);
          reject(err);
        });

        this.socket.on('close', () => {
          if (this.connected && !this.reconnecting) {
            this.connected = false;
            this.stopHeartbeat();
            this.attemptReconnect();
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  private handleMessage(message: NetworkMessage): void {
    switch (message.type) {
      case 'ROOM_STATE': {
        const state = message.payload as RoomStatePayload;
        this.callbacks.onRoomState(state);
        break;
      }
      case 'GAME_START': {
        const data = message.payload as { boardCount: number; playerCount: number };
        this.callbacks.onGameStart(data);
        break;
      }
      case 'CARDS_DEALT': {
        const dealt = message.payload as CardsDealtPayload;
        this.callbacks.onCardsDealt(dealt);
        break;
      }
      case 'ALL_READY': {
        this.callbacks.onAllReady();
        break;
      }
      case 'BOARD_REVEAL': {
        const reveal = message.payload as BoardRevealPayload;
        this.callbacks.onBoardReveal(reveal);
        break;
      }
      case 'HAND_COMPLETE': {
        const result = message.payload as HandCompletePayload;
        this.callbacks.onHandComplete(result);
        break;
      }
      case 'PLAYER_DISCONNECTED': {
        const dc = message.payload as { playerId: string; playerName: string };
        this.callbacks.onPlayerDisconnected(dc.playerId, dc.playerName);
        break;
      }
      case 'HEARTBEAT_ACK': {
        this.lastHeartbeatAck = Date.now();
        break;
      }
      case 'ERROR': {
        const err = message.payload as ErrorPayload;
        this.callbacks.onError(new Error(err.message));
        break;
      }
    }
  }

  sendReady(boardAssignments: Card[][]): void {
    const payload: PlayerReadyPayload = { boardAssignments };
    this.send(createMessage('PLAYER_READY', payload, this.playerId));
  }

  send(message: NetworkMessage): void {
    if (this.socket && this.connected) {
      try {
        this.socket.write(JSON.stringify(message) + '\n');
      } catch {
        this.connected = false;
        this.callbacks.onDisconnected();
      }
    }
  }

  private startHeartbeat(): void {
    this.lastHeartbeatAck = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastHeartbeatAck > NETWORK_CONFIG.heartbeatTimeoutMs) {
        this.connected = false;
        this.stopHeartbeat();
        this.attemptReconnect();
        return;
      }
      this.send(createMessage('HEARTBEAT', {}, this.playerId));
    }, NETWORK_CONFIG.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempt >= NETWORK_CONFIG.reconnectAttempts) {
      this.reconnecting = false;
      this.reconnectAttempt = 0;
      this.callbacks.onDisconnected();
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempt++;
    this.callbacks.onReconnecting(this.reconnectAttempt);

    // Wait 2 seconds between reconnect attempts
    setTimeout(() => {
      if (!this.reconnecting) return;

      this.connect(this.lastHostIP, this.lastRoomCode, this.lastPort)
        .then(() => {
          this.reconnecting = false;
          this.reconnectAttempt = 0;
        })
        .catch(() => {
          this.attemptReconnect();
        });
    }, 2000);
  }

  disconnect(): void {
    this.reconnecting = false;
    this.reconnectAttempt = 0;
    this.connected = false;
    this.stopHeartbeat();
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
  }
}
