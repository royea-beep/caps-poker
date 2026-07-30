-- SERVER-DEAL-PHASE-A — 'starting'-state reaper (D1).  BRANCH ONLY — NOT APPLIED TO THE SHARED
-- PROJECT (Iron Rule 11). Ships with the deal cutover; inert until then.
--
-- WHY THIS EXISTS (verified against live DB 2026-07-25, correcting a FALSE claim I made earlier):
-- I claimed a dealless room "never enters 'playing', so cleanup_expired_rooms / evict_ghost_seats
-- catch it". That is wrong. Read the live bodies:
--   * cleanup_expired_rooms : UPDATE ... WHERE expires_at < NOW() AND status IN ('waiting','starting')
--       -> ensure_public_lobby inserts EVERY pool room with expires_at = NULL, and `NULL < NOW()` is
--          NULL (never true), so pool rooms are STRUCTURALLY unreachable by this reaper.
--          PROOF: 9 pool rooms still status='waiting', all expires_at NULL, oldest 2026-06-26, while
--          the cron has run every 2 minutes for a month. Its only other branch needs status='playing'.
--   * evict_ghost_seats(90)  : WHERE gr.is_public AND gr.status = 'waiting'  -> 'waiting' ONLY, and it
--          deletes SEATS, never the room.
--   * finish_wedged_playing_rooms(120) : WHERE gr.status = 'playing'         -> 'playing' ONLY.
-- => status='starting' has ZERO reaper coverage, permanently. Nothing writes 'starting' TODAY (no DB
--    function does; the client's 'starting' is local React state), so this hole is created the moment
--    the deal cutover parks a room in 'starting' for the EF round-trip. On EF timeout/cold-start/500
--    the room would sit in 'starting' forever.
-- LEAK AMPLIFIER: ensure_public_lobby counts ONLY status='waiting', so a stuck 'starting' pool room
--    silently drops out of the pool count -> the pool tops itself up and the poisoned room lingers.

-- ── 1. ANCHOR ────────────────────────────────────────────────────────────────────────────────────
-- game_rooms has created_at / started_at / finished_at / expires_at but NO 'starting' anchor.
-- started_at is DELIBERATELY NOT reused: two LIVE reapers already key on it
-- (finish_wedged_playing_rooms: started_at < now()-120s; cleanup_expired_rooms: COALESCE(started_at,
-- created_at) < NOW()-2h). Setting it at 'starting' would shift their semantics under them. A
-- dedicated column keeps this change additive and side-effect free.
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS starting_at timestamptz;

COMMENT ON COLUMN public.game_rooms.starting_at IS
  'Set when the room enters status=''starting'' (deal in flight). Anchor for reap_stuck_starting_rooms. NOT started_at — that one means ''playing began'' and two live reapers key on it.';

-- Partial index: the reaper only ever scans rooms currently in 'starting'.
CREATE INDEX IF NOT EXISTS game_rooms_starting_at_idx
  ON public.game_rooms (starting_at) WHERE status = 'starting';

-- ── 2. REAPER ────────────────────────────────────────────────────────────────────────────────────
-- TIMEOUT = 45s (provisional, MUST be re-validated against the measured EF p95 at deploy — Rule 10):
--   lower bound  : worst-case deal sequence = cold start (~1-3s) + the bounded 2x retry (~5-6s) ≈ 10s.
--                  45s is ~4x that, so the reaper can never race a legitimately in-flight deal.
--   upper bound  : < the 90s host deal-clock, so a dead room is recovered BEFORE any other timer.
-- COVERAGE: keys ONLY on status + starting_at. It deliberately does NOT reference expires_at, so
-- expires_at IS NULL pool rooms (i.e. all of them) are covered — that NULL blind spot is the exact
-- bug that made cleanup_expired_rooms useless here.
-- DISPOSITION:
--   public pool room -> REVERT to 'waiting'. A pool room is SHARED: abandoning it removes a table
--     from the pool (ensure_public_lobby then mints a replacement) and the dead row leaks, whereas
--     reverting returns the table to service, restores it to the pool count, and re-enables
--     evict_ghost_seats coverage (which only sees 'waiting') for its stale seats.
--   non-public OR already expired -> 'abandoned'. Private rooms are single-use and carry a real
--     expires_at, so cleanup_expired_rooms already deletes abandoned rows after a day.
-- NO PARTIAL DEAL STATE SURVIVES A REVERT — the guarantee: any dealt_hands row for the room is
--   DELETED here. dealt_hands is keyed by hand_id (PK) with create-or-get semantics, so a surviving
--   row could otherwise be re-served as a STALE deal if a hand_id were reused. Deleting the row makes
--   the next attempt mint a fresh seed + deck by construction. (Belt and braces: the 24h TTL in
--   cleanup_dealt_hands would eventually drop it anyway.)
CREATE OR REPLACE FUNCTION public.reap_stuck_starting_rooms(p_stale_seconds integer DEFAULT 45)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_reverted  int := 0;
  v_abandoned int := 0;
  v_rec       record;
  v_has_deals boolean := to_regclass('public.dealt_hands') IS NOT NULL;
BEGIN
  FOR v_rec IN
    SELECT gr.id, gr.room_code, gr.is_public, gr.expires_at
    FROM game_rooms gr
    WHERE gr.status = 'starting'
      -- anchor ONLY on starting_at; COALESCE to created_at so a row that somehow reached 'starting'
      -- without an anchor can still be reaped instead of becoming immortal.
      AND COALESCE(gr.starting_at, gr.created_at) < now() - make_interval(secs => p_stale_seconds)
  LOOP
    -- purge any authoritative deal for this room so nothing stale can be re-served on retry
    IF v_has_deals THEN
      DELETE FROM dealt_hands WHERE room_id = v_rec.id::text;
    END IF;

    IF v_rec.is_public AND (v_rec.expires_at IS NULL OR v_rec.expires_at > now()) THEN
      UPDATE game_rooms
        SET status = 'waiting', starting_at = NULL
        WHERE id = v_rec.id;
      v_reverted := v_reverted + 1;
    ELSE
      UPDATE game_rooms
        SET status = 'abandoned', starting_at = NULL
        WHERE id = v_rec.id;
      v_abandoned := v_abandoned + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reverted', v_reverted, 'abandoned', v_abandoned);
END;
$function$;

-- ── 3. CRON ──────────────────────────────────────────────────────────────────────────────────────
-- Every minute, matching caps_evict_ghost_seats / caps_finish_wedged_playing. Worst-case recovery is
-- 45s (stale) + <=60s (cron granularity) ~= 105s; the room is out of service only for that window and
-- no other timer ever touches a 'starting' room.
DO $$
BEGIN
  PERFORM cron.unschedule('caps_reap_stuck_starting');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('caps_reap_stuck_starting', '* * * * *', $$ SELECT public.reap_stuck_starting_rooms(45); $$);
