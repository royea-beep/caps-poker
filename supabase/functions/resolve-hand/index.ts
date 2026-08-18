/**
 * STAGE 2 — THE SERVER ADJUDICATES.
 *
 * The client used to decide who won and what it was paid. That means a player who DROPS is never
 * recorded at all — nobody is left to write their row — and a modified client can report any
 * outcome it likes. This function reads the deal the SERVER dealt, evaluates it with the SAME
 * evaluator the app runs, and writes the result itself.
 *
 * WHAT MAKES IT THE SAME EVALUATOR. `handEvaluator.ts` and `chipMath.ts` beside this file are
 * GENERATED FROM THE APP SOURCE at deploy time by scripts/gen-edge-shared.mjs, and `--check` fails
 * the deploy if they have drifted. There is no second implementation to keep in sync.
 *
 * NO SILENT FALLBACKS, ANYWHERE. Both economy constants — the pot and the COMPLETE-bonus
 * percentage — are READ FROM app_config AND THE FUNCTION REFUSES TO RUN WITHOUT THEM. That is
 * deliberate and it is the lesson of the bug this stage nearly shipped: the app's
 * `getCompleteBonusPercent` reads module state that only the app's bootstrap sets, so a server
 * copy would have returned the flat-50 fallback forever, paying 50% where the live map says 25%
 * at two boards and 75% at four. It would have bundled green and been quietly wrong in the
 * economy. A missing config here is a 500, not a plausible number.
 */
import { evaluateOmahaHand, compareHands } from '../_shared/handEvaluator.ts';
import { calculateChipDeltasCore } from '../_shared/chipMath.ts';
import type { Card } from '../_shared/cards.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`rest ${path} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Both economy constants come from app_config and MUST be present. See the header. */
async function loadConfig(boardCount: number): Promise<{ potPerBoard: number; bonusPercent: number }> {
  const rows = await rest(`app_config?key=in.(pot_per_board,complete_bonus_pct_by_boards)&select=key,value`);
  const map: Record<string, any> = {};
  for (const r of rows) map[r.key] = r.value;

  const pot = map['pot_per_board'];
  if (typeof pot !== 'number') throw new Error('app_config.pot_per_board missing or not a number');

  const byBoards = map['complete_bonus_pct_by_boards'];
  const pct = byBoards?.[String(boardCount)];
  if (typeof pct !== 'number') {
    throw new Error(`app_config.complete_bonus_pct_by_boards has no entry for ${boardCount} boards`);
  }
  return { potPerBoard: pot, bonusPercent: pct };
}

interface Seat { device_id: string; seat_index: number; cards: Card[] }
interface Board { board_index: number; open: Card[]; closed: Card[] }

// CORS. This function was only ever called server-side until stage 2 wired the host, and a browser
// preflight was therefore never exercised: the first live hand failed with "No
// 'Access-Control-Allow-Origin' header is present". Transport only — nothing about adjudication,
// the claim-release or idempotency changes here.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Set once the claim is taken, so a failure AFTER claiming can release it. Without this, a hand
  // that errors mid-write stays claimed forever and can never be resolved by anyone — measured,
  // not theorised: the first live call failed on a CHECK constraint and left exactly that state.
  let claimed: { roomId: string; handNo: number } | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const roomCode = String(body.room_code ?? '').toUpperCase();
    const handNo = Number(body.hand_no);
    if (!roomCode || !Number.isInteger(handNo)) {
      return json({ ok: false, reason: 'missing_args' }, 400);
    }

    const rooms = await rest(`game_rooms?room_code=eq.${roomCode}&select=id`);
    if (!rooms.length) return json({ ok: false, reason: 'no_such_room' }, 404);
    const roomId = rooms[0].id;

    const hands = await rest(
      `game_hands?room_id=eq.${roomId}&hand_no=eq.${handNo}&select=deal,placements,board_count,player_count,resolved`
    );
    if (!hands.length) return json({ ok: false, reason: 'no_such_hand' }, 404);
    const hand = hands[0];

    // IDEMPOTENCY PER (room, hand_no). The claim is a CONDITIONAL update, so two callers racing
    // the same hand cannot both win it — the loser gets zero rows back and returns the stored
    // outcome rather than recomputing and re-paying.
    const claim = await rest(
      `game_hands?room_id=eq.${roomId}&hand_no=eq.${handNo}&resolved_at=is.null`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ resolved_at: new Date().toISOString() }) }
    );
    if (!claim.length) {
      return json({ ok: true, replayed: true, outcome: hand.resolved ?? null });
    }
    claimed = { roomId, handNo };

    const seats: Seat[] = [...(hand.deal?.seats ?? [])].sort((a, b) => a.seat_index - b.seat_index);
    const boards: Board[] = [...(hand.deal?.boards ?? [])].sort((a, b) => a.board_index - b.board_index);
    const boardCount: number = hand.board_count;
    const placements = hand.placements ?? {};

    // AUTO-FILL. A seat that never submitted is not forfeited — it is placed exactly the way the
    // client's auto-place does it: the cards this server dealt, in dealt order, four per board.
    // This is the entire reason stage 2 exists: the absent player still gets a real result.
    const autoFilled: string[] = [];
    const byDevice: Record<string, Card[][]> = {};
    for (const s of seats) {
      const submitted = placements[s.device_id];
      if (Array.isArray(submitted) && submitted.length === boardCount) {
        byDevice[s.device_id] = submitted;
      } else {
        const groups: Card[][] = [];
        for (let b = 0; b < boardCount; b++) groups.push(s.cards.slice(b * 4, b * 4 + 4));
        byDevice[s.device_id] = groups;
        autoFilled.push(s.device_id);
      }
    }

    // Evaluate every board with the generated evaluator. Community = open ++ closed.
    const boardResults = boards.slice(0, boardCount).map((bd) => {
      const community = [...bd.open, ...bd.closed];
      const results = seats.map((s) => evaluateOmahaHand(byDevice[s.device_id][bd.board_index], community));
      let best = 0;
      let tied = [0];
      for (let i = 1; i < results.length; i++) {
        const c = compareHands(results[i], results[best]);
        if (c > 0) { best = i; tied = [i]; }
        else if (c === 0) tied.push(i);
      }
      const isTie = tied.length > 1;
      return {
        boardIndex: bd.board_index,
        winnerIndex: isTie ? -1 : best,
        tiedPlayers: isTie ? tied : [],
        potWon: 0,
        handName: results[best].rank,
        // RESPONSE FIELDS ONLY — these are already computed above; nothing new is evaluated. The
        // reveal needs a rank name and score per seat per board (multiplayer-game.tsx:409-415
        // reads br.playerResults[].name/.score), and without them the host would have to evaluate
        // locally for display while taking winners from here — two evaluations of one hand, the
        // duplication this whole route exists to remove.
        playerResults: results.map((r, i) => ({
          seat_index: seats[i].seat_index,
          device_id: seats[i].device_id,
          name: r.name,
          score: r.score,
        })),
      };
    });

    const cfg = await loadConfig(boardCount);
    const deltas = calculateChipDeltasCore(boardResults, seats.length, { potPerBoard: cfg.potPerBoard }, cfg.bonusPercent);

    // Write one hand_history row PER SEAT — including any seat that dropped. chips_delta is the
    // REAL NET from the shared arithmetic, not a display approximation.
    const rows = seats.map((s, i) => ({
      device_id: s.device_id,
      hand_number: handNo,
      chips_delta: deltas.chipDeltas[i],
      boards_won: boardResults.filter((b) => b.winnerIndex === i).length,
      boards_total: boardCount,
      player_count: seats.length,
      // hand_history_session_type_check allows sng/quick_poker/practice/custom only. Multiplayer
      // hands were already filed as 'quick_poker' by the client, so the server keeps that label and
      // the history stays continuous across the handover.
      session_type: 'quick_poker',
      // hand_history_result_check allows only won/lost/folded/timeout — there is no 'tie'. This
      // mirrors the client's existing `p_won: netChips > 0`, so a break-even hand files as 'lost'
      // exactly as it always has. chips_delta carries the truth; `result` is the coarse label.
      result: deltas.chipDeltas[i] > 0 ? 'won' : 'lost',
    }));
    await rest('hand_history', { method: 'POST', body: JSON.stringify(rows) });

    // Chips through the single per-hand mover, idempotent on hand identity so a retry after a
    // partial failure cannot pay twice.
    for (let i = 0; i < seats.length; i++) {
      await rest('rpc/record_hand_net', {
        method: 'POST',
        body: JSON.stringify({
          p_device_id: seats[i].device_id,
          p_net: deltas.chipDeltas[i],
          p_hand_id: `mp:${roomId}:${handNo}:${seats[i].device_id}`,
        }),
      });
    }

    const outcome = {
      hand_no: handNo,
      board_count: boardCount,
      player_count: seats.length,
      seats: seats.map((s, i) => ({
        device_id: s.device_id,
        seat_index: s.seat_index,
        chips_delta: deltas.chipDeltas[i],
        boards_won: boardResults.filter((b) => b.winnerIndex === i).length,
        auto_filled: autoFilled.includes(s.device_id),
      })),
      boards: boardResults.map((b) => ({
        board_index: b.boardIndex,
        winner_index: b.winnerIndex,
        tied: b.tiedPlayers,
        playerResults: b.playerResults,
      })),
      complete_winner: deltas.completeWinner,
      complete_bonus: deltas.completeBonusAmount,
      bonus_percent: cfg.bonusPercent,
      pot_per_board: cfg.potPerBoard,
    };
    await rest(`game_hands?room_id=eq.${roomId}&hand_no=eq.${handNo}`, {
      method: 'PATCH', body: JSON.stringify({ resolved: outcome }),
    });

    return json({ ok: true, outcome });
  } catch (e) {
    // RELEASE THE CLAIM. A hand that failed part-way must remain resolvable; record_hand_net is
    // idempotent on hand identity, so a retry cannot pay twice even if chips had already moved.
    if (claimed) {
      try {
        await rest(`game_hands?room_id=eq.${claimed.roomId}&hand_no=eq.${claimed.handNo}`, {
          method: 'PATCH', body: JSON.stringify({ resolved_at: null }),
        });
      } catch { /* the original error is the one worth reporting */ }
    }
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
