-- S75: Create bug-recordings storage bucket for expo-av audio uploads
-- Run in Supabase dashboard SQL editor: https://supabase.com/dashboard/project/gxrpunvhjcrzqnitbqah/sql/new

-- Create public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-recordings', 'bug-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anon uploads (internal testers)
CREATE POLICY IF NOT EXISTS "Allow anon uploads bug-recordings" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'bug-recordings');

-- Allow public reads
CREATE POLICY IF NOT EXISTS "Allow public reads bug-recordings" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'bug-recordings');
