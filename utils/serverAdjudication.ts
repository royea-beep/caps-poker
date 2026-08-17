/**
 * STAGE 2, CLIENT SIDE — behind app_config.mp_server_adjudication_enabled, DEFAULT FALSE.
 *
 * Three things move together or not at all: each seat submits its own placements, the host asks the
 * server to adjudicate, and the host stops adjudicating. Half of that is worse than none — if the
 * server judged while placements were not flowing, it would judge the DEALT order while the reveal
 * animated the player's ARRANGEMENT, paying for cards nobody saw. So one flag gates all three.
 *
 * THE FLAG IS READ HERE, WHERE THE DECISION IS MADE, straight from app_config. It is deliberately
 * NOT routed through a module-level setter populated by the app's bootstrap: `setMpBoardRevealEnabled`
 * and `setCompleteBonusPctByBoards` are exactly that shape, and the second of them would have made
 * the server pay the wrong COMPLETE bonus forever because nothing on a server ever calls the setter.
 * A value that must be pushed in can silently never arrive. A value that is pulled cannot.
 */
import { getSupabase } from './supabase';
import type { Card } from '../constants/gameConfig';

const FLAG_KEY = 'mp_server_adjudication_enabled';

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

/** Cached per session. Any failure means FALSE — the old path, which is known to work. */
export async function isServerAdjudicationEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const sb = getSupabase();
      if (!sb) return false;
      const { data, error } = await sb.from('app_config').select('value').eq('key', FLAG_KEY).maybeSingle();
      if (error) return false;
      return data?.value === true;
    } catch {
      return false;
    } finally {
      inflight = null;
    }
  })().then((v) => {
    cached = v;
    return v;
  });
  return inflight;
}

/** Test seam only — the flag is fetched once per session otherwise. */
export function _resetServerAdjudicationCache(): void {
  cached = null;
}

/**
 * ONE SEAT SUBMITS ITS OWN CARDS. There is no "on behalf of" parameter on `submit_placements` and
 * none is wanted: the RPC resolves the caller's seat from the device id and validates by set
 * equality against what the server dealt THAT seat. A host physically does not hold another seat's
 * cards here, so it cannot submit for them even by mistake.
 *
 * THROWS ON FAILURE, DELIBERATELY. A seat evicted after the grace window gets `not_seated`, and
 * swallowing that would fall through to the server's auto-fill — which places cards in DEALT order
 * while the reveal shows the arrangement. Silent, and worse than the old path. The caller decides
 * what to do; it must not be nothing.
 */
export async function submitOwnPlacements(
  roomCode: string,
  handNo: number,
  deviceId: string,
  assignments: Card[][]
): Promise<void> {
  if (!roomCode) throw new Error('submit_placements: no room code');
  if (!Number.isInteger(handNo) || handNo <= 0) throw new Error(`submit_placements: bad hand_no ${handNo}`);
  if (!deviceId) throw new Error('submit_placements: no device id');

  const sb = getSupabase();
  if (!sb) throw new Error('submit_placements: no Supabase client');
  const { data, error } = await sb.rpc('submit_placements', {
    p_room_code: roomCode,
    p_hand_no: handNo,
    p_device_id: deviceId,
    p_assignments: assignments,
  });
  if (error) throw new Error(`submit_placements failed: ${error.message}`);
  if (!data?.ok) throw new Error(`submit_placements refused: ${data?.reason ?? 'unknown'}`);
}

/** One seat's line in a board's reveal, in the shape multiplayer-game.tsx:409-415 consumes. */
export interface ServerPlayerResult {
  seat_index: number;
  device_id: string;
  name: string;
  score: number;
}

export interface ServerOutcome {
  hand_no: number;
  board_count: number;
  player_count: number;
  seats: { device_id: string; seat_index: number; chips_delta: number; boards_won: number; auto_filled: boolean }[];
  boards: { board_index: number; winner_index: number; tied: number[]; playerResults: ServerPlayerResult[] }[];
  complete_winner: number | null;
  complete_bonus: number;
  bonus_percent: number;
  pot_per_board: number;
}

/**
 * HOST ONLY: ask the server who won. THROWS — there is no fallback to local adjudication, for the
 * same reason `serverDeal.ts` has none: a quiet fallback restores client authority invisibly, and
 * an invisible security regression is the one this project pays most for.
 */
export async function resolveHandOnServer(roomCode: string, handNo: number): Promise<ServerOutcome> {
  const sb = getSupabase();
  if (!sb) throw new Error('resolve_hand: no Supabase client');
  const { data, error } = await sb.functions.invoke('resolve-hand', {
    body: { room_code: roomCode, hand_no: handNo },
  });
  if (error) throw new Error(`resolve_hand failed: ${error.message}`);
  if (!data?.ok || !data?.outcome) throw new Error(`resolve_hand refused: ${data?.reason ?? data?.error ?? 'unknown'}`);
  return data.outcome as ServerOutcome;
}

/**
 * Reshape the server's outcome into exactly what `runRevealSequence` used to return, so every
 * consumer downstream — the BOARD_REVEAL broadcast, the reveal animation, /results — is untouched.
 * This changes WHO DECIDES, not what the player watches.
 */
export function outcomeToRevealShape(outcome: ServerOutcome): { boardResults: any[]; handResult: any } {
  const boardResults = outcome.boards.map((b) => ({
    boardIndex: b.board_index,
    playerResults: b.playerResults.map((pr) => ({ name: pr.name, score: pr.score })),
    winnerIndex: b.winner_index,
    tiedPlayers: b.tied,
    potWon: 0,
  }));
  return {
    boardResults,
    handResult: {
      boardResults,
      chipDeltas: outcome.seats.map((s) => s.chips_delta),
      completeWinner: outcome.complete_winner,
      completeBonusAmount: outcome.complete_bonus,
    },
  };
}
