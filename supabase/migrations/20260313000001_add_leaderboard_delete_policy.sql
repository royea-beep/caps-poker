-- Allow delete for own rows (matched by device_id in app logic)
CREATE POLICY leaderboard_delete ON leaderboard FOR DELETE USING (true);
