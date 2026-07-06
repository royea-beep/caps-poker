-- PENDING (strategist to apply) — AUTO-LEARN 2026-07-06
-- Read-only reporting views over analytics_events for the 4 new passive friction
-- signals (rage_tap, screen_abandon, stuck_dwell, error_boundary_hit). No writes,
-- no new tables — analytics_events already exists and the client now populates it.
-- Safe to run any time; these are pure SELECT-based views.

-- ─── 1. Top rage-tap targets ────────────────────────────────────────────────────
-- Buckets by screen + a 50px coordinate grid cell so the SAME dead button clusters
-- together across different device sizes (raw pixel coords differ per device).
CREATE OR REPLACE VIEW top_rage_tap_targets AS
SELECT
  screen,
  (round((properties->>'x')::numeric / 50) * 50)::int AS x_bucket,
  (round((properties->>'y')::numeric / 50) * 50)::int AS y_bucket,
  COUNT(*) AS rage_tap_count,
  COUNT(DISTINCT device_id) AS distinct_devices,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen
FROM analytics_events
WHERE event_name = 'rage_tap'
GROUP BY screen, x_bucket, y_bucket
ORDER BY rage_tap_count DESC;

-- ─── 2. Top abandon screens ─────────────────────────────────────────────────────
-- Screens users bounce off within 3s of arriving with zero interaction.
CREATE OR REPLACE VIEW top_abandon_screens AS
SELECT
  screen,
  COUNT(*) AS abandon_count,
  COUNT(DISTINCT device_id) AS distinct_devices,
  ROUND(AVG((properties->>'dwellMs')::numeric)) AS avg_dwell_ms,
  MAX(created_at) AS last_seen
FROM analytics_events
WHERE event_name = 'screen_abandon'
GROUP BY screen
ORDER BY abandon_count DESC;

-- ─── 3. Top stuck screens ───────────────────────────────────────────────────────
-- Screens where users sit 30s+ with zero interaction — "I don't know what to do here."
CREATE OR REPLACE VIEW top_stuck_screens AS
SELECT
  screen,
  COUNT(*) AS stuck_count,
  COUNT(DISTINCT device_id) AS distinct_devices,
  MAX(created_at) AS last_seen
FROM analytics_events
WHERE event_name = 'stuck_dwell'
GROUP BY screen
ORDER BY stuck_count DESC;

-- ─── 4. Bonus: error boundary hits by screen ────────────────────────────────────
-- Separate from crash_reports (which exists for triage) — this is the lightweight
-- "how often, where" view that sits alongside the other 3 friction signals.
CREATE OR REPLACE VIEW top_error_boundary_screens AS
SELECT
  screen,
  properties->>'message' AS error_message,
  COUNT(*) AS hit_count,
  COUNT(DISTINCT device_id) AS distinct_devices,
  MAX(created_at) AS last_seen
FROM analytics_events
WHERE event_name = 'error_boundary_hit'
GROUP BY screen, properties->>'message'
ORDER BY hit_count DESC;

-- ─── 5. One-query "friction heatmap" — everything above, unioned ───────────────
-- The single query a strategist runs for "what's breaking, where" without knowing
-- the 4 separate views exist.
CREATE OR REPLACE VIEW friction_heatmap AS
SELECT 'rage_tap' AS signal, screen, rage_tap_count AS count, distinct_devices, last_seen
FROM top_rage_tap_targets
UNION ALL
SELECT 'screen_abandon' AS signal, screen, abandon_count AS count, distinct_devices, last_seen
FROM top_abandon_screens
UNION ALL
SELECT 'stuck_dwell' AS signal, screen, stuck_count AS count, distinct_devices, last_seen
FROM top_stuck_screens
UNION ALL
SELECT 'error_boundary_hit' AS signal, screen, hit_count AS count, distinct_devices, last_seen
FROM top_error_boundary_screens
ORDER BY count DESC;

-- Usage:
--   SELECT * FROM friction_heatmap LIMIT 20;                      -- the whole picture
--   SELECT * FROM top_rage_tap_targets LIMIT 10;                  -- dead/confusing controls
--   SELECT * FROM top_abandon_screens LIMIT 10;                   -- screens that look broken
--   SELECT * FROM top_stuck_screens LIMIT 10;                     -- screens with unclear next-step
--   SELECT * FROM top_error_boundary_screens LIMIT 10;            -- render crashes by screen
