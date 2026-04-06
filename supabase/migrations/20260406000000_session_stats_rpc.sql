-- RPC: session stats for last 7 days (used by Telegram /status command)
CREATE OR REPLACE FUNCTION get_session_stats_7d()
RETURNS TABLE(total_sessions bigint, unique_testers bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::bigint AS total_sessions,
    COUNT(DISTINCT from_number)::bigint AS unique_testers
  FROM whatsapp_sessions
  WHERE created_at > NOW() - INTERVAL '7 days';
$$;
