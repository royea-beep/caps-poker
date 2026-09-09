-- ============================================================================================
-- MOVE THE FAUCET FROM PRESENCE TO PLAY.
--
-- MEASURED BEFORE ANYTHING CHANGED (chip_transactions, real devices, harness excluded):
--
--     daily_streak   685,100   83%   paid for OPENING the app
--     daily_login    110,850   13%   paid for OPENING the app — and dead since 2026-07-02
--     daily_reward    13,800    2%   paid for OPENING the app
--     hand_won         4,875   0.6%  paid for PLAYING
--
-- UNDER 1% OF EVERY CHIP EVER MINTED CAME FROM PLAYING A HAND. A game that pays for presence and
-- not for play is structurally wrong at 26 players and at 26,000, which is why this does not wait
-- for a bigger sample.
--
-- ── THE CONSEQUENCE, IN NUMBERS ─────────────────────────────────────────────────────────────
-- A hand at three players costs 25 x 3 boards = 75 to enter and is ZERO-SUM: the buy-ins return
-- to the winners. Expected chips from playing = 0 before rake, slightly negative after. So today
-- a player and a non-player receive EXACTLY THE SAME 530 chips a day, and a returning player at
-- streak 30 receives 10,350 a day for opening the app. There is no moment where anyone needs to
-- buy chips. That, not price and not the storefront, is why purchases are zero.
--
-- ── WHAT THIS CHANGES ───────────────────────────────────────────────────────────────────────
--   presence_grant_multiplier   scales the streak ladder DOWN (0.4 = 40% of today)
--   play_grant_per_hand         a grant for FINISHING a hand
--   play_grant_practice_pct     practice pays a fraction of it — Roye's rule is that practice
--                               stays free and frictionless, so a learner must not be starved
--   play_grant_daily_cap        the grind ceiling
--
-- All four live in app_config, NOT in code, so they can be retuned the day real data exists
-- without a deploy or a build.
--
-- ── ONE WRITER ──────────────────────────────────────────────────────────────────────────────
-- The grant is paid INSIDE record_hand_net — the existing settlement path — and not beside it.
-- That path already carries every guard: econ_authz_probe, econ_rate_ok (throttle),
-- econ_bind_ok (identity), the +/-10,000 clamp, a 20,000/day hand_net ceiling, and idempotency
-- on (device_id, reference_id). This project has fixed a dual-writer problem twice; a new chip
-- writer would be the third.
--
-- Practice reaches the same function by calling it with net 0 and p_is_practice true, so even
-- the chip-neutral path is the same writer.
-- ============================================================================================

-- ── THE FOUR KNOBS ──────────────────────────────────────────────────────────────────────────
INSERT INTO app_config (key, value) VALUES
  ('presence_grant_multiplier', '0.4'::jsonb),
  ('play_grant_per_hand',       '80'::jsonb),
  ('play_grant_practice_pct',   '50'::jsonb),
  ('play_grant_daily_cap',      '800'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Idempotency for the grant, mirroring uq_hand_net_ref. One hand, one grant, forever — a retry,
-- a double-tap or a replayed request cannot pay twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_play_grant_ref
  ON public.chip_transactions (device_id, reference_id)
  WHERE event_type = 'play_grant' AND reference_id IS NOT NULL;

-- ── THE SETTLEMENT PATH, NOW PAYING FOR PLAY ────────────────────────────────────────────────
-- A 4-argument OVERLOAD with NO default. The existing 3-argument function is kept and delegates
-- here with practice=false, so every current caller keeps working unchanged and there is still
-- exactly one implementation. A DEFAULT on the 4th argument would have made the 3-argument call
-- ambiguous, which is why there is not one.
CREATE OR REPLACE FUNCTION public.record_hand_net(
  p_device_id text, p_net integer, p_hand_id text, p_is_practice boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user_id uuid;
  v_net     integer;
  v_new     bigint;
  v_cap     integer := 10000;
  v_tx_id   uuid;
  v_rake_pct numeric := 0;
  v_rake    integer := 0;
  v_credit  integer;
  v_gained_today bigint;
  c_max_gain_per_day constant integer := 20000;
  -- play-grant knobs, read fresh so a retune takes effect without a deploy
  v_grant_base   integer := COALESCE((SELECT (value #>> '{}')::int     FROM app_config WHERE key='play_grant_per_hand'), 0);
  v_grant_pct    integer := COALESCE((SELECT (value #>> '{}')::int     FROM app_config WHERE key='play_grant_practice_pct'), 100);
  v_grant_cap    integer := COALESCE((SELECT (value #>> '{}')::int     FROM app_config WHERE key='play_grant_daily_cap'), 0);
  v_grant        integer := 0;
  v_granted_today bigint := 0;
  v_grant_paid   integer := 0;
  v_grant_reason text := NULL;
BEGIN
  PERFORM public.econ_authz_probe('record_hand_net', p_device_id);
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'net', 0, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('ok', false, 'net', 0, 'reason', 'identity_mismatch'); END IF;

  IF p_device_id IS NULL OR length(p_device_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;

  v_net := LEAST(GREATEST(COALESCE(p_net, 0), -v_cap), v_cap);

  IF v_net > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_gained_today
    FROM chip_transactions
    WHERE device_id = p_device_id AND event_type = 'hand_net' AND amount > 0
      AND created_at >= date_trunc('day', now());
    IF v_gained_today + v_net > c_max_gain_per_day THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'hand_net_cap_daily',
        'net', 0, 'gained_today', v_gained_today, 'cap', c_max_gain_per_day);
    END IF;
  END IF;

  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;

  -- ── THE PLAY GRANT ────────────────────────────────────────────────────────────────────────
  -- Paid for FINISHING a hand, win or lose. Practice pays play_grant_practice_pct of it: a
  -- learner is not starved, and real play stays strictly the better deal so the grant cannot
  -- become a reason to avoid opponents.
  --
  -- THE GRIND CAP is play_grant_daily_cap per device per calendar day, enforced by SUMMING THE
  -- LEDGER rather than by trusting a counter — the ledger is the same source the payout writes
  -- to, so the cap cannot drift from what was actually paid. It is also PARTIAL: a hand that
  -- crosses the ceiling is paid the remainder, not refused, so the last hand of the day still
  -- settles normally. Three further ceilings already sit above it: econ_rate_ok throttles call
  -- volume, the +/-10,000 clamp bounds any single hand, and hand_net is capped at 20,000/day.
  IF v_grant_base > 0 AND v_grant_cap > 0 AND p_hand_id IS NOT NULL THEN
    v_grant := CASE WHEN p_is_practice
                    THEN floor(v_grant_base * v_grant_pct / 100.0)::int
                    ELSE v_grant_base END;
    SELECT COALESCE(SUM(amount), 0) INTO v_granted_today
    FROM chip_transactions
    WHERE device_id = p_device_id AND event_type = 'play_grant'
      AND created_at >= date_trunc('day', now());
    v_grant_paid := LEAST(v_grant, GREATEST(0, v_grant_cap - v_granted_today));
    IF v_grant_paid > 0 THEN
      INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description, reference_id)
      VALUES (v_user_id, p_device_id, v_grant_paid, 'play_grant', 'credit',
              CASE WHEN p_is_practice THEN 'play grant (practice)' ELSE 'play grant' END, p_hand_id)
      ON CONFLICT (device_id, reference_id) WHERE event_type = 'play_grant' AND reference_id IS NOT NULL
      DO NOTHING;
      IF NOT FOUND THEN
        v_grant_paid := 0; v_grant_reason := 'already_granted_for_this_hand';
      END IF;
    ELSE
      v_grant_reason := 'play_grant_cap_daily';
    END IF;
  END IF;

  -- gross hand_net ledger row (idempotent on device_id+reference_id)
  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description, reference_id)
  VALUES (v_user_id, p_device_id, v_net, 'hand_net',
          CASE WHEN v_net >= 0 THEN 'credit' ELSE 'debit' END, 'hand net ' || v_net, p_hand_id)
  ON CONFLICT (device_id, reference_id) WHERE event_type = 'hand_net' AND reference_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_tx_id;

  IF p_hand_id IS NOT NULL AND v_tx_id IS NULL THEN
    -- Duplicate hand. The grant above is separately idempotent, so a replay pays neither.
    SELECT total_chips INTO v_new FROM leaderboard WHERE device_id = p_device_id;
    UPDATE leaderboard SET total_chips = GREATEST(0, total_chips + v_grant_paid), updated_at = now()
      WHERE device_id = p_device_id AND v_grant_paid > 0;
    IF v_grant_paid > 0 THEN SELECT total_chips INTO v_new FROM leaderboard WHERE device_id = p_device_id; END IF;
    RETURN jsonb_build_object('ok', true, 'net', 0, 'new_balance', COALESCE(v_new, 0),
                              'duplicate', true, 'play_grant', v_grant_paid);
  END IF;

  -- SINK: house rake on winnings only, config-driven. UNCHANGED — not touched by this sprint.
  SELECT COALESCE((value #>> '{}')::numeric, 0) INTO v_rake_pct FROM app_config WHERE key = 'hand_rake_pct';
  IF v_net > 0 AND COALESCE(v_rake_pct, 0) > 0 THEN
    v_rake := floor(v_net * v_rake_pct / 100.0);
    IF v_rake > 0 THEN
      INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description, reference_id)
      VALUES (v_user_id, p_device_id, -v_rake, 'rake', 'debit', 'house rake ' || v_rake, p_hand_id);
    END IF;
  END IF;
  -- The rake is taken on WINNINGS ONLY, so the grant is deliberately outside it: a grant for
  -- finishing a hand is not winnings, and raking it would quietly undo part of the change.
  v_credit := v_net - v_rake + v_grant_paid;

  INSERT INTO leaderboard (device_id, player_name, total_chips, updated_at)
  VALUES (p_device_id, 'Player', GREATEST(0, v_credit), now())
  ON CONFLICT (device_id) DO UPDATE
    SET total_chips = GREATEST(0, leaderboard.total_chips + v_credit), updated_at = now()
  RETURNING total_chips INTO v_new;

  RETURN jsonb_build_object('ok', true, 'new_balance', v_new, 'net', v_net, 'rake', v_rake,
                            'play_grant', v_grant_paid, 'play_grant_reason', v_grant_reason,
                            'practice', p_is_practice,
                            'clamped', (v_net <> COALESCE(p_net, 0)));
END; $fn$;

-- The original 3-argument signature, preserved for every existing caller, delegating so there is
-- one implementation rather than two that can drift apart.
-- p_hand_id KEEPS ITS DEFAULT NULL — the live function has one, and Postgres refuses to drop a
-- parameter default via CREATE OR REPLACE. Callers that pass two arguments still work.
CREATE OR REPLACE FUNCTION public.record_hand_net(p_device_id text, p_net integer, p_hand_id text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  SELECT public.record_hand_net(p_device_id, p_net, p_hand_id, false);
$fn$;

-- ── THE PRESENCE GRANT, SCALED DOWN ─────────────────────────────────────────────────────────
-- The streak LADDER is kept — its shape is what brings people back — and only its MAGNITUDE is
-- multiplied. That is one knob to retune instead of seven, and it cannot accidentally invert the
-- ladder's order.
CREATE OR REPLACE FUNCTION public.claim_daily_streak(p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_streak player_streaks;
  v_today date := CURRENT_DATE;
  v_reward bigint;
  v_base bigint;
  v_mult numeric := COALESCE((SELECT (value #>> '{}')::numeric FROM app_config WHERE key='presence_grant_multiplier'), 1.0);
  v_new_streak integer;
  v_shield_used boolean := false;
  v_days_since_login integer;
  v_user_id uuid;
BEGIN
  PERFORM public.econ_authz_probe('claim_daily_streak', p_device_id);
  IF NOT public.econ_rate_ok(p_device_id) THEN RETURN jsonb_build_object('already_claimed', false, 'reward', 0, 'reason', 'rate_limited'); END IF;
  IF NOT public.econ_bind_ok(p_device_id) THEN RETURN jsonb_build_object('already_claimed', false, 'reward', 0, 'reason', 'identity_mismatch'); END IF;

  INSERT INTO player_streaks (device_id, current_streak, last_login_date, total_logins)
  VALUES (p_device_id, 0, NULL, 0) ON CONFLICT (device_id) DO NOTHING;
  SELECT * INTO v_streak FROM player_streaks WHERE device_id = p_device_id;

  IF v_streak.last_login_date = v_today THEN
    RETURN jsonb_build_object(
      'already_claimed', true,
      'current_streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'reward', 0,
      'shield_available', v_streak.current_streak >= 7 AND v_streak.streak_shield_used_at IS NULL,
      'next_reward', floor(CASE
        WHEN v_streak.current_streak + 1 >= 30 THEN 10000
        WHEN v_streak.current_streak + 1 >= 14 THEN 2500
        WHEN v_streak.current_streak + 1 >= 7  THEN 1500
        WHEN v_streak.current_streak + 1 >= 5  THEN 1000
        WHEN v_streak.current_streak + 1 >= 3  THEN 750
        WHEN v_streak.current_streak + 1 >= 2  THEN 600
        ELSE 500 END * v_mult)
    );
  END IF;

  v_days_since_login := CASE WHEN v_streak.last_login_date IS NULL THEN NULL
                             ELSE (v_today - v_streak.last_login_date)::integer END;

  IF v_streak.current_streak >= 7 AND v_days_since_login = 2 AND v_streak.streak_shield_used_at IS NULL THEN
    v_new_streak := v_streak.current_streak + 1; v_shield_used := true;
  ELSIF v_streak.last_login_date IS NULL OR v_days_since_login = 1 THEN
    v_new_streak := COALESCE(v_streak.current_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_base := CASE
    WHEN v_new_streak >= 30 THEN 10000
    WHEN v_new_streak >= 14 THEN 2500
    WHEN v_new_streak >= 7  THEN 1500
    WHEN v_new_streak >= 5  THEN 1000
    WHEN v_new_streak >= 3  THEN 750
    WHEN v_new_streak >= 2  THEN 600
    ELSE 500 END;
  v_reward := floor(v_base * v_mult);

  UPDATE player_streaks
  SET current_streak = v_new_streak,
      longest_streak = GREATEST(longest_streak, v_new_streak),
      last_login_date = v_today,
      total_logins = total_logins + 1,
      streak_shield_used_at = CASE WHEN v_shield_used THEN now() ELSE streak_shield_used_at END,
      updated_at = now()
  WHERE device_id = p_device_id;

  SELECT user_id INTO v_user_id FROM push_tokens WHERE device_id = p_device_id LIMIT 1;
  PERFORM public.ensure_leaderboard_row(p_device_id);
  UPDATE leaderboard SET total_chips = total_chips + v_reward, updated_at = now()
    WHERE device_id = p_device_id;
  INSERT INTO chip_transactions (user_id, device_id, amount, event_type, action, description)
  VALUES (v_user_id, p_device_id, v_reward, 'daily_streak', 'credit',
          'daily streak day ' || v_new_streak || ' (x' || v_mult || ')');

  RETURN jsonb_build_object(
    'already_claimed', false, 'current_streak', v_new_streak,
    'longest_streak', GREATEST(COALESCE(v_streak.longest_streak,0), v_new_streak),
    'reward', v_reward, 'base_reward', v_base, 'multiplier', v_mult,
    'shield_used', v_shield_used);
END; $fn$;

-- ── daily_login: DEAD, AND ALREADY SEALED — NOTHING TO DO ───────────────────────────────────
-- 110,850 chips, 13% of everything ever minted, last transaction 2026-07-02 — the day
-- app/(tabs)/index.tsx:858 removed the call ("HOTFIX 2026-07-02 (economy leak)").
--
-- I INTENDED TO ADD A GUARD AND CHECKED FIRST: one already exists, in BOTH earn_chips overloads.
--
--     IF p_event_type IN ('daily_login', 'daily_reward') THEN
--       RETURN ... 'gated', p_event_type || '_retired';
--
-- So it is dead by a GUARD, not merely by the absence of a caller, and a future caller cannot
-- reopen it by typing the string. Writing the guard I planned would have replaced a working
-- function with a worse one. NOTHING IS CHANGED HERE.
--
-- The 110,850 already minted are NOT reversed, and no balance is adjusted.
-- (Note: that gate blocks the earn_chips ROUTE only. claim_daily_reward is a separate function
-- and still pays — its last transaction is today. It is 2% of the faucet and is left alone.)

COMMENT ON FUNCTION public.record_hand_net(text, integer, text, boolean) IS
  'THE ONE CHIP WRITER FOR PLAY. Settles the hand AND pays the play grant, so a grant cannot '
  'become a second writer. Knobs live in app_config: play_grant_per_hand, play_grant_practice_pct, '
  'play_grant_daily_cap. Guards: econ_authz_probe, econ_rate_ok, econ_bind_ok, +/-10000 clamp, '
  '20000/day hand_net ceiling, per-hand idempotency on (device_id, reference_id) for BOTH the '
  'settlement row and the grant row.';
