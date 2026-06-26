-- VAMOS-CAPS-LOBBY-V2-CLIENT — TASK D: ACTIVATION (owner-gated, apply at deploy ONLY)
--
-- ⚠️  DO NOT APPLY until the V2 lobby client is LIVE.
--
-- The seeded public tables are HOSTLESS (host_id NULL, current_players 0). The OLD
-- deployed client browses via list_open_tables() (which returns public tables too) and
-- decides host/guest from a route param it hardcodes to "guest" — so it cannot host a
-- hostless table and would hang. Only the V2 client reads join_table.is_host to make the
-- first joiner the host. Therefore: ship the V2 client first, THEN apply this migration.
--
-- Backend RPCs (already live on gxrpunvhjcrzqnitbqah, built by the strategist):
--   ensure_public_lobby()  — tops the pool up to 2 'waiting' public tables per type (2/3/4)
--   list_public_tables()   — browse the pool
--   join_table()           — first joiner of a hostless public table becomes host (is_host)
--   leave_table()          — public tables never abandon; host-leave clears host_id
--
-- This migration: (1) enables pg_cron, (2) schedules ensure_public_lobby() every minute
-- to self-heal the pool, (3) seeds the pool once immediately. Idempotent.

-- 1) pg_cron (Supabase-managed; safe no-op if already enabled).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Self-heal schedule: replenish the pool every minute. ensure_public_lobby() only
--    creates what is missing, so this is cheap and idempotent. Unschedule any prior copy
--    first so re-applying does not stack duplicate jobs.
DO $$
BEGIN
  PERFORM cron.unschedule('caps-ensure-public-lobby')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'caps-ensure-public-lobby');
  PERFORM cron.schedule('caps-ensure-public-lobby', '* * * * *', 'SELECT public.ensure_public_lobby();');
END $$;

-- 3) Seed now so the lobby is populated the moment the client goes live.
SELECT public.ensure_public_lobby();
