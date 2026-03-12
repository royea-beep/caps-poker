import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getDeviceId } from './leaderboard';

type MessageHandler = (payload: any, senderId: string) => void;
type PresenceHandler = (players: { id: string; name: string }[]) => void;

/**
 * RealtimeServer — host creates a Supabase Realtime channel.
 * Same message protocol as GameServer (TCP), but over Supabase Realtime.
 */
export class RealtimeServer {
  private channel: RealtimeChannel | null = null;
  private roomCode: string = '';
  private hostId: string = '';
  private hostName: string = '';
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private presenceHandler: PresenceHandler | null = null;
  private started = false;

  async start(roomCode: string, hostName: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    this.roomCode = roomCode;
    this.hostId = await getDeviceId();
    this.hostName = hostName;

    this.channel = supabase.channel(`caps-room-${roomCode}`, {
      config: { presence: { key: this.hostId } },
    });

    // Track presence
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState();
      const players = Object.entries(state).map(([key, presences]) => ({
        id: key,
        name: (presences as any)[0]?.name || key,
      }));
      this.presenceHandler?.(players);
    });

    // Listen for broadcast messages from guests
    this.channel.on('broadcast', { event: 'game_message' }, ({ payload }) => {
      if (!payload) return;
      const { type, data, senderId } = payload;
      const handlers = this.messageHandlers.get(type) || [];
      handlers.forEach((h) => h(data, senderId));
    });

    const status = await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel!.track({ name: this.hostName, isHost: true });
      }
    });

    this.started = true;
    return true;
  }

  /** Broadcast a message to all players in the room */
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
      payload: { type, data: payload, senderId: this.hostId, targetId: playerId },
    });
  }

  onMessage(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
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

  stop(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.started = false;
    this.messageHandlers.clear();
    this.presenceHandler = null;
  }
}

/**
 * RealtimeClient — guest joins a Supabase Realtime channel.
 * Same message protocol as GameClient (TCP), but over Supabase Realtime.
 */
export class RealtimeClient {
  private channel: RealtimeChannel | null = null;
  private roomCode: string = '';
  private playerId: string = '';
  private playerName: string = '';
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private presenceHandler: PresenceHandler | null = null;
  private connected = false;

  async connect(roomCode: string, playerName: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    this.roomCode = roomCode;
    this.playerId = await getDeviceId();
    this.playerName = playerName;

    this.channel = supabase.channel(`caps-room-${roomCode}`, {
      config: { presence: { key: this.playerId } },
    });

    // Track presence
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState();
      const players = Object.entries(state).map(([key, presences]) => ({
        id: key,
        name: (presences as any)[0]?.name || key,
      }));
      this.presenceHandler?.(players);
    });

    // Listen for broadcast messages
    this.channel.on('broadcast', { event: 'game_message' }, ({ payload }) => {
      if (!payload) return;
      const { type, data, senderId, targetId } = payload;
      // Ignore messages targeted to other players
      if (targetId && targetId !== this.playerId) return;
      const handlers = this.messageHandlers.get(type) || [];
      handlers.forEach((h) => h(data, senderId));
    });

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel!.track({ name: this.playerName, isHost: false });
        this.connected = true;
      }
    });

    return true;
  }

  /** Send a message to the room (host will receive) */
  send(type: string, payload: any): void {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'game_message',
      payload: { type, data: payload, senderId: this.playerId },
    });
  }

  onMessage(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
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
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.connected = false;
    this.messageHandlers.clear();
    this.presenceHandler = null;
  }
}

/** Generate a 6-char alphanumeric room code */
export function generateOnlineRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Check if Supabase Realtime is available */
export function isOnlineMultiplayerAvailable(): boolean {
  return isSupabaseConfigured;
}
