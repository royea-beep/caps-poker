-- =============================================================================================
-- CLOSE-S1 — the unauthenticated chip mint, closed fail-closed.
--
-- ⚠️ THE DISTINCTION THAT IS THE FIX, AND THE REASON THIS WAS HELD BACK TWICE:
--    THIS GATE REFUSES A CALLER WITH **NO SESSION**. IT DOES **NOT** REFUSE AN ANONYMOUS CALLER.
--    99.7% of CAPS devices are anonymous-WITH-a-session. They arrive with role 'authenticated'
--    and a 'sub' claim, so auth.uid() is non-null and they pass, exactly as before. What is
--    refused is a caller with no JWT subject at all: a raw anon key from curl, and an app that
--    fires an economy call before its session lands.
--    Do NOT "simplify" this into a check on auth.users.is_anonymous, and do NOT re-add a
--    `v_uid IS NULL -> true` shortcut. Either change locks out almost every real player.
--
-- BRANCH-PROVEN BEFORE APPLYING (Iron Rule 11), on a throwaway Supabase branch, both ways.
-- ⚠️ The branch came up with 5 tables and 0 functions against production's 73 / 188 — its
--    migrations FAILED — so every object this gate reads was hand-built on the branch from
--    production's live definitions. Stated, not hidden: the replica is only as faithful as that
--    script. That is the branch-fidelity cost the migration-history report priced.
--
--   #  caller context                                             before          after
--   1  anon role, NO session (attacker AND player mid-startup)    true (MINTED)   FALSE  <- closed
--   2  anonymous WITH session, unbound device (a real player)     true            true
--   3  anonymous WITH session, device bound to itself             true            true
--   4  anonymous WITH session, device bound to another uid        false           false
--   5  SERVICE ROLE, no user session (resolve-hand)               true            true
--   6  real account WITH session, unbound device                  true            true
--   7  no JWT context at all                                      -               FALSE
--   8  EXCEPTION path (a table it reads made unavailable)         true (MINTED)   FALSE + logged
--                                                                 sqlstate 42P01
--   Rows 2, 3, 5 and 6 are the whole reason this was held. They all still pass.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- PART 1 — econ_bind_ok: fail closed on no session, and on any exception.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.econ_bind_ok(p_device_id text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
-- REFUSES NO SESSION, NOT ANONYMOUS. See the migration header before changing anything here.
DECLARE v_uid uuid := auth.uid(); v_bound uuid; v_is_existing boolean; v_has_continuity boolean; v_is_anon boolean;
BEGIN
  IF COALESCE((SELECT (value #>> '{}')::boolean FROM app_config WHERE key='econ_binding_enabled'), false) = false
     THEN RETURN true; END IF;

  -- SERVICE ROLE FIRST, deliberately ahead of the no-session refusal below: the resolve-hand
  -- edge function settles multiplayer with NO user session by design, and it is the only writer
  -- that can pay a DROPPED SEAT. It used to pass by accident under the old rule; now it passes
  -- on purpose. Same discriminator the CLOSE-S2 ladder trigger uses.
  IF auth.role() = 'service_role' THEN RETURN true; END IF;

  -- THE MINT, CLOSED. Was: `IF p_device_id IS NULL OR p_device_id = '' OR v_uid IS NULL THEN
  -- RETURN true`. The v_uid half of that disjunction is the hole.
  IF v_uid IS NULL THEN
    BEGIN
      INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
      VALUES ('econ_authz', jsonb_build_object('case','refused_no_session'), p_device_id, NULL, 'economy');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN false;
  END IF;

  -- A session exists but the caller named no device: nothing to bind, and refusing would break
  -- authenticated callers that legitimately pass no device id. Unchanged behaviour.
  IF p_device_id IS NULL OR p_device_id = '' THEN RETURN true; END IF;

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

  -- ADDED, NOT SUBSTITUTED: a caller holding a real account binds on first sight.
  SELECT is_anonymous INTO v_is_anon FROM auth.users WHERE id = v_uid;
  IF v_is_anon IS FALSE THEN
    INSERT INTO device_identity (device_id, auth_uid) VALUES (p_device_id, v_uid)
      ON CONFLICT (device_id) DO NOTHING;
    RETURN true;
  END IF;

  -- UNCHANGED anonymous path.
  SELECT EXISTS (SELECT 1 FROM leaderboard WHERE device_id = p_device_id) INTO v_is_existing;
  SELECT EXISTS (SELECT 1 FROM analytics_events WHERE device_id = p_device_id AND user_id = v_uid LIMIT 1)
    INTO v_has_continuity;

  IF (NOT v_is_existing) OR v_has_continuity THEN
    INSERT INTO device_identity (device_id, auth_uid) VALUES (p_device_id, v_uid)
      ON CONFLICT (device_id) DO NOTHING;
    RETURN true;
  END IF;

  RETURN true;

-- FAIL CLOSED. Was: `EXCEPTION WHEN OTHERS THEN RETURN true` — a table made unavailable turned
-- the gate off entirely. The nested block keeps a failing log from swallowing the refusal.
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO analytics_events (event_name, properties, device_id, user_id, screen)
    VALUES ('econ_authz',
            jsonb_build_object('case','refused_exception','sqlstate',SQLSTATE,'sqlerrm',SQLERRM),
            p_device_id, v_uid, 'economy');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN false;
END; $function$;

-- ---------------------------------------------------------------------------------------------
-- PART 2 — submit_score: the third mint vector, which had NO identity guard at all.
--
-- It called econ_authz_probe, which is TELEMETRY and refuses nothing, then inserted a new
-- device_id into leaderboard — firing ledger_starting_grant for +2000. PART 1 alone would have
-- left this wide open, because this function never consulted the gate.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_score(p_device_id text, p_player_name text, p_total_chips bigint, p_hands_played integer, p_hands_won integer, p_biggest_win integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  -- CLOSE-S1 PART 2 — the guard this function never had. Same shape as the other 14 callers.
  IF NOT public.econ_bind_ok(p_device_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'identity_mismatch');
  END IF;

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

-- ---------------------------------------------------------------------------------------------
-- ⚠️ verify_jwt AND PAYMENTS — restated here because this is where it will be read.
-- `verify-purchase` runs with verify_jwt = true TODAY, and that is currently doing real work.
-- When PayPlus is wired the provider's webhook cannot present a user JWT, so verify_jwt must come
-- off — and at that moment THE PAYLOAD SIGNATURE BECOMES THE ONLY GATE ON CREDITING CHIPS. Add
-- and prove the signature check FIRST; never remove verify_jwt in the same change.
-- ---------------------------------------------------------------------------------------------
