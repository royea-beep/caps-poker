-- RED-TEAM 2026-08-31 — ⚠️ CLOSING A LIVE, UNLIMITED CHIP MINT.
--
-- ═══ WHAT WAS PERFORMED, NOT ASSERTED ═══════════════════════════════════════════════════════
-- From outside, with only the public anon key and no session, `record_reward` was called eight
-- times in a loop:
--     record_reward('RT-MINT-01', 2000, 'rt_probe_N', false)
-- and the balance climbed 2000 → 16000 → 18000, one clean 2000-chip credit per call, past every
-- daily cap in the economy. Nine chip_transactions rows, 18,000 chips, verified by fresh SELECT.
--
-- ═══ WHY IT WORKED ═══════════════════════════════════════════════════════════════════════════
-- record_reward is anon-callable and, alone among the anon chip-writers, called ONLY
-- econ_authz_probe (which just logs). It had NO econ_rate_ok, NO econ_bind_ok, and NO daily cap.
-- The amount is caller-supplied, clamped only per-call to 2,000. So a script mints 2,000 per call,
-- unbounded. Every sibling — earn_chips, claim_daily_streak, claim_low_chip_rescue,
-- claim_emergency_chips(device) — opens with all three guards and a daily cap; this one was the
-- gap. It is the most severe finding of the red-team pass: a stranger gets unlimited chips.
--
-- ═══ THE FIX, MATCHING THE SIBLINGS EXACTLY ══════════════════════════════════════════════════
-- Add the two missing guards (econ_authz_probe was already present) AND a 5,000/day per-device cap
-- on record_reward's own grants — the same ceiling earn_chips carries. Caller-supplied amount and
-- the 2,000 per-call clamp are kept, because the legitimate callers rely on them (referral 300,
-- share 50, achievements up to 1,000); what changes is that the total a device can receive through
-- this path in a day is now bounded, and the path is throttled and logged like every other.
--
-- ═══ WHY THIS DOES NOT BREAK LEGIT USE ═══════════════════════════════════════════════════════
-- econ_bind_ok returns true for a caller with no session (CAPS is device-anonymous by design), so
-- anonymous players keep working. redeem_referral calls record_reward(referrer, 300, ...) — 300 is
-- far under 5,000/day and passes the throttle. The client's referral_welcome / achievement grants
-- are single small credits. Nothing legitimate approaches 5,000/day through this one path.
--
-- The daily total is summed from record_reward's OWN rows: it writes
-- description = 'reward ' || event_type, action 'credit'. Summing those for the device since
-- midnight is exact and does not touch other event types' budgets.

CREATE OR REPLACE FUNCTION public.record_reward(p_device_id text, p_amount integer, p_event_type text, p_once boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_amt     integer;
  v_new     bigint;
  v_cap     integer := 2000;  -- per-grant clamp (rewards are 100-1000 today); tunable
  v_today   bigint;
  c_max_per_day constant integer := 5000;  -- RED-TEAM 2026-08-31: matches earn_chips' daily ceiling
BEGIN
  PERFORM public.econ_authz_probe('record_reward', p_device_id);
  -- RED-TEAM 2026-08-31 — the two guards this function was missing, in the sibling order.
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'granted', 0, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'granted', 0, 'reason', 'identity_mismatch'); END IF;

  IF p_device_id IS NULL OR length(p_device_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;
  IF p_event_type IS NULL OR length(p_event_type) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_event_type');
  END IF;

  v_amt := LEAST(GREATEST(COALESCE(p_amount, 0), 0), v_cap);  -- reward only: [0, cap]

  IF v_amt = 0 THEN
    SELECT total_chips INTO v_new FROM leaderboard WHERE device_id = p_device_id;
    RETURN jsonb_build_object('ok', true, 'granted', 0, 'new_balance', COALESCE(v_new,0), 'reason', 'zero_amount');
  END IF;

  IF p_once AND EXISTS (
    SELECT 1 FROM chip_transactions
    WHERE device_id = p_device_id AND event_type = p_event_type
  ) THEN
    SELECT total_chips INTO v_new FROM leaderboard WHERE device_id = p_device_id;
    RETURN jsonb_build_object('ok', true, 'granted', 0, 'already_granted', true, 'new_balance', COALESCE(v_new,0));
  END IF;

  -- RED-TEAM 2026-08-31 — DAILY CEILING. Sum record_reward's own credits for this device today;
  -- refuse once the grant would cross 5,000. This is what turns "2,000 per call forever" into
  -- "5,000 per device per day", the same bound every other faucet has.
  SELECT COALESCE(SUM(amount), 0) INTO v_today
    FROM chip_transactions
   WHERE device_id = p_device_id AND action = 'credit' AND description LIKE 'reward %'
     AND created_at >= date_trunc('day', now());
  IF v_today + v_amt > c_max_per_day THEN
    SELECT total_chips INTO v_new FROM leaderboard WHERE device_id = p_device_id;
    RETURN jsonb_build_object('ok', false, 'granted', 0, 'reason', 'reward_cap_daily',
                              'granted_today', v_today, 'cap', c_max_per_day, 'new_balance', COALESCE(v_new,0));
  END IF;

  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;

  INSERT INTO leaderboard (device_id, player_name, total_chips, updated_at)
  VALUES (p_device_id, 'Player', v_amt, now())
  ON CONFLICT (device_id) DO UPDATE
    SET total_chips = GREATEST(0, leaderboard.total_chips + v_amt),
        updated_at  = now()
  RETURNING total_chips INTO v_new;

  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description)
  VALUES (v_user_id, p_device_id, v_amt, p_event_type, 'credit', 'reward ' || p_event_type);

  RETURN jsonb_build_object('ok', true, 'granted', v_amt, 'new_balance', v_new,
                            'clamped', (v_amt <> COALESCE(p_amount,0)));
END;
$function$;

COMMENT ON FUNCTION public.record_reward(text, integer, text, boolean) IS
  'Grants a reward (referral, share, achievement). Anon-callable, so it carries the full economy '
  'guard set: econ_authz_probe + econ_rate_ok + econ_bind_ok, a 2,000 per-call clamp AND a '
  '5,000/day per-device ceiling. Until 2026-08-31 it had only the probe and was a live unlimited '
  'mint (RED-TEAM: 18,000 chips minted from outside with the public key). Do not remove the daily '
  'cap or the guards. See migration 20260831190000.';
