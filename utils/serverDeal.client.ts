// SERVER-DEAL-PHASE-A — client integration for the deal_hand Edge Function.
//
// DARK by default: `server_deal_enabled` defaults FALSE, so nothing here runs until the owner turns
// the flag on (after the 2-device acceptance test). Existing MP + solo play is UNAFFECTED while off.
// Mirrors the mp_board_reveal_enabled remote kill-switch pattern (app_config key -> cached module var).

import { getSupabase } from './supabase';

// Fast remote flag. Default FALSE (the whole feature ships dark). Set from app/_layout.tsx's
// app_config fetch. If the read fails, we keep the safe default (false = today's client-side deal).
let _serverDealEnabled = false;
export function setServerDealEnabled(v: boolean): void {
  _serverDealEnabled = v;
}
export function isServerDealEnabled(): boolean {
  return _serverDealEnabled;
}

export interface DealtCard {
  suit: string;
  rank: string;
  id: string;
}
export interface PlayerDealPayload {
  playerIndex: number;
  handId: string;
  playerCount: number;
  yourCards: DealtCard[];
  boards: { openCards: DealtCard[]; closedCardCount: number }[];
}

/**
 * Fetch THIS device's authoritative deal slice from the deal_hand Edge Function. Each client (host and
 * guests) calls this with the same hand_id + seat order; the server returns only the caller's own hole
 * cards + open board cards + a closed COUNT — never opponents' cards, never closed cards.
 *
 * 2-DEVICE-GATED: consuming this in the live MP flow — replacing the synchronous host-shuffle-and-
 * broadcast in RealtimeServer.startGame() (which today stores this.playerHands = the whole deck) and
 * releasing closed cards only at reveal — is the sync->async protocol inversion whose only acceptance
 * test is two real devices. This helper + the flag are the ready integration point; the cutover is
 * deliberately NOT wired blind, because touching that critical sync path would risk the flag-off path.
 */
export async function fetchServerDeal(args: {
  handId: string;
  roomId: string;
}): Promise<PlayerDealPayload | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    // Body carries ONLY the hand + room. Caller identity is NOT sent — it rides the session JWT that
    // supabase.functions.invoke attaches (Authorization header); the EF derives auth.uid() from it and
    // looks the seat up server-side from room_players. CAPS already runs anonymous auth
    // (utils/auth.ts signInAnonymously), so a signed-in caller resolves a real auth.uid() — invoke()
    // (unlike a raw fetch) sends the session token. The cutover must only ensure the anon session is
    // resolved BEFORE join_table so room_players.user_id is populated (see FAIRNESS_PHASE_A_AUDIT.md).
    const { data, error } = await supabase.functions.invoke('deal_hand', {
      body: { hand_id: args.handId, room_id: args.roomId },
    });
    if (error || !data?.ok) return null;
    return data.deal as PlayerDealPayload;
  } catch {
    return null;
  }
}
