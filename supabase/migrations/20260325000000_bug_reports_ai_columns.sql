-- S74: Add AI triage columns to bug_reports
-- Run in Supabase dashboard SQL editor: https://supabase.com/dashboard/project/gxrpunvhjcrzqnitbqah/sql/new

ALTER TABLE bug_reports
ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;

-- Note: ai_summary and audio_url already exist in this table.

-- Add check constraint on classification
ALTER TABLE bug_reports
DROP CONSTRAINT IF EXISTS bug_reports_classification_check;
ALTER TABLE bug_reports
ADD CONSTRAINT bug_reports_classification_check
  CHECK (classification IN ('RELEVANT', 'UNRELATED', 'PENDING'));

-- Index for dashboard queue filtering
CREATE INDEX IF NOT EXISTS idx_bug_reports_classification ON bug_reports (classification);
CREATE INDEX IF NOT EXISTS idx_bug_reports_needs_review ON bug_reports (needs_review);
