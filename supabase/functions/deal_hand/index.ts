// SERVER-DEAL-PHASE-A — deal_hand Edge Function (Deno). NOT DEPLOYED until owner verifies on 2 devices.
//
// Server-authoritative deal. The server generates a CSPRNG seed, deals deterministically (see deal.ts),
// stores the FULL deck + every seat's hole cards + closed board cards in dealt_hands (RLS-locked,
// service-role only), and returns to EACH caller ONLY their own slice (own hole cards + open board
// cards + a closed COUNT). This closes the current cheating vector where the host client holds the
// whole deck in memory.
//
// Contract (POST JSON):
//   { hand_id: string, room_id?: string, player_count: 2|3|4, seats: string[], device_id: string }
//   - `seats` = device_ids in seat order (fixed at deal creation by the first/host call).
//   - The caller receives sliceForPlayer for the seat whose device_id === caller device_id.
// Response: { ok: true, deal: PlayerDealPayload } | { ok:false, error }
//
// ANON CAVEAT (documented, Phase-A limitation): CAPS is device-anonymous (auth.uid() is NULL), so the
// EF authenticates by the client-supplied device_id. A caller who knows another player's (opaque)
// device_id could request that seat's slice. Hardening = signed device tokens; out of Phase-A scope.
// The deck / opponents' hole cards / closed cards still NEVER leave the server regardless.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dealFromSeed, sliceForPlayer, type ServerDeal } from './deal.ts';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

function newSeedHex(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b); // CSPRNG
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const { hand_id, room_id, player_count, seats, device_id } = await req.json();
    if (
      typeof hand_id !== 'string' || !hand_id ||
      typeof device_id !== 'string' || !device_id ||
      ![2, 3, 4].includes(player_count) ||
      !Array.isArray(seats) || seats.length !== player_count
    ) {
      return json({ ok: false, error: 'bad_request' }, 400);
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Create-or-get the authoritative deal for this hand_id (idempotent under concurrent joins).
    let row = (await sb.from('dealt_hands').select('*').eq('hand_id', hand_id).maybeSingle()).data;
    if (!row) {
      const seed = newSeedHex();
      const deal = dealFromSeed(seed, player_count as 2 | 3 | 4);
      const ins = await sb
        .from('dealt_hands')
        .insert({
          hand_id,
          room_id: room_id ?? null,
          player_count,
          seat_device_ids: seats,
          seed_hex: seed,
          deck: deal.deck,
          player_hands: deal.playerHands,
          boards: deal.boards,
        })
        .select('*')
        .single();
      if (ins.error) {
        // lost the race to another caller -> re-read the row they inserted
        row = (await sb.from('dealt_hands').select('*').eq('hand_id', hand_id).single()).data;
      } else {
        row = ins.data;
      }
    }
    if (!row) return json({ ok: false, error: 'deal_unavailable' }, 500);

    const seat = (row.seat_device_ids as string[]).indexOf(device_id);
    if (seat < 0) return json({ ok: false, error: 'not_in_seats' }, 403);

    // Reconstruct the ServerDeal from storage and return ONLY this caller's non-leaking slice.
    const deal: ServerDeal = {
      deck: row.deck,
      playerHands: row.player_hands,
      boards: row.boards,
      discarded: [],
      seedHex: row.seed_hex,
    };
    return json({ ok: true, deal: sliceForPlayer(deal, seat, hand_id) }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
