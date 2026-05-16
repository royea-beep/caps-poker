# CAPS Analytics — Onboarding Funnel

## Pipeline

All events go through `track(event, properties?, screen?)` in `utils/analytics.ts` → Supabase RPC `track_event` → `analytics_events` table. Fire-and-forget; never blocks UX; silently drops if Supabase is unconfigured.

Each row in `analytics_events` carries: `event_name` (text), `user_id` (uuid, nullable — anon-eligible), `device_id` (text, from `getDeviceId()`), `properties` (jsonb), `screen` (text), `session_id` (text), `created_at` (timestamptz). The RPC param `p_event` maps to the `event_name` column.

## The 8 funnel events

| Funnel step | Event name | Screen | Properties | Wired at |
|---|---|---|---|---|
| 1. App opened | `app_opened` | `home` | `{}` | `app/(tabs)/index.tsx:903`, `app/index.tsx:899` |
| 2. Home rendered | `home_screen_loaded` | `home` | `{ chips, hands_played, ... }` (rich payload) | `app/(tabs)/index.tsx:904`, `app/index.tsx:900` |
| 3. Game started | `game_started` | `home` | `{ player_count }` | `app/(tabs)/index.tsx:1086`, `app/index.tsx:1082` (fires when PLAY tapped) |
| 4. Arrangement timeout | `arrangement_timeout` | `game` | `{ player_count, board_count, cards_remaining }` | `app/game.tsx:367` — fires when the arrangement timer hits 0 and we auto-place |
| 5. Hand completed | `hand_completed` | `results` | (rich results payload) | `app/results.tsx:486` |
| 6. Google prompt shown | `google_prompt_shown` | `login_prompt` | `{}` | `components/LoginPromptModal.tsx:14` — fires when modal becomes visible |
| 7. Google prompt accepted | `login_google_success` | `login_prompt` | `{}` | `components/LoginPromptModal.tsx:17` — fires after successful OAuth |
| 8. Bug reporter opened | `bug_reporter_opened` | `bug_reporter` | `{}` | `components/BugReporter.tsx:451` — fires in `openReporter` callback (shake or FAB tap) |

## Related events (already wired, useful for deeper analysis)

| Event | Notes |
|---|---|
| `login_google_pressed` | User tapped Google button (precursor to `_success` / `_failed`) |
| `login_google_failed` | OAuth failed — `{ error }` |
| `login_dismissed` | User tapped "אולי אחר כך" — explicit funnel exit |
| `play_button_tapped` | Distinguishes accidental taps from real intent (fires before `game_started`) |
| `tutorial_completed` / `tutorial_skipped` | First-run gating |
| `onboarding_completed` / `onboarding_skipped` / `onboarding_screen` | Multi-step onboarding flow |
| `hand_dealt` | Per-hand event (fires every hand, not just first) |
| `cards_placed` | Player explicitly placed their cards (opposite of `arrangement_timeout`) |
| `game_ended` | Game session ended |
| `streak_claimed` | Daily streak reward picked up |
| `result_viewed_duration` | Time spent on results screen |
| `share_pressed` / `complete_shared` | Viral share funnel |
| `screen_view` | Generic tab navigation (cups, friends, play, profile) |

## Funnel SQL — measure conversion

```sql
WITH base AS (
  SELECT
    device_id,
    bool_or(event_name = 'app_opened')         AS opened,
    bool_or(event_name = 'home_screen_loaded') AS home,
    bool_or(event_name = 'game_started')       AS started,
    bool_or(event_name = 'hand_completed')     AS first_hand,
    bool_or(event_name = 'google_prompt_shown')      AS prompted,
    bool_or(event_name = 'login_google_success')     AS signed_in,
    bool_or(event_name = 'arrangement_timeout')      AS timed_out
  FROM analytics_events
  WHERE created_at > now() - interval '24 hours'
  GROUP BY device_id
)
SELECT
  count(*) FILTER (WHERE opened)     AS step_1_opened,
  count(*) FILTER (WHERE home)       AS step_2_home,
  count(*) FILTER (WHERE started)    AS step_3_started,
  count(*) FILTER (WHERE first_hand) AS step_4_first_hand,
  count(*) FILTER (WHERE prompted)   AS step_5_google_prompt,
  count(*) FILTER (WHERE signed_in)  AS step_6_signed_in,
  count(*) FILTER (WHERE timed_out)  AS afk_timeouts
FROM base;
```

## Verification

```sql
SELECT event_name, count(*)
FROM analytics_events
WHERE created_at > now() - interval '2 minutes'
GROUP BY event_name
ORDER BY count(*) DESC;
```

Run against Supabase `gxrpunvhjcrzqnitbqah` (CAPS production).

## Notes

- `app_opened` and `home_screen_loaded` are duplicated across `app/index.tsx` (legacy) and `app/(tabs)/index.tsx` (current). The tabs version is live per CLAUDE.md. Dedupe in SQL by device_id + created_at minute.
- Anonymous users have `user_id = NULL`. Funnel SQL should bucket by `device_id` to avoid losing the pre-signup cohort.
- All `track()` calls are fire-and-forget; if Supabase or network is down, events drop silently. There is no client-side queue.