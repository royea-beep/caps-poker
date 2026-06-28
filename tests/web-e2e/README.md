# Layer 2 — web-e2e (Playwright, two contexts)

Two-browser-context smoke against a per-run Vercel preview deploy (never
prod, never the `caps.ftable.co.il` alias).

## Why two preview deploys?

The 2-client MP verify done in UNIFY-FINAL ran into shared-`localStorage`:
two tabs on the same origin share storage, so two anonymous Supabase
sessions collapse into one device_id. Two DIFFERENT preview deploys =
two DIFFERENT subdomains = two ORIGINS = two distinct `localStorage`
buckets. The Playwright harness here codifies that trick.

## Inputs

`PREVIEW_URL_A` and `PREVIEW_URL_B` — set by the CI job after running
`vercel deploy --yes` twice from the dist dir. The local runner can also
point both at the same URL but pass `--browser-context` flags that fork
storage (Playwright's `browser.newContext()` does this).

## Flow shape

`mp_2client.spec.ts`:
1. Open A + B, screenshot home at 390.
2. A and B both navigate `/lobby`, find first available 2-seat table,
   click Join (twice on B per the known refsReady race — proven in
   UNIFY-FINAL, harness retries by design).
3. Wait until both are at `/multiplayer-game`.
4. Screenshot placement on both, assert mint instruction pill present,
   assert NO popup-signature strings ("Daily Reward Ready", "Streak",
   "Level Up", "Weekly Recap", "Welcome to CAPS Poker!" toast, etc.).
5. Cross-check Supabase: `game_rooms.status='playing'` for the joined
   room, both `device_id`s in `room_players`.
6. Tear down: leave_table both, finish_table.

## Console assertion

Hooks `page.on('console')` and `page.on('pageerror')`. Any `severity:'error'`
that ISN'T in the known-benign list (audio-autoplay, etc.) fails the spec.

## Run locally

```
PREVIEW_URL_A=https://caps.ftable.co.il \
PREVIEW_URL_B=https://caps.ftable.co.il \
npx playwright test --config tests/web-e2e/playwright.config.ts
```

(In CI both URLs are isolated preview deploys.)
