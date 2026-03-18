-- User profiles: linked to Supabase auth, syncs local game state
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  display_name text,
  avatar_url text,
  chips integer DEFAULT 500,
  total_played integer DEFAULT 0,
  total_won integer DEFAULT 0,
  best_win integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: users can only read/write their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can upsert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);
