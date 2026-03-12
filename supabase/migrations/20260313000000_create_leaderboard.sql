-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  player_name TEXT NOT NULL DEFAULT 'Player',
  total_chips INTEGER NOT NULL DEFAULT 1000,
  hands_played INTEGER NOT NULL DEFAULT 0,
  hands_won INTEGER NOT NULL DEFAULT 0,
  biggest_win INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone can read (anon key is public, this is a public leaderboard)
CREATE POLICY leaderboard_select ON leaderboard FOR SELECT USING (true);

-- Anyone can insert their own row
CREATE POLICY leaderboard_insert ON leaderboard FOR INSERT WITH CHECK (true);

-- Anyone can update their own row (matched by device_id in app logic)
CREATE POLICY leaderboard_update ON leaderboard FOR UPDATE USING (true);

-- Index for top-N queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_chips ON leaderboard (total_chips DESC);
