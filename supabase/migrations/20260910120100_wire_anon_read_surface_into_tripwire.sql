-- CLOSE-THE-FOUR · 2026-09-10 — fix the CLASS: wire the detector into the hourly tripwire.
--
-- 20260910120000 closed the archive and the seven views. This closes the shape that produced
-- them. `security_posture_tripwire()` (cron 37, hourly) already guards RLS on five tables and
-- the grants on game_rooms / room_players / test_devices. It gains section (d): every relation
-- a client role can read whose SOURCE that role cannot, plus every RLS-off table a client role
-- can touch — i.e. `public.anon_read_surface_violations()`, which must return zero rows.
--
-- WHY THIS IS THE CLASS AND NOT ANOTHER INSTANCE. `ALTER DEFAULT PRIVILEGES IN SCHEMA public
-- GRANT ALL ON TABLES TO anon, authenticated` is set on this project, and `defaclobjtype='r'`
-- covers VIEWS as well as tables. So a REVOKE protects exactly the object it names and nothing
-- created afterwards. That is how migration 20260831170000 could revoke `v_harness_devices`
-- with the comment "the detector itself should not be a public listing of device ids", and
-- migration 20260907000000 could hand the same rows straight back through
-- `v_harness_devices_v2` five weeks later — no bad SQL, just a default nobody re-applied.
--
-- PROVEN ON A THROWAWAY BRANCH BOTH WAYS BEFORE IT WAS APPLIED (Iron Rules 10 and 11), against
-- a reproduction built from production's own ACLs:
--   C1  clean tree                      -> {"ok":true,"fired":false,"findings":0}
--   C2  create v_harness_devices_v3     -> {"ok":true,"fired":true,"findings":2,"detail":
--         "anon can read v_harness_devices_v3 -> view is readable by anon but its source
--          v_harness_devices_v2 is not; authenticated can read v_harness_devices_v3 -> ..."}
--   C3  WhatsApp row queued, carrying that text and the REVOKE/GRANT remedy
--   C4  drop the v3                     -> {"ok":true,"fired":false,"findings":0}
-- A control that cannot fail is not a control: C2 is the proof that this one can.
--
-- It also caught two mistakes in the reproduction itself while it was being built (a view and a
-- table I created on the branch without replicating production's revoke), which is the strongest
-- evidence it will catch the next real one.
--
-- SUPPRESSION IS INHERITED, DELIBERATELY: at most 4 alerts a day and none within 60 minutes of
-- the last. A view that launders privilege is a standing condition, not an incident — it should
-- nag once an hour at most, not 24 times.

CREATE OR REPLACE FUNCTION public.security_posture_tripwire()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_bad text[] := '{}';
  v_to text; v_today int; v_msg text; r record;
  c_daily_cap constant int := 4;
BEGIN
  -- (a) RLS must remain ENABLED on every table whose protection depends on it.
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('game_rooms','room_players','test_devices','leaderboard','club_members')
       AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    v_bad := v_bad || ('RLS DISABLED on ' || r.relname);
  END LOOP;

  -- (b) Client roles must hold SELECT and nothing else on the seat/room tables. Catches both a
  --     re-grant and a new table inheriting the public default ACL (anon=arwdDxtm).
  FOR r IN
    SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('game_rooms','room_players')
       AND grantee IN ('anon','authenticated')
       AND privilege_type <> 'SELECT'
  LOOP
    v_bad := v_bad || (r.grantee || ' regained ' || r.privilege_type || ' on ' || r.table_name);
  END LOOP;

  -- (c) test_devices must stay unreachable by clients (it gates the lockout alarm).
  FOR r IN
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='test_devices' AND grantee IN ('anon','authenticated')
  LOOP
    v_bad := v_bad || (r.grantee || ' regained ' || r.privilege_type || ' on test_devices');
  END LOOP;

  -- (d) 2026-09-10 · THE CLASS. A relation a client role can read whose SOURCE that role cannot
  --     read, or an RLS-off table a client role can touch. See migration 20260910120100.
  FOR r IN SELECT * FROM public.anon_read_surface_violations()
  LOOP
    v_bad := v_bad || (r.client_role || ' can read ' || r.relation || ' -> ' || r.why);
  END LOOP;

  IF array_length(v_bad, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'fired', false, 'findings', 0);
  END IF;

  SELECT count(*) INTO v_today FROM whatsapp_outbound
   WHERE message LIKE '%SECURITY POSTURE%' AND created_at > now() - interval '24 hours';
  IF v_today >= c_daily_cap
     OR EXISTS (SELECT 1 FROM whatsapp_outbound WHERE message LIKE '%SECURITY POSTURE%' AND created_at > now() - interval '60 minutes') THEN
    RETURN jsonb_build_object('ok', true, 'fired', false, 'suppressed', true, 'findings', array_length(v_bad,1), 'detail', array_to_string(v_bad, '; '));
  END IF;

  SELECT to_number INTO v_to FROM whatsapp_outbound ORDER BY created_at DESC LIMIT 1;
  IF v_to IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_to_number'); END IF;

  v_msg := '🛡️ SECURITY POSTURE REGRESSION: ' || array_to_string(v_bad, '; ')
        || '. Client roles must hold SELECT only on game_rooms/room_players and NOTHING on '
        || 'test_devices; RLS must stay enabled. Writes go through SECURITY DEFINER RPCs only. '
        || 'A "can read X -> its source is not readable" line means a NEW view inherited the schema '
        || 'default ACL over data that was deliberately revoked. '
        || 'FIX: REVOKE ALL ON <object> FROM anon, authenticated, PUBLIC; GRANT SELECT TO service_role.';

  INSERT INTO whatsapp_outbound (to_number, message, status) VALUES (v_to, v_msg, 'pending');
  RETURN jsonb_build_object('ok', true, 'fired', true, 'findings', array_length(v_bad,1), 'detail', array_to_string(v_bad, '; '));
END;
$function$;
