-- ============================================================================================
-- ONE SOURCE FOR "WHAT BUILD IS LIVE", AND IT IS THE DEVICES.
--
-- THE INCIDENT. Six readers reported build 471 while Roye's phone ran 508. The nightly digest
-- said 471 on 123 consecutive nights, from 2026-04-28 through 2026-08-28. Five sources existed
-- and four were wrong:
--
--     app_config.current_build        465
--     app_config.next_build_number    466
--     build_history / get_current_build()  471
--     app.json ios.buildNumber        508
--     the phone                       508     <- the only true one
--
-- build_history was hand-fed by a person running register_build() after each build. Nothing
-- automated ever wrote it — no caller exists in the repo or in any of its 1,418 commits — so
-- when the practice stopped during the May pipeline migrations, the table simply stopped. IT
-- KEPT ANSWERING. That is the whole failure: a table that stops being written still returns a
-- row, with no indication that the row is four months old.
--
-- It was worse than stale. get_current_build() ordered by BUILD_NUMBER, and build numbers are
-- not monotonic in time because two profiles shared the column — so it returned a testflight row
-- from 2026-04-27 (#471) in preference to the newest row in its own table (#451, 2026-05-08).
--
-- ── WHY DEVICE TELEMETRY AND NOT app.json ──────────────────────────────────────────────────
-- app.json is a build INPUT. It says what the next build will be numbered, not what anyone is
-- running; it is already 509 the moment someone bumps it, days before that build exists. The
-- database cannot read it anyway.
--
-- The app has been reporting Application.nativeBuildVersion as `native_build` on every analytics
-- event since 2026-08-09. THE DATABASE HAS KNOWN THE TRUE BUILD FOR NINETEEN DAYS while five
-- sources reported otherwise. That is ground truth in the Iron Rule #9 sense: not a number
-- someone typed, but what installed binaries actually report about themselves.
--
-- ── THE PROPERTY THAT MATTERS ──────────────────────────────────────────────────────────────
-- This CANNOT silently go stale, because it is derived rather than maintained. If nobody
-- updates it, it still tracks reality. And when it has nothing to go on it says so and returns
-- NULL rather than a number — a reader that prints "unknown" is recoverable; one that prints a
-- confident wrong number is what cost this project a sprint.
-- ============================================================================================

-- ── THE AUTHORITATIVE SOURCE ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_live_build()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reported AS (
    -- Only real numerics. A malformed property must not become a build number.
    SELECT (properties->>'native_build')::bigint AS build,
           properties->>'native_version'         AS version,
           created_at,
           device_id
    FROM analytics_events
    WHERE properties->>'native_build' ~ '^[0-9]{1,9}$'
      AND created_at > now() - interval '90 days'
  ),
  top AS (
    -- HIGHEST build seen, not most-recently-seen: a tester opening an old install must not drag
    -- the answer backwards. Builds only ever roll forward.
    SELECT build,
           max(version)                AS version,
           max(created_at)             AS last_seen_at,
           count(*)                    AS events,
           count(DISTINCT device_id)   AS devices
    FROM reported
    GROUP BY build
    ORDER BY build DESC
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT jsonb_build_object(
       'build_number', t.build,
       'version',      t.version,
       'source',       'device telemetry (analytics_events.native_build)',
       'devices',      t.devices,
       'events',       t.events,
       'last_seen_at', t.last_seen_at,
       -- A FRESHNESS FLAG, so a reader can say "stale" instead of answering confidently. This is
       -- the guard build_history never had.
       'stale',        (t.last_seen_at < now() - interval '14 days'),
       'note',         CASE WHEN t.last_seen_at < now() - interval '14 days'
                            THEN 'no device has reported this build in over 14 days'
                            ELSE NULL END
     ) FROM top t),
    -- NO TELEMETRY AT ALL: say so. Never guess, never fall back to build_history.
    jsonb_build_object(
      'build_number', NULL,
      'version',      NULL,
      'source',       'device telemetry (analytics_events.native_build)',
      'devices',      0,
      'events',       0,
      'last_seen_at', NULL,
      'stale',        true,
      'note',         'no device has reported a native build in the last 90 days'
    )
  );
$$;

COMMENT ON FUNCTION public.get_live_build() IS
  'THE authoritative answer to "what build is live". Derived from what installed binaries report '
  '(Application.nativeBuildVersion -> analytics_events.native_build), so it cannot go stale the '
  'way build_history did. Returns build_number NULL with a note when there is no telemetry — '
  'never a guess. Every other build reader delegates here.';

-- ── READER 1: get_current_build() ───────────────────────────────────────────────────────────
-- WAS: SELECT ... FROM build_history WHERE status='live' ORDER BY build_number DESC LIMIT 1
--      -> 471, a testflight row from 2026-04-27, eleven days older than its own table's newest.
-- The key shape is preserved so get_live_dashboard() and get_caps_launch_dashboard() — which
-- both call this — keep working unchanged. The changelog fields now come from build_history only
-- when it happens to hold a row for the live build; they are decoration, and NULL is honest.
CREATE OR REPLACE FUNCTION public.get_current_build()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_live_build()
      || jsonb_build_object(
           'status',       CASE WHEN (public.get_live_build()->>'build_number') IS NULL
                                THEN 'unknown' ELSE 'live' END,
           'platform',     'ios',
           'features',     COALESCE(b.features, '[]'::jsonb),
           'fixes',        COALESCE(b.fixes, '[]'::jsonb),
           'changelog_he', b.changelog_he,
           'commits',      COALESCE(b.commits, '[]'::jsonb),
           'deployed_at',  b.deployed_at,
           'known_issues', COALESCE(b.known_issues, '[]'::jsonb),
           -- Named so nobody re-derives where the number came from.
           'build_history_row_found', (b.build_number IS NOT NULL)
         )
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT * FROM build_history
    WHERE build_number = (public.get_live_build()->>'build_number')::bigint
    ORDER BY started_at DESC NULLS LAST LIMIT 1
  ) b ON true;
$$;

-- ── READER 2: get_build_changelog() ─────────────────────────────────────────────────────────
-- TWO defects, not one:
--   1. 'current' came from the same wrong ORDER BY build_number.
--   2. p_limit WAS INERT. `SELECT jsonb_agg(...) FROM build_history LIMIT p_limit` applies the
--      LIMIT to the AGGREGATE — one row — so it limited 1 row to N and did nothing. Verified:
--      get_build_changelog(5) returned all 46 rows. The LIMIT now sits in a subquery where it
--      selects rows, and ordering is by started_at, not by a column that ran two series.
CREATE OR REPLACE FUNCTION public.get_build_changelog(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'current', (public.get_live_build()->>'build_number'),
    'current_source', 'device telemetry — NOT build_history',
    -- Stated in the payload so a consumer cannot mistake this list for a current record.
    'build_history_note',
      'build_history has not been written since 2026-05-08; builds 452-508 are absent. '
      'Historical only. Read it by started_at, never by build_number: two profiles shared that column.',
    'builds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'build', build_number, 'version', version, 'status', status,
        'features', features, 'fixes', fixes, 'changelog_he', changelog_he,
        'commits', commits, 'started_at', started_at, 'deployed_at', deployed_at, 'notes', notes
      ) ORDER BY started_at DESC NULLS LAST)
      FROM (SELECT * FROM build_history
            ORDER BY started_at DESC NULLS LAST
            LIMIT GREATEST(p_limit, 1)) rows
    ), '[]'::jsonb)
  );
$$;

-- ── READER 3: run_daily_digest() — the 21:00 job that said 471 for 123 nights ───────────────
CREATE OR REPLACE FUNCTION public.run_daily_digest()
RETURNS jsonb          -- jsonb, not json: CREATE OR REPLACE cannot change an existing return type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'date', CURRENT_DATE - 1,
    'new_devices', (SELECT count(*) FROM user_profiles WHERE created_at::date = CURRENT_DATE - 1),
    'stage_funnel', get_stage_funnel(),
    'top_events', (SELECT jsonb_agg(x) FROM (
        SELECT event_name, count(*) cnt FROM analytics_events
        WHERE created_at::date = CURRENT_DATE - 1
        GROUP BY event_name ORDER BY cnt DESC LIMIT 5) x),
    -- WAS: (SELECT build_number FROM build_history WHERE status='live' ORDER BY build_number DESC LIMIT 1)
    -- which printed 471 every night from 2026-04-28. Now the devices answer, and the digest
    -- carries the freshness flag so a silent room reads as "unknown", not as a number.
    'build', (public.get_live_build()->>'build_number'),
    'build_source', (public.get_live_build()->>'source'),
    'build_stale', (public.get_live_build()->>'stale'),
    'build_devices', (public.get_live_build()->>'devices'),
    'smoke', (SELECT (smoke_test_caps())->>'score')
  ) INTO v_result;

  INSERT INTO analytics_events (event_name, properties, screen)
  VALUES ('daily_digest', v_result, 'system');

  RETURN v_result;
END;
$$;

-- ── READER 4: get_daily_digest() — the 06:00 Hebrew morning message ─────────────────────────
-- Applied separately as 20260828120100_morning_digest_build_from_devices.sql: it returns `json`
-- and its body is long, so it is replaced whole there rather than half-rewritten here.

-- ── READER 5: auto_dismiss_stale_crashes() — STRUCTURALLY BROKEN, MADE FAIL-SAFE ────────────
-- This one is NOT merely pointed at a stale number. Its matching rule is:
--
--     EXISTS (SELECT 1 FROM build_history b WHERE b.version = c.version
--                                             AND b.build_number <= v_cutoff_build)
--
-- It joins builds to crashes on `version` — a MARKETING STRING. crash_reports has no build
-- column at all (columns: version, status, pipeline_last_status). Every build_history row is
-- version '2.7.0', so ANY 2.7.0 crash matches as long as SOME 2.7.0 build sits below the cutoff
-- — and dozens do. It is a version-wide sweep wearing a build-level cutoff.
--
-- That is inert today only because zero crashes sit in the open statuses (349 rows, all
-- dismissed or fixed). But a BRAND-NEW crash from build 509 would match on version '2.7.0' and
-- be auto-dismissed on the very next nightly run. Repointing the number does not fix that; it
-- arms it.
--
-- SO IT FAILS SAFE. It dismisses only when a crash can be tied to an ACTUAL build below the
-- cutoff, which no column currently allows — so it becomes an explicit no-op that reports why,
-- instead of a sweep that quietly closes new reports. Nothing is destroyed either way: it
-- dismissed nothing before this change and dismisses nothing after it.
CREATE OR REPLACE FUNCTION public.auto_dismiss_stale_crashes(p_supersede_threshold int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_build         jsonb := public.get_live_build();
  v_current_build bigint := (v_build->>'build_number')::bigint;
  v_cutoff_build  bigint;
  v_blocked       text := NULL;
BEGIN
  IF v_current_build IS NULL THEN
    v_blocked := 'no live build known from device telemetry';
  ELSIF (v_build->>'stale')::bool THEN
    v_blocked := 'live build is stale (' || COALESCE(v_build->>'note','') || ')';
  ELSE
    v_cutoff_build := v_current_build - p_supersede_threshold;
    -- crash_reports carries no build number. Until it does, there is no honest way to decide
    -- that a given crash belongs to a superseded build, and guessing from the marketing version
    -- would close reports from the CURRENT build.
    v_blocked := 'crash_reports has no build column; matching on `version` would dismiss '
              || 'reports from the current build. Refusing to guess.';
  END IF;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'current_live_build', v_current_build,
    'build_source', v_build->>'source',
    'cutoff_build', v_cutoff_build,
    'threshold', p_supersede_threshold,
    'dismissed', 0,
    'blocked_reason', v_blocked,
    'still_open', (SELECT COUNT(*) FROM crash_reports
                    WHERE status IN ('new','needs_human','auto_fixing','fixing'))
  );
END;
$$;

-- ── THE DEAD KEYS AND THE DEAD TABLE, LABELLED IN PLACE ─────────────────────────────────────
-- NOT backfilled and NOT deleted, per the brief. The cutoff is recorded so the next reader
-- cannot repeat this. app_config.current_build / next_build_number keep their values (465/466)
-- deliberately: writing 508 into them would recreate exactly the trap that produced this
-- incident — a hand-maintained number that looks authoritative and goes stale in a week.
COMMENT ON TABLE public.build_history IS
  'HISTORICAL ONLY — DO NOT READ FOR CURRENT STATE. Last written 2026-05-08. Builds 452-508 are '
  'absent: nothing ever wrote this table automatically, a person ran register_build() by hand and '
  'stopped during the May 2026 pipeline migrations. NOT backfilled — the gap is recorded, not '
  'invented. Read it BY started_at, never by build_number: the testflight and production profiles '
  'ran independent number series, so max(build_number) and max(started_at) are different rows. '
  'For the live build use get_live_build().';

INSERT INTO app_config (key, value)
VALUES ('build_source_of_truth',
        '"get_live_build() — device telemetry. build_history is historical only (gap 452-508, cutoff 2026-05-08). app_config.current_build (465) and next_build_number (466) are DEAD hand-maintained keys; no reader uses them."'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
