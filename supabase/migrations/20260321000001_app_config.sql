CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO app_config (key, value) VALUES
  ('pro_voices_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read, only service_role can write
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON app_config FOR SELECT USING (true);
CREATE POLICY "service_write" ON app_config FOR ALL USING (auth.role() = 'service_role');
