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
import { ensureAnonymousAuth } from './auth';
import { resolveJoinIdentity, joinErrorMessage } from './joinIdentity';
import { track } from './analytics';

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
  /** 'bot_practice' rows are lobby advertisements for the local practice game (no join_table). Optional until the server migration lands. */
  table_kind?: 'human' | 'bot_practice';
}

export interface JoinResult {
  ok: boolean;
  error?: string;
  /**
   * T1 — user-facing copy for errors that have no adequate wording at the call site (today: only
   * `no_session`). Resolved in `joinTable` so all four call sites get it from one place. Call sites
   * should prefer it and fall back to their own context-specific string: `res?.message ?? '…'`.
   */
  message?: string;
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
  /**
   * Seat (0-indexed) the server assigned this joiner. join_table now picks the
   * smallest FREE seat in [0, max_players), so mid-waiting leaves no longer leak a
   * unique-constraint collision. Clients should trust this — never recompute it
   * from join order or current_players.
   */
  seat_index?: number;
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
    // IDENTITY: await the anon session before seating. Every call site passes a `userIdRef.current`
    // populated by a FIRE-AND-FORGET `getUser()` (app/lobby/table.tsx:132 and friends), so a fast
    // joiner reached this RPC with playerId = null and was seated with room_players.user_id = NULL —
    // an unattributable seat. Resolving it HERE fixes all four call sites at one choke point.
    // ensureAnonymousAuth() returns the existing session's uid, or signs in anonymously first (CAPS
    // has run anonymous auth since 2026-04-27), so auth.uid() is non-null by the time the RPC fires.
    // This is also the PREREQUISITE for flipping app_config.join_requires_session — with the flag off
    // it simply repairs the NULL, so it is safe and beneficial standalone.
    // J2: BOUNDED — never block the join on auth (2.5s cap, falls back to the device identity).
    // M2 — telemetry on the timeout path ONLY. The DB cannot see this: server-side auth.uid() is
    // non-null whenever a session JWT is attached, so it cannot tell "auth was fast" from "auth timed
    // out but a session already existed". `had_session` is resolved AFTER the join decision, so it
    // never delays the join; the whole callback is fire-and-forget and swallows its own errors.
    const sessionUid = await resolveJoinIdentity(ensureAnonymousAuth, playerId ?? null, undefined, (info) => {
      void (async () => {
        try {
          const { data } = await sb.auth.getSession();
          track('join_auth_timeout', {
            elapsed_ms: info.elapsedMs,
            reason: info.reason,
            had_session: !!data?.session,      // TRUE => auth existed but was slow; FALSE => genuinely sessionless
            had_fallback: info.hadFallback,
          }, 'lobby');
        } catch { /* telemetry must never affect the join */ }
      })();
    });
    const { data, error } = await sb.rpc('join_table', {
      p_room_code: roomCode.trim().toUpperCase(),
      p_player_id: sessionUid,
      p_display_name: displayName ?? 'Player',
      p_device_id: deviceId ?? null,
    });
    if (error) return null;
    // T1: attach the user-facing copy HERE, once, so no call site can forget it. Immutable —
    // never mutate the RPC payload.
    const result = data as JoinResult;
    const copy = result?.ok === false ? joinErrorMessage(result.error) : undefined;
    return copy ? { ...result, message: copy } : result;
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
 * Heartbeat a seated player's presence (bumps room_players.last_seen). Used to keep
 * seats in the PUBLIC pool from being reaped by evict_ghost_seats(>90s stale) while
 * the player is actually waiting. Fire-and-forget; no-op for non-existent rooms.
 *
 * Identity: the device_id passed here MUST match the realtime presence key
 * (utils/realtimeMultiplayer uses getDeviceId() as the presence key on both host and
 * client), so a row identified by (room_code, device_id) is the same physical seat.
 */
export async function touchRoomPlayer(roomCode: string, deviceId: string | null, userId: string | null): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb || !roomCode) return;
    await sb.rpc('touch_room_player', {
      p_room_code: roomCode.trim().toUpperCase(),
      p_device_id: deviceId ?? null,
      p_user_id: userId ?? null,
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
