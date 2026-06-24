# VAMOS CAPS PRE-FRIENDS-READINESS — TASK 0 + TASK 1

**Date:** 2026-06-24 · **Branch:** `feat/telemetry-instrumentation`
**Scope:** TASK 0 (persist vision) + TASK 1 (instrumentation). TASK 2 (full web QA) = next session per pacing.

## TASK 0 — Vision persisted
Play-overhaul vision + status is persisted in the project's durable memory (MEMORY.md index +
`session_caps_play_overhaul_phase1_jun24.md`): **two play options only** — SINGLE PLAYER (vs bots,
`game.tsx`) and MULTIPLAYER LOBBY (3 types = 2P/3P/4P × 2 open tables = 6; auto-start when full;
"+ Create table"; invite-by-code to a specific table). **Phase 1 DONE** (`feat/play-overhaul`: sit-and-go
→ redirect to /game, unified render). Phase 2 = build the lobby (+fold in the placement-timer auto-place
fix). Phase 3 = remove Quick Poker / Tournament / WiFi as separate modes.

## TASK 1 — Telemetry + breadcrumbs (done + verified)

**Root cause found:** `utils/analytics.ts` `track()` was a **no-op** since 2026-06-17 (the `track_event`
RPC 404'd back then). Every `track()` callsite (~40 across screens/components) silently did nothing — why
analytics_events had ~8 events in 7 days. The `track_event` RPC now exists.

**Fixes (client, branch — ships on web-deploy with owner authorization):**
1. **Restored `track()`** → calls `track_event(p_event, p_user_id, p_device_id, p_data, p_screen)`,
   fire-and-forget, never throws. `session_id` + `app_version` ride in `p_data` (the RPC has no dedicated
   args; the table's session_id column would need an RPC change to populate directly — folded into
   properties instead, queryable). This re-activates ALL existing instrumentation app-wide on web+native.
2. **Breadcrumb trail** — `track()` now feeds the existing `utils/breadcrumbs.ts` ring buffer (last 20)
   that the crash/bug reporters already attach (no duplicate system). Each crumb = `event @screen`.
3. **Added the missing named events:** `mode_start` (home), `purchase` (shop success), `cup_earned`
   (results, per awarded cup). `screen_view` / `game_started` / `game_ended` already existed.
4. **Web global error handler** — `utils/webErrorReporter.ts` (wired in `app/_layout.tsx` web branch):
   `window 'error'` + `'unhandledrejection'` → insert `crash_reports` (throttled/deduped) WITH the
   breadcrumb trail, screen, app_version, and userAgent. The native crash pipeline (crash-evidence dashcam
   + ErrorUtils handler) is native-gated, so web (what friends play) captured nothing before this.

**error_logs note (profile finding):** `error_logs` is **service_role-only** (no public/anon INSERT
policy, no insert RPC) — a client cannot write it. `crash_reports` is the only telemetry table with a
**public INSERT** policy and it has the richer breadcrumb fields (step_log, last_screen, last_action,
console_errors, component_stack, device), so web errors go there. If you specifically want `error_logs`
populated from clients, that needs a small SECURITY DEFINER `log_client_error` RPC (owner-applied) — say
the word and I'll provide it.

**Verify:** `tsc` 0 · `jest` 2505/2505. Events land (proven against live DB, test rows then deleted):
- `track_event('screen_view', …, '{session_id,app_version,mode}', 'home')` → row in `analytics_events`
  with session_id + app_version readable in properties.
- Simulated web-reporter insert → row in `crash_reports` with breadcrumb trail in step_log.

## Not done (next session)
TASK 2 — full Playwright/Chromium web QA of caps.ftable.co.il (20 pages / ~75 buttons), PASS/FAIL table,
fix everything broken, re-verify. (Now that telemetry is live, friend-session bugs will also self-report.)

## Constraints
No deploy/OTA/build/submit. Branch `feat/telemetry-instrumentation`. Owner authorizes any deploy.
