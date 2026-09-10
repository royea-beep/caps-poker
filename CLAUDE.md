# CAPS Poker — Claude Code Brain

## Quick start
1. Run on Empire HQ (vjxqlqtlywovnbidovit):
   SELECT bot_landing_brief('caps-poker');
2. Read the response — it has EVERYTHING: state, blockers, rules, risks
   ⚠️ Measured 2026-09-10: the brief is ALIVE but its `risks` are stale — it says CAPS has no Hebrew
   (live since 2026-09-02) and no account-deletion flow (Settings has one; `process_pending_deletions`
   runs nightly). Read it for hierarchy and guidelines, not for state.
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

## Current state (corrected 2026-09-07 — every number below was measured, not recalled; re-measured 2026-09-10 where marked)
- ✅ **MAIN IS CURRENT AGAIN (2026-09-10).** `claude/vamos-caps-align-celebration-flppo0` (33 commits,
  including the `submit_score` migration live since 2026-09-08) and the deep-audit branch were both
  merged to `main` on 2026-09-10. Main had spent two days describing a `submit_score` that had already
  stopped running. The measured inventory of everything — screens, DB objects, assets, docs, workflows,
  branches — is **`docs/deep-audit-2026-09-10/README.md`**, with the SQL behind every number in
  `QUERIES.md` beside it.
- ✅ **THE ANON READ SURFACE IS CLOSED (2026-09-10, applied to production, branch-proven first).**
  `chip_transactions_prereset_20260901` (RLS on, client roles revoked) and seven views that handed
  `anon` what their base tables deny. ⚠️ The archive was not merely readable: the schema default ACL
  gave `anon` and `authenticated` INSERT, DELETE and **TRUNCATE**, and a branch reproduction took a
  25-row copy to **zero rows** with the anon role. Production re-attacked afterwards with the shipped
  public key over HTTPS: all eight objects and both destructive probes return `401 / 42501`, while
  `leaderboard` and `app_config` still return 200. Migrations `20260910120000` + `20260910120100`.
  ⚠️ **AND THE CLASS, WHICH IS THE PART TO REMEMBER:** nothing was ever "granted" to anon. This
  project has `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated`,
  and `defaclobjtype='r'` covers **views as well as tables** — so every new object in `public` is BORN
  with all seven privileges for both client roles, and a REVOKE protects only the object it names.
  That is how 20260831170000 could revoke `v_harness_devices` ("the detector itself should not be a
  public listing of device ids") and 20260907000000 could hand the same rows back through
  `v_harness_devices_v2` five weeks later with no wrong SQL anywhere. The next one is caught by
  `anon_read_surface_violations()`, wired into `security_posture_tripwire()` (cron 37, hourly), which
  must return zero rows — proven to FIRE on a planted `_v3` before it was applied.
- Version: 2.7.0 | Build: **515**, uploaded and proven installable from Apple's own records.
  (Was "B458 (building)". ⚠️ The build a device is RUNNING comes from `get_live_build()` —
  device telemetry — never from a number typed here or into `app_config`.)
- Tests: **2,846/2,846 across 53 suites on main** (measured 2026-09-10 by running `npx jest --ci`; was
  written as 2,824/52 on 2026-09-07). The celebration branch reports 2,869/56 — it carries 14 test files main lacks.
- **73 tables, 198 functions, 12 views, 14 Edge Functions** (was "56 tables, 127 RPCs, 16 Edge
  Functions" — two of the three were low and the Edge Function count was high). Re-measured 2026-09-10,
  unchanged, plus: 8 triggers · 100 RLS policies · 31 cron jobs, all active, 0 failures in 7 days.
  ⚠️ **14 is the DEPLOYED count. The repo holds 13 directories** — `resolver-probe` exists only as a
  deployment — and **8 of the 14 were hand-deployed** (`entrypoint_path` = `source/index.ts`), so for
  those eight the repo copy is not necessarily what runs. Diff before deploying any of them.
- Live data (re-measured 2026-09-10): **403 devices · 25 have ever played · 78 hands · 14 bindings ·
  float = ledger, gap 0 · 9 rooms all `waiting`, 0 have ever reached `playing` · 0 purchases, ever**.

  ⚠️ **"HAVE PLAYED" — THE CANONICAL DEFINITION (ruled 2026-09-10). QUOTE `games_played > 0` = 25,
  AND NAME THE COLUMN.** Three columns answer this question and they disagree, so a bare "25" is an
  unfalsifiable number:
  | number | query | what it actually counts |
  |---|---|---|
  | **25** ← **the default; say "25 by `games_played`"** | `count(*) from leaderboard where games_played > 0` | devices the SERVER credited with a finished game. Written only by `tg_hand_history_leaderboard_counters`, which since CLOSE-S2 runs for `service_role` only — so this is the *server-authoritative* count and the one that cannot be forged. |
  | 26 | `count(*) from leaderboard where hands_played > 0` | +1. `hands_played` is caller-supplied through `submit_score` and was never gated; it is a DISPLAY stat, forgeable, and must never be used to size the player base. |
  | 10 | `count(distinct device_id) from hand_history` | devices with a stored hand ROW. Lower because practice hands are not written, and because 23 of the 25 pre-date the current write path. |
  Use 25. If a number in a report is not one of these three, it is wrong.

  ⚠️ **The float-vs-ledger gap is still computed by NOTHING, and is still a hand measurement.**
  `health_check()` sums the float and counts ledger rows but never subtracts them. What it would
  take is written out in `docs/deep-audit-2026-09-10/FINDINGS.md` §"computing the gap"; it was
  NOT built this sprint, on instruction. One thing measured 2026-09-10 that nobody had established:
  **all 403 devices reconcile INDIVIDUALLY** (`chips` = per-device `sum(amount)` on every row, 0
  exceptions), so the aggregate zero is not hiding offsetting per-device errors.
- **THE PRODUCT MAP IS `docs/product-map/PRODUCT-MAP-2026-09-07.md`** and it regenerates its
  route list from `app/`. Read it before describing a screen or a feature to anyone.
  ⚠️ Only the route LIST regenerates. Its "reached by" and R/U columns were hand-typed and, measured
  2026-09-10 by grepping every navigation call, were wrong for 3 routes (`/theme-pick`,
  `/orientation-pick`, `/spectate` have NO tap path — URL-only), 2 redirects (`/simulate` renders in a
  dev build; `/debug` opens on `__DEV__`, not on the dev-unlock gesture) and 8 "reached by" entries.
  Corrected in place; the measured index is `docs/deep-audit-2026-09-10/SCREENS.md`.
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
  ✅ CLOSED 2026-09-08 (handoff 202): `submit_score` is STATS-ONLY on production — it never writes
  `total_chips` and returns `chips_written:false` (read from `pg_get_functiondef` on 2026-09-10; the
  line above used to say STILL OPEN). ⚠️ Its migration file lives ONLY on the celebration branch, and
  the live function's own `COMMENT` still describes the old clamp-and-raise behaviour — a comment is a
  claim. `hands_played` / `hands_won` / `biggest_win` are still caller-supplied: cosmetic, no chips, no ladder.
- ⚠️ **The catch-all 404 was fixed in the WRONG FILE on 2026-09-03 and only went live 2026-09-07.**
  The exclusion went into the ROOT `vercel.json`. **PRODUCTION NEVER READS THAT FILE** — the deploy
  runs `npx vercel --prod` from `dist/`, and **`scripts/fix-web-html.js` writes `dist/vercel.json`**,
  which still carried `{ source: "/(.*)" }`. Measured on the live site four days later: `/nope.png`,
  `/nope.mp4` and `/definitely-missing.html` all returned **200 with 1,902 bytes of the app's HTML**.
  The generator's own comment had said since 2026-08-15 that the root file is never read in prod.
  **EDIT `scripts/fix-web-html.js` FOR ANYTHING THAT MUST SHIP — headers, rewrites, redirects.**
  The root file is kept identical so `vercel dev` matches; `tests/vercel-rewrites.test.ts` now reads
  the GENERATOR's source and fails if the two disagree (proven to fire).
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
- Auth: Anonymous + Google login prompt after game 3-5

## Key RPCs
- health_check() — run first every session
- get_live_build() — the build devices are RUNNING (device telemetry, `analytics_events.native_build`).
  `get_current_build()` wraps it and adds `build_history` metadata — a table last written 2026-05-08, so
  those extra fields are stale by construction. Read `get_live_build()`.
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
- ⚠️ **A FILENAME IS NOT EVIDENCE. Verify by CONTENT, and verify at the place that actually SHIPS.**
  This shape has now cost this project six times: Hebrew screenshots under two names · the icon
  overwritten six times in place · a stale bundle under an unchanged hash · three different files
  called `caps-explainer-FINAL.mp4` · the catch-all 404 fixed in `vercel.json` when prod reads
  `dist/vercel.json` · and `variant="gold"` on a button that has painted MINT since the theme sweep.
  ⚠️ And the ninth, found 2026-09-10 and **CORRECTED THE SAME DAY — the first report of it was wrong
  in the direction that flatters the product.** `boardWin.wav`, `boardLose.wav` and `revealStart.wav`
  were byte-identical (sha256 3c395893…, 44,178 B), and the first pass concluded "a lost board plays
  the win chime". Reading the SAMPLES says otherwise: all three were **0.5 s of digital silence** —
  22,050 frames, every sample exactly 0, ffmpeg's null source (`ISFT: Lavf62.3.100` is still in the
  header). A won board, a lost board and the start of every reveal played NOTHING, for five and a half
  months, with sound on by default. ⚠️ **sha256 equality proved the three files were the SAME; it did
  not prove WHAT they were** — and I asserted the "same chime" without reading a sample. FIXED
  2026-09-10: all three regenerated by `scripts/generate-reveal-sounds.py`, guarded by
  `tests/sound-assets.test.ts`, which asserts distinctness AND signal (a uniqueness check alone
  passes on three DIFFERENT silent files).
  ⚠️ ALSO CORRECTED: `turnReveal`, `riverReveal` and `boardTransition` do **not** lack files. They
  deliberately reuse `cardFlip` / `chipsWin` / `cardPlace` at distinct volumes (`utils/sounds.ts:62-64`)
  and all three are played from `components/BoardReveal.tsx`. That claim was mine and it was wrong.
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
