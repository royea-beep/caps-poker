-- CLOSE-THE-LEAKS 2026-08-31 — the ELO ladder stops leaking auth uuids and real names.
--
-- ═══ WHAT THE RED-TEAM PULLED ════════════════════════════════════════════════════════════════
-- get_elo_leaderboard returned, to anyone holding the public anon key:
--     {"user_id": "d0cc66b9-…", "name": "Roye Arguan", …}
--     {"user_id": "ab1b7383-…", "name": "Avi Avitan",  …}
-- Two leaks in one payload: the auth.users uuid (the join key to everything a user owns) and the
-- real full name from user_profiles.display_name (a Google sign-in name).
--
-- ═══ THE FIX — MATCH THE NORMAL LEADERBOARD, DO NOT INVENT A NEW SHAPE ═══════════════════════
-- get_leaderboard already does this right: it never returns a device id or a uuid, and it shows
-- `leaderboard.player_name` — the chosen handle — not the real name. This makes the ELO ladder
-- expose EXACTLY what the normal board exposes and nothing more:
--   · user_id is DROPPED. An auth uuid must never cross a public surface — it is also what made the
--     leave_table kick-a-signed-in-player chain possible (closed in 20260831220000).
--   · the name is now COALESCE(player_name, 'Player') from the same leaderboard row the normal
--     board reads, and the user_profiles join (the source of the real name) is removed entirely.
--
-- ⚠️ REAL NAMES ON THE LADDER ARE ROYE'S CALL — SURFACED, NOT DECIDED HERE.
-- This migration removes the real name because the instruction was to match the normal-board
-- pattern, and that pattern shows the chosen handle. If Roye wants a real-name "serious" ELO ladder,
-- that is a deliberate product choice he can make — the options are:
--   (a) chosen handle only (what this ships; matches the normal board; no PII).
--   (b) real name shown, user_id still dropped (identity on the ladder, but not the account key).
--   (c) a dedicated ladder display-name players opt into.
-- The uuid comes out in every case; only the name question is his.
--
-- Signature, return keys (minus user_id), ordering and the elo_games>0 filter are otherwise
-- unchanged, so the client that renders this ladder keeps working.

CREATE OR REPLACE FUNCTION public.get_elo_leaderboard(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', COALESCE(l.player_name, 'Player'),
      'elo', ps.elo_rating,
      'peak', ps.elo_peak,
      'games', ps.elo_games,
      'win_rate', CASE WHEN ps.hands_played > 0 THEN ROUND(ps.hands_won::NUMERIC / ps.hands_played * 100, 1) ELSE 0 END
    ) ORDER BY ps.elo_rating DESC)
    FROM player_poker_stats ps
    LEFT JOIN leaderboard l ON l.device_id = (SELECT device_id FROM push_tokens WHERE user_id = ps.user_id LIMIT 1)
    WHERE ps.elo_games > 0
    LIMIT p_limit
  ), '[]'::JSONB);
END;
$function$;

COMMENT ON FUNCTION public.get_elo_leaderboard(integer) IS
  'Public ELO ladder. Returns ONLY chosen handle + elo stats — no user_id, no device_id, no real '
  'name — matching get_leaderboard. Until 2026-08-31 it leaked the auth user_id and the real '
  'display_name to the public anon key (RED-TEAM). Whether real names belong on the ladder is a '
  'product decision; the uuid must never return. See migration 20260831230000.';
