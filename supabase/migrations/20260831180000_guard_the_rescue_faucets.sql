-- PURGE-AND-CLOSE 2026-08-31 — the two rescue faucets get the guards every other economy RPC has.
--
-- ═══ THE BRIEF NAMED ONE. THERE ARE TWO. ═════════════════════════════════════════════════════
-- `claim_low_chip_rescue` was carried forward as "the one economy RPC with no guards". Reading the
-- catalogue rather than the note, `claim_winback_rescue` is in exactly the same state and grants
-- TWICE as much — 1,000 chips against 500. Both are SECURITY DEFINER, both are granted to anon,
-- and neither calls econ_authz_probe, econ_rate_ok or econ_bind_ok. Every other chip-granting
-- function in this database opens with those three lines.
--
-- ═══ WHAT WAS ACTUALLY EXPOSED — BOUNDED, AND SAID WITHOUT INFLATION ═════════════════════════
-- Neither is a free-chip tap. Each already refuses unless the caller's balance is under a floor
-- (100 for low_chip, 50 for winback), each is once per device per day / per seven days via
-- chip_rescue_log, and winback additionally needs 24 hours of inactivity. And since CLOSE-THE-SIX
-- an attacker cannot mint the leaderboard row they would need — `no_player_record` is returned when
-- one is absent, and leaderboard INSERT is service_role only.
--
-- What is genuinely missing is the THROTTLE and the VISIBILITY. Without econ_rate_ok a caller may
-- hammer these at any rate the network allows, probing device ids for one that qualifies; without
-- econ_authz_probe a refusal leaves no trace, so nobody would see it happening. Both guards cost
-- one line each and every sibling function already pays it.
--
-- ═══ WHAT DOES NOT CHANGE ════════════════════════════════════════════════════════════════════
-- Amounts (500 / 1,000), thresholds (100 / 50), the daily and weekly locks, the inactivity window,
-- the return shapes and the Hebrew messages are byte-identical. This adds three lines to each
-- function and touches nothing else. econ_bind_ok returns true for a caller with no session by
-- design — anonymous players must keep reaching these — so this does not lock anyone out; it adds
-- the rate limit and the record.

CREATE OR REPLACE FUNCTION public.claim_low_chip_rescue(p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_chips bigint;
  v_today date := CURRENT_DATE;
  v_rescue_amount int := 500;
  v_min int := COALESCE((SELECT value::int FROM app_config WHERE key = 'min_playable_chips'), 100);
BEGIN
  -- CLOSE-THE-SIX / PURGE-AND-CLOSE 2026-08-31 — the three guards every other economy RPC opens
  -- with. Same order as earn_chips, record_hand_net, claim_daily_streak and credit_purchase.
  PERFORM public.econ_authz_probe('claim_low_chip_rescue', p_device_id);
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('eligible', false, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('eligible', false, 'reason', 'identity_mismatch'); END IF;

  SELECT total_chips INTO v_current_chips FROM leaderboard WHERE device_id = p_device_id;
  IF v_current_chips IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_player_record');
  END IF;
  IF v_current_chips >= v_min THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'chips_too_high', 'current_chips', v_current_chips);
  END IF;
  IF EXISTS(SELECT 1 FROM chip_rescue_log WHERE device_id = p_device_id AND rescue_type = 'low_chip' AND granted_date = v_today) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'already_claimed_today', 'next_claim_at', (v_today + 1)::text);
  END IF;
  UPDATE leaderboard SET total_chips = total_chips + v_rescue_amount WHERE device_id = p_device_id;
  INSERT INTO chip_rescue_log (device_id, rescue_type, chips_granted) VALUES (p_device_id, 'low_chip', v_rescue_amount);
  INSERT INTO chip_transactions (device_id, amount, event_type, action, description)
  VALUES (p_device_id, v_rescue_amount, 'low_chip_rescue', 'credit', 'low chip rescue (chips were ' || v_current_chips || ')');
  RETURN jsonb_build_object(
    'eligible', true, 'granted', true, 'amount', v_rescue_amount,
    'previous_chips', v_current_chips, 'new_chips', v_current_chips + v_rescue_amount,
    'message_he', 'ברוך השב! קיבלת ' || v_rescue_amount || ' ציפים לחזרה למשחק 🎁'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_winback_rescue(p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_chips bigint;
  v_last_hand timestamptz;
  v_hours_inactive int;
  v_today date := CURRENT_DATE;
  v_rescue_amount int := 1000;
BEGIN
  -- Same three guards. This one grants twice what low_chip does and had exactly the same none.
  PERFORM public.econ_authz_probe('claim_winback_rescue', p_device_id);
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('eligible', false, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('eligible', false, 'reason', 'identity_mismatch'); END IF;

  SELECT total_chips INTO v_current_chips FROM leaderboard WHERE device_id = p_device_id;
  IF v_current_chips IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_player_record');
  END IF;

  IF v_current_chips >= 50 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'chips_too_high', 'current_chips', v_current_chips);
  END IF;

  SELECT MAX(created_at) INTO v_last_hand FROM hand_history WHERE device_id = p_device_id;
  v_hours_inactive := COALESCE(EXTRACT(EPOCH FROM (now() - v_last_hand)) / 3600, 9999)::int;

  IF v_hours_inactive < 24 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'too_recent', 'hours_inactive', v_hours_inactive);
  END IF;

  IF EXISTS(SELECT 1 FROM chip_rescue_log WHERE device_id = p_device_id AND rescue_type = 'winback' AND granted_at > now() - INTERVAL '7 days') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'already_claimed_recently');
  END IF;

  UPDATE leaderboard SET total_chips = total_chips + v_rescue_amount WHERE device_id = p_device_id;
  INSERT INTO chip_rescue_log (device_id, rescue_type, chips_granted) VALUES (p_device_id, 'winback', v_rescue_amount);
  INSERT INTO chip_transactions (device_id, amount, event_type, action, description)
  VALUES (p_device_id, v_rescue_amount, 'winback_rescue', 'credit', 'winback after ' || v_hours_inactive || 'h inactive');

  RETURN jsonb_build_object(
    'eligible', true, 'granted', true, 'amount', v_rescue_amount,
    'previous_chips', v_current_chips, 'new_chips', v_current_chips + v_rescue_amount,
    'hours_inactive', v_hours_inactive,
    'message_he', '🎁 ברוך השב! קיבלת ' || v_rescue_amount || ' ציפים מתנה'
  );
END;
$function$;
