-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- VAMOS CAPS — CLOSE-S1: the unauthenticated chip mint.
--
-- ⛔ DO NOT APPLY THIS YET. ⛔
--
-- THIS MIGRATION IS PREPARED AND BRANCH-PROVEN, BUT ITS PREREQUISITE IS NOT MET AS OF 2026-09-03.
-- Applying it before the app-open auth gate is LIVE IN PRODUCTION will refuse economy calls for
-- real anonymous players. Measured on production the day this was written:
--
--   * the live web bundle (index-1b8d616b…, 3,821,159 B) contains ZERO occurrences of
--     `ensureSessionBounded` / `APP_OPEN_AUTH_TIMEOUT_MS` / `__resetAuthGate` — the gate is NOT
--     shipped. It is still unmerged on claude/vamos-caps-align-celebration-flppo0; origin/main is
--     e3d7d5e and does not contain utils/authGate.ts.
--   * `analytics_events` holds 483 `econ_authz` rows, EVERY ONE `case = 'no_session'`, across 197
--     DISTINCT DEVICES, from 2026-08-01 through 2026-09-03. Economy calls are still arriving with
--     no session, at scale, today.
--   * only 6 of 512 devices that have made an economy call are bound in `device_identity` (1.2%).
--     The 6 bindings are NOT evidence the gate shipped: a binding is written whenever ANY economy
--     call happens to arrive after the fire-and-forget sign-in lands, which was always true for
--     later calls. Same shape as the `gap = 0` trap — a green number measuring something else.
--
-- APPLY ONLY AFTER: the auth gate is merged, deployed to web AND native, and the
-- `econ_authz / no_session` counter has stopped growing for real devices. Verify with:
--     SELECT count(*), max(created_at) FROM analytics_events
--      WHERE event_name='econ_authz' AND properties->>'case'='no_session';
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CLOSES — three mint vectors proven live in TOTAL-AUDIT-2026-09-02 (19,160 chips in two
-- calls, from the shipped public key with no sign-in):
--   1. record_hand_net  (±10000/call)  — gated by econ_bind_ok  -> closed by PART 1
--   2. record_reward    (2000/call)    — gated by econ_bind_ok  -> closed by PART 1
--   3. submit_score     (new device_id -> ledger_starting_grant +2000)
--                                       — ⚠️ HAS NO GUARD AT ALL  -> closed by PART 2
-- PART 2 is required: PART 1 alone leaves vector 3 wide open, because submit_score never called
-- econ_bind_ok — it only calls econ_authz_probe, which is telemetry and refuses nothing.
--
-- BRANCH-PROVEN (Supabase branch `close-s1-bindok`, deleted after; faithful reproduction of the
-- shipped function and every table it reads). Truth table, before -> after:
--   1 anon role, NO session (the attacker AND a player mid-startup)  true -> FALSE   (mint refused)
--   2 anonymous WITH session, unbound device (a real player)         true -> true    (still works)
--   3 anonymous WITH session, device bound to itself                 true -> true    (still works)
--   4 anonymous WITH session, device bound to ANOTHER uid            false -> false  (unchanged)
--   5 SERVICE ROLE, no user session (resolve-hand)                   true -> true    (preserved)
--   6 EXCEPTION path (a table it reads made unavailable)             true -> FALSE + logged
-- All 14 econ_bind_ok callers consume it as `IF NOT public.econ_bind_ok(...) THEN <refuse>`
-- (verified against every function body on production), so they inherit this table exactly.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- PART 1 — econ_bind_ok: fail closed on no session, and on error.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.econ_bind_ok(p_device_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_bound uuid; v_is_existing boolean; v_has_continuity boolean;
        v_is_anon boolean; v_role text := COALESCE(auth.role(), '');
BEGIN
  -- ══ THE DISTINCTION THIS GATE ENFORCES — STATED SO NOBODY SOFTENS IT LATER ══════════════════
  -- This gate refuses a caller with NO SESSION. It does NOT refuse anonymous callers.
  -- 99.7% of CAPS devices are anonymous-WITH-a-session and they MUST keep working: they fall
  -- through to the unchanged anonymous path below and return true. "Anonymous" is a legitimate
  -- identity here. "No session at all" is not an identity, and that difference is the whole fix.
  -- ⚠️ Do NOT "simplify" this into a check on is_anonymous, and do NOT re-add a
  -- `v_uid IS NULL -> true` shortcut. Either change locks out almost every real player, or
  -- re-opens the mint. This function is the single gate for 14 economy RPCs.

  -- 0. SERVICE-ROLE BYPASS — FIRST, AND DELIBERATELY.
  -- resolve-hand adjudicates multiplayer with NO user session BY DESIGN, and is the only writer
  -- that can settle a seat that DROPPED. Under the old fail-open rule it passed BY ACCIDENT
  -- (v_uid IS NULL => true). It must now pass ON PURPOSE, or multiplayer settlement breaks the
  -- moment this lands. Same discriminator the CLOSE-S2 ladder trigger already uses.
  IF v_role = 'service_role' THEN RETURN true; END IF;

  -- 1. Kill switch — unchanged.
  IF COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='econ_binding_enabled'), false) = false
     THEN RETURN true; END IF;

  -- 2. ══ FIX A ══ FAIL CLOSED on no session.
  -- Was: `IF p_device_id IS NULL OR p_device_id = '' OR v_uid IS NULL THEN RETURN true;`
  IF v_uid IS NULL THEN
    BEGIN
      INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
      VALUES ('econ_authz', jsonb_build_object('case','refused_no_session','device',p_device_id),
              p_device_id, NULL, 'economy');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN false;
  END IF;

  IF p_device_id IS NULL OR p_device_id = '' THEN
    BEGIN
      INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
      VALUES ('econ_authz', jsonb_build_object('case','refused_no_device'), p_device_id, v_uid, 'economy');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN false;
  END IF;

  -- ── everything below is UNCHANGED from the shipped function ──────────────────────────────────
  SELECT auth_uid INTO v_bound FROM device_identity WHERE device_id = p_device_id;
  IF v_bound IS NOT NULL THEN
    IF v_bound = v_uid THEN RETURN true; END IF;
    BEGIN
      INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
      VALUES ('econ_authz',
              jsonb_build_object('case','identity_mismatch','bound_uid',v_bound,'caller_uid',v_uid),
              p_device_id, v_uid, 'economy');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN false;
  END IF;

  SELECT is_anonymous INTO v_is_anon FROM auth.users WHERE id = v_uid;
  IF v_is_anon IS FALSE THEN
    INSERT INTO device_identity (device_id, auth_uid) VALUES (p_device_id, v_uid)
      ON CONFLICT (device_id) DO NOTHING;
    RETURN true;
  END IF;

  SELECT EXISTS (SELECT 1 FROM leaderboard WHERE device_id = p_device_id) INTO v_is_existing;
  SELECT EXISTS (SELECT 1 FROM analytics_events WHERE device_id = p_device_id AND user_id = v_uid LIMIT 1)
    INTO v_has_continuity;

  IF (NOT v_is_existing) OR v_has_continuity THEN
    INSERT INTO device_identity (device_id, auth_uid) VALUES (p_device_id, v_uid)
      ON CONFLICT (device_id) DO NOTHING;
    RETURN true;
  END IF;

  RETURN true;   -- an anonymous caller WITH a session always passes

EXCEPTION WHEN OTHERS THEN
  -- 3. ══ FIX B ══ was `RETURN true`. A gate that GRANTS access when it errors is how this stayed
  -- hidden for months. Fail closed, and LOG, so a refusal is visible rather than silent.
  BEGIN
    INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
    VALUES ('econ_authz',
            jsonb_build_object('case','refused_exception','sqlstate',SQLSTATE,'sqlerrm',left(SQLERRM,200)),
            p_device_id, v_uid, 'economy');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN false;
END; $function$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- PART 2 — submit_score: add the guard it never had (mint vector 3).
-- Body is byte-identical to the shipped function except for the four added lines marked below.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
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

  -- ══ CLOSE-S1, PART 2 — ADDED ══════════════════════════════════════════════════════════════
  -- submit_score had NO identity guard: econ_authz_probe is telemetry and refuses nothing. A
  -- session-less caller could therefore INSERT a brand-new device_id here, which fires
  -- ledger_starting_grant and mints +2000 — the third vector in TOTAL-AUDIT-2026-09-02, and the
  -- one PART 1 alone does not close. This is the same guard the other 14 economy RPCs already use.
  IF NOT public.econ_bind_ok(p_device_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
  END IF;
  -- ══════════════════════════════════════════════════════════════════════════════════════════

  IF p_device_id IS NULL OR length(p_device_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;
  v_chips := GREATEST(0, LEAST(COALESCE(p_total_chips, 0), v_max_chips));

  SELECT total_chips INTO v_prev FROM leaderboard WHERE device_id = p_device_id;
  v_prev := COALESCE(v_prev, 0);

  IF v_chips > v_prev + v_max_gain THEN
    v_chips := v_prev + v_max_gain;
  END IF;
  IF v_chips < v_prev THEN
    v_chips := v_prev;
  END IF;

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

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- AFTER APPLYING, RUN THESE (all three must refuse, raw anon, shipped public key, no sign-in):
--   curl -s -X POST "$URL/rest/v1/rpc/record_hand_net" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--        -H 'Content-Type: application/json' -d '{"p_device_id":"ATTACK-1","p_net":10000}'
--   curl … /rpc/record_reward  -d '{"p_device_id":"ATTACK-1","p_amount":2000,"p_event_type":"x"}'
--   curl … /rpc/submit_score   -d '{"p_device_id":"ATTACK-NEW","p_player_name":"x","p_total_chips":2000,
--                                   "p_hands_played":0,"p_hands_won":0,"p_biggest_win":0}'
-- Expect: identity_mismatch / ok:false on all three, and NO new leaderboard or chip_transactions row.
-- Then confirm a real cold-launch first hand still works on a fresh device, and that
-- `econ_authz / refused_no_session` does NOT start climbing for real device_ids.
--
-- ROLLBACK: re-apply the previous definitions from
--   git show <this-commit>^:supabase/migrations/  (or restore econ_bind_ok's `v_uid IS NULL ->
--   true` line and submit_score without the guard). Both are single-function replacements.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
