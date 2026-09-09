-- ============================================================================================
-- THE TWO DEAD BUILD KEYS ARE DELETED, NOT CORRECTED.
--
-- app_config.current_build held 465 and next_build_number held 466 while the phone ran 508. The
-- tempting fix is to type 509 into them. THAT WOULD REBUILD THE TRAP: they went wrong because
-- they were hand-maintained numbers that looked authoritative, and a fresh hand-typed number is
-- wrong again the next time anyone builds and forgets. A DELETED KEY CANNOT DISAGREE.
--
-- Verified before deleting: NOTHING reads them. No client code, no CI workflow, and no database
-- function actually selects app_config WHERE key IN ('current_build','next_build_number') —
-- every build reader was repointed at get_live_build() on 2026-08-28.
-- ============================================================================================
DELETE FROM app_config WHERE key IN ('current_build', 'next_build_number');

INSERT INTO app_config (key, value) VALUES
  ('build_source_of_truth',
   '"get_live_build() — device telemetry (analytics_events.native_build). The ONLY source. app_config.current_build and next_build_number were DELETED 2026-08-28 rather than corrected: a hand-typed number is wrong again at the next build. app.json ios.buildNumber is the build INPUT (what the next build will be numbered), not evidence of what anyone runs. build_history is historical only, gap 452-508, cutoff 2026-05-08."'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
