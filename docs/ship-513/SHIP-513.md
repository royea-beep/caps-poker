# SHIP-513 — 2026-09-01 — merge every visual change, close the MP rematch gap, build 513

Roye approved the pixels (results before/after, shop, lobby — handoff 148). This sprint closes the
one flagged gap, merges the whole visual body of work to `main`, refreshes the stale baselines, and
ships build 513 to a device.

## 1 — The one gap, closed
- **MP `⚡ REMATCH` → ChipButton** (`5ed2872`). MP results has no sticky DEAL ME IN (that is
  `!isMultiplayer`), so the host `⚡ REMATCH` is the MP primary restart — the one plain `Button` left
  in this screen family. Now the app's mint ChipButton, matching the solo sticky. Same handler/gating.
- **Verified by rendering the MP results branch** (guarded render scaffold, removed before commit —
  NOT shipped), 320 + 393: `mp-rematch` mint `rgb(79,214,168)`, "You beat Alex" header, HOME present,
  `goldButtonHits = 0`, no clipping. Tie tally re-proven **2 WON · 1 TIED · 1 LOST = 4 = boardCount**.
- **2-client:** a true live 2-client MP session needs Supabase realtime (join_table + presence),
  blocked in-container — stated plainly. The MP RESULTS render is what was verified.

## 2 — Merged to main
- `f118a1e → 603202c` fast-forward (16 commits: the game five, results IA, shop/lobby/profile gilding,
  app-wide LuxuryBackdrop, MP rematch, build bump). Confirmed on the **remote ref**:
  `git ls-remote origin refs/heads/main = 603202c` (then `ff234ba` after the baseline commit).
- **Web by content delta** (live bundle `index-99a77718…js`, markers not hash — the app is one
  output:single bundle):

  | marker | hits | screen |
  |---|---|---|
  | `result-headline`, `board-tally` | 1, 1 | results hero |
  | `Hand details` / `Hide details` | 1 / 1 | progressive-disclosure toggle |
  | `results-play-again`, `mp-rematch` | 1, 1 | results / MP primary CTAs |
  | `rgba(201,168,76,0.45)` | 3 | gilded cards (profile + shop + lobby) |
  | `rgba(79,214,168,0.08)` | 2 | mint coachingBtn retint |
  | `Available Items`, `auto-start when full` | 1, 2 | shop / lobby present |
  | `buy-${…}` / `join-` testIDs | 1 / 1 | shop buy / lobby join chips |
  | `#4FD6A8` / `#C9A84C` (chip mint/brass) | 58 / 77 | ChipButton identity |
  | `513` | 18 | build number live |

- **goldButtonHits 0:** the results CTA is now the mint ChipButton (`results-play-again` present) and
  coachingBtn is mint; the old gold coachingBtn tint is gone from results. The 2 residual
  `rgba(255,215,0,0.08)` in the bundle are `replay.tsx` + `CompleteBanner.tsx` (a COMPLETE celebration
  banner — gold = WON is correct there), not a button. `DealMeInButton` (solid `#FFD700`) is now
  unused dead code, never rendered. Runtime `goldButtonHits = 0` was measured on the fixture build of
  the byte-identical results source; live `/results` needs a played hand a static visit can't reach.

## 3 — Baselines, then 513
- **BackstopJS baselines regenerated on Linux** (`backstop-baseline.yml` → `qa/backstop-baseline-refresh`,
  fast-forwarded into main as `ff234ba`). 10 scenarios changed: home, game, profile, shop, chip-store
  (big luxury jumps), and cups/friends/leaderboard/play/rank (3-tab nav + Linux re-capture).
- **LOOKED at all 10 before committing:** home = luxury masthead; game = amplified felt, **clear at
  full opacity (no coaching veil)**; profile/shop/chip-store = gilded; play/friends/leaderboard/cups/rank
  = valid screens with real data. None veiled, no 404, no frozen toast. (`chip-store` is a route alias
  of shop — identical bytes, expected.)
- **Bumped iOS build 512 → 513** (`603202c`). `app.json ios.buildNumber` is the build INPUT. **DB build
  keys absent** by design: `app_config.current_build` / `next_build_number` were deleted 2026-08-28
  (`build_source_of_truth = get_live_build()` device telemetry), so nothing disagrees. version 2.7.0.
- **iOS build DELIVERED** (`ios-testflight.yml`, run 33541200961, all steps green). The workflow greps
  the altool log for "UPLOAD SUCCEEDED" (altool can exit 0 on a failed upload), so this is a real
  delivery, not a green workflow. Quoted:
  ```
  BUILD_NUMBER: 513   MARKETING_VERSION: 2.7.0
  UPLOAD SUCCEEDED with no errors
  Delivery UUID: 1d4b2c78-6d00-436f-b6d6-96139ebe1e01
  Transferred 23224751 bytes in 0.969 seconds
  ```
  IPA byte size: **513 = 23,224,751 bytes** vs **512 = 23,214,022 bytes** → **+10,729 bytes** (+0.05%).

## 4 — Tap list (device) — see the PASTE block.

## Not touched
Winner cue (`#FFD700` 3px), card sizes, the 83px arc, tie-tally arithmetic, `KILL_Board`; no motion
added; no economy / reset / security / nav / flag touched.
