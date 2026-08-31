-- PURGE-AND-CLOSE 2026-08-31 — remove every harness device, across every table that keys on it.
--
-- ═══ THE POPULATION IS 77, NOT 66 — REPORTED BEFORE ANYTHING WAS DELETED ═════════════════════
-- Handoff 131 measured 66 harness leaderboard rows holding 96,379 chips. It is now 77 rows holding
-- 119,299. The extra ELEVEN ARE MINE: the Playwright sweeps run during CLOSE-THE-SIX itself, on
-- 2026-08-30 and 2026-08-31. The detector counting the person using it is the detector working, and
-- it is also why a hand-maintained list was abandoned — the population moves while you look at it.
--
-- ═══ EVERY DEVICE CHECKED FOR REAL PLAY. NONE SHOWS ANY. ═════════════════════════════════════
-- Four predicates, any hit = keep: a hand_history row · a binding in device_identity · a card
-- placement gap that could be a human hand · a user agent that is neither the Claude desktop app,
-- a Playwright emulation, nor headless. Twenty-two devices tripped one and every one resolved:
--
--   * 26 devices carry `Macintosh; Intel Mac OS X 10_15_7` — Playwright's WebKit default UA, which
--     the view's string pattern does not match. ALL 26 have webdriver = true, so they were caught
--     by the stronger signal anyway. Not unexplained: my exclusion list was incomplete.
--
--   * FOUR DEVICES ARE GENUINE MIXTURES and they are the ones the cleanup rule exists for —
--     f972-050b-7bbd, 86f3-8423-ed3b, 83f9-ef93-5114, dca6-320a-0b1e each carry BOTH an
--     automation UA and a human-looking one. Resolved by three independent facts:
--       1. the "human" UA is `Linux; Android 14; Pixel 8` on all four, and that string appears on
--          EXACTLY FOUR DEVICES IN THE WHOLE DATABASE — all four of them these. A real Pixel 8
--          owner would be a fifth device. There is none.
--       2. ZERO sessions carry both UAs. The same persisted caps_device_id was reused across
--          separate contexts, which is what a Playwright run with a saved storage state does and
--          what a human cannot do.
--       3. f972 has 8 placements with source='tap', which reads as human — until you time them.
--          Median gap across its 435 placement gaps: 0.004 SECONDS. Only 35 of 435 exceed one
--          second, and those are idle time between runs, not pacing.
--     ⚠️ THE LESSON, AND IT IS THE INVERSE OF LAST SPRINT'S. Then, an `auto_all` burst looked like
--     a robot and was one human tap. Here, `source='tap'` looks like a human and is a machine.
--     THE SOURCE LABEL IS NOT THE SIGNAL — THE TIMING IS.
--
--   * dev-s2-host and dev-s2-guest own 2 hand_history rows each. Their ids are synthetic, which the
--     app cannot produce, so they are the 2026-08-17 multiplayer QA rigs. Harness.
--
-- ZERO of the 77 appear in device_identity. All six bindings are real people and none is touched.
--
-- ═══ ⚠️ THE GAP CANNOT HOLD, AND THAT IS ARITHMETIC, NOT A DEFECT ════════════════════════════
-- The brief requires the gap to stay at 384,493. It cannot, and the reason is worth stating rather
-- than discovering afterwards:
--
--     harness float  119,299        harness ledger  70,136        difference  49,163
--
-- The gap IS unrecorded float — balance that no transaction accounts for — and 49,163 of the
-- 384,493 belongs to these devices. Removing them necessarily removes their share:
--
--     gap 384,493  ->  335,330      predicted BEFORE the delete, verified after
--
-- Deleting only the leaderboard side would move it by the full 119,299, which is worse. Deleting
-- both sides is the only coherent option, and the remaining 335,330 is a truer number: real
-- players' unrecorded float, with the test traffic taken out of it.
--
-- Order matters: chip_transactions before leaderboard, so no trigger re-derives anything.

DELETE FROM public.chip_transactions  WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.achievements       WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.daily_rewards      WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.device_cups        WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.economy_log        WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.chip_rescue_log    WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.player_streaks     WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.heatmap_events     WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.hand_history       WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.econ_rate_counters WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
DELETE FROM public.leaderboard        WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);

-- analytics_events LAST and DELIBERATELY: v_harness_devices READS this table, so removing the
-- events removes the evidence that identified the devices. Every other table must be cleared while
-- the view can still name them.
DELETE FROM public.analytics_events   WHERE device_id IN (SELECT device_id FROM public.v_harness_devices);
