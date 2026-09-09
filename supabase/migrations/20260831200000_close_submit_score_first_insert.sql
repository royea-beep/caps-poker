-- RED-TEAM 2026-08-31 — ⚠️ CLOSING A SECOND LIVE MINT: submit_score's unclamped first insert.
--
-- ═══ WHAT WAS PERFORMED ══════════════════════════════════════════════════════════════════════
-- One anon call, no session, a device id that did not exist before:
--     submit_score('RT-BILLION', 'PWNED', 1000000000, 9999, 9999, 999999)
--   → {"ok": true, "total_chips": 1000000000}
-- A brand-new device set to ONE BILLION chips, which is also v_max_chips — the hard ceiling. It
-- tops the leaderboard instantly (get_leaderboard ranks by total_chips). Confirmed twice: a 100k
-- first-call landed 100,000 with gained_today 0, and the billion landed in full.
--
-- ═══ WHY IT WORKED ═══════════════════════════════════════════════════════════════════════════
-- Three guards were added to submit_score over time — a +2,000 per-submit delta clamp, a
-- never-lower rule, and a 5,000/day gain ceiling. EVERY ONE OF THEM IS GATED ON
-- `v_prev IS NOT NULL`, i.e. they only run when a leaderboard row ALREADY EXISTS. On the very
-- first submit for a device there is no prior row, `v_prev` is NULL, all three are skipped, and the
-- caller-supplied `p_total_chips` is written verbatim (only the 1e9 absolute cap applies). The
-- guards fixed the UPDATE clobber and left the INSERT wide open.
--
-- ═══ THE FIX ═════════════════════════════════════════════════════════════════════════════════
-- Treat a missing prior balance as 0, so the delta clamp and the daily ceiling run on the first
-- insert exactly as they do on every later one. A brand-new device can then be raised at most
-- +2,000 in a submit and +5,000 in a day — the same bound a real player has, and coincidentally
-- the starting balance.
--
-- ═══ WHY THIS DOES NOT BREAK LEGIT USE ═══════════════════════════════════════════════════════
-- A real new device already has a leaderboard row before submit_score is ever called — the
-- starting-grant trigger and ensure_leaderboard_row create it at 2,000. So for legitimate traffic
-- v_prev is already non-NULL and this changes nothing. The NULL path is the attack path, and
-- capping it to 2,000 is the correct floor for a device that has earned nothing. Everything else in
-- the function — the 1e9 absolute cap, the player-name/hands columns, the daily meter table — is
-- byte-identical.

CREATE OR REPLACE FUNCTION public.submit_score(p_device_id text, p_player_name text, p_total_chips bigint, p_hands_played integer, p_hands_won integer, p_biggest_win integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_chips bigint;
  v_prev bigint;
  v_max_chips bigint := 1000000000;
  v_max_gain bigint := 2000;
  v_gain bigint := 0;
  v_gained_today bigint := 0;
  v_allowance bigint;
  v_capped boolean := false;
  c_max_gain_per_day constant bigint := 5000;
BEGIN
  PERFORM public.econ_authz_probe('submit_score', p_device_id);
  IF p_device_id IS NULL OR length(p_device_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;
  v_chips := GREATEST(0, LEAST(COALESCE(p_total_chips, 0), v_max_chips));

  -- RED-TEAM 2026-08-31 — a device with no row has earned nothing, so its prior balance is 0, not
  -- "unbounded". Treating NULL as 0 makes all three guards below run on the FIRST submit, which is
  -- the write that set a fresh device to a billion. Legit new devices already have a 2,000 row, so
  -- this only bites the attack path.
  SELECT total_chips INTO v_prev FROM leaderboard WHERE device_id = p_device_id;
  v_prev := COALESCE(v_prev, 0);

  -- delta clamp: a jump beyond v_max_gain over the prior balance is clamped to prev + v_max_gain.
  IF v_chips > v_prev + v_max_gain THEN
    v_chips := v_prev + v_max_gain;
  END IF;

  -- never lower an existing balance.
  IF v_chips < v_prev THEN
    v_chips := v_prev;
  END IF;

  -- DAILY GAIN CEILING. Only the RAISE is metered; an echo (gain 0) is always allowed.
  IF v_chips > v_prev THEN
    v_gain := v_chips - v_prev;
    SELECT COALESCE(gained, 0) INTO v_gained_today
    FROM econ_score_gain_daily WHERE device_id = p_device_id AND day = CURRENT_DATE;
    v_gained_today := COALESCE(v_gained_today, 0);
    v_allowance := GREATEST(c_max_gain_per_day - v_gained_today, 0);
    IF v_gain > v_allowance THEN
      v_gain := v_allowance;
      v_chips := v_prev + v_gain;
      v_capped := true;
    END IF;
    IF v_gain > 0 THEN
      INSERT INTO econ_score_gain_daily (device_id, day, gained)
      VALUES (p_device_id, CURRENT_DATE, v_gain)
      ON CONFLICT (device_id, day) DO UPDATE SET gained = econ_score_gain_daily.gained + EXCLUDED.gained;
    END IF;
  END IF;

  INSERT INTO leaderboard (device_id, player_name, total_chips, hands_played, hands_won, biggest_win, updated_at)
  VALUES (p_device_id, COALESCE(NULLIF(p_player_name, ''), 'Player'), v_chips,
    GREATEST(0, COALESCE(p_hands_played, 0)), GREATEST(0, COALESCE(p_hands_won, 0)),
    GREATEST(0, COALESCE(p_biggest_win, 0)), now())
  ON CONFLICT (device_id) DO UPDATE SET
    player_name=EXCLUDED.player_name, total_chips=EXCLUDED.total_chips,
    hands_played=EXCLUDED.hands_played, hands_won=EXCLUDED.hands_won,
    biggest_win=EXCLUDED.biggest_win, updated_at=now();
  RETURN jsonb_build_object('ok', true, 'total_chips', v_chips,
    'gain_capped', v_capped, 'gained_today', v_gained_today + v_gain);
END; $function$;

COMMENT ON FUNCTION public.submit_score(text, text, bigint, integer, integer, integer) IS
  'Echoes/raises a device leaderboard balance. Anon-callable. The +2,000 delta clamp, never-lower '
  'rule and 5,000/day ceiling now run on the FIRST insert too (prior balance treated as 0). Until '
  '2026-08-31 those guards only covered the update path, so a fresh device could be set to a '
  'billion in one call (RED-TEAM). Do not restore the IS NOT NULL gating. See migration 20260831200000.';
