-- Allow anonymous reads on bug_reports for the bug dashboard
-- Dashboard at caps.ftable.co.il/bugs/ reads directly from Supabase
CREATE POLICY "anon_read_bugs"
  ON bug_reports
  FOR SELECT
  USING (true);
