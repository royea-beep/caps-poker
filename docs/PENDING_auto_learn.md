# AUTO-LEARN — crash pipeline audit + passive friction signals (2026-07-06)

## 1. Crash auto-fix pipeline audit — VERDICT: dead for ~2 months

`crash_reports.pipeline_*` columns (`pipeline_attempts`, `pipeline_last_status`, `pipeline_last_run`,
`pipeline_missing_info`) are **100% unreferenced code** — a full-repo grep found zero files that read or
write them. They are not "not running," they were never wired to anything.

The REAL mechanism is `crash_reports.auto_fix_*`, driven by the `auto-fix-crashes` Edge Function
(queries `status='new' AND auto_fix_attempts<3`), triggered by `.github/workflows/auto-fix-crashes.yml`
(`*/5 * * * *` cron). That workflow's GitHub status is **`disabled_manually`** — last successful run
**2026-05-14**, i.e. dark for ~2 months. All 6 recent crashes (5 audio-autoplay `play()`/`pause()` races,
1 share-fail) show `auto_fix_attempts=0` and sat with `status='new'` until the UNRELATED
`auto_dismiss_stale_crashes(3)` cron job (which IS active, runs daily 3:30 UTC) flipped them to
`status='dismissed'` after 3 days — administrative cleanup, not a fix. `resolved_at` timestamps
clustering at 06:30 local match this cron exactly.

**Did not re-enable it** — it was disabled manually (deliberate action by someone), and flipping an
autonomous code-modifying pipeline back on isn't a judgment call to make silently. Owner: if you want it
back, `gh workflow enable "Auto-Fix Crashes"` (or ask me to). Worth knowing: the 6 crashes on file are
all benign (browser audio-autoplay policy races + one share-sheet cancel) — nothing urgent was missed,
but future real crashes will sit unprocessed the same way until this is decided.

## 2. cards_placed fix — root cause + fix

Was tracked ONLY inside `startCountdown()`, itself gated behind `if (!countdownActive)` in
`handleReady` (app/game.tsx) — i.e. only the first hand-ready action in a game session fired it.
Separately, `app/multiplayer-game.tsx` has its own entirely separate `handleReady`/`startCountdown`
pair that never tracked `cards_placed` at all (the event was only ever wired into solo/practice).
Both fixed:
- game.tsx: now tracks unconditionally right after the `allBoardsFull` guard in `handleReady`
  (guaranteed exactly once per hand via the existing debounce guards).
- multiplayer-game.tsx: added the same tracking, guarded by the existing idempotent `readySentRef`.

## 3. New passive friction signals — `utils/frictionSignals.ts`

Wired once at the root (`app/_layout.tsx`): a non-claiming global touch observer
(`onStartShouldSetResponderCapture` returning `false` — never intercepts a real press/gesture) plus the
existing pathname-change effect. No per-screen glue needed anywhere else.

- **rage_tap** — 3+ taps within 40px / 1s, 2s cooldown after firing (so one mashing session reports
  once, not N times). `properties: {x, y, tapCount, windowMs}`.
- **screen_abandon** — left a screen within 3s of arrival with zero interaction.
  `properties: {dwellMs}`.
- **stuck_dwell** — 30s+ on a screen with zero interaction. `properties: {dwellMs}`.
- **error_boundary_hit** — added to the existing `ErrorBoundary.componentDidCatch`, alongside (not
  replacing) the crash_reports pipelines. `properties: {message}`.

All fire via the existing `track()` → `analytics_events` (event_name, properties jsonb, screen,
device_id, created_at) — no new tables, no schema change on the client side.

Unit-tested: `utils/__tests__/frictionSignals.test.ts` (12 tests — threshold, radius, cooldown,
re-arm, window timing for all 3 timer-based signals).

## 4. Server-side views for the strategist — see `docs/PENDING_auto_learn_friction_views.sql`

5 read-only views (`CREATE OR REPLACE VIEW`, no new tables, safe to run any time):
`top_rage_tap_targets`, `top_abandon_screens`, `top_stuck_screens`, `top_error_boundary_screens`, and
`friction_heatmap` (the one-query union of all 4 — "run this, see everything").

**Agent is blocked from applying prod DDL** — strategist to run the .sql file.
