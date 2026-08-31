-- CLOSE-THE-LEAKS 2026-08-31 — the two smaller red-team items.
--
-- ═══ 1 · earn_chips accepts a negative amount and has no floor ════════════════════════════════
-- RED-TEAM: earn_chips('device','hand_won',-500) returned {"chips_earned": -500} and the leaderboard
-- update was `total_chips = total_chips + v_amt` with no GREATEST(0, …) — so a caller who knows a
-- device id could reduce that balance, potentially below zero. It is gated on the device id staying
-- secret (which it does), so it was latent — but it is a one-line class of guard and it removes the
-- "if a device id ever leaks, it is also a drain" clause.
--
-- TWO guards, both overloads:
--   · REFUSE a negative p_amount outright — no legitimate caller passes one (the client only ever
--     credits positive gameplay amounts; debits go through spend_chips, which already refuses
--     negatives with invalid_amount). This removes the drain primitive entirely.
--   · FLOOR the balance at 0 on the update, as defence in depth, so no path can drive it negative.
-- Everything else — the allowlist, the 5,000/day cap, the purchase-grant refusal, the clamp — is
-- byte-identical.
--
-- ═══ 2 · v_harness_devices does not scan referral_links ══════════════════════════════════════
-- Found while cleaning up the red-team's own test devices: RT-REF-OWNER had only a referral_links
-- row and the harness view missed it, because the view's union covers leaderboard, analytics_events,
-- chip_transactions, hand_history, device_identity, player_streaks and heatmap_events — not
-- referral_links. The detector is the instrument every cleanup depends on, so its blind spots cost
-- whole sprints. referral_links is added to the synthetic-id union.

-- ── earn_chips(device_id) ──
CREATE OR REPLACE FUNCTION public.earn_chips(p_device_id text, p_event_type text, p_amount integer DEFAULT 50)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user_id uuid; v_amt integer; v_earned_today integer; v_new bigint; c_max_per_day constant integer := 5000;
BEGIN
  PERFORM public.econ_authz_probe('earn_chips', p_device_id);
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'identity_mismatch'); END IF;
  -- RED-TEAM 2026-08-31 — no negative earn. A grant is a credit; debits are spend_chips' job.
  IF COALESCE(p_amount, 50) < 0 THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'invalid_amount'); END IF;
  IF p_event_type IN ('daily_login', 'daily_reward') THEN RETURN jsonb_build_object('ok', true, 'chips_earned', 0, 'gated', p_event_type || '_retired'); END IF;
  IF p_event_type IN ('starter_pack_2x', 'iap_starter_pack') THEN
    RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'purchase_not_verified',
                              'detail', 'real-money grants are credited only by credit_purchase via verify-purchase');
  END IF;
  IF p_event_type NOT IN ('daily_streak','hand_won','hand_win','quick_poker_win','quick_poker_buyin','quick_poker_buy_in','rebuy_500','first_game','share_hand','buy_emotes','emergency_chips','low_chip_rescue','streak_5_wins','sit_n_go_win','buy_avatar') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_event_type'); END IF;
  v_amt := GREATEST(0, LEAST(1500, COALESCE(p_amount, 50)));  -- reward only, non-negative
  SELECT COALESCE(SUM(amount), 0) INTO v_earned_today FROM chip_transactions WHERE device_id = p_device_id AND action = 'credit' AND created_at >= date_trunc('day', now())
    AND event_type IN ('daily_streak','hand_won','hand_win','quick_poker_win','quick_poker_buyin','quick_poker_buy_in','rebuy_500','first_game','share_hand','buy_emotes','emergency_chips','low_chip_rescue','streak_5_wins','sit_n_go_win','buy_avatar');
  IF v_amt > 0 AND v_earned_today + v_amt > c_max_per_day THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'earn_cap_daily', 'earned_today', v_earned_today, 'cap', c_max_per_day); END IF;
  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;
  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description) VALUES (v_user_id, p_device_id, v_amt, p_event_type, 'credit', p_event_type);
  UPDATE leaderboard SET total_chips = GREATEST(0, total_chips + v_amt) WHERE device_id = p_device_id;
  RETURN jsonb_build_object('ok', true, 'chips_earned', v_amt);
END; $function$;

-- ── earn_chips(user_id) ──
CREATE OR REPLACE FUNCTION public.earn_chips(p_user_id uuid, p_event_type text, p_amount integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_device_id text; v_amt integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot earn chips for user %', auth.uid(), p_user_id;
  END IF;
  IF COALESCE(p_amount, 50) < 0 THEN RETURN jsonb_build_object('ok', false, 'earned', 0, 'reason', 'invalid_amount'); END IF;
  IF p_event_type IN ('daily_login', 'daily_reward') THEN
    RETURN jsonb_build_object('ok', true, 'earned', 0, 'gated', p_event_type || '_retired');
  END IF;
  IF p_event_type NOT IN ('daily_streak','hand_won','hand_win','quick_poker_win',
      'quick_poker_buyin','quick_poker_buy_in','rebuy_500','first_game','share_hand','buy_emotes',
      'emergency_chips','low_chip_rescue','streak_5_wins','sit_n_go_win','buy_avatar') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_event_type');
  END IF;
  v_amt := GREATEST(0, LEAST(1500, COALESCE(p_amount, 50)));
  SELECT device_id INTO v_device_id FROM push_tokens WHERE user_id = p_user_id LIMIT 1;
  IF v_device_id IS NULL THEN v_device_id := p_user_id::text; END IF;
  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description)
  VALUES (p_user_id, v_device_id, v_amt, p_event_type, 'credit', p_event_type);
  UPDATE leaderboard SET total_chips = GREATEST(0, total_chips + v_amt) WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'earned', v_amt);
END; $function$;

-- ── the detector gap ──
CREATE OR REPLACE VIEW public.v_harness_devices AS
  SELECT device_id, 'automation_fingerprint'::text AS signal
    FROM public.v_automation_devices
  UNION
  SELECT device_id, 'synthetic_device_id'::text AS signal
    FROM (
      SELECT device_id FROM public.leaderboard        WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.analytics_events  WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.chip_transactions WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.hand_history      WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.device_identity
      UNION SELECT device_id FROM public.player_streaks
      UNION SELECT device_id FROM public.heatmap_events    WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.referral_links    WHERE device_id IS NOT NULL  -- RED-TEAM 2026-08-31: was missing
    ) seen
   WHERE device_id !~ '^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$'
     AND device_id !~ '^anon-[0-9a-z]+$';
