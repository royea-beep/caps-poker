/**
 * Multiplayer Lobby API — VAMOS-CAPS-MP-LOBBY Phase 2.
 *
 * Thin wrappers over the SECURITY DEFINER lobby RPCs on game_rooms
 * (list_open_tables / create_table / join_table). Writes never go directly to
 * game_rooms (RLS allows only authenticated insert/update) — only via these RPCs.
 * Fire-safe: never throw to the UI.
 */
import { getSupabase } from './supabase';

export type PlayerCount = 2 | 3 | 4;

export interface OpenTable {
  id: string;
  room_code: string;
  host_name: string;
  status: string;
  current_players: number;
  max_players: number;
  player_count: number; // == max_players (the "type")
  game_config: { numberOfPlayers?: number } | null;
  created_at: string;
}

export interface JoinResult {
  ok: boolean;
  error?: string;
  id?: string;
  room_code?: string;
  current_players?: number;
  max_players?: number;
  status?: string;
  autostarted?: boolean;
  game_config?: { numberOfPlayers?: number } | null;
}

export interface CreateResult {
  ok: boolean;
  error?: string;
  id?: string;
  room_code?: string;
  status?: string;
  current_players?: number;
  max_players?: number;
  game_config?: { numberOfPlayers?: number } | null;
}

/** All waiting (joinable) tables. Returns [] on any failure. */
export async function listOpenTables(): Promise<OpenTable[]> {
  try {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.rpc('list_open_tables');
    if (error || !Array.isArray(data)) return [];
    return data as OpenTable[];
  } catch {
    return [];
  }
}

/** Open a new table of the given size; the caller is seated as host (1/N). */
export async function createTable(playerCount: PlayerCount, hostId?: string | null, hostName?: string): Promise<CreateResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('create_table', {
      p_player_count: playerCount,
      p_host_id: hostId ?? null,
      p_host_name: hostName ?? 'Player',
    });
    if (error) return null;
    return data as CreateResult;
  } catch {
    return null;
  }
}

/** Claim a seat at a table by code. Auto-starts (status='playing') when it fills. */
export async function joinTable(roomCode: string, playerId?: string | null): Promise<JoinResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('join_table', {
      p_room_code: roomCode.trim().toUpperCase(),
      p_player_id: playerId ?? null,
    });
    if (error) return null;
    return data as JoinResult;
  } catch {
    return null;
  }
}

/** Group tables by their size (2/3/4) for the lobby's three sections. */
export function groupTablesByType(tables: OpenTable[]): Record<PlayerCount, OpenTable[]> {
  const out: Record<PlayerCount, OpenTable[]> = { 2: [], 3: [], 4: [] };
  for (const t of tables) {
    const n = (t.player_count ?? t.max_players) as PlayerCount;
    if (n === 2 || n === 3 || n === 4) out[n].push(t);
  }
  return out;
}
