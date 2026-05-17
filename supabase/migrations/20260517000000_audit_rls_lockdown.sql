-- Lock down four tables exposed to anon JWT abuse per audit 2026-05-17.
-- Tables had either no RLS or USING(true) policies, allowing anyone holding
-- the anon key (bundled in the iOS app binary) to insert/update/delete rows.

-- 1) chip_transactions: financial integrity. Only allow insert via service role
--    or via a SECURITY DEFINER RPC; no client-direct writes.
ALTER TABLE IF EXISTS public.chip_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chip_transactions_anon_all ON public.chip_transactions;
DROP POLICY IF EXISTS chip_transactions_select_own ON public.chip_transactions;
DROP POLICY IF EXISTS chip_transactions_insert_none ON public.chip_transactions;
CREATE POLICY chip_transactions_select_own ON public.chip_transactions
  FOR SELECT TO authenticated, anon
  USING (user_id IS NOT NULL AND user_id = auth.uid());
-- No INSERT / UPDATE / DELETE policy => denied for anon + authenticated; only service role bypasses.

-- 2) leaderboard: prior migration set USING(true) on all four operations.
ALTER TABLE IF EXISTS public.leaderboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leaderboard_select_all ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_insert_all ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_update_all ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_delete_all ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_anon_all ON public.leaderboard;
DROP POLICY IF EXISTS "Public read access" ON public.leaderboard;
CREATE POLICY leaderboard_public_read ON public.leaderboard
  FOR SELECT TO anon, authenticated USING (true);
-- Writes only through SECURITY DEFINER submit_score RPC.

-- 3) analytics_events: protect funnel integrity.
ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_events_anon_all ON public.analytics_events;
DROP POLICY IF EXISTS analytics_events_insert_any ON public.analytics_events;
-- No client SELECT/INSERT/UPDATE/DELETE policy. Track via the existing track_event RPC,
-- which should be redefined as SECURITY DEFINER if not already.

-- 4) crash_reports: anyone can flip status today.
ALTER TABLE IF EXISTS public.crash_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crash_reports_anon_update ON public.crash_reports;
DROP POLICY IF EXISTS crash_reports_anon_all ON public.crash_reports;
-- No UPDATE policy. SELECT is OK if dashboard reads anonymously; restrict to admin if not.
CREATE POLICY crash_reports_anon_insert ON public.crash_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- After applying: verify with
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('chip_transactions','leaderboard','analytics_events','crash_reports');
-- All four should show rowsecurity = true.
