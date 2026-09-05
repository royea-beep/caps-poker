-- CAPS · TESTER ROUND — the five numbers, as SQL. 2026-09-05 (VAMOS TESTER-READINESS §2)
--
-- NOT a dashboard. These are the DEFINITIONS, so the round is measured the same way twice and
-- nobody re-derives them under pressure while testers are playing. Run them by hand.
--
-- Join key is analytics_events.device_id. user_id is NOT usable: over the last month only 13
-- distinct user_ids appear across 209 devices, because anonymous auth does not carry a stable
-- identity into the events table.
--
-- Two exclusions apply to every query:
--   1. v_automation_devices — the harness device list.
--   2. properties->>'webdriver' = 'true' — self-reported automation. Present on events emitted by
--      bundles since ~Aug 2026 (2158 of 2892 events since 2026-08-01 carry the key; 339 of those
--      say true). Historical rows without the key cannot be filtered this way.

-- ── shared filter ────────────────────────────────────────────────────────────────────────────
--   WHERE device_id IS NOT NULL
--     AND device_id NOT IN (SELECT device_id FROM v_automation_devices)
--     AND coalesce(properties->>'webdriver','false') <> 'true'

-- 1 · INSTALLS (arrivals). DERIVABLE. Counts device_ids whose first app_opened lands in the
--     window. On web a device_id is per-browser-profile localStorage, so clearing site data or
--     switching browser mints a new one: this OVER-counts arrivals and UNDER-counts returns.
SELECT count(*) AS arrivals FROM (
  SELECT device_id, min(created_at)::date d0
  FROM analytics_events
  WHERE event_name = 'app_opened' AND device_id IS NOT NULL
    AND device_id NOT IN (SELECT device_id FROM v_automation_devices)
    AND coalesce(properties->>'webdriver','false') <> 'true'
  GROUP BY 1) f
WHERE f.d0 BETWEEN :round_start AND :round_end;

-- 2 · FIRST HAND PLAYED. DERIVABLE. Use hand_dealt, not hand_completed: hand_completed only fires
--     on /results, so anyone who quits mid-hand is invisible to it (285 devices dealt a hand,
--     88 ever completed one). game_started is once-per-session since 2026-08-17 (eb79ae1) and is
--     a session count, not a hand count.
SELECT count(DISTINCT device_id) AS players_who_played
FROM analytics_events
WHERE event_name = 'hand_dealt' AND device_id IS NOT NULL
  AND device_id NOT IN (SELECT device_id FROM v_automation_devices)
  AND coalesce(properties->>'webdriver','false') <> 'true'
  AND created_at::date BETWEEN :round_start AND :round_end;

-- 3 · HANDS PER PLAYER. DERIVABLE. Report the MEDIAN, not the mean — the all-time mean is 2.9
--     and the median is 2 because one device has 198 hands.
WITH d AS (
  SELECT device_id, count(*) hands FROM analytics_events
  WHERE event_name = 'hand_dealt' AND device_id IS NOT NULL
    AND device_id NOT IN (SELECT device_id FROM v_automation_devices)
    AND coalesce(properties->>'webdriver','false') <> 'true'
    AND created_at::date BETWEEN :round_start AND :round_end
  GROUP BY 1)
SELECT count(*) players, sum(hands) hands, round(avg(hands),1) mean,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY hands) median, max(hands) max FROM d;

-- 4 · DAY-2 RETURN. DERIVABLE — this is the round's one question.
--     d0 = first app_opened (it fires on every Home mount, so it marks a session start).
--     Return = ANY event on d0+1, not app_opened specifically: a player who deep-links straight
--     into /game never mounts Home and would be missed by the narrower test.
--     Cohorts whose d0 is younger than 2 days have not had their day 2 yet — excluded.
WITH first_seen AS (
  SELECT device_id, min(created_at)::date d0 FROM analytics_events
  WHERE event_name = 'app_opened' AND device_id IS NOT NULL
    AND device_id NOT IN (SELECT device_id FROM v_automation_devices)
    AND coalesce(properties->>'webdriver','false') <> 'true'
  GROUP BY 1),
ret AS (
  SELECT f.device_id, f.d0,
    EXISTS (SELECT 1 FROM analytics_events e WHERE e.device_id = f.device_id
              AND e.created_at::date = f.d0 + 1) AS d1,
    EXISTS (SELECT 1 FROM analytics_events e WHERE e.device_id = f.device_id
              AND e.event_name = 'hand_dealt') AS played
  FROM first_seen f
  WHERE f.d0 BETWEEN :round_start AND :round_end AND f.d0 <= CURRENT_DATE - 2)
SELECT count(*) cohort, count(*) FILTER (WHERE played) ever_played,
       count(*) FILTER (WHERE d1) returned_day2,
       count(*) FILTER (WHERE played AND d1) played_and_returned,
       round(100.0 * count(*) FILTER (WHERE d1) / nullif(count(*),0), 1) pct_day2
FROM ret;

-- 5 · EVER REACHED MULTIPLAYER. DERIVABLE, but read the four steps separately — they are four
--     different things and only the last one means "played a hand against a human".
--       lobby_opened     → saw the lobby
--       table_joined     → sat down
--       mp_game_started  → the TABLE started (fired from app/lobby/table.tsx, not from a hand)
--       mp_game_ended    → a multiplayer HAND resolved on their screen
SELECT count(DISTINCT device_id) FILTER (WHERE event_name = 'lobby_opened')    opened_lobby,
       count(DISTINCT device_id) FILTER (WHERE event_name = 'table_joined')    joined_table,
       count(DISTINCT device_id) FILTER (WHERE event_name = 'mp_game_started') table_started,
       count(DISTINCT device_id) FILTER (WHERE event_name = 'mp_game_ended')   finished_mp_hand
FROM analytics_events
WHERE device_id IS NOT NULL
  AND device_id NOT IN (SELECT device_id FROM v_automation_devices)
  AND coalesce(properties->>'webdriver','false') <> 'true'
  AND created_at::date BETWEEN :round_start AND :round_end;

-- ── NOT DERIVABLE ────────────────────────────────────────────────────────────────────────────
-- · WIN / LOSS / TIE IN MULTIPLAYER. mp_game_ended carries only `won: myDelta > 0`. A tie makes
--   myDelta 0, so BOTH players are recorded won:false. 19 of the 55 mp_game_ended rows ever
--   written are net_chips 0 + won:false, including both seats of room JER9 on 2026-08-20 — one
--   2-player, 4-board hand where the table says nobody won. Solo was fixed for this on
--   2026-08-23 (results.tsx now sends `outcome: win|tie|loss` beside `won`); multiplayer was not.
--   Until multiplayer sends `outcome`, do not report a multiplayer win rate from this table.
-- · A RETURN ON A DIFFERENT BROWSER OR DEVICE. New device_id, counted as a new arrival.
-- · WHY SOMEONE LEFT. stuck_dwell / rage_tap / screen_abandon exist and fire, but they are
--   signals to go and look at a screen, not an answer.
