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

WITH sessions AS (
  SELECT
    e.device_id,
    e.properties->>'session_id'                                  AS session_id,
    MAX((e.properties->>'placed_index')::int)                    AS max_placed,   -- MAX, deliberately
    MAX((e.properties->>'total_required')::int)                  AS total_required,
    MAX((e.properties->>'board_count')::int)                     AS board_count,
    BOOL_OR(e.properties->>'source' = 'auto')                    AS used_auto,
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
