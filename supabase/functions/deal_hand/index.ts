// SERVER-DEAL-PHASE-A — deal_hand Edge Function (Deno). NOT DEPLOYED until owner verifies on 2 devices.
//
// Server-authoritative deal. The server generates a CSPRNG seed, deals deterministically (see deal.ts),
// stores the FULL deck + every seat's hole cards + closed board cards in dealt_hands (RLS-locked,
// service-role only), and returns to EACH caller ONLY their own slice.
//
// AUTHZ (the audit fix): the EF runs as service_role and BYPASSES the dealt_hands RLS, so RLS is
// decorative — this function is the SOLE authz boundary for the full deck. Therefore:
//   - Caller identity comes ONLY from the VERIFIED JWT (auth.uid()), never from a request-body field.
//   - The seat is looked up from the SERVER-SIDE roster (room_players, snapshotted onto the deal row),
//     never from a client-supplied seats array. A caller can only ever get its OWN seat, and only if
//     it is actually seated — there is no request field that selects a seat.
//   - Deploy with verify_jwt=TRUE (see supabase/config.toml). Do NOT inherit the verify_jwt=false
//     default some other EFs in this project use; that would let anyone with the shipped anon key call it.
//
// AUTH REALITY (Rule-14 correction, DB+code verified 2026-07-25 — a prior comment here claimed the
// opposite and was wrong): CAPS DOES run anonymous Supabase auth (utils/auth.ts:43 signInAnonymously;
// 1798 is_anonymous users live, one created today), the client calls this EF via
// supabase.functions.invoke() which attaches the session JWT, and join_table records the caller's
// auth.uid() (p_player_id) into room_players.user_id. So getUser() below resolves a real auth.uid() for
// a signed-in caller and the roster match succeeds — no "adopt sessions" blocker. The one real
// prerequisite for the cutover is a join-time RACE, not missing auth: a player who reaches join_table
// before their anon session resolves lands in room_players with user_id = NULL; such a seat is
// correctly rejected ('unauthenticated') here, so the client must await the session before join and
// repair any NULL-user_id seat before dealing.
//
// Contract (POST JSON): { hand_id: string, room_id: string }  — NO identity/seat/roster in the body.
// Response: { ok:true, deal: PlayerDealPayload } | { ok:false, error }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dealFromSeed, sliceForPlayer, type ServerDeal } from './deal.ts';
import { authorizeDealRequest, type RosterEntry } from './authz.ts';

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
    const authHeader = req.headers.get('Authorization') ?? '';
    const { hand_id, room_id } = await req.json();
    if (typeof hand_id !== 'string' || !hand_id || typeof room_id !== 'string' || !room_id) {
      return json({ ok: false, error: 'bad_request' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1) VERIFIED caller identity — from the JWT, NEVER the body. null => no session -> rejected below.
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await asCaller.auth.getUser();
    const callerUserId = userData?.user?.id ?? null;

    // service-role client (bypasses RLS) for dealt_hands + room_players
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 2) Create-or-get the authoritative deal for this hand_id. The roster snapshot (user_id per seat)
    //    is taken from the SERVER-SIDE room_players — never from the request body.
    let row = (await sb.from('dealt_hands').select('*').eq('hand_id', hand_id).maybeSingle()).data;
    if (!row) {
      const { data: players } = await sb
        .from('room_players')
        .select('user_id, seat_index')
        .eq('room_id', room_id)
        .order('seat_index', { ascending: true });
      const seated = (players ?? []) as { user_id: string | null; seat_index: number }[];
      const pc = seated.length;
      if (![2, 3, 4].includes(pc)) return json({ ok: false, error: 'bad_roster' }, 409);

      const seed = newSeedHex();
      const deal = dealFromSeed(seed, pc as 2 | 3 | 4);
      const ins = await sb
        .from('dealt_hands')
        .insert({
          hand_id,
          room_id,
          player_count: pc,
          seat_user_ids: seated.map((r) => r.user_id), // snapshot: user_id per seat, in seat order
          seed_hex: seed,
          deck: deal.deck,
          player_hands: deal.playerHands,
          boards: deal.boards,
        })
        .select('*')
        .single();
      row = ins.error ? (await sb.from('dealt_hands').select('*').eq('hand_id', hand_id).single()).data : ins.data;
    }
    if (!row) return json({ ok: false, error: 'deal_unavailable' }, 500);

    // 3) AUTHORIZE off the STORED roster snapshot: identity from the JWT, seat from the server roster.
    const roster: RosterEntry[] = ((row.seat_user_ids as (string | null)[]) ?? []).map((uid, seatIndex) => ({
      userId: uid,
      seatIndex,
    }));
    const authz = authorizeDealRequest(callerUserId, roster);
    if (!authz.ok) return json({ ok: false, error: authz.error }, authz.error === 'unauthenticated' ? 401 : 403);

    // 4) Return ONLY this caller's non-leaking slice.
    const deal: ServerDeal = {
      deck: row.deck,
      playerHands: row.player_hands,
      boards: row.boards,
      discarded: [],
      seedHex: row.seed_hex,
    };
    return json({ ok: true, deal: sliceForPlayer(deal, authz.seat, hand_id) }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
