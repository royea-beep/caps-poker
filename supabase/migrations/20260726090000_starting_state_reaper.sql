-- SERVER-DEAL-PHASE-A — 'starting'-state reaper (D1/E2). BRANCH ONLY — NOT APPLIED (Iron Rule 11).
--
-- WHY 'starting' NEEDS ITS OWN REAPER (verified on live):
--   cleanup_expired_rooms : WHERE expires_at < NOW() AND status IN ('waiting','starting') — but
--     ensure_public_lobby inserts pool rooms with expires_at = NULL and `NULL < NOW()` is never true,
--     so pool rooms are STRUCTURALLY unreachable. PROOF: 9 pool rooms still 'waiting', all expires_at
--     NULL, oldest 2026-06-26, cron running every 2 min for a month.
--   evict_ghost_seats(90)             : gr.status='waiting' ONLY, and deletes SEATS, not rooms.
--   finish_wedged_playing_rooms(120)  : gr.status='playing' ONLY.
--   => 'starting' has ZERO coverage. Nothing writes it today, so the hole appears the moment the
--      deal cutover parks a room there (see 20260726091000_join_table_autostart_deal.sql).
--
-- E2 CORRECTION — my first version was WRONG and would have created zombie tables.
-- It reverted to 'waiting' WITHOUT touching the roster. But a room only reaches 'starting' by FILLING
-- (autostart fires at current_players == max_players), so "revert to waiting" produced a room that is
-- 'waiting' AND FULL:
--   * join_table rejects every joiner (current_players >= max_players -> 'table_full_or_gone');
--   * autostart never re-fires, because it only runs INSIDE a join that is now impossible;
--   * ensure_public_lobby counts status='waiting' regardless of fullness, so the dead room OCCUPIES
--     one of the 2 pool slots per size and SUPPRESSES a joinable replacement;
--   * evict_ghost_seats only clears seats whose last_seen is stale, so live-but-stuck clients keep it
--     full indefinitely.
-- Net: un-joinable, un-startable and pool-blocking — strictly worse than the leak it avoided.
--
-- DISPOSITION NOW: a FULL stuck room is ABANDONED (roster deleted), mirroring
-- finish_wedged_playing_rooms' existing DELETE-then-mark pattern. Rationale:
--   * 'starting' implies full, so revert-to-waiting is never the good case here.
--   * ensure_public_lobby counts ONLY status='waiting' -> abandoning frees the pool slot IMMEDIATELY
--     and the */2 cron mints a clean, joinable replacement. Starvation is impossible (proof below).
--   * cleanup_expired_rooms deletes abandoned rooms after a day, so nothing leaks.
--   * players get a clean "room is gone" signal instead of a zombie table.
-- A non-full room in 'starting' (shouldn't happen; defensive) is reverted to 'waiting' — safe because
-- it is still joinable and therefore cannot starve the pool.
--
-- DOUBLE-DECREMENT SAFETY vs evict_ghost_seats (both run every minute): this reaper NEVER touches
-- current_players — it deletes the roster and abandons the row, so there is no decrement to double.
-- And evict_ghost_seats' scan is `gr.is_public AND gr.status='waiting'`, so an 'abandoned' room is
-- invisible to it. The two can run in the same minute with no interaction.

-- ── 1. ANCHOR ────────────────────────────────────────────────────────────────────────────────────
-- started_at is DELIBERATELY NOT reused: finish_wedged_playing_rooms (started_at < now()-120s) and
-- cleanup_expired_rooms (COALESCE(started_at,created_at) < NOW()-2h) already key on it.
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS starting_at timestamptz;

-- F1 — PER-HAND ANCHOR. game_rooms has NO hand/seq/round column today (verified: information_schema
-- returns none) and no live per-hand table (shared_hands/hand_history are archives). Hands 2+ never
-- touch the DB at all — RealtimeServer.startNewHand() -> startGame() just does `this.handId++`
-- IN MEMORY (utils/realtimeMultiplayer.ts:534-540, 556) while the room sits at status='playing'.
-- My first design anchored hand_id on starting_at, which promote then set to NULL — so the anchor
-- was destroyed by the very first promote and hand #2 had nothing to derive an id from.
-- hand_seq is a MONOTONIC per-room counter: it is the anchor for BOTH the hand_id and the promote
-- guard, it survives promote, and it is never reused (a reaped+retried hand increments again, so the
-- retry mints a brand-new deck by construction).
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS hand_seq integer NOT NULL DEFAULT 0;

-- G1 — ANTI-GRIEF STATE. begin_next_hand must not let ONE player abort a hand they are losing, so the
-- advance requires UNANIMITY (mirroring the in-memory `nextHandRequests.size >= connected.length` rule
-- that RealtimeServer already uses at realtimeMultiplayer.ts:526-531) plus a minimum inter-hand gap.
-- next_hand_acks holds the uids that have asked for the next hand at the CURRENT hand_seq.
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS next_hand_acks jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.game_rooms.next_hand_acks IS
  'uids that requested the next hand at the current hand_seq. begin_next_hand requires EVERY seated player to be present (unanimity) so no single player can reset a hand in progress. Cleared on each advance.';

COMMENT ON COLUMN public.game_rooms.hand_seq IS
  'Monotonic per-room hand counter. hand_id = room_id || '':'' || hand_seq. Incremented when a hand enters ''starting'' (autostart or begin_next_hand); NEVER decremented or reused, so every attempt gets a fresh deck.';

COMMENT ON COLUMN public.game_rooms.starting_at IS
  'Set when autostart parks the room in status=''starting'' (deal in flight). Anchor for reap_stuck_starting_rooms AND the deterministic hand_id. NOT started_at — that means ''playing began'' and two live reapers key on it.';

CREATE INDEX IF NOT EXISTS game_rooms_starting_at_idx
  ON public.game_rooms (starting_at) WHERE status = 'starting';

-- ── 2. REAPER ────────────────────────────────────────────────────────────────────────────────────
-- TIMEOUT 45s — PROVISIONAL, must be re-validated against the measured EF p95 at deploy (Rule 10):
--   > worst-case deal (cold start ~1-3s + bounded 2x retry ~5-6s ~= 10s), ~4x margin so it can never
--     race an in-flight deal;  < the 90s host deal-clock so recovery precedes every other timer.
-- COVERAGE: keys ONLY on status + starting_at. It never filters on expires_at, so expires_at IS NULL
-- pool rooms (i.e. all of them) ARE covered — that NULL blind spot is what makes cleanup_expired_rooms
-- useless here. (expires_at is read only to classify, never to select.)
CREATE OR REPLACE FUNCTION public.reap_stuck_starting_rooms(p_stale_seconds integer DEFAULT 45)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_abandoned int := 0;
  v_reverted  int := 0;
  v_rec       record;
  v_has_deals boolean := to_regclass('public.dealt_hands') IS NOT NULL;
BEGIN
  FOR v_rec IN
    SELECT gr.id, gr.room_code, gr.current_players, gr.max_players
    FROM game_rooms gr
    WHERE gr.status = 'starting'
      -- COALESCE so a row that somehow reached 'starting' without an anchor cannot become immortal
      AND COALESCE(gr.starting_at, gr.created_at) < now() - make_interval(secs => p_stale_seconds)
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Purge the authoritative deal so a retry can NEVER be served a stale deck. dealt_hands is PK'd on
    -- hand_id with create-or-get semantics; the hand_id is derived from starting_at, so a fresh attempt
    -- mints a new id anyway — this is belt-and-braces, and it reclaims the row immediately.
    IF v_has_deals THEN
      DELETE FROM dealt_hands WHERE room_id = v_rec.id::text;
    END IF;

    IF v_rec.current_players >= v_rec.max_players THEN
      -- FULL (the real case): retire it. Roster deleted first, mirroring finish_wedged_playing_rooms.
      DELETE FROM room_players WHERE room_id = v_rec.id;
      UPDATE game_rooms
        SET status = 'abandoned', starting_at = NULL, finished_at = now()
        WHERE id = v_rec.id;
      v_abandoned := v_abandoned + 1;
    ELSE
      -- NOT full (defensive): still joinable, so reverting cannot starve the pool.
      UPDATE game_rooms SET status = 'waiting', starting_at = NULL WHERE id = v_rec.id;
      v_reverted := v_reverted + 1;
    END IF;
  END LOOP;

  -- Top the pool back up in the same tick so an abandoned table is replaced immediately rather than
  -- waiting for the next */2 lobby cron.
  IF v_abandoned > 0 THEN PERFORM public.ensure_public_lobby(); END IF;

  RETURN jsonb_build_object('ok', true, 'abandoned', v_abandoned, 'reverted', v_reverted);
END;
$function$;

-- POOL-SLOT STARVATION PROOF:
--   ensure_public_lobby counts `is_public AND status='waiting' AND max_players=pc AND table_kind=...`.
--   A reaped full room is set to 'abandoned', so it is NOT counted -> the count drops below the target
--   -> a replacement is minted (immediately by the PERFORM above, and again by the */2 cron).
--   A reaped non-full room stays 'waiting' but is joinable, so it is a legitimate pool member.
--   => no stuck room can ever occupy a pool slot. QED.

-- ── 3. CRON ──────────────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('caps_reap_stuck_starting');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('caps_reap_stuck_starting', '* * * * *', $$ SELECT public.reap_stuck_starting_rooms(45); $$);
