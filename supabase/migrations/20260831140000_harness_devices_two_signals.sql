-- CLOSE-THE-SIX 2026-08-31 — the harness detector gets the half it never had.
--
-- ═══ FIRST, A CORRECTION TO MY OWN HANDOFF ═══════════════════════════════════════════════════
-- VERIFY-EVERYTHING (handoff 130) reported: "NOT ONE ROW in the entire database has
-- webdriver=true". THAT IS WRONG. There are 565 such events across 46 devices, and
-- v_automation_devices currently returns 50 device ids. The query behind that claim was scoped to
-- a filtered subset — the devices in a card-placement timing analysis — and I generalised its
-- `false` into a statement about the whole table. That is Iron Rule #8 (absence in one namespace
-- is not absence) and I broke it. The view was never blind in the way I said.
--
-- ═══ WHAT IS ACTUALLY TRUE, MEASURED ═════════════════════════════════════════════════════════
-- v_automation_devices matches on `properties->>'webdriver' = 'true'` or a `ua` containing
-- Headless / Playwright / Claude/ / Electron/ / bot. Those keys arrive from the AN1 client
-- fingerprint, which shipped on 2026-08-01 (commit 0ba09a6, utils/analytics.ts). So the view has
-- exactly two blind spots, and neither is a regression — it has never been able to see them:
--
--   1. EVERYTHING BEFORE 2026-08-01 19:51:12. No event before that carries `ua` or `webdriver` at
--      all: Apr 758, May 540, Jun 1,566, Jul 3,709 events, every one of them invisible to it.
--   2. ANY DEVICE THAT NEVER SENDS A WEB FINGERPRINT. A harness that writes rows through SQL or an
--      RPC never runs `navigator`, so it has no UA to match. Measured: 80 device ids across
--      leaderboard/analytics_events/chip_transactions/hand_history/device_identity/player_streaks
--      cannot have come from the app, and v_automation_devices catches ZERO of them.
--
-- ═══ THE SECOND SIGNAL, AND WHY IT IS EXACT RATHER THAN A HEURISTIC ══════════════════════════
-- `getDeviceId()` (utils/leaderboard.ts:40) is the ONLY producer of a device id in the app:
--     'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16))
-- with a single fallback on a SecureStore failure: 'anon-' + Date.now().toString(36).
-- So a real client emits ^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$ or ^anon-[0-9a-z]+$ and NOTHING
-- ELSE. `eqh-eqs1-a`, `rig3p-b`, `rig2p-loser`, `dev-s2-host`, `test-ah1-verify` are not things
-- the app can produce. This rule needs no fingerprint, works retroactively over all history, and
-- cannot be defeated by a harness presenting an ordinary user agent — which is exactly the case
-- that made me misread a real player's Auto-Place tap as a robot last sprint.
--
-- THE TWO SIGNALS ARE COMPLEMENTARY AND, TODAY, DISJOINT: the view catches 50 automated BROWSERS
-- using real-format ids (our own Playwright sweeps); the format rule catches 80 SYNTHETIC ids
-- written straight to the database. Neither alone is the answer. Union: 130.
--
-- v_automation_devices IS KEPT AND UNCHANGED. Earlier handoffs quote its counts (28 on 2026-08-27,
-- 29 on 2026-08-28, 50 today) and rewriting it would silently restate history. It is now labelled
-- with what it does and does not cover, and the complete answer lives in the new view.

COMMENT ON VIEW public.v_automation_devices IS
  'ONE OF TWO harness signals: devices whose analytics fingerprint says browser automation '
  '(webdriver=true, or a Headless/Playwright/Claude/Electron/bot user agent). BLIND to everything '
  'before 2026-08-01 (the AN1 fingerprint did not exist) and to any harness that writes without a '
  'browser. Do not use it alone to decide what is real — use v_harness_devices.';

CREATE OR REPLACE VIEW public.v_harness_devices AS
  -- Signal 1: the browser fingerprint. Works only for web traffic since 2026-08-01.
  SELECT device_id, 'automation_fingerprint'::text AS signal
    FROM public.v_automation_devices
  UNION
  -- Signal 2: an id the app cannot produce. Works over all history, with no fingerprint needed.
  SELECT device_id, 'synthetic_device_id'::text AS signal
    FROM (
      SELECT device_id FROM public.leaderboard        WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.analytics_events  WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.chip_transactions WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.hand_history      WHERE device_id IS NOT NULL
      UNION SELECT device_id FROM public.device_identity
      UNION SELECT device_id FROM public.player_streaks
      UNION SELECT device_id FROM public.heatmap_events    WHERE device_id IS NOT NULL
    ) seen
   WHERE device_id !~ '^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$'
     AND device_id !~ '^anon-[0-9a-z]+$';

COMMENT ON VIEW public.v_harness_devices IS
  'THE COMPLETE harness list: browser-automation fingerprints UNION device ids the app cannot '
  'produce. `signal` says which rule caught each one, so a device can be argued with rather than '
  'just excluded. Use this, not v_automation_devices, to separate real play from test traffic. '
  'NOTE: it identifies, it does not delete — rows that show real play are never removed on its '
  'say-so. See migration 20260831140000.';

GRANT SELECT ON public.v_harness_devices TO service_role;
