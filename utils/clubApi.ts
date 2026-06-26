/**
 * Clubs API — VAMOS-CAPS-FRIENDS-CLUBS.
 *
 * Thin, fire-safe wrappers over the SECURITY DEFINER club RPCs on
 * gxrpunvhjcrzqnitbqah. A club is a closed group of friends with its own private
 * mini-league; club tables are game_rooms rows linked by club_id that only members
 * can list/create (server-enforced). Club tables ride the existing join_table /
 * finish_table / realtime path — they are ordinary private game_rooms rows.
 */
import { getSupabase } from './supabase';
import type { OpenTable, PlayerCount } from './lobbyApi';

export interface Club {
  id: string;
  club_code: string;
  name: string;
  member_count: number;
  is_owner: boolean;
}

export interface ClubMember {
  display_name: string;
  games_played: number;
  games_won: number;
  net_chips: number;
}

export interface ClubMutationResult {
  ok: boolean;
  error?: string;
  id?: string;
  club_code?: string;
  name?: string;
  already_member?: boolean;
}

export interface CreateClubTableResult {
  ok: boolean;
  error?: string;
  id?: string;
  room_code?: string;
  club_id?: string;
  current_players?: number;
  max_players?: number;
  status?: string;
  game_config?: { numberOfPlayers?: number } | null;
}

/** Create a club; the caller becomes owner + first member. Returns the new club or null. */
export async function createClub(name: string, deviceId?: string | null, userId?: string | null, displayName?: string): Promise<ClubMutationResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('create_club', {
      p_name: name, p_device_id: deviceId ?? null, p_user_id: userId ?? null, p_display_name: displayName ?? 'Player',
    });
    if (error) return null;
    return data as ClubMutationResult;
  } catch {
    return null;
  }
}

/** Join a club by code (idempotent). Returns the club, {ok:false,error:'no_such_club'}, or null. */
export async function joinClub(clubCode: string, deviceId?: string | null, userId?: string | null, displayName?: string): Promise<ClubMutationResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('join_club', {
      p_club_code: clubCode.trim().toUpperCase(), p_device_id: deviceId ?? null, p_user_id: userId ?? null, p_display_name: displayName ?? 'Player',
    });
    if (error) return null;
    return data as ClubMutationResult;
  } catch {
    return null;
  }
}

/** The clubs the caller belongs to. Returns [] on any failure. */
export async function myClubs(deviceId?: string | null, userId?: string | null): Promise<Club[]> {
  try {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.rpc('my_clubs', { p_device_id: deviceId ?? null, p_user_id: userId ?? null });
    if (error || !Array.isArray(data)) return [];
    return data as Club[];
  } catch {
    return [];
  }
}

/** A club's private mini-league, ranked by net_chips then games_won. Returns [] on failure. */
export async function clubLeaderboard(clubCode: string): Promise<ClubMember[]> {
  try {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.rpc('club_leaderboard', { p_club_code: clubCode.trim().toUpperCase() });
    if (error || !Array.isArray(data)) return [];
    return data as ClubMember[];
  } catch {
    return [];
  }
}

/**
 * Record one member's result into the club mini-league after a club game. Each client
 * calls this for ITSELF at game end (won + net chips for this player). Fire-and-forget.
 */
export async function recordClubResult(clubCode: string, deviceId: string | null, userId: string | null, won: boolean, netChips: number): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb || !clubCode) return;
    await sb.rpc('record_club_result', {
      p_club_code: clubCode.trim().toUpperCase(), p_device_id: deviceId ?? null, p_user_id: userId ?? null,
      p_won: won, p_net_chips: Math.round(netChips || 0),
    });
  } catch {
    /* fire-and-forget */
  }
}

/** Open a club table (member-gated). The caller is seated as host (seat 0). Returns it or null. */
export async function createClubTable(clubCode: string, playerCount: PlayerCount, deviceId?: string | null, userId?: string | null, displayName?: string): Promise<CreateClubTableResult | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('create_club_table', {
      p_club_code: clubCode.trim().toUpperCase(), p_player_count: playerCount,
      p_device_id: deviceId ?? null, p_user_id: userId ?? null, p_display_name: displayName ?? 'Player',
    });
    if (error) return null;
    return data as CreateClubTableResult;
  } catch {
    return null;
  }
}

/** A club's waiting tables (member-gated; [] for non-members). Returns [] on failure. */
export async function listClubTables(clubCode: string, deviceId?: string | null, userId?: string | null): Promise<OpenTable[]> {
  try {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.rpc('list_club_tables', {
      p_club_code: clubCode.trim().toUpperCase(), p_device_id: deviceId ?? null, p_user_id: userId ?? null,
    });
    if (error || !Array.isArray(data)) return [];
    return data as OpenTable[];
  } catch {
    return [];
  }
}
