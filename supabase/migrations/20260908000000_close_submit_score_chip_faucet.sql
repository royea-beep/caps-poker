-- CLOSE-SUBMIT-SCORE 2026-09-08 — submit_score STOPS BEING A CHIP FAUCET.
--
-- WHAT IT WAS. It took p_total_chips FROM THE REQUEST BODY, clamped it to prev + 2,000 per call
-- and 5,000 per device per day, and wrote the result straight into leaderboard.total_chips —
-- with NO chip_transactions row. Reproduced from outside with nothing but the public anon key
-- plus an anonymous session: a brand-new device reached 9,000 chips against a 6,000 ledger, a
-- 3,000 gap, without playing a hand. ~3x the richest real player, who holds 3,250.
--
-- ⚠️ THE DEFECT WAS NEVER THE CAP. A clamp on an invented number is still an invented number.
-- Lowering the cap would have bounded the damage again and left the shape intact.
--
-- WHAT THE REAL CLIENT ACTUALLY NEEDS, read from app/results.tsx before touching this:
-- there is exactly ONE caller (utils/leaderboard.ts:107, from app/results.tsx:576) and it runs
-- LAST in a strictly sequenced block — record_hand_net, then record_reward per achievement, then
-- this. It passes `latest ?? gs.chips`, where `latest` is the balance THE SERVER ITSELF just
-- returned. The results screen's own comment calls it "a no-op echo of the true post-delta
-- total". A legitimate call therefore needs NO grant at all, and its return value is discarded
-- (`return !error`). So the grant is REMOVED ENTIRELY rather than re-derived: there is no chip
-- movement here to derive. Every chip movement stays with the ledgered writers — record_hand_net,
-- record_reward, earn_chips — which is what has held the gap at 0 across 398 devices.
--
-- ⚠️ AND IT IS UPDATE-ONLY, NOT AN UPSERT. leaderboard.total_chips is NOT NULL DEFAULT 2000, so
-- an INSERT from this function that simply omitted the column would ITSELF have granted 2,000
-- unledgered chips by a second route. Removing the INSERT closes that before it can be found.
-- The row is created by the ledgered writers: record_hand_net runs FIRST in the results block and
-- creates it (measured — a fresh device came out at 194 = 120 net - 6 rake + 80 play grant, with
-- three matching ledger rows and gap 0). ensure_leaderboard_row, record_reward, get_poker_shop,
-- claim_share_reward and credit_purchase can all create it too.
--
-- ⚠️ THE SIGNATURE IS UNCHANGED ON PURPOSE. p_total_chips is accepted and DELIBERATELY IGNORED
-- because build 515 is already on TestFlight and still sends it. Changing the argument list would
-- break the installed app; ignoring the value breaks nothing and closes the hole for every
-- client, shipped or future. tests/submit-score-contract.test.ts pins that the client keeps
-- sending all six arguments, and that submit_score stays sequenced AFTER record_hand_net.
--
-- NOT CHANGED: the S1 identity guard, the econ_authz_probe, and the stats write, which stays an
-- absolute write exactly as before so the diff is precisely "chips removed" and nothing else.
-- ⚠️ KNOWN AND DELIBERATELY LEFT: hands_played / hands_won / biggest_win are still caller-supplied,
-- so a player can inflate their OWN displayed stats. No chips, no ELO, no ladder movement — the
-- forged device came out elo 1000, games_played 0. Reported, not widened into this fix.
--
-- BRANCH-PROVEN BEFORE/AFTER on preview project ywxjotjcexkqjgxdzhwd, same four forged calls:
--   before  2,000 -> 4,000 -> 6,000 -> 7,000   gained_today 5,000
--   after   2,000 -> 2,000 -> 2,000 -> 2,000   gained_today NULL, chips_written false
CREATE OR REPLACE FUNCTION public.submit_score(
  p_device_id text, p_player_name text, p_total_chips bigint,
  p_hands_played integer, p_hands_won integer, p_biggest_win integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_chips bigint;
  v_rows  integer;
BEGIN
  PERFORM public.econ_authz_probe('submit_score', p_device_id);

  -- CLOSE-S1 PART 2 — unchanged. Refuses NO SESSION, not ANONYMOUS.
  IF NOT public.econ_bind_ok(p_device_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
  END IF;

  IF p_device_id IS NULL OR length(p_device_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;

  -- STATS ONLY. total_chips is absent from this statement and must never be added to it.
  UPDATE leaderboard SET
    player_name  = COALESCE(NULLIF(p_player_name, ''), 'Player'),
    hands_played = GREATEST(0, COALESCE(p_hands_played, 0)),
    hands_won    = GREATEST(0, COALESCE(p_hands_won, 0)),
    biggest_win  = GREATEST(0, COALESCE(p_biggest_win, 0)),
    updated_at   = now()
  WHERE device_id = p_device_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_leaderboard_row', 'chips_written', false);
  END IF;

  SELECT total_chips INTO v_chips FROM leaderboard WHERE device_id = p_device_id;
  RETURN jsonb_build_object('ok', true, 'total_chips', v_chips, 'chips_written', false);
END; $function$;
