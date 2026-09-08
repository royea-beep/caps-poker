# CAPS Poker — Claude Code Brain

## Quick start
1. Run on Empire HQ (vjxqlqtlywovnbidovit):
   SELECT bot_landing_brief('caps-poker');
2. Read the response — it has EVERYTHING: state, blockers, rules, risks
3. Register your session:
   SELECT bot_register_session('caps-poker', 'cc-caps-main', 'claude_code', 'task description');
4. Heartbeat every 10-15 min:
   SELECT bot_heartbeat('SESSION_ID', 'current task');
5. End session:
   SELECT bot_end_session('SESSION_ID', 'handoff notes');

## Project IDs
- Supabase (CAPS): gxrpunvhjcrzqnitbqah
- Empire HQ: vjxqlqtlywovnbidovit
- GitHub: royea-beep/caps-poker
- Web: caps.ftable.co.il (Vercel)
- Local: C:\Projects\POKER\Caps

## Game rules (CRITICAL — memorize)
- Board count DYNAMIC: 2P=4, 3P=3, 4P=2
- Each player: 4 cards PER BOARD (not 4 total)
- Each board: 5 community cards
- Single 52-card deck, max 4 players
- Code: getBoardCount() + getCardsPerPlayer() in constants/gameConfig.ts
- NEVER hardcode board counts

## Current state (corrected 2026-09-07 — every number below was measured, not recalled)
- Version: 2.7.0 | Build: **515**, uploaded and proven installable from Apple's own records.
  (Was "B458 (building)". ⚠️ The build a device is RUNNING comes from `get_live_build()` —
  device telemetry — never from a number typed here or into `app_config`.)
- Tests: **2,846/2,846 across 53 suites** (was 2,474 — that figure was 372 tests stale)
- **73 tables, 198 functions, 12 views, 14 Edge Functions** (was "56 tables, 127 RPCs, 16 Edge
  Functions" — two of the three were low and the Edge Function count was high)
- Live data: **393 devices · 25 have ever played · 78 hands · 7 bindings · float 789,530 ·
  ledger gap 0 · 0 rooms have ever reached `playing` · 0 purchases, ever**
- **THE PRODUCT MAP IS `docs/product-map/PRODUCT-MAP-2026-09-07.md`** and it regenerates its
  route list from `app/`. Read it before describing a screen or a feature to anyone.
- ✅ **`/battle-pass` is CLOSED as of 2026-09-07 — the route redirects to Home.** It used to be
  unreachable but NOT dark: nothing linked to it, `battle_pass_enabled = false` gated nothing (no
  client code reads it), and typing the URL rendered a full screen with a running "55d 23h
  remaining" countdown and a premium button asking 5,000 chips — when the richest balance in the
  database is 3,250 and 0 of 60 reward ids resolve. ⚠️ **REDIRECT, NOT DELETE.** The screen lives
  at `components/BattlePassScreen.tsx` with its store, config and utils; reopening is ONE LINE and
  the route file carries the note saying what must be true first. **XP was not touched** — it
  accrues after every hand and shows on the results screen.
- ⚠️ **The TestFlight public link is DISABLED** since 2026-09-07, proven by Apple's read-back.
  Re-enabling it makes it resolve again but installs nothing until 515 passes Beta App Review.
- Visual: green felt — `FELT_GRADIENT.classic` `['#003115','#062E18']`, which BoardSurface
  lifts to rgb(26,70,44) for the table top. Card face **#FCFAF3**, red/black suits.
  (Was "maroon felt #5C1818, warm cards #FFFEF8" — wrong on BOTH halves. That line was
  ADDED in 3ed2b8a on 2026-08-22, the same commit that introduced the paint-theme system
  and set cardFace to #FCFAF3 — so it described the app it was replacing and was false the
  day it was written. The app has never rendered #FFFEF8 since.)
- **3 tabs: Home · Play · Profile** (corrected 2026-09-03). It was five until `eaf9201`
  (2026-08-31) cut it to three. `friends` and `cups` are STILL ROUTES but are registered
  `href: null` in `app/(tabs)/_layout.tsx` — off the tab bar, reached from Home / the SideMenu.
  Do not "restore" them to the bar: the removal was deliberate (de-duplicate destinations).
- **LANGUAGE — CAPS IS ENGLISH-FIRST, AND THAT IS THE CORRECT STATE (recorded 2026-09-03).**
  CAPS is a GLOBAL app. **English is the default and the primary language.** Hebrew exists for the
  Israeli pilot only — and that pilot will include players from anywhere. Hebrew is an ADDITION,
  never the requirement.
  ⚠️ A screen rendering English is NOT a defect and NOT a gap. Two earlier docs framed
  "ten screens are still 100% English" as something to fix; that framing was WRONG and is
  retracted here so no future session re-derives "the app should be Hebrew" and starts translating.
  THE REAL DEFECT IS THE HALF-STATE: the app offers Hebrew, then delivers English on most screens,
  and leaks English strings into the screens it did translate (the home daily-bonus chip and the
  legal line are live examples). Either a screen is translated or the app should not claim that
  language for it. **Consistency is the defect; the English is not.**
  Mechanics: Hebrew went live 2026-09-02 (`52df7cc` un-forced `getLanguage()`); `caps_language`
  is applied; hand-rank NAMES stay English on purpose (poker terminology).
- **LADDER — server-authoritative since 2026-09-03 (CLOSE-S2).** `elo`/`games_played`/`wins` move
  ONLY for the service-role writer (the `resolve-hand` edge function adjudicating multiplayer).
  Solo-vs-bots (`quick_poker`) NO LONGER moves the competitive ladder, exactly as practice never
  did. A client-written `hand_history` row records history and moves no ladder — that is what
  closed the device_id forge. The lobby is empty (0 rooms have ever finished), so nobody climbs
  today. This is deliberate; do not "fix" it back.
- **S1 CLOSED — server-side, on production, 2026-09-03.** `econ_bind_ok` no longer returns true for
  a caller with **no session**, and no longer returns true from its `WHEN OTHERS` handler.
  ⚠️ IT REFUSES **NO SESSION**, NOT **ANONYMOUS** — anonymous players arrive with role
  `authenticated` and a `sub` claim, so they pass exactly as before. Do NOT "simplify" this into a
  check on `auth.users.is_anonymous`, and do NOT re-add a `v_uid IS NULL -> true` shortcut: either
  change locks out ~99.7% of real devices. `service_role` is allowed FIRST and on purpose, because
  `resolve-hand` settles multiplayer with no user session and is the only writer that can pay a
  dropped seat. `submit_score` gained the guard it never had — it was the third mint vector, and
  PART 1 alone would have left it open. Proven: raw anon minted 2,000 before and 0 after; a
  brand-new anonymous device cold-launched against production still gets its grant and plays.
  ⚠️ STILL OPEN: `submit_score` moves `leaderboard.total_chips` with NO `chip_transactions` row, so
  it can break the gap invariant. Gated now, but still unledgered.
- ⚠️ **The catch-all 404 was fixed in the WRONG FILE on 2026-09-03 and only went live 2026-09-07.**
  The exclusion went into the ROOT `vercel.json`. **PRODUCTION NEVER READS THAT FILE** — the deploy
  runs `npx vercel --prod` from `dist/`, and **`scripts/fix-web-html.js` writes `dist/vercel.json`**,
  which still carried `{ source: "/(.*)" }`. Measured on the live site four days later: `/nope.png`,
  `/nope.mp4` and `/definitely-missing.html` all returned **200 with 1,902 bytes of the app's HTML**.
  The generator's own comment had said since 2026-08-15 that the root file is never read in prod.
  **EDIT `scripts/fix-web-html.js` FOR ANYTHING THAT MUST SHIP — headers, rewrites, redirects.**
  The root file is kept identical so `vercel dev` matches; `tests/vercel-rewrites.test.ts` now reads
  the GENERATOR's source and fails if the two disagree (proven to fire).
- ✅ **THE REPORTER IS HONEST STILLS NOW, AND SAYS WHEN IT LOSES ONE (2026-09-08).** `report_type`
  is DERIVED — `'frames'` when frames arrived, else `'text'` (nothing anywhere filters on it,
  checked across the client, scripts and all 14 Edge Functions); `has_video` is `false`; the WHOLE
  burst uploads (8s each, one 12s retry) into `metadata.frame_urls` with
  `frames_captured`/`frames_uploaded`/`attachment_complete`; and a failed attachment writes
  `[attachment incomplete — N of M screen frames failed to upload]` into `description` and changes
  the toast. ⚠️ **`video_url` IS STILL WRITTEN ON PURPOSE** — four Edge Functions read it and two
  (`analyze-bug-report:234`, `retriage-pending:195`) already assign it to a var called
  `screenshotUrl`; it feeds the AI triage vision call and the Telegram photo, and Edge Functions
  cannot be deployed from a VAMOS lane. It carries the LAST frame. Audio untouched — 27 real `.m4a`.
  ⚠️ **CORRECTION to handoff 196:** the nine lost frames were NOT the "leading comma" in
  `handleStop` — that value is a duplicate of the last frame and `crashDetector.ts:53` uses it. The
  loss was at the upload, which only sent `frames[length-1]`.
  ⚠️ **NO LIVE PROOF YET — needs a device.** `BugReporter.handleStart` returns early on web
  (`:472`), so no browser can start the recorder. A settings-entry E2E also failed here: the
  container's browser cannot reach Supabase (`TypeError: Failed to fetch`) even though curl can —
  and the ROW proved it, 252 unchanged, 0 rows with the stamp, while the rig's log said "submitted".
  ⚠️ **TWO WRITERS EXIST**: `ReportBugButton.tsx` (Settings, text only, always honest) and
  `BugReporter.tsx` (shake/FAB, the media path). Do not assume a fix to one touches the other.
- ⚠️ **THE SOLO ARRANGEMENT PHASE HAS NO CLOCK — "MORE TIME WHERE IT SCROLLS" IS A NO-OP THERE
  (2026-09-08).** `startCountdown()` has exactly ONE call site, inside the player's READY handler,
  and it runs AFTER `setPlayerReady(true)` — so the timeout branch, gated on `!playerReady`, can
  never fire; and if the bots are already done (they are, immediately) the same handler navigates on
  the next line. `app/game.tsx:713` says it outright: *"Solo: bots never start countdown — player
  has free thinking time."* WATCHED IT: 47s on the 320/2P placement screen, 31 samples, no countdown
  painted, no auto-resolve (`tests/solo-clock-reachability.mjs`). **A solo player has unlimited time
  to arrange.** The derived clock IS wired and tested (`getArrangeSeconds` in `constants/gameConfig.ts`
  → 70s/44s/33s vs 30s base, from `boardsContentH/boardsAvailH`, the same two numbers that decide
  `boardsScroll`) but it changes nothing a solo player feels. Kept so the day a solo clock is
  switched on it is already layout-aware. ⚠️ **THE REAL CLOCK IS MULTIPLAYER'S** — `COUNTDOWN_SECS
  = 60`, BROADCAST, with `DEAL_CLOCK_MS` 15s above it. Both ways to extend it break one of Roye's
  rules: per-device desyncs players, and raising the shared constant lengthens it where the layout
  fits. The clean fix is server-side per-room. **Roye's call; 0 rooms have ever reached `playing`.**
  ⚠️ **PROBE LESSON, second time:** a text locator on `/READY/` grabs the BOT's "✓ READY" status pill
  before the commit button — the click lands on a label, nothing happens, and the rig reports a
  broken product. Use `getByRole('button')`. Trace the URL after a click before believing a failure.
- ⚠️ **BOARD 4 SCROLLS AND CANNOT STOP WITHOUT SMALLER CARDS (measured 2026-09-08).** Both engines:
  **320/2P hides 271px** (206/477), **320/3P hides 113px** (254/367), **393/2P hides 44px**
  (512/556); 393/3P, 393/4P and 320/4P fit. 271px is NOT recoverable from spacing, and
  `useGameLayout` already searches card width down and sets `boardsScroll` only when the minimum
  still does not fit — the system had already concluded it. **Roye ruled card sizes stay, so this is
  his trade, not a defect to fix.** Shipped instead: a **"▼ N more boards below"** pill, absolutely
  positioned in a `pointerEvents="box-none"` row so it adds ZERO height — every overflow number is
  identical before and after — appearing only where content is hidden and paging down on one tap.
  ⚠️ The first fit probe reported **0px in all 12 cells** because it matched any element with
  `overflow-y:auto` containing a BOARD label (the document qualifies). A scroller that is not
  scrolling is not the scroller — select by ACTUAL overflow. And the first pill passed every
  assertion while **covering board 4's cards**; only looking caught it.
- ⚠️ **THE 252 BUG REPORTS ARE 195 MACHINE PINGS — AND THE "VIDEO" REPORTER HAS NEVER SHOT A VIDEO
  (read 2026-09-08).** Of the 204 rows with no summary: **195 are `[ping] app opened vX` dev
  telemetry** (writer still live at `components/BugReporter.tsx:380`, `__DEV__`-gated so it cannot
  fire from TestFlight), 1 is a self-declared test, 5 are empty video shells, and the **3 with human
  sentences are SEEDS** — they arrived via `submit_feedback`, an RPC with **zero callers in the
  repo**, tagged `tournament_lobby`/`cash_table`, screens CAPS does not have, and one praises
  tournaments that have never existed. **0 of the 204 are a player's words.** The real voice is the
  48 rows that WERE summarised and closed in March/April.
  ⚠️ **`video_url` HOLDS A JPEG.** Measured: 29 rows have one, **29 of 29 point at
  `/frames/bug-frame-*.jpg`, 0 are mp4/mov/webm, and 29 of 29 equal `screenshot_url`.**
  `utils/screenRecorder.ts` samples ≤10 stills at 0.5fps (`MAX_FRAMES = 10`), `stopRecording()`'s
  return is discarded by a leading comma, and only the LAST frame is uploaded — nine of ten are
  thrown away every report. `report_type: 'video'` is a hardcoded literal. Losses are silent:
  **7 of 36** `has_video` rows have no URL (5s upload timeout → null), **15 of 42** lost the audio.
  ✅ **ZERO reports about multiplayer or the lobby, ever** — a regex over every text column across
  all 252 returns 2 hits and neither is about multiplayer. The tester round will be the first time
  those surfaces are exercised by anyone.
  ⚠️ **AND THE CARD REPORT IS STILL LIVE AND WAS ANSWERED BACKWARDS.** One tester asked twelve times
  (reports 9/22/70/72/73/74/75/77/78/81, MASTER #7, plus the May 1★ #713) to delete the top-left
  corner index and keep a LARGE CENTRE RANK. Measured on the built app: a 2P card is 40×56px with
  exactly three glyphs — **rank 12px in the corner, suit 9px under it, suit 26px in the centre.
  There is NO centre rank at any player count.** So the rank appears once, at the smallest size on
  the card, while 26px repeats the suit. 515 kept the corner, ADDED a bottom-right one, and deleted
  the centre rank. `Card.tsx:23` says the corners are "DELIBERATELY UNTOUCHED" — it is a decision,
  not a defect, and it is Roye's to reverse or confirm. Also `Card.tsx:25` claims the bottom-right
  index shows at 3P; measured 0 at BOTH 2P (40px) and 3P (46px) — both under its 54px gate.
- ⚠️ **`submit_score` MINTS UNLEDGERED — REPRODUCED IN PRODUCTION 2026-09-08, no longer theoretical.**
  With a real ANONYMOUS session (anyone can mint one from the public key in one HTTP call — proven:
  `role: authenticated, is_anonymous: true`) a brand-new device was driven to **total_chips 9,000 /
  ledger_sum 6,000 / GAP 3,000**. The 3,000 is exactly the `submit_score` gains, which write no
  `chip_transactions` row. Bounded and the bound holds: **5,000 per device per day**, shared with
  `record_reward`, which refused correctly with `reward_cap_daily`. But 9,000 is ~3× the richest
  real player (3,250), reached without playing a hand.
  ⚠️ **WHY THE LIVE GAP IS STILL 0**: `app/results.tsx` calls `submit_score` as an ABSOLUTE
  read-back write of the balance the ledger already produced, sequenced after every ledgered delta,
  so normal play grants nothing. The hole is that the server **CLAMPS a caller-supplied number
  instead of DERIVING it from a verified game event**. ✅ The ladder did NOT move — `elo` stayed
  1000, `games_played` 0 — so **S2 holds**; `hands_played` is forgeable, the competitive ladder is
  not. **This is the single most valuable thing left to fix.**
- ⚠️ **`finish_table` REAPS ABANDONED ROOMS BY DESIGN — and my first reading of that was wrong.**
  A stranger with no session ended `5JT6` and `CZ9Z` (`waiting → finished`, confirmed by SELECT).
  Reading the function shows why: `IF NOT v_is_participant AND v_has_fresh_seat THEN
  RETURN 'not_authorized'` — a stranger is refused **only if a seat was seen in the last 90
  seconds**. Both rooms had `roster_cleared: 0` and `room_players` is EMPTY across the whole
  database, so what ran was the deliberate abandoned-room reaper, NOT a griefing vector.
  The narrower real risk: room codes are **4 characters** and the protection lapses 90s after a
  heartbeat, so a backgrounded tester's waiting room can be ended by anyone guessing the code.
  ⚠️ **COULD NOT VERIFY** the branch that protects a LIVE seat — `create_table` refuses a forged
  host (FK to `users`). Those two rooms are left `finished`: never hand-edit a `game_rooms` row.
- ⚠️ **FINAL-QA 2026-09-08 — `docs/final-qa/FINAL-QA-2026-09-08.md`. Suite 2,866/2,866, tsc clean.**
  Ground truth re-measured independently and matches: **398 devices · 25 played · 78 hands · 12
  bindings · gap 0 · max 3,250 · 0 purchases**. Two numbers here were stale and are corrected:
  **float is 800,920** (was 789,530) and there are **9 rooms, all `waiting`/`finished`, 0 ever
  `playing`**. Every mint vector WITHOUT a session refuses with `identity_mismatch`; `earn_chips`
  refuses a negative with `invalid_amount`; direct writes to `leaderboard`, `chip_transactions` and
  `game_rooms` are all `permission denied`; `get_leaderboard` leaks **no user_id, no device_id, no
  uuid**; `delete_user_account` is revoked for anon AND authenticated. Card face measured
  **rgb(252,250,243) = #FCFAF3 exactly**. Privacy page md5 identical across live, repo and dist.
  ⚠️ **A 204 IS NOT A WRITE.** An anon PATCH on `leaderboard` returned **HTTP 204** and changed
  nothing — RLS matched zero rows. Reporting the status code would have filed a catastrophic false
  positive. Read the row.
  ⚠️ **STILL OVERPROMISING, all verified live and unfixed:** `/lobby` says "auto-start when full"
  in TWO places (`app/lobby/index.tsx:280` and `utils/i18n.ts:1214`, so the Play screen says it
  too) while 0 rooms have ever played · `/club/DEMO` opens a club for any typed code · an unknown
  route renders Expo Router's developer page **"Unmatched Route … Go back • Sitemap"** (confirmed
  on production: live `/nope-xyz` returns the same 1,902-byte shell as `/`) · and `/shop`,
  `/chip-store`, `/achievements`, `/rank` have a loading state with **no failure state**, while
  `/leaderboard` shows headers with no empty state.
  ⚠️ **SIX INSTRUMENT FAILURES IN ONE SPRINT, every one caught by looking at the output:**
  `python3 -m http.server` does no SPA rewrite and reported **32 of 33 routes broken** · I read the
  card faces as grey and the measurement said #FCFAF3 · a tooltip selector matched a 393×852
  wrapper and invented 16 overlaps · the first attack batch used wrong RPC parameter names so
  refusals and 404s were indistinguishable · the 204 above · and my first `finish_table` verdict.
  **`tests/serve-dist-like-prod.mjs` now serves `dist/` using `dist/vercel.json`'s OWN rules** so a
  local walk reproduces production, honest 404s included. Use it instead of a static server.
  ⚠️ **NEVER VERIFIED, said plainly:** native iOS rendering on a device · the reporter's media path
  (`BugReporter.handleStart` returns early on web) · two real clients in one room · MP under load.
  The container's browser **cannot reach Supabase or caps.ftable.co.il** — `fetch` THREW for both
  while `curl` reached both — so every browser check runs backend-dark.
- ✅ **THE SECRET GUARD EXISTS AND HAS BEEN WATCHED REFUSING A REAL COMMIT (2026-09-08).** Both
  halves, since `41b534d` on 2026-09-06: `.githooks/pre-commit` (installed by a `prepare` script in
  `package.json`, because `core.hooksPath` is local config a fresh clone does not get) and
  `.github/workflows/secret-scan.yml` on every push and PR — the hook is the fast local no, the
  workflow is the one `--no-verify` cannot skip. `scripts/scan-secrets.mjs` walks **`git ls-files`**,
  so **`docs/**` and every `.json` are in scope**; the token leaked in `docs/MASTER_INDEX.md` as well
  as in source, and a source-only scanner would have caught half of it.
  **Proven three ways, not asserted:** `--rev a40ea15` and `--rev 345c327` BLOCK the two commits that
  actually leaked the bot token, naming `docs/MASTER_INDEX.md` first; a real `git commit` carrying a
  fake token in a `.ts`, a `.md` and a `.json` exited 1 with HEAD unmoved; and over **820 commits /
  4,142 files those two are the ONLY refusals — 0 false positives**, now a standing CI step
  (`tests/secret-scan-falsepos.mjs`). Current tree: **clean**. Nothing rotated.
  ⚠️ **TWO SILENT HOLES WERE FOUND AND CLOSED, and both are this project's signature shape.**
  `--staged` read the WORKING TREE, so staging a secret then scrubbing the file passed — it now reads
  the INDEX (`git show :<path>`), which is what `git commit` writes. And a shell-interpolated path
  made git die on `app/(tabs)/index.tsx` — parentheses are shell syntax — with the throw swallowed by
  a `catch`, so the app's 2,475-line home screen was never opened while the scanner printed "clean".
  Every git call is `execFileSync` with an argument array now. **Caught by looking at the output.**
- ⚠️ **THE ROOT `vercel.json` IS KEPT ON PURPOSE, AND IT NOW LABELS ITSELF (2026-09-08).** It is NOT
  read by the deploy that serves caps.ftable.co.il — that is `dist/vercel.json` from
  `scripts/fix-web-html.js` — but it IS read by Vercel's Git integration (that schema check is what
  failed 29 deploys), and its `buildCommand` is a WORKING build, so it is the correct fallback if the
  Ignored Build Step is ever switched off. Deleting it would swap a labelled trap for a silent
  zero-config deploy of the repo root onto the production domain.
  **The warning is the VALUE of `installCommand`, the file's first key** — a legal string in a legal
  field, NOT a new property, so the closed schema is untouched, and it prints into the build log of
  any deploy that ever uses this config. It still ends in `npm install`. Four tests hold it; two were
  proven to fire by stripping the warning and by planting an apostrophe. ⚠️ A note BESIDE a trap is
  not a label ON it: the generator has carried the same sentence in a real comment since 2026-08-15
  and it stopped nobody, me included.
  Sibling sweep: no shadow copies exist today (`public/privacy.html`, `public/terms.html`,
  `public/bugs`, `public/hand` all absent), and no generated output is tracked.
- ✅ **`ios-testflight-DISABLED.yml` IS DELETED (2026-09-08, Roye's call).** The name said off; GitHub
  said `state: "active"` and it carried a live `workflow_dispatch:`. It had **never run once —
  `total_count: 0`** — while still importing a p12 and signing with the cert its own header calls
  revoked (`45EBC138DF94E77658BA9558EAAE19FC`). Apple hard-limits ~10 uploads per app per day.
  ⚠️ **`.github/workflows/ios-testflight.yml` IS THE ONLY WORKFLOW THAT BUILDS CAPS**, and that was
  CHECKED, not read off the names: run 1227 (`34107249013`), `workflow_dispatch` on main, **success**,
  head `b8b7ae1a3` — and `git show b8b7ae1a3:app.json` reads `ios.buildNumber: 515`, which is the
  input its own step reads via `node -p "require('./app.json').expo.ios.buildNumber"`. Same workflow
  succeeded for 509→515, seven in a row. The deleted file's stated keep-condition — *"KEPT until this
  one produces a successful build"* — was met seven times over. Nothing referenced it: no
  `workflow_call`, no `uses: ./`, no script, no dispatch by display name; the seven hits were all
  prose. Its two header lines in `ios-testflight.yml` were rewritten in the same commit, because a
  comment pointing at a deleted file is the defect being closed. Diff still available:
  `git show 9577aa5:.github/workflows/ios-testflight-DISABLED.yml`.
  ⚠️ **STILL LYING, REPORTED NOT CHANGED:** `asc-details.yml` and `asc-list.yml` are listed by GitHub
  as `active` workflows with **NO FILE** in the working tree, on `origin/main`, or anywhere in this
  clone's history · `ios-testflight-free.yml` is named "FREE — no EAS cloud" and runs `eas build`
  against the dead Expo account (last run 2026-06-25) · `ios-simulator-smoke.yml` runs `eas build`
  on **push** · `variant="gold"` survives at `app/simulate.tsx:232` and `:323` and has painted MINT
  since the theme sweep · and `MEMORY.md:951` still instructs a future session to wire a new cert
  into the file just deleted. ✅ `KILL_Board`/`KILL_game` are NOT liars — `KILL_FINITE_ON_THIS_PLATFORM
  = true`, name matches state; the "false on web" line is honest history of a reverted experiment.
- ⚠️ **THE `paths-ignore` RULE HAS NEVER FIRED. BUILDS DID NOT DROP (measured 2026-09-08).** It is on
  the branch, **not on `origin/main`**, and it only triggers on pushes to main. The last Web Deploy
  run started at 07:39:12Z; the rule was committed at 08:25:34Z — **46 minutes later**. Successful
  runs per day went 7 (09-07) → 1 (09-08), and that is a quiet day, not a saving.
  What it WOULD save, measured the same way: of **70 successful runs, 24 (34%)** had a diff entirely
  of `docs/**` or `**/*.md`. Aimed correctly, saved nothing yet. **First thing to check after the
  next merge to main: a docs-only push must show NO Web Deploy run.** No dollar figure is claimed —
  this session has no billing access. Red deploys still cost nothing (`buildingAt == ready`, no
  build-log events, no container).
- ⚠️ **`vercel.json` IS JSON — A COMMENT IN IT KILLED EVERY GIT DEPLOY FOR FIVE DAYS (2026-09-08).**
  The SAME 2026-09-03 commit that put the 404 fix in the wrong file also added a `_comment_rewrites`
  array to the ROOT `vercel.json` to explain the change. JSON has no comment syntax, so that is a
  real property, and Vercel validates `vercel.json` against a CLOSED schema **BEFORE** it runs the
  project's Ignored Build Step. Measured over 21.7 hours: **40 deploys — 29 ERROR, 8 READY,
  3 CANCELED**, every ERROR carrying
  `should NOT have additional property _comment_rewrites`. Fixed by deleting the key;
  `tests/vercel-rewrites.test.ts` now fails on any top-level key outside Vercel's schema or
  starting with `_`, and was proven to fire by putting the defect back.
  ⚠️ **AND THE RED WAS NOT THE BILL.** A failed deploy has `buildingAt == ready == createdAt` and
  NO build log events — no container is ever allocated, so 29 failures cost nothing. The money went
  to the GREEN ones: **5 of the 8 production deploys in that window were pushes whose entire diff
  was a `.md` or something under `docs/`**, each running a full `expo export` + Playwright + WCAG +
  BackstopJS + `vercel --prod` to publish a byte-identical bundle. `web-deploy.yml` now carries
  `paths-ignore: ['docs/**', '**/*.md']`. ⚠️ **That ignore is NOT yet proven on a live trigger** —
  it only fires on pushes to `main`. Check the first docs-only push to main shows NO Web Deploy run.
  ✅ **An Ignored Build Step ALREADY EXISTS on `caps-poker-web` and on `wingman-api-staging`, and it
  skips EVERYTHING, not just docs** — proven by a CANCELED deploy of `820b6c6`, a twelve-file
  application-code commit. Do NOT "add" one, and do NOT disconnect the Git integration: the skip is
  the control that was already working, and the schema error was merely running before it.
- **FIVE-O is NAVY, not red (corrected 2026-09-03).** `visual.fiveo` paints surface `#1A1A2E` with a
  mint `#4FD6A8` accent. The picker showed a `#5c0000` red preview and said "Red felt / Bold action";
  both are corrected. Same class as the maroon-felt line above — a description contradicting the
  product. If you are about to "restore the red", read `constants/paintThemes.ts` first.
- **The landing page carries the explainer video (2026-09-07).** `public/landing.html`, between the
  one-line mechanic and the call to action. The mp4 is **hosted on Supabase Storage, not vendored**;
  its sha256 and byte size are pinned in a comment beside the embed because **three files have worn
  that filename**. Muted, `controls`, no autoplay, `preload="metadata"`, poster
  `public/shots/explainer-poster.webp` (the clip's end card — a gameplay frame loses because
  Chromium's control bar covers the burnt-in caption, and every placement frame shows the demo
  balance 499,900). The video is **English on both language pages** and only the chrome translates;
  that is correct, not a gap. `tests/film-verify.mjs` asserts all of it across 2 engines × 2
  languages × 320/393.
- ⚠️ **THE APP STORE LISTING IS BLANK — not stale, blank (read from Apple 2026-09-08).** Every
  text field is `null`: subtitle, description, keywords, promo text, what's new, support URL,
  marketing URL, privacy policy URL, both categories. **Zero screenshots.** The age-rating
  questionnaire has **never been answered** (`gamblingSimulated: null`, override NONE), so the app
  is not 12+ or 17+ — it is unrated. The version record still reads **1.0, created 2026-03-11**,
  and the listing name is `CAPS - Card game` while everything else says CAPS POKER. Every one of
  those was an HTTP 200 read, so they are findings, not failed reads. **The app therefore cannot
  be submitted today**: Apple requires a description, support URL, privacy URL, category, an
  answered age rating and one screenshot. Drafted copy is in
  `docs/last-gaps/THE-LAST-GAPS-2026-09-08.md`; NOTHING was changed and nothing submitted. Re-read
  it any time with Actions → Manage TestFlight → `store-listing` (GET only).
  ✅ **THE SCREENSHOTS ARE RE-SHOT: `docs/product-map/store-515/`** — 9 screens × 2 sizes, 1320×2868
  (6.9″, Apple's current primary) and 1290×2796 (6.7″), every file's real pixel size asserted after
  writing and every file checked BY OCR for Hebrew and for an implausible balance.
  Hands are genuinely played by the rig, so home, profile, hand history and results carry earned
  content. `docs/product-map/store/SUPERSEDED.md` marks the old set do-not-upload.
  ⚠️ **AND A CORRECTION: THE SHOP IS NOT EMPTY AND NEVER WAS.** On 2026-09-08 I dropped the shop
  shot and wrote that "payments are off, so a stocked shop is a state no player can reach". WRONG.
  `chip_config` holds **TEN ACTIVE ITEMS** — emote packs, card backs, avatars, a table theme —
  priced **100 to 500 CHIPS**, all affordable on a 2,000 starting balance. They are bought with
  CHIPS via `spend_chips`; payments being off stops you BUYING chips with money, not SPENDING them.
  "Shop is empty right now" appeared because my sweep runs with the backend ABORTED. **That empty
  state was my rig's, not the product's** — and the 2026-09-03 shop screenshot was almost certainly
  captured the same way. Read the RPC before inferring a cause from an empty screen.
  ⚠️ These are WEB-EXPORT renders in headless Chromium, NOT iOS captures. One consequence is
  visible: "⚔️ Challenge a Friend" on home renders as a thin monochrome cross, because U+2694 is
  text-default and a text font wins even after VS16; iOS draws it in colour. Three fontconfig
  approaches failed to move Chromium's own fallback. Capture home on a device if it must be perfect.
  ⚠️ Three product defects the big captures exposed, all UNFIXED: the achievements filter row clips
  "Collection"; the reveal's DANGER pill overflows the left edge and reads "ANGER"; and the
  "You won 50 chips!" toast lands ON TOP OF the YOU WIN headline on results (the rig now waits for
  it to clear, the overlap itself is still there).
- ✅ **The three cold-visit defects are CLOSED (2026-09-08).**
  ⚠️ **THE BUY-IN IS CHARGED ON COMMIT, NOT ON MOUNT.** Typing `/game` used to take 75 chips the
  instant the page rendered — measured 2,000 → 1,925, no prompt, no hand. It now fires from
  `chargeBuyInOnce()` (`app/game.tsx:320`) via `confirmPlacement()`, which BOTH commit paths call:
  READY, and the arrangement clock expiring (that second path resolves a hand without ever calling
  `handleReady`, which is how `cards_placed` under-fired for months). `doNavigate()` calls the same
  guarded function as a backstop so no completed hand is free. **The amount and every rule are
  unchanged — only the moment moved.** Proven by `tests/buyin-on-commit.mjs`: abandoned URL 0,
  played hand exactly the derived buy-in, practice 0; and the probe was proven to fire by putting
  the defect back (3/6). ⚠️ Do not measure this with the BALANCE — a hand resolves and winnings land
  in the same tick (two runs gave 1,925 and 2,262). Use `totalChipsSpent`.
  · `/gameover` now redirects Home unless the balance is genuinely below `getMatchCost(...)` — it
  used to say "Not enough chips to continue" above the number 2,000.
  · `/multiplayer-game` with no room now renders `/lobby/table`'s EXISTING sentence, "Online
  multiplayer is unavailable right now" — deliberately not a third wording for one fact.
  ⚠️ STILL OPEN, reported and left for Roye: `/lobby` promises "auto-start when full" while 0 rooms
  have ever reached `playing`, and `/club/DEMO` renders a full club for any typed code.
- ⚠️ **THE PRIVACY PAGE IS `privacy.html` AT THE REPO ROOT — NOT `public/`.** `expo export` copies
  `public/` into `dist/`, and **then** `scripts/fix-web-html.js` copies the ROOT `privacy.html` over
  the top, so a `public/privacy.html` would be silently overwritten. Same class as the 404 fix.
  `tests/privacy-page.test.ts` asserts no shadow copy exists AND pins every claim to the code.
  Rewritten 2026-09-08 from the source; the page it replaced was Hebrew-only, dated April, and
  wrong on four counts: it promised in-app account deletion (the RPC is REVOKED —
  `delete_user_account` is anon=false/authenticated=false, so the Settings button always fails),
  described Apple processing payments (0 purchases, ever), claimed no third-party sharing, and said
  12+. **Seven third parties genuinely receive data**: Supabase · Vercel · Google (only on sign-in)
  · **Telegram** (an `on_bug_report_inserted` AFTER INSERT trigger forwards every bug report, with
  its screenshot, to a private channel) · **Anthropic** (the Claude API summarises every report) ·
  **OpenAI** (Whisper, only when audio is attached) · **Expo** (push delivery). ⚠️ A bug report also
  carries a breadcrumb trail, the last 20 console lines, the device id and the build number — the
  page now says so.
- **THE LISTING PACK IS `docs/listing/LISTING-PACK-2026-09-08.md`** — description, subtitle,
  keywords, promo text, what's new, support URL, privacy URL, category and the exact age-rating
  answers, ready to paste. ⚠️ NOTHING has been written to App Store Connect. Two likely rejections
  are named there and are CODE, not metadata: **Google sign-in without Sign in with Apple**, and the
  **in-app delete-account control that cannot work**.
- Auth: Anonymous + Google login prompt after game 3-5

## Key RPCs
- health_check() — run first every session
- get_current_build() — what build is live
- delete_user_account(device_id, user_id) — account deletion (22 tables)
- merge_guest_to_user(device_id, user_id) — guest to Google merge
- track_event(event, device_id, properties, screen) — analytics
- get_home_screen_v3(device_id or user_id) — home data

## Key files
- app/(tabs)/index.tsx — Home (2475 lines)
- app/game.tsx — Game (~1486 lines)
- app/results.tsx — Results (~1099 lines)
- app/settings.tsx — Settings + account deletion
- components/Card.tsx — Card rendering (CARD BIBLE)
- components/Board.tsx — Board display
- utils/auth.ts — Anonymous + Google auth
- utils/analytics.ts — Supabase track_event
- utils/supabase.ts — Client with AsyncStorage persistence
- constants/gameConfig.ts — getBoardCount(), game constants

## Hard rules
- DO NOT hardcode board counts — use getBoardCount()
- Colors look PINK on screen — go 2-3x darker than hex picker
- Alert.alert fails on web — skip on web, navigate directly
- expo-file-system legacy functions BROKEN in SDK 55
- All analytics via Supabase track_event RPC (NOT PostHog)
- Never suggest App Store submission unless Roye says so
- GitHub Actions builds (not EAS)
- VAMOS = always .md file, never chat-only instructions
- ⚠️ **NEVER PUT PROSE IN A `.json` FILE.** `vercel.json`, `app.json`, `package.json` — a `_comment`
  key is a real property and a closed schema rejects the whole file. Explanations go in the `.js`
  that generates it (`scripts/fix-web-html.js`), in a test, or in a doc. This cost five days of red.
- ⚠️ **BUNDLE DOCS WITH THE CODE THEY DOCUMENT.** A docs-only push to `main` used to trigger a full
  web build and a production deploy. One commit per section of a brief — code, tests and docs together.
- ⚠️ **A FILENAME IS NOT EVIDENCE. Verify by CONTENT, and verify at the place that actually SHIPS.**
  This shape has now cost this project six times: Hebrew screenshots under two names · the icon
  overwritten six times in place · a stale bundle under an unchanged hash · three different files
  called `caps-explainer-FINAL.mp4` · the catch-all 404 fixed in `vercel.json` when prod reads
  `dist/vercel.json` · and `variant="gold"` on a button that has painted MINT since the theme sweep.
  Before believing a file is what its name says: read its bytes, and check which copy the deploy,
  the CI gate or the bundler actually consumes. A test that certifies the wrong file is worse than
  no test — it is a green check over an open hole, and one stood for five days.

## Before ANY release
1. Full test suite green
2. Visual check every screen on device
3. Progressive disclosure: screens not overloaded for new players
4. No half-done features visible
5. No encoding bugs (check for broken emoji/unicode)

## Visual QA (added Apr 27)

Before any UI change, run:
```bash
npm run visual-qa
```

If the test fails, the diff is in `test-results/` showing exact pixel differences.
**WHICH BASELINES? There are TWO systems — do not confuse them (corrected 2026-08-09).**
`npm run visual-qa:update` is `playwright test --update-snapshots`; it refreshes **Playwright**
snapshots and does NOT touch the gate that actually fails in CI. The CI gate is **BackstopJS**
(`npx backstop test`, `.github/workflows/web-deploy.yml:199-213`, non-blocking, artifact
`backstop-report`). Its references live in `backstop_data/bitmaps_reference/` — NOT in
`tests/visual/baselines/`, which is empty and dead. Regenerate on **Linux**, never on Windows,
or different font rendering is baked into every scenario:
```bash
gh workflow run backstop-baseline.yml
```
Then LOOK at every changed reference before committing it, and commit only that directory:
```bash
git add backstop_data/bitmaps_reference
git commit -m "chore: update BackstopJS baselines after [reason]"
```
Confirm the diff is only what you intended — a baseline commit that silently absorbs an unrelated
regression is worse than a failing check.

⚠️ **AND THE UPDATE RECIPE THAT USED TO BE PRINTED HERE COULD NOT RUN (corrected 2026-09-08).**
It said `npm run visual-qa:update && git add tests/visual/baselines/`. **`tests/visual/baselines/`
does not exist** — not empty, absent — so the `git add` fails outright, and the Playwright snapshots
that `--update-snapshots` does refresh are not what CI compares. It is the same shape as the 404
fix: a documented command aimed at a file the thing that ships never reads. The ONLY baselines that
matter are `backstop_data/bitmaps_reference/`, regenerated on Linux by the dispatch above.

`npm run visual-qa` (`playwright test`, testDir `tests/visual`, 6 tests in 2 specs) is still worth
running before a UI change — it just is not the CI gate, and it has no committed baselines to
update.
