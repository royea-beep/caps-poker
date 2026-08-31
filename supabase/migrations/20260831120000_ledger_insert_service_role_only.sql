-- CLOSE-THE-SIX 2026-08-31 — the ledger stops accepting rows from the browser.
--
-- ═══ WHAT WAS OPEN ═══════════════════════════════════════════════════════════════════════════
-- `chip_transactions` carried a policy `insert_tx  FOR INSERT TO public WITH CHECK (true)`. Any
-- holder of the anon key — which ships inside the web bundle and the iOS binary — could insert an
-- arbitrary ledger row. Measured, not inferred: one HTTPS request with the public key inserted a
-- +1,000,000 row on 2026-08-31 (VERIFY-EVERYTHING §3.4b; the row was removed and the totals
-- re-read to prove it).
--
-- It could never mint PLAYABLE chips — `leaderboard` INSERT/UPDATE/DELETE are service_role only
-- and both were refused 42501. What it corrupts is the LEDGER, which is the number the
-- float-vs-ledger reconciliation is measured against. Anyone could make that reconciliation say
-- anything.
--
-- ═══ WHERE THE POLICY CAME FROM — it was never in a migration ═════════════════════════════════
-- Neither `insert_tx` nor `read_own_tx` appears in ANY statement in
-- supabase_migrations.schema_migrations. They were applied directly to the database, outside the
-- migration history, so they were never reviewed as a diff.
--
-- Worse: `supabase/migrations/20260517000000_audit_rls_lockdown.sql` in this repo ALREADY makes
-- this exact fix — it drops every insert policy on chip_transactions and leaves only a restrictive
-- SELECT. That file is committed and **was never applied**: the applied history jumps
-- 20260516115223 -> 20260517123843. The repo has believed this was fixed since 2026-05-17.
--
-- ═══ WHY THIS CANNOT BREAK ANY WRITER ════════════════════════════════════════════════════════
-- All fifteen functions that insert into chip_transactions are SECURITY DEFINER owned by
-- `postgres`, which OWNS the table, and `chip_transactions` does not have FORCE ROW LEVEL
-- SECURITY (relforcerowsecurity = false). Postgres does not apply RLS to a table's owner unless
-- FORCE is set, so policies on this table have never applied to any of them:
--
--   claim_daily_reward   claim_daily_streak   claim_emergency_chips (x2)   claim_low_chip_rescue
--   claim_share_reward   claim_winback_rescue credit_purchase              earn_chips (x2)
--   ledger_starting_grant record_hand_net     record_reward                spend_chips (x2)
--
-- And nothing client-side writes here directly: `grep -rn "from('chip_transactions')" app/
-- components/ utils/ hooks/` returns zero insert sites — only three comments.
--
-- That reasoning was TESTED rather than trusted, on a development branch (Iron Rule #11), with a
-- before AND an after, because an "after" alone would pass on a database where the bug never
-- existed. See tests/verify-ledger-policy.mjs.
--
-- ═══ WHAT IS DELIBERATELY NOT CHANGED ════════════════════════════════════════════════════════
-- `read_own_tx  FOR SELECT TO public USING (true)` makes every device's chip history world-
-- readable, and the 2026-05-17 lockdown intended `user_id = auth.uid()`. It is a real leak and it
-- is REPORTED, not fixed here: this sprint was scoped to the write path, and narrowing SELECT is a
-- behaviour change on a surface I have not finished mapping.

-- 1. THE WRITE PATH. Replace the permissive policy with an explicit, self-documenting one. The
--    service role bypasses RLS anyway; naming it keeps the intent legible in pg_policies rather
--    than leaving a table with no INSERT policy and no record of why.
DROP POLICY IF EXISTS insert_tx ON public.chip_transactions;
CREATE POLICY insert_tx_service_only ON public.chip_transactions
  FOR INSERT TO service_role WITH CHECK (true);

-- 2. THE GRANT UNDERNEATH IT. anon and authenticated hold DELETE, INSERT, TRUNCATE and UPDATE on
--    the ledger. RLS currently makes DELETE and UPDATE no-ops (no policy => zero rows match,
--    confirmed on the branch: both returned 204 and changed nothing).
--
--    ⚠️ TRUNCATE IS NOT SUBJECT TO RLS AT ALL — Postgres filters SELECT/INSERT/UPDATE/DELETE and
--    not TRUNCATE. Today that grant is not reachable, because PostgREST exposes no TRUNCATE verb
--    and Supabase does not expose the anon role over a direct Postgres connection. So it is a
--    latent over-grant rather than a live hole — stated that way on purpose. It should still not
--    exist, and a policy change that left it in place would be relying on PostgREST's surface
--    rather than on permissions.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.chip_transactions FROM anon, authenticated;

COMMENT ON TABLE public.chip_transactions IS
  'The chip ledger. WRITES ARE service_role ONLY — every legitimate writer is a SECURITY DEFINER '
  'function owned by postgres, so RLS does not apply to it. Do not add a permissive INSERT policy '
  'or re-grant INSERT to anon/authenticated: an anon-writable ledger cannot mint playable chips '
  '(leaderboard is service_role only) but it destroys the float-vs-ledger reconciliation, which is '
  'the only check that the economy adds up. See migration 20260831120000.';
