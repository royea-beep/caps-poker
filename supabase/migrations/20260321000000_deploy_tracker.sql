CREATE TABLE IF NOT EXISTS deploy_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL DEFAULT 'caps-poker',
  fix_summary text NOT NULL,
  severity text CHECK (severity IN ('CRITICAL', 'MEDIUM', 'LOW')) NOT NULL,
  session_id uuid,
  committed_at timestamptz DEFAULT now(),
  deployed_at timestamptz DEFAULT NULL
);

ALTER TABLE deploy_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON deploy_tracker
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_deploy_tracker_pending
  ON deploy_tracker (project, deployed_at)
  WHERE deployed_at IS NULL;
