/**
 * STAGE 1 — THE SERVER DEALS (MULTIPLAYER ONLY).
 *
 * Thin wrapper over the `deal_hand` RPC. The RPC returns cards as `{rank, suit, id}`, which is
 * already the client `Card` shape, so there is no adapter here and none is wanted: an adapter is
 * a second place for the deck's shape to drift.
 *
 * WHY THIS EXISTS AT ALL — it removes the guest bug rather than fixing it. The host used to publish
 * each guest's hole cards to `caps-room-{CODE}-p-{device}` with `private: true`, and the
 * `realtime.messages` policy denies both halves of that delivery for a device-anonymous player.
 * Here there is no player-to-player delivery: each client asks the server for its own cards over
 * its own request. There is nothing left to authorise.
 *
 * NO SILENT FALLBACK. Every function here THROWS on failure and there is no catch that reverts to
 * the local dealer. A network blip must surface as a visible error, because a fallback would
 * quietly restore client dealing — and a silent security regression is the failure this project
 * pays for most: invisible for weeks, and you cannot fix what you cannot see. Practice keeps the
 * client dealer; multiplayer must not reach for it.
 */
import { getSupabase } from './supabase';
import type { Card } from '../constants/gameConfig';

/** One seat's slice, as returned to a normal (non-host) caller. */
export interface ServerDealSlice {
  hand_no: number;
  player_count: number;
  board_count: number;
  your_cards: Card[];
  boards: { board_index: number; open_cards: Card[] }[];
}

/**
 * The whole deal — HOST ONLY, and only until stage 2 moves adjudication. The host cannot run
 * evaluateAllBoards from its own slice: it needs every seat's cards and the closed cards. The RPC
 * honours `p_full` only for the seat flagged is_host; a guest asking for it gets its slice.
 */
export interface ServerDealFull {
  hand_no: number;
  player_count: number;
  board_count: number;
  your_cards: Card[];
  full: {
    seats: { device_id: string; seat_index: number; cards: Card[] }[];
    boards: { board_index: number; open: Card[]; closed: Card[] }[];
  };
}

async function callDealHand(
  roomCode: string,
  deviceId: string,
  handNo: number,
  full: boolean
): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('deal_hand: no Supabase client');
  const { data, error } = await sb.rpc('deal_hand', {
    p_room_code: roomCode,
    p_device_id: deviceId,
    p_hand_no: handNo,
    p_full: full,
  });
  if (error) throw new Error(`deal_hand failed: ${error.message}`);
  if (!data?.ok) throw new Error(`deal_hand refused: ${data?.reason ?? 'unknown'}`);
  return data;
}

/** Guest/normal path: this caller's cards plus the open board cards. Never anyone else's. */
export async function dealHandSlice(
  roomCode: string,
  deviceId: string,
  handNo: number
): Promise<ServerDealSlice> {
  const d = await callDealHand(roomCode, deviceId, handNo, false);
  if (!Array.isArray(d.your_cards) || !Array.isArray(d.boards)) {
    throw new Error('deal_hand: malformed slice');
  }
  return d as ServerDealSlice;
}

/** Host path: the full deal, so the existing host adjudication keeps working until stage 2. */
export async function dealHandFull(
  roomCode: string,
  deviceId: string,
  handNo: number
): Promise<ServerDealFull> {
  const d = await callDealHand(roomCode, deviceId, handNo, true);
  if (!d.full?.seats || !d.full?.boards) {
    // p_full is honoured only for is_host. Landing here means this caller is not the host, which
    // is a wiring error rather than a network one — say so instead of limping on.
    throw new Error('deal_hand: full deal not returned (caller is not the host?)');
  }
  return d as ServerDealFull;
}
