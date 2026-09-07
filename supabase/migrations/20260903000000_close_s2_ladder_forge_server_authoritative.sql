-- VAMOS CAPS — CLOSE-S2 (2026-09-03): close the ladder forge by making the competitive ladder
-- SERVER-AUTHORITATIVE. The hand_history AFTER-INSERT trigger updated leaderboard WHERE
-- device_id = NEW.device_id, and device_id on an incoming row was NEVER validated against the
-- caller. Two anon-reachable forge vectors exploited this (both proven live and on a branch):
--   A) a direct authenticated table insert (user_id = attacker, device_id = victim) — allowed by
--      the users_own_hh RLS policy, which checks user_id but not device_id; and
--   B) record_hand_result_d(p_device_id => victim, p_won => true, p_session_type => 'quick_poker'),
--      a SECURITY DEFINER RPC granted to anon that inserts a row for ANY device_id with no
--      ownership check.
-- Either filed a 'won' row for a victim device and climbed that device's rank (1000 -> 1020).
--
-- FIX: move the ladder ONLY for the service-role writer — the resolve-hand edge function that
-- adjudicates multiplayer and is the only party that can (and must) write a row for a seat that
-- DROPPED. A client-originated row (direct insert OR the record_hand_result_d RPC) carries the
-- caller's anon/authenticated JWT, never service_role, so it still RECORDS the player's own
-- history row — win_rate, hands and the personal history screen are unaffected — but moves the
-- ladder for NO device. The forge therefore moves nothing.
--
-- DELIBERATE, OWNER-APPROVED CONSEQUENCE (Roye, 2026-09-03): solo-vs-bots (quick_poker) no longer
-- moves the competitive ladder. Beating a bot is not a competitive result — the same reason
-- practice already never moved it (the practice guard below stays). Personal history / win_rate /
-- hands keep working. The empty lobby means no device currently climbs until real multiplayer
-- exists; that is accepted — a ladder anyone can forge, or that is earned against bots, is not a
-- ladder.
--
-- auth.role() is the Supabase helper: it reads request.jwt.claims and returns NULL on an unset
-- claim WITHOUT throwing (unlike a raw ::json cast on an empty string), so an internal/no-claim
-- writer also does not move the ladder. It is schema-qualified because the function pins
-- search_path to 'public'.
CREATE OR REPLACE FUNCTION public.tg_hand_history_leaderboard_counters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_delta integer; v_win integer;
BEGIN
  -- CLOSE-S2 — SERVER-AUTHORITATIVE LADDER. Only the service-role writer (resolve-hand) may move
  -- elo / games_played / wins / win_rate. Every client-originated row records history but moves no
  -- ladder, which closes the device_id forge at its projection.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RETURN NULL; END IF;

  -- PRACTICE IS A DELIBERATE EXCLUSION, NOT DRIFT. Practice is XP-only and never touches chips, so
  -- it must not touch the ladder either -- it would let a player climb games_played and ELO without
  -- ever risking anything. THIS LINE is why hand_history (which DOES record practice, for the
  -- player's own history) and the leaderboard (which must not) differ ON PURPOSE. Do not "fix" it
  -- back: the gap between the two counters should be exactly the practice hands, and nothing else.
  IF NEW.session_type = 'practice' THEN RETURN NULL; END IF;
  IF NEW.device_id IS NULL THEN RETURN NULL; END IF;

  -- A TIE IS COUNTABLE AS NEITHER: it moves games_played (a game was played) and nothing else.
  v_delta := CASE NEW.result WHEN 'won' THEN 20 WHEN 'lost' THEN -10 ELSE 0 END;
  v_win   := CASE WHEN NEW.result = 'won' THEN 1 ELSE 0 END;

  UPDATE leaderboard
     SET elo = GREATEST(100, elo + v_delta), elo_last_delta = v_delta,
         games_played = games_played + 1, wins = wins + v_win,
         win_rate = ROUND(100.0 * (wins + v_win) / (games_played + 1))
   WHERE device_id = NEW.device_id;
  RETURN NULL;
END; $function$;
