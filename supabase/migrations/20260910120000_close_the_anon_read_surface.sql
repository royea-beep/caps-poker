-- CLOSE-THE-FOUR · 2026-09-10 — the archive and the seven laundering views.
--
-- ═══ WHAT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN ═══════════════════════════════════════
--
-- 1. `chip_transactions_prereset_20260901` — the pre-reset chip ledger, 4,237 rows of
--    device_id / user_id / amount / description. RLS was OFF and the table still carried the
--    schema's DEFAULT ACL, `anon=arwdDxtm` and `authenticated=arwdDxtm`. So it was not merely
--    readable with the shipped public key: `a`=INSERT, `d`=DELETE and `D`=TRUNCATE were all
--    granted. PROVEN ON A THROWAWAY BRANCH (Iron Rule 11), never on production: as `anon`,
--    DELETE removed a row, INSERT forged one, and TRUNCATE took a 25-row reproduction to
--    ZERO ROWS. The standing rule for this table is "locked, not deleted" — and anyone
--    holding the anon key could have emptied it.
--
-- 2. Seven SECURITY DEFINER views handed `anon` exactly what their base tables deny:
--       friction_heatmap · top_abandon_screens · top_stuck_screens · top_rage_tap_targets
--       v_simulator_devices · v_harness_devices_v2 · v_grant_without_session
--    The first five read `analytics_events`, whose own COMMENT says "WRITES AND READS ARE
--    service_role ONLY" and whose ACL is `anon=xtm` (SELECT revoked by 20260831170000).
--    `v_grant_without_session` also reads `leaderboard`, whose SELECT was revoked from anon
--    on 2026-08-15 precisely so device_id would stop leaking — and it returns device_id and
--    total_chips side by side. `v_harness_devices_v2` is a UNION over `v_harness_devices`,
--    which 20260831170000 REVOKED from anon with the comment "the detector itself should not
--    be a public listing of device ids"; the _v2 wrapper handed the same rows straight back.
--
-- ═══ THE CLASS, NOT THE INSTANCE ════════════════════════════════════════════════════════════
--
-- Neither object was ever "granted" to anon. Both were BORN that way:
--
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
--
-- is set on this project (pg_default_acl, `defaclobjtype='r'` covers tables AND views), so
-- every new table and every new view in `public` arrives with all seven privileges granted to
-- both client roles. A REVOKE fixes the one object it names; the default keeps minting new
-- ones. That is why 20260831170000 could revoke `v_harness_devices` and 20260907000000 could
-- re-open the identical data through `v_harness_devices_v2` five weeks later without anyone
-- writing a line of wrong SQL.
--
-- The signature is readable in one column. An object that has never been revoked from still
-- carries the untouched default `anon=arwdDxtm`; a revoked one shows the gap (`anon=xtm` on
-- analytics_events, `anon=awdDxtm` on leaderboard and v_harness_devices). The detector added
-- below keys on the CONSEQUENCE rather than the ACL text: anon can read the view, anon cannot
-- read what the view reads.
--
-- NOT DONE HERE, AND DELIBERATELY: the default privilege itself is not changed. PostgREST
-- needs `anon`/`authenticated` to hold table privileges for RLS to be the gate on the tables
-- that ARE meant to be public, and flipping a schema-wide default is a blast radius that
-- belongs to Roye, not to a migration that is closing two holes. The detector is what makes
-- the default safe to keep.

-- ── 1 · the archive ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chip_transactions_prereset_20260901 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chip_transactions_prereset_20260901 FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.chip_transactions_prereset_20260901 TO service_role;

COMMENT ON TABLE public.chip_transactions_prereset_20260901 IS
  'Pre-reset chip ledger, archived by migration 20260901000000 (4,237 rows). HISTORICAL — '
  'locked, never deleted. RLS on + zero policies = deny-all for client roles; service_role '
  'reads it. Until 2026-09-10 this table had RLS OFF and the schema default ACL, so anon and '
  'authenticated could SELECT, INSERT, DELETE and TRUNCATE it; a branch reproduction proved '
  'TRUNCATE took it to zero rows. Nothing reads it: 0 functions, 0 views, 0 crons, 0 '
  'dependent objects, 0 FKs. See migration 20260910120000.';

-- ── 2 · the seven views ────────────────────────────────────────────────────────────────────
-- REVOKE ALL, not REVOKE SELECT: the client roles held a/w/d/D on these views too.
REVOKE ALL ON public.friction_heatmap        FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.top_abandon_screens     FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.top_stuck_screens       FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.top_rage_tap_targets    FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.v_simulator_devices     FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.v_harness_devices_v2    FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.v_grant_without_session FROM anon, authenticated, PUBLIC;

GRANT SELECT ON public.friction_heatmap        TO service_role;
GRANT SELECT ON public.top_abandon_screens     TO service_role;
GRANT SELECT ON public.top_stuck_screens       TO service_role;
GRANT SELECT ON public.top_rage_tap_targets    TO service_role;
GRANT SELECT ON public.v_simulator_devices     TO service_role;
GRANT SELECT ON public.v_harness_devices_v2    TO service_role;
GRANT SELECT ON public.v_grant_without_session TO service_role;

-- ── 3 · the detector: how the NEXT one is caught ───────────────────────────────────────────
-- Returns every relation a client role can read whose source that role cannot read. A future
-- `_v3` over the same data is caught the moment it is created, without anyone remembering
-- that a revoke once happened. Keyed on effective privilege (has_table_privilege), so it is
-- immune to how the grant arrived — default ACL, explicit GRANT, or role membership.
CREATE OR REPLACE FUNCTION public.anon_read_surface_violations()
RETURNS TABLE (relation text, relkind text, client_role text, reads_from text, why text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH edges AS (
    SELECT DISTINCT v.oid AS view_oid, v.relname AS viewname, v.relkind,
                    base.oid AS base_oid, base.relname AS basename
      FROM pg_class v
      JOIN pg_namespace n  ON n.oid = v.relnamespace AND n.nspname = 'public'
      JOIN pg_rewrite r    ON r.ev_class = v.oid
      JOIN pg_depend  d    ON d.objid = r.oid AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_class base   ON base.oid = d.refobjid AND base.oid <> v.oid
      JOIN pg_namespace bn ON bn.oid = base.relnamespace AND bn.nspname = 'public'
     WHERE v.relkind IN ('v','m')
  ), roles AS (SELECT unnest(ARRAY['anon','authenticated']) AS r)
  -- (a) a view the role can read, over a source the role cannot
  SELECT e.viewname::text, e.relkind::text, roles.r::text, e.basename::text,
         'view is readable by ' || roles.r || ' but its source ' || e.basename || ' is not'
    FROM edges e CROSS JOIN roles
   WHERE has_table_privilege(roles.r, e.view_oid, 'SELECT')
     AND NOT has_table_privilege(roles.r, e.base_oid, 'SELECT')
  UNION ALL
  -- (b) a table with RLS OFF that a client role can touch at all: nothing gates it
  SELECT c.relname::text, c.relkind::text, roles.r::text, '(itself)'::text,
         'RLS is OFF and ' || roles.r || ' holds ' ||
         concat_ws(',', CASE WHEN has_table_privilege(roles.r,c.oid,'SELECT')   THEN 'SELECT'   END,
                        CASE WHEN has_table_privilege(roles.r,c.oid,'INSERT')   THEN 'INSERT'   END,
                        CASE WHEN has_table_privilege(roles.r,c.oid,'UPDATE')   THEN 'UPDATE'   END,
                        CASE WHEN has_table_privilege(roles.r,c.oid,'DELETE')   THEN 'DELETE'   END,
                        CASE WHEN has_table_privilege(roles.r,c.oid,'TRUNCATE') THEN 'TRUNCATE' END)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   CROSS JOIN roles
   WHERE c.relkind = 'r' AND NOT c.relrowsecurity
     AND (has_table_privilege(roles.r,c.oid,'SELECT') OR has_table_privilege(roles.r,c.oid,'INSERT')
       OR has_table_privilege(roles.r,c.oid,'UPDATE') OR has_table_privilege(roles.r,c.oid,'DELETE')
       OR has_table_privilege(roles.r,c.oid,'TRUNCATE'))
  ORDER BY 1, 3;
$function$;

REVOKE ALL ON FUNCTION public.anon_read_surface_violations() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.anon_read_surface_violations() TO service_role;

COMMENT ON FUNCTION public.anon_read_surface_violations() IS
  'THE CLASS DETECTOR. Every relation a client role can read whose source it cannot, plus '
  'every RLS-off table a client role can touch. Must return ZERO ROWS. Non-zero means a new '
  'object inherited the schema default ACL (anon=arwdDxtm) over data that was deliberately '
  'revoked — the shape that let v_harness_devices_v2 re-open v_harness_devices five weeks '
  'after 20260831170000 closed it. Wired into security_posture_tripwire (cron 37, hourly).';
