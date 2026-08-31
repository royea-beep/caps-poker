-- PURGE-AND-CLOSE 2026-08-31 — the ten permissive tables, and the ledger's read side.
--
-- ═══ THE PROOF THAT MAKES ALL OF THIS SAFE, STATED ONCE ══════════════════════════════════════
-- Every table below is owned by `postgres` with `relforcerowsecurity = false`. Postgres does not
-- apply RLS to a table's owner unless FORCE is set, so a SECURITY DEFINER function owned by
-- postgres is unaffected by any policy here. That is the same proof that made the chip_transactions
-- fix safe, and it was verified there with a before/after on a development branch and all fifteen
-- writers exercised live. Checked per table rather than assumed: definer writers 8 / 1 / 1 / 1 /
-- 0 / 0 / 0 / 2 across the eight closed below, NON-definer writers ZERO in every one.
--
-- ═══ 1 · analytics_events — THE ONE THAT MATTERS ═════════════════════════════════════════════
-- Prioritised because it is not just telemetry: `econ_bind_ok` reads it to decide whether an
-- anonymous device has continuity with a session, and `v_automation_devices` / `v_harness_devices`
-- read it to decide which devices are real. A table anyone with the public key can write to was
-- deciding who is a player and who is a robot — you could forge continuity to pass the binding
-- guard, or forge human-looking events to hide a device from the purge that just ran.
--
-- SAFE TO CLOSE, checked four ways: the client has ZERO direct `.from('analytics_events')` sites and
-- writes only through the `track_event` RPC (utils/analytics.ts:235), which is SECURITY DEFINER;
-- 12 functions read the table and every one is definer or not anon-callable; the 7 views over it
-- (friction_heatmap, top_stuck_screens, top_abandon_screens, top_rage_tap_targets, v_analytics_human
-- and the two detectors) are postgres-owned, so they keep reading regardless of the base policy.
--
-- The SELECT side goes too. `Public read USING (true)` exposed every device id, screen and session
-- id to anyone holding the anon key — a device-activity feed, the same objection as read_own_tx.
--
-- ═══ 2 · chip_transactions read side ═════════════════════════════════════════════════════════
-- CLOSE-THE-SIX narrowed the WRITE and said plainly that the read was left for a later pass. This
-- is that pass. `read_own_tx FOR SELECT TO public USING (true)` made the entire ledger world-
-- readable: every device's chip history, timestamps included. The 2026-05-17 lockdown intended
-- `user_id = auth.uid()`, and nothing client-side reads this table directly, so it closes to
-- service_role outright rather than to a per-user predicate that would still leak nothing useful
-- to a device-keyed product.
--
-- ═══ 3 · TWO TABLES ARE DELIBERATELY LEFT OPEN, WITH THE EXACT REASON ════════════════════════
-- Not "probably fine" — a named dependency that would break, in each case:
--
--   deploy_log            scripts/deploy-ota.sh:20 POSTs straight to /rest/v1/deploy_log with
--                         EXPO_PUBLIC_SUPABASE_ANON_KEY. Narrowing it breaks OTA deploy logging,
--                         and it fails SILENTLY there ("silent fail" is in the script), so the
--                         breakage would not announce itself. Fix is to move that write behind a
--                         definer RPC, which is a change to the deploy path, not to RLS.
--
--   prompt_execution_log  log_prompt_invocation(...) is SECURITY INVOKER — prosecdef = false — and
--                         granted to anon. It inserts AS THE CALLER, so it depends on this policy.
--                         The app never calls it (zero references in app/ components/ utils/ hooks/);
--                         it is tooling. Fix is to make that function SECURITY DEFINER, which is a
--                         change to a function's trust level and wants its own review.
--
-- Four further tables — bug_reports, crash_reports, heatmap_events, shared_hands — are not in this
-- set at all: the client writes to them directly (7 / 3 / 2 / 1 call sites), so their permissive
-- INSERT is load-bearing until those writes move behind RPCs.

-- ── analytics_events ────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service insert" ON public.analytics_events;
DROP POLICY IF EXISTS "Public read"    ON public.analytics_events;
CREATE POLICY analytics_events_service_write ON public.analytics_events
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY analytics_events_service_read ON public.analytics_events
  FOR SELECT TO service_role USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, SELECT ON public.analytics_events FROM anon, authenticated;

-- ── chip_transactions, the read side ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS read_own_tx ON public.chip_transactions;
CREATE POLICY read_tx_service_only ON public.chip_transactions
  FOR SELECT TO service_role USING (true);
REVOKE SELECT ON public.chip_transactions FROM anon, authenticated;

-- ── the six other closable tables ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert achievements" ON public.achievements;
CREATE POLICY achievements_service_insert ON public.achievements FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.achievements FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can insert daily rewards" ON public.daily_rewards;
CREATE POLICY daily_rewards_service_insert ON public.daily_rewards FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.daily_rewards FROM anon, authenticated;

DROP POLICY IF EXISTS "Service can insert" ON public.device_cups;
CREATE POLICY device_cups_service_insert ON public.device_cups FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.device_cups FROM anon, authenticated;

DROP POLICY IF EXISTS "System can insert logs" ON public.economy_log;
CREATE POLICY economy_log_service_insert ON public.economy_log FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.economy_log FROM anon, authenticated;

DROP POLICY IF EXISTS "anon insert" ON public.debug_sessions;
CREATE POLICY debug_sessions_service_insert ON public.debug_sessions FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.debug_sessions FROM anon, authenticated;

-- learning_events has NO writer of any kind: zero client call sites, zero functions, and the web
-- beacon that once fed it is commented out in utils/learning.ts ("SPA deployment has no /api/learn
-- endpoint — beacon suppressed"). A dead table with an open door.
DROP POLICY IF EXISTS "Anyone can insert learning events" ON public.learning_events;
CREATE POLICY learning_events_service_insert ON public.learning_events FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.learning_events FROM anon, authenticated;

DROP POLICY IF EXISTS starter_insert_any ON public.starter_pack_redemptions;
CREATE POLICY starter_redemptions_service_insert ON public.starter_pack_redemptions FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.starter_pack_redemptions FROM anon, authenticated;

-- ── the detector itself should not be a public listing of device ids ────────────────────────
REVOKE SELECT ON public.v_harness_devices FROM anon, authenticated, PUBLIC;
GRANT  SELECT ON public.v_harness_devices TO service_role;

COMMENT ON TABLE public.analytics_events IS
  'Client telemetry. WRITES AND READS ARE service_role ONLY — the client writes through the '
  'track_event RPC (SECURITY DEFINER) and never touches the table. Do not re-open it: econ_bind_ok '
  'reads this table to decide whether an anonymous device is continuous, and v_harness_devices '
  'reads it to decide which devices are real, so a publicly writable analytics table lets an '
  'attacker choose who counts as a player. See migration 20260831170000.';
