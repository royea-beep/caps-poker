-- THE DETECTOR, WIDENED — AND THE ONE SIGNAL DELIBERATELY LEFT OUT OF THE PURGE VIEW.
--
-- Background: v_harness_devices has two signals and BOTH ask "is this a robot?" — an automation
-- fingerprint, or a device_id that does not look real. A simulator is not a robot; it reports
-- webdriver=false and a well-formed device_id, so it walked straight through. The companion
-- v_simulator_devices closed that on 2026-09-07.
--
-- ⚠️ "IF ONE GOT THROUGH, ASSUME OTHERS HAVE." So every device carrying a leaderboard row was
-- classified by the strongest signal present, and the sweep found a SECOND class the views miss:
--
--   A · no analytics event at all ........................... 1 device
--   D · a server-side econ_authz event and nothing else ..... 6 devices
--
-- Seven devices took the 2,000-chip starter grant and NEVER RENDERED A SCREEN. No binding, no
-- hand, no client event. Six of them arrived in machine-regular bursts — 2026-08-23 at 17:45:44,
-- 17:46:03, 17:46:24 and 17:46:44, twenty seconds apart.
--
-- ⚠️ AND THAT IS WHY THIS SIGNAL IS NOT IN v_harness_devices_v2.
-- A real phone that crashed on launch, or lost the network after the grant call, leaves EXACTLY
-- this trace. The pattern is suspicious; it is not proof of a robot. Folding it into the view a
-- purge selects from would eventually delete a player whose app crashed — which is the opposite
-- of what these views exist for. It is published so it can be looked at, and it is quarantined so
-- it cannot be swept.

CREATE OR REPLACE VIEW public.v_grant_without_session AS
SELECT l.device_id,
       'grant_without_session'::text AS signal,
       l.total_chips,
       (SELECT count(*) FROM analytics_events e WHERE e.device_id = l.device_id) AS events,
       (SELECT min(e.created_at) FROM analytics_events e WHERE e.device_id = l.device_id) AS first_seen
FROM leaderboard l
WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events e
        WHERE e.device_id = l.device_id AND e.event_name <> 'econ_authz'
      );

COMMENT ON VIEW public.v_grant_without_session IS
  'Devices holding a leaderboard row that never produced a single client-rendered event — they '
  'took the starter grant and nothing else. REPORT-ONLY. Deliberately NOT part of '
  'v_harness_devices_v2: a real phone that crashed on launch leaves an identical trace, so this '
  'is a thing to look at, never a thing to purge by.';
