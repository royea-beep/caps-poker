-- CLOSE-THE-SIX 2026-08-31 — earn_chips stops being a payment path.
--
-- ═══ THE RULING, BECAUSE HALF OF THIS FINDING WAS NOT A HOLE ═════════════════════════════════
-- VERIFY-EVERYTHING reported "earn_chips grants 6,500 chips to a caller with no session" as one
-- finding. It is two, and they have opposite answers.
--
-- NOT A HOLE — THE ANONYMOUS PATH, WORKING AS DESIGNED.  CAPS is a device-anonymous product:
-- essentially every device plays without an account, so `econ_bind_ok` returning true when
-- `auth.uid() IS NULL` is deliberate and correct. The gameplay grants (hand_won, first_game,
-- daily_streak, share_hand, quick_poker_*, rebuy_500, buy_emotes, buy_avatar, emergency_chips,
-- low_chip_rescue, streak_5_wins, sit_n_go_win) are SUPPOSED to be reachable that way, and they
-- are already fenced by four server-side controls that were measured working: an event-type
-- allowlist, a server-owned amount clamp (a caller's 999,999 came back as 1,500), a 5,000/day
-- per-device cap, and a 30/minute throttle that refused on call 31. Requiring a session here
-- would lock out the players the product is built for. That half is RETIRED as a finding.
--
-- A HOLE — THE TWO PURCHASE-SHAPED EVENT TYPES.  `iap_starter_pack` and `starter_pack_2x` are not
-- gameplay grants; they are the credit half of a REAL-MONEY purchase. The device resolved a
-- RevenueCat purchase and then TOLD THE SERVER it happened, and the server paid 5,000 chips on
-- that say-so. Nothing proved a payment. This project already built the replacement and already
-- deployed it: migration 20260822145848 says so in its own header — "Today the client calls
-- earn_chips('iap_starter_pack') after a purchase resolves ON THE DEVICE. There is no proof a
-- payment happened." `verify-purchase` (verify_jwt on, HMAC over the raw body) and
-- `credit_purchase` (service_role only) are the verified path, and eight attacks against them
-- were refused. The old door was simply left open beside the new one.
--
-- ═══ WHY THIS CANNOT LOCK OUT AN ANONYMOUS PLAYER ════════════════════════════════════════════
-- Only the two purchase event types change. Every gameplay event type keeps the identical path,
-- the identical clamp and the identical cap. And the sole client caller —
-- `app/shop.tsx:95 handleBuyStarterPack` — is behind `Platform.OS !== 'web' && isIapEnabled()`
-- (app/shop.tsx:233), and `app_config.iap_enabled` is `false`, so it is unreachable today. When
-- IAP is enabled it must route through verify-purchase instead; the client change ships with it.
--
-- ⚠️ THE GO-LIVE CHECKLIST IS docs/PAYMENTS-GO-LIVE.md — added 2026-08-31, and it leads with the
-- blocker below. Work it before iap_enabled is flipped.
--
-- ⚠️ ONE THING THIS DOES NOT FIX, REPORTED RATHER THAN SILENTLY LEFT: `credit_purchase` resolves
-- packages from `app_config.chip_store_packages`, whose ids are small/medium/large/premium/mega.
-- There is no `starter_pack` entry, so the verified path would answer `unknown_package` for the
-- RevenueCat starter pack. Adding one is an economy VALUE change and is Roye's call, not this
-- sprint's. It must be done before `iap_enabled` is flipped.
--
-- Nothing else in this function is touched: same signature, same guards in the same order, same
-- allowlist, same clamp, same cap, same daily-login/daily-reward retirement.

CREATE OR REPLACE FUNCTION public.earn_chips(p_device_id text, p_event_type text, p_amount integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user_id uuid; v_amt integer; v_earned_today integer; v_new bigint; c_max_per_day constant integer := 5000;
BEGIN
  PERFORM public.econ_authz_probe('earn_chips', p_device_id);
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'identity_mismatch'); END IF;
  IF p_event_type IN ('daily_login', 'daily_reward') THEN RETURN jsonb_build_object('ok', true, 'chips_earned', 0, 'gated', p_event_type || '_retired'); END IF;

  -- CLOSE-THE-SIX 2026-08-31 — THE PURCHASE GRANTS LEAVE THIS FUNCTION.
  -- Was: look up starter_pack_chips / starter_pack_2x_chips in app_config and pay it, once per
  -- device, to any caller — including one with no session at all. Chips bought with real money are
  -- now credited ONLY by credit_purchase, which is granted to service_role alone and is reached
  -- only through verify-purchase after an HMAC signature check over the raw callback body.
  -- Refused, never silently zero: a client that still calls this must be able to tell the
  -- difference between "you already had it" and "this path no longer pays".
  IF p_event_type IN ('starter_pack_2x', 'iap_starter_pack') THEN
    RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'purchase_not_verified',
                              'detail', 'real-money grants are credited only by credit_purchase via verify-purchase');
  END IF;

  IF p_event_type NOT IN ('daily_streak','hand_won','hand_win','quick_poker_win','quick_poker_buyin','quick_poker_buy_in','rebuy_500','first_game','share_hand','buy_emotes','emergency_chips','low_chip_rescue','streak_5_wins','sit_n_go_win','buy_avatar') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_event_type'); END IF;
  v_amt := GREATEST(-500, LEAST(1500, COALESCE(p_amount, 50)));
  SELECT COALESCE(SUM(amount), 0) INTO v_earned_today FROM chip_transactions WHERE device_id = p_device_id AND action = 'credit' AND created_at >= date_trunc('day', now())
    AND event_type IN ('daily_streak','hand_won','hand_win','quick_poker_win','quick_poker_buyin','quick_poker_buy_in','rebuy_500','first_game','share_hand','buy_emotes','emergency_chips','low_chip_rescue','streak_5_wins','sit_n_go_win','buy_avatar');
  IF v_amt > 0 AND v_earned_today + v_amt > c_max_per_day THEN RETURN jsonb_build_object('ok', false, 'chips_earned', 0, 'reason', 'earn_cap_daily', 'earned_today', v_earned_today, 'cap', c_max_per_day); END IF;
  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;
  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description) VALUES (v_user_id, p_device_id, v_amt, p_event_type, 'credit', p_event_type);
  UPDATE leaderboard SET total_chips = total_chips + v_amt WHERE device_id = p_device_id;
  RETURN jsonb_build_object('ok', true, 'chips_earned', v_amt);
END; $function$;

COMMENT ON FUNCTION public.earn_chips(text, text, integer) IS
  'Gameplay chip grants for an anonymous device. Fenced by an event allowlist, a server-owned '
  'clamp (-500..1500), a 5,000/day per-device cap and econ_rate_ok/econ_bind_ok. It does NOT pay '
  'for purchases: iap_starter_pack and starter_pack_2x are refused with purchase_not_verified. '
  'Real-money credit is credit_purchase only. See migration 20260831130000.';
