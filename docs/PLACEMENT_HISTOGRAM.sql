-- PLACEMENT HISTOGRAM — AI2. WRITTEN BEFORE THE DATA ARRIVES, RUN UNCHANGED WHEN THE WEEK IS UP.
-- Committed deliberately so the query cannot be shaped by what we hope to see.
--
-- MINIMUM SAMPLE BEFORE ANY CONCLUSION IS REPORTED: **30 non-test devices reaching hand_dealt.**
-- Below that, report the raw rows and no conclusions. Rationale: the buckets below are 5-wide, and
-- at ~20 devices a single bucket of 3 is noise indistinguishable from a trend. 30 is the point where
-- a 2:1 split between "stalled early" and "finished" stops being a coin flip. It is a floor, not a
-- target — more is better, and the 7-day window may need extending to reach it.
--
-- ⚠️ MAX(placed_index), NEVER last-row-wins. The four Auto-Place emits are independent
-- fire-and-forget track() calls that race, and were observed inserting 6,7,5,4. Values are correct
-- and complete; only arrival order varies. A last-row-wins query would under-report AUTO users
-- specifically — the exact population `source` exists to identify.
--
-- ⚠️ test rows are excluded via the test_devices ALLOWLIST (NOT EXISTS), never by deletion —
-- same mechanism as the tripwires.
--
-- ⚠️ card_removed is SHIPPED BUT UNPROVEN on live. Any churn conclusion drawn from it is
-- unvalidated until a real tap on a placed card is observed.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️⚠️ CORRECTED 2026-08-06 (BB2). THIS FILE WAS LIVE AND WRONG. It was not born right.
--
-- Between 2026-08-01 and 2026-08-06 this query silently under-counted the MOST ENGAGED users.
-- `card_placed` had THREE emit sites but only TWO were instrumented: `handleBoardPress`
-- ('tap', game.tsx:850) and the per-board ⚡ `handleAutoFill` ('auto', game.tsx:918). The
-- THIRD — `autoFillAllBoards` (game.tsx:973), behind the "⚡ Auto-Place ALL" button and the
-- auto-sim driver — emitted NOTHING. Anyone who used that one button produced zero card_placed
-- rows, so the LEFT JOIN below gave them COALESCE(max_placed, 0) = 0 and they landed in the
-- '0 — dealt, never placed' bucket: a one-tap power user, filed as an instant quitter.
--
-- That is the single most damaging failure mode this query has, because the bucket it corrupts
-- is the one any reader will treat as the headline "players give up immediately" number. The
-- defect was invisible in the data — the query returned clean, plausible rows the whole time.
-- It was found by USING the app (clicking the button and watching the DB stay empty), not by
-- reading either the SQL or the client. Lifetime card_placed at the moment of the fix: 15
-- events, 5 devices, all 2026-08-01, all our own probes — ZERO from a real user, ever.
--
-- ✅ FOURTH PATH INSTRUMENTED 2026-08-13 (was: STILL UNINSTRUMENTED). game.tsx:456-468 auto-places
-- the remaining cards when the countdown expires, and now emits card_placed with source:'timeout'.
-- It previously emitted arrangement_timeout ONLY, so the most informative session type — a player
-- placing under time pressure — produced no placement data at all.
--
-- ⚠️ 'timeout' IS DELIBERATELY EXCLUDED FROM used_auto BELOW. A player whose clock ran out did NOT
-- choose Auto-Place; folding them together would repeat the exact 'auto_all' mistake in reverse,
-- inflating the population that "found the button". The string_agg on sources picks 'timeout' up
-- automatically, so the paths stay visible without contaminating the used_auto flag.
--
-- There is NO FIFTH placement path. Verified 2026-08-13 by enumerating every board-state mutation
-- in game.tsx: L465 (timeout fill), L540 (initial deal, not a placement), L569 (bot cards),
-- L869 (tap), L937 (per-board auto), L992 (auto ALL), and L897 — which is
-- handleRemoveCardFromBoard, a REMOVAL, correctly silent. Card removal is entirely unmeasured;
-- that is a known gap, not an oversight in this query.
--
-- (historical) game.tsx:446 auto-placed the remaining cards when
-- the arrangement COUNTDOWN EXPIRES. It emits `arrangement_timeout` (carrying `cards_remaining`)
-- but no `card_placed`. Those sessions therefore STILL bucket as '0 — dealt, never placed'.
-- Until that path is instrumented, cross-check the 0 bucket against `arrangement_timeout`
-- before concluding anything about it. Do not read the 0 bucket as "gave up" on its own.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

WITH sessions AS (
  SELECT
    e.device_id,
    e.properties->>'session_id'                                  AS session_id,
    MAX((e.properties->>'placed_index')::int)                    AS max_placed,   -- MAX, deliberately
    MAX((e.properties->>'total_required')::int)                  AS total_required,
    MAX((e.properties->>'board_count')::int)                     AS board_count,
    -- BB2: 'auto_all' MUST be included here. It is a distinct source value, not a variant of
    -- 'auto' — matching only 'auto' would leave every one-tap Auto-Place-ALL user flagged as a
    -- manual placer, which is the same class of error this file was just corrected for.
    BOOL_OR(e.properties->>'source' IN ('auto', 'auto_all'))     AS used_auto,
    -- Keep the paths separable: per-board ⚡ and one-tap ALL are different user intents.
    string_agg(DISTINCT e.properties->>'source', '+')            AS sources,
    MIN((e.properties->>'ms_since_deal')::int)                   AS ms_to_first_placement,
    MAX((e.properties->>'ms_since_deal')::int)                   AS ms_to_last_placement
  FROM analytics_events e
  WHERE e.event_name = 'card_placed'
    AND e.created_at > now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM test_devices t WHERE t.device_id = e.device_id)
  GROUP BY 1, 2
),
-- Devices that were DEALT a hand but never placed anything have no card_placed rows at all, so they
-- must come from hand_dealt or they vanish from the denominator — which would be the single easiest
-- way to make this look healthy.
dealt AS (
  SELECT d.device_id, d.properties->>'session_id' AS session_id,
         (d.properties->>'board_count')::int      AS board_count
  FROM analytics_events d
  WHERE d.event_name = 'hand_dealt'
    AND d.created_at > now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM test_devices t WHERE t.device_id = d.device_id)
),
joined AS (
  SELECT
    d.device_id, d.session_id,
    COALESCE(s.board_count, d.board_count)   AS board_count,
    COALESCE(s.max_placed, 0)                AS max_placed,
    COALESCE(s.total_required, d.board_count * 4) AS total_required,
    COALESCE(s.used_auto, false)             AS used_auto,
    s.sources,
    s.ms_to_first_placement, s.ms_to_last_placement
  FROM dealt d
  LEFT JOIN sessions s
    ON s.device_id = d.device_id AND s.session_id = d.session_id
)
SELECT
  board_count,
  used_auto,
  CASE
    WHEN max_placed = 0                    THEN '0 — dealt, never placed'
    WHEN max_placed BETWEEN 1 AND 3        THEN '1-3'
    WHEN max_placed BETWEEN 4 AND 8        THEN '4-8'
    WHEN max_placed BETWEEN 9 AND 11       THEN '9-11'
    WHEN max_placed >= total_required      THEN 'ALL placed'
    ELSE '12+ but short of total'
  END                                                          AS bucket,
  COUNT(*)                                                     AS sessions,
  COUNT(DISTINCT device_id)                                    AS devices,
  string_agg(DISTINCT sources, ' | ')                          AS placement_sources,
  ROUND(AVG(ms_to_first_placement) / 1000.0, 1)                AS avg_secs_to_FIRST_placement,
  ROUND(AVG(ms_to_last_placement - ms_to_first_placement) / 1000.0, 1) AS avg_secs_SPENT_placing
FROM joined
GROUP BY 1, 2, 3
ORDER BY board_count, used_auto, bucket;

-- THE QUESTION THIS IS REALLY ASKING, stated up front so the answer is not rationalised later:
-- time-to-FIRST-placement is separated from time SPENT placing on purpose. In the AH1 verification
-- run the first tap came 25.6 SECONDS after the deal — and that was someone who knew exactly what to
-- do. If real players show a similar pre-first-tap stall, the problem is NOT the twelve placements;
-- it is that nobody knows what to do when the hand appears, and the fix is the first ten seconds
-- rather than the workload. A high avg_secs_to_FIRST_placement with a LOW avg_secs_SPENT_placing
-- points at comprehension. The reverse points at workload. Those imply different products.

-- Denominator check — run alongside, never in place of the above.
SELECT COUNT(DISTINCT d.device_id) AS non_test_devices_reaching_hand_dealt
FROM analytics_events d
WHERE d.event_name = 'hand_dealt'
  AND d.created_at > now() - interval '7 days'
  AND NOT EXISTS (SELECT 1 FROM test_devices t WHERE t.device_id = d.device_id);

-- AW1.4 STANDING CONVENTION (added 2026-08-01): every analytics query MUST also exclude automated
-- traffic, not just test devices. Add to BOTH CTEs above:
--     AND coalesce(e.properties->>'webdriver','') <> 'true'
-- Web traffic was found to be substantially headless Chrome (our own Playwright sweeps). This filter
-- only works FORWARD - devices predating the UA capture are permanently unclassifiable.
