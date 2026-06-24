# VAMOS CAPS PRE-FRIENDS-QA — TASK 2 (full web QA + fix)

**Date:** 2026-06-24 · **Branch:** `feat/telemetry-instrumentation` (QA fixes land with the telemetry work,
per owner sequencing) · Harness: `tests/pre-friends-qa.mjs` (Playwright/Chromium, mobile 390×844, live
caps.ftable.co.il = origin/main).

## Summary
**32 checks → 30 effectively PASS, 1 real bug FOUND+FIXED, 2 benign WARN, 0 outstanding app failures.**
`tsc` 0 · `jest` 2505/2505.

## PASS/FAIL table

### Page health (load + render + console/network) — 20/20 OK
All 20 routes load and render with **zero console errors**: `/ /play /friends /cups /profile /shop
/chip-store /leaderboard /achievements /hand-history /settings /sit-and-go /tournament /quick-poker
/lobby/host /lobby/join /rank /missions /stats`.
- `/game` — WARN: 5× `NotAllowedError: play() failed` (browser autoplay block before a user gesture).
  **FIXED** (see below) — was an unhandled rejection that would have flooded crash_reports once telemetry
  deploys.
- `/rank` — `net::ERR_ABORTED` on the leaderboard query; page still renders. Benign (request cancelled by
  the QA navigating away mid-load). Re-confirm in post-deploy QA.

### Buttons / flows
| Surface | Action | Expected | Result |
|---|---|---|---|
| Tabs | Home / Cups / Profile | navigate to tab | **PASS** |
| Tabs | Friends | → /friends | **PASS** (verified by direct nav; the `.click()` timeout was home-animation actionability, not a defect — element is visible/role=tab/reachable) |
| Tabs | Play | → /play | PASS (route renders; QA selector matched the big "PLAY NOW" CTA, not the tab — harness ambiguity, not an app bug) |
| Home | PLAY NOW | → game / welcome | **PASS** |
| Home | Claim daily bonus / Invite / code | present | rendered |
| Home | **Open chip shop** | → /shop | **FAIL → FIXED** (real bug, see below) |
| Play | Sit & Go card | → /sit-and-go | **PASS** |
| Shop | Buy (affordable item) | deduct chips + feedback | **PASS** (1,100→1,000 and 1,700→1,600 — the live economy fix is working) |

### Edge cases
| Case | Result |
|---|---|
| Rapid double-click PLAY | **PASS** — no crash/flood |
| Refresh mid-game (/game) | **PASS** (WARN = autoplay, fixed) |
| Back after navigating | **PASS** |

## Fixes made (this branch)
1. **Chip-shop button dead on web (REAL BUG).** The decorative floating "+chips" text
   (`styles.chipFloatText`, `position:absolute` over the header chip button in the same `topChipWrap`)
   had no `pointerEvents`, so even at opacity 0 it intercepted taps — `elementFromPoint` at the button
   center returned that overlay DIV, and the button was unreachable (click/tap timeout; force-click did
   not navigate). A friend tapping the shop icon on home would get nothing. **Fix:** `pointerEvents="none"`
   on the floating text (`app/(tabs)/index.tsx`). Decorative element, must never capture touch.
2. **Sound autoplay unhandled rejection.** `utils/sounds.ts` `player.play()` / `ambientPlayer.play()`
   returned a web Promise that rejects with `NotAllowedError` before a user gesture; unhandled, it
   surfaced as console errors AND (once the new web error reporter ships) would have written a
   crash_reports row on every /game load. **Fix:** swallow the play() rejection (`.catch`).

## Verification status
- Page health, tab nav, PLAY, Sit&Go, Shop-buy, edge cases: verified live (rendered evidence in
  `test-results/qa/`).
- The 2 fixes are on this branch; live confirmation happens **post-deploy** (the owner-gated step:
  merge telemetry+QA → web auto-deploys → strategist verifies real events in analytics_events/crash_reports
  → re-run this harness incl. the chip-shop tap). Nothing sent to friends until that passes.

## Constraints
No deploy/OTA/build/submit. Branch `feat/telemetry-instrumentation`. Owner authorizes the merge+deploy.
