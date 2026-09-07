-- THE INSTRUMENT GAP: v_harness_devices CANNOT SEE A SIMULATOR.
--
-- Found 2026-09-07 while purging before the tester round. The iOS Simulator device
-- c634-9816-87a6 bound itself, took a starter grant, and sat in the numbers looking exactly
-- like a real phone:
--   * NO automation fingerprint — a simulator sets webdriver=false, has no Headless/Playwright
--     user agent, and is not a bot. v_automation_devices is blind to it by construction.
--   * device_id MATCHES the real-device pattern ^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$, so the
--     synthetic_device_id branch of v_harness_devices does not fire either.
-- Both existing signals ask "is this a robot?". A simulator is not a robot. It is a developer.
--
-- ⚠️ AND IT IS NOT ONE ROW. The same signal finds 113 devices carrying device_model
-- 'Simulator iOS', first seen 2026-07-06, of which 108 hold a leaderboard row and 216,920 chips.
-- NONE of them is in v_harness_devices. NONE has games_played > 0. Together they contribute
-- ZERO hands and ONE binding — so they inflate the device count and the float, and barely touch
-- the two numbers the tester round is measured against.
--
-- ⚠️ WHY THIS IS A COMPANION VIEW AND NOT AN EDIT TO v_harness_devices.
-- Every purge in this project is driven by "select from the view", and that is the right rule.
-- Folding this signal into v_harness_devices would silently turn the next routine run of that
-- same command from a 58-device purge into a 170-device one — a decision nobody made, executed
-- by a habit. The signal belongs in the instrument; the decision to act on it belongs to Roye.
-- Use v_harness_devices_v2 once that decision exists.

CREATE OR REPLACE VIEW public.v_simulator_devices AS
SELECT DISTINCT e.device_id,
       'simulator_device_model'::text AS signal
FROM analytics_events e
WHERE e.device_id IS NOT NULL
  -- Android emulators are covered too, though none has appeared yet: better here than in the
  -- incident report that finds them.
  AND (e.properties ->> 'device_model') ~* '(simulator|emulator|sdk_gphone|android sdk built)';

COMMENT ON VIEW public.v_simulator_devices IS
  'Devices identified as an iOS Simulator or Android emulator by device_model. Neither the '
  'automation fingerprint nor the synthetic-device-id rule catches these: a simulator reports '
  'webdriver=false and a well-formed device_id. Added 2026-09-07 after one bound itself and was '
  'invisible to v_harness_devices.';

CREATE OR REPLACE VIEW public.v_harness_devices_v2 AS
SELECT device_id, signal FROM public.v_harness_devices
UNION
SELECT device_id, signal FROM public.v_simulator_devices;

COMMENT ON VIEW public.v_harness_devices_v2 IS
  'v_harness_devices plus the simulator signal. This is the view a purge should use. It is kept '
  'separate on purpose: adopting it is a decision about ~112 additional devices, not a refactor.';
