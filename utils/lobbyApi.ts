/**
 * Multiplayer Lobby API — VAMOS-CAPS-MP-LOBBY Phase 2 + LOBBY-V2-CLIENT.
 *
 * Thin wrappers over the SECURITY DEFINER lobby RPCs on game_rooms. Writes never
 * go directly to game_rooms (RLS allows only authenticated insert/update) — only
 * via these RPCs. Fire-safe: never throw to the UI.
 *
 * Two lobbies share the same table machinery:
 *  - PUBLIC  (Play → /lobby): a persistent, auto-seeded pool of HOSTLESS tables
 *    (2 per type). listPublicTables() browses them; join_table makes the FIRST
 *    joiner the host (returns is_host:true); ensure_public_lobby() replenishes.
 *  - PRIVATE (Friends → /lobby/private): create_table opens an invite-code table
 *    (is_public stays false) the creator hosts; joinTable(code) joins by code.
 *    Private tables never appear in the public lobby.
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
  /** True when this joiner claimed the host seat of a hostless public table. */
  is_host?: boolean;
  /** True when the caller was already seated at this table (idempotent re-join). */
  already_joined?: boolean;
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

/** All waiting (joinable) tables — public + private. Returns [] on any failure. */
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

/** The persistent public-pool tables (hostless, waiting). Returns [] on any failure. */
export async function listPublicTables(): Promise<OpenTable[]> {
  try {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.rpc('list_public_tables');
    if (error || !Array.isArray(data)) return [];
    return data as OpenTable[];
  } catch {
    return [];
  }
}

/**
 * Seed/replenish the public pool to 2 waiting tables per type (idempotent).
 * Used at activation and by the e2e harness — NOT called from normal UI flow
 * (the pool self-heals via join_table + pg_cron). Returns the RPC result or null.
 */
export async function ensurePublicLobby(): Promise<{ ok: boolean; created?: number } | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('ensure_public_lobby');
    if (error) return null;
    return data as { ok: boolean; created?: number };
  } catch {
    return null;
  }
}

/** Open a new table of the given size; the caller is seated as host (roster seat 0). */
export async function createTable(playerCount: PlayerCount, hostId?: string | null, hostName?: string, deviceId?: string | null): Promise<CreateResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('create_table', {
      p_player_count: playerCount,
      p_host_id: hostId ?? null,
      p_host_name: hostName ?? 'Player',
      p_device_id: deviceId ?? null,
    });
    if (error) return null;
    return data as CreateResult;
  } catch {
    return null;
  }
}

/** Claim a seat (adds a room_players roster row; idempotent per player). Auto-starts when full. */
export async function joinTable(roomCode: string, playerId?: string | null, displayName?: string, deviceId?: string | null): Promise<JoinResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('join_table', {
      p_room_code: roomCode.trim().toUpperCase(),
      p_player_id: playerId ?? null,
      p_display_name: displayName ?? 'Player',
      p_device_id: deviceId ?? null,
    });
    if (error) return null;
    return data as JoinResult;
  } catch {
    return null;
  }
}

/**
 * Leave a table (removes the roster row, frees the seat). On a PRIVATE waiting table,
 * the host leaving abandons it. On a PUBLIC pool table it is NEVER abandoned — the seat
 * is freed and, if the host left, host_id is cleared so the next joiner becomes host.
 */
export async function leaveTable(roomCode: string, playerId?: string | null, deviceId?: string | null): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.rpc('leave_table', {
      p_room_code: roomCode.trim().toUpperCase(),
      p_player_id: playerId ?? null,
      p_device_id: deviceId ?? null,
    });
  } catch {
    /* fire-and-forget */
  }
}

/**
 * Mark a table finished + clear its roster at game end (host only). Fixes the 'playing'
 * leak: join_table autostart left rooms 'playing' forever. Idempotent + fire-safe; a
 * no-op for codes not in game_rooms (e.g. legacy 6-digit internet rooms).
 */
export async function finishTable(roomCode: string): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb || !roomCode) return;
    await sb.rpc('finish_table', { p_room_code: roomCode.trim().toUpperCase() });
  } catch {
    /* fire-and-forget */
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
