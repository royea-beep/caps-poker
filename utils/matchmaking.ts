/**
 * Matchmaking helpers — createRoom / joinRoom / quickMatch.
 * Wraps sit_and_go_sessions + sit_and_go_players Supabase tables.
 * Uses 6-digit numeric room codes (consistent with existing generateOnlineRoomCode).
 */

import { getSupabase } from './supabase';
import { GameConfig } from '../constants/gameConfig';
import { generateOnlineRoomCode } from './realtimeMultiplayer';

export interface RoomInfo {
  roomCode: string;
  sessionId: string;
}

export interface SessionRow {
  id: string;
  room_code: string;
  status: string;
  max_players: number;
  current_players: number;
  host_id: string;
}

/**
 * Create a new waiting room in Supabase.
 * Returns the room code and session ID to wire into RealtimeServer.
 */
export async function createRoom(hostName: string, config: GameConfig): Promise<RoomInfo> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const roomCode = generateOnlineRoomCode();

  const { data: session, error } = await sb
    .from('sit_and_go_sessions')
    .insert({
      room_code: roomCode,
      status: 'waiting',
      max_players: config.numberOfPlayers,
      current_players: 1,
      host_id: hostName,
    })
    .select('id')
    .single();

  if (error || !session) throw new Error(error?.message ?? 'Failed to create room');

  await sb.from('sit_and_go_players').insert({
    session_id: session.id,
    player_name: hostName,
    chips: config.startingChips,
  });

  return { roomCode, sessionId: session.id };
}

/**
 * Join an existing waiting room.
 * Throws if the room is not found, already started, or is full.
 */
export async function joinRoom(roomCode: string, playerName: string, startingChips: number): Promise<RoomInfo> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data: session, error } = await sb
    .from('sit_and_go_sessions')
    .select('*')
    .eq('room_code', roomCode.trim())
    .eq('status', 'waiting')
    .single();

  if (error || !session) throw new Error('Room not found or already started');
  if ((session as SessionRow).current_players >= (session as SessionRow).max_players) throw new Error('Room is full');

  const s = session as SessionRow;

  await sb.from('sit_and_go_players').insert({
    session_id: s.id,
    player_name: playerName,
    chips: startingChips,
  });

  await sb
    .from('sit_and_go_sessions')
    .update({ current_players: s.current_players + 1 })
    .eq('id', s.id);

  return { roomCode: s.room_code, sessionId: s.id };
}

/**
 * Quick match: join an available room, or create one if none exist.
 */
export async function quickMatch(playerName: string, config: GameConfig): Promise<RoomInfo> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');

  // Find any waiting room with space
  const { data: rooms } = await sb
    .from('sit_and_go_sessions')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(10);

  if (rooms) {
    for (const row of rooms as SessionRow[]) {
      if (row.current_players < row.max_players) {
        try {
          return await joinRoom(row.room_code, playerName, config.startingChips);
        } catch {
          // Room became full or gone — try next
        }
      }
    }
  }

  // No available rooms — create one
  return createRoom(playerName, config);
}

/**
 * Mark a session as completed after the game ends.
 */
export async function closeRoom(sessionId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from('sit_and_go_sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId);
}

/**
 * List active waiting rooms (for lobby display).
 * Returns up to 10 rooms with space.
 */
export async function listWaitingRooms(): Promise<SessionRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('sit_and_go_sessions')
    .select('id, room_code, status, max_players, current_players, host_id')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(10);
  return (data as SessionRow[]) ?? [];
}
