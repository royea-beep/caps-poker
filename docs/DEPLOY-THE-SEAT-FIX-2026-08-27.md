CAPS - DEPLOY-THE-SEAT-FIX: it shipped, and clearing one gate uncovered the next (2026-08-27)

MAP: vamos_handoffs id 109. main ed19e21 (was 945cc12 at session start). Three deploys this
session. resolve-hand v11, verify_jwt false, unchanged. NO DB SCHEMA CHANGE. Bindings 21 -> 3.

=== 1 - DEPLOYED, AND THE FIX IS IN THE BUNDLE ===

  945cc12  index-f40ddcc45276de5b70929e3470f663b4.js   the pre-fix build this session began on
  8ded2f7  index-393732135a6172f21a62af41867ce030.js   THE SEAT FIX
  44d5130  index-388e467e4f9dd8a483c27b090ef5b0b9.js   the a11y critical
  ed19e21  index-28c376a20e1051a60a6ba8c1aa967752.js   two more chips-derived readers  <- LIVE NOW
Each hash sampled three times with retry before being believed.

FIX PRESENT, NOT MERELY A NEW HASH - the brief's exact warning, and the check that answers it:

  winnerSeat        pre-fix f40ddcc4 : 0      live 28c376a2 : 10
  'TIE GAME'        pre-fix          : 1      live          : 1    <- control: does NOT discriminate
  tablist  (a11y)   pre-a11y         : 0      live          : 3
  handshake (share) pre-share 388e467e: 10     live          : 11   <- +1, the new tie mark

`winnerSeat` and `tablist` are names that exist only because of these commits and survive
minification. The controls matter as much: 'TIE GAME' is present in BOTH bundles and would have
"confirmed" a deploy that never happened, and the handshake mark ALREADY EXISTED 10 times in the
Hebrew strings, so only the DELTA against the previous bundle proves the share fix landed.

=== 2 - THE FULL LOOP DID NOT RUN, AND WILL NOT RUN FROM HERE ===

I could not run it and I am not going to dress up what I did run as the loop.

BROWSER EGRESS IS BLOCKED IN THIS CONTAINER. Measured, three ways, not assumed:
   chromium -> https://example.com/         ERR_CONNECTION_RESET
   chromium -> https://caps.ftable.co.il/   ERR_CONNECTION_RESET
   same, with the agent proxy configured    ERR_CONNECTION_RESET
   same, plus --ignore-certificate-errors   http://example.com -> 405 (the proxy ANSWERS),
                                            https CONNECT still reset
So the browser reaches the proxy and the proxy refuses the tunnel. curl works, the browser does
not. tests/final-qa.mjs cannot reach the site; the one cell I attempted died on page.goto.
The parity probe still works because it serves the bundle from LOCALHOST.

NO WEBKIT, AGAIN, AND NOW FOR A NAMED REASON. `npx playwright install webkit` fails:
   Download failed: server closed connection.
   URL: https://playwright.download.prss.microsoft.com/.../webkit-ubuntu-24.04.zip
Chromium is present only as build 1194 against a pinned 1217, needing an explicit
executablePath. EVERY BROWSER NUMBER IN THIS HANDOFF IS CHROMIUM-ONLY.

WHAT DID RUN, WITH REAL NETWORK, ON THE CI RUNNER - and it is a real loop cell, not a
substitute for the loop: the post-deploy WCAG audit walks 14 live screens on
caps.ftable.co.il, and BackstopJS renders 14. Both ran against the deployed build. Findings
below. The final-qa matrix (engines x widths x board counts, the gated-screen config override,
the planted self-test) HAS NOT RUN against any of this.

WHAT I DID RUN HERE: tests/parity-3p-probe.mjs against a production export of the deployed
code, 7/7 rows at 393, 320 and 430 px, 0 page errors, re-run AFTER the deploy. The 3-player
one-board-each hand renders TIE GAME with no overlay; all six controls unchanged.
Full jest suite 2,653/2,653, 43 suites. tsc --noEmit clean.

=== 3 - THE LOOP FOUND TWO THINGS, AND THE FIRST WAS HIDING THE SECOND ===

3a) A CRITICAL a11y VIOLATION, PRE-EXISTING, AND IT WAS MASKING THE VISUAL GATE.

The post-deploy WCAG audit fails on critical, and BackstopJS runs ONLY if it passes. Both
deploys of the seat fix and the one before it reported, byte-identically:
   [wcag] hand-history   crit=1
   [wcag] TOTALS critical=1 serious=9 moderate=0 minor=0
   BackstopJS visual regression ... SKIPPED
That identity across run 1576 (945cc12, pre-fix) and run 1577 (8ded2f7, post-fix) is also the
CONTROL proving the seat fix introduced nothing: same 14 screens, same 1 critical, same 9
serious, before and after.

THE CRITICAL WAS INTRODUCED BY THE FIX FOR THE PREVIOUS ONE. Commit 7556d5a gave the three
/hand-history filter chips accessibilityRole="tab" because they were focusable and declared
nothing. Correct as far as it went - but `tab` is a role axe checks a PARENT for, and the
wrapping View declared nothing: aria-required-parent, impact CRITICAL. So from 2026-08-23
onward EVERY DEPLOY SKIPPED THE VISUAL GATE. A gate that is skipped is not a gate.

FIXED with the shape already proven against this instrument, not a guess: leaderboard.tsx:151
wraps its role="tab" children in accessibilityRole="tablist", and the same audit measures
/leaderboard at crit=0. Verified by the instrument itself on the next deploy: critical 1 -> 0,
and BACKSTOPJS RAN FOR THE FIRST TIME SINCE 2026-08-22. Confirmed twice: the WCAG step's
conclusion is `success` on both deploys since the fix, having been `failure` on every one before.

The nine SERIOUS are untouched and pre-existing - color-contrast on six screens, target-size on
the three onboarding step dots, scrollable-region-focusable on two lists. FAIL_ON_SERIOUS is
false so they do not gate. Named rather than silently carried; none is this sprint's.

3b) WHAT THE UNMASKED GATE IMMEDIATELY FOUND: BACKSTOP 0 PASSED, 14 FAILED.

Every one of the 14 scenarios failed, all with `size: isDifferent` and content deltas of
9%-93%. THAT IS THE SIGNATURE OF STALE BASELINES, NOT 14 REGRESSIONS: the references are
393x852 and match the configured viewport, the scenarios capture the full document, and the
document height moves with content.

  baselines last committed   3ed2b8a, 2026-08-22
  commits to app/ or components/ since   23
  gate runs since                        ZERO - the a11y critical skipped it every time

So the baselines are five days and 23 UI commits stale, and nothing noticed because the other
gate was swallowing the run.

I DID NOT REGENERATE THEM. CLAUDE.md is explicit that this is a reviewed, Linux-only
regeneration via backstop-baseline.yml, and that "a baseline commit that silently absorbs an
unrelated regression is worse than a failing check." With 23 commits of drift a human has to
look at the diffs. THIS IS THE ONE OPEN ITEM I AM HANDING BACK RATHER THAN CLOSING.

=== 4 - TWO MORE READERS WERE STILL DECIDING A WIN FROM CHIPS ===

The align-the-celebration sprint enumerated "eight readers". THE ENUMERATION WAS OF ONE FILE.
Grepping the whole app for a chips-derived WIN - not for netChips, which is legitimately
everywhere as money - finds two more:

  utils/statsEngine.ts   THE WHOLE /stats SCREEN. handsWon, handsLost, handsTied,
                         currentWinStreak, bestWinStreak, currentLoseStreak and the
                         recent-form last10WinRate ALL keyed off `net`, in one branch shared
                         with the money totals. /stats reported a win rate under the CHIPS
                         definition while /rank, the ladder, the record and the celebration
                         report under BOARDS. They could not disagree before because they were
                         the same `if`. Now split: outcome asks the boards, money asks the net.
                         Streaks match /results: a win extends, a loss ends, A TIE DOES NEITHER.
  utils/shareHand.ts     the share emoji was `netChips > 0 ? 'OK' : 'X'`. A hand the record
                         calls a tie was shared to OTHER PEOPLE as a win; a board win that
                         netted zero was shared as a defeat. The only reader whose disagreement
                         was visible outside the app. A tie now has its own mark.

THE TESTS ASSERTED THE DEFECT, AGAIN. Every statsEngine fixture said "this is a loss" by
setting netChips negative on top of a board fixture whose one board the PLAYER won - passing
only because the code read chips. Same shape as the achievement tests last sprint. They express
the outcome with BOARDS now, plus five cases pinning the divergence.

BOTH PLANTS CAUGHT, AND I CHECKED WHICH. Restoring the chips rule fails three of the five;
disabling the seat rule fails the 3-player one. The streak case does not discriminate the chips
plant - it targets different behaviour - and I am saying so rather than reporting five ticks.

FINAL SWEEP: every surviving netChips comparison in app/, utils/, components/, hooks/ and
store/ is a statement about MONEY - the net line, the "+N chips earned" CTA, the tie bonus,
biggest-win, the share net line, and one animation that flashes a positive figure. NO
CHIPS-DERIVED WIN DECISION REMAINS ANYWHERE.

=== 5 - THE 18 BINDINGS ===

ALL 18 ARE PROVABLY HARNESS. Five independent signals, every one of them agreeing:
  - 18/18 appear in v_automation_devices, THE PROJECT'S OWN RULE
  - every analytics event carrying a `ua` has webdriver=true - 1,364 events across the 18,
    on headless Windows and Mac UAs. ZERO events with a human UA.
  - the 18 events NOT flagged have NO `ua` key at all. Absence, not a human agent - Rule 8,
    and it is the reason the raw counts looked like 3 "unflagged" events per device.
  - ZERO CARD PLACEMENTS. One `deal_pressed` heatmap row per device and nothing else.
  - bound_at equals the device's FIRST HAND to the microsecond on all 18. Machine-paced.
  - 0 purchases, 0 room_players, 0 club_members.

CLEANED: 18 bindings deleted. REMAINING: 3, and I SELECTED to confirm it rather than asserting
it - e519-8702-3cc6, 7159-1e31-d433, 6956-24d1-5ee4, none of them in v_automation_devices.
Real player 6956-24d1-5ee4 untouched at 2,530 chips.

HOW THE CLEANUP RULE MISSED THEM - the gap, stated. Each sprint deleted an EXPLICIT LIST of the
devices IT KNEW IT HAD CREATED ("11 harness devices", "8 harness devices", "12 harness
devices"). Devices minted by anything else that day - the a11y sweep, the gated-surface probe,
the celebration-gate probe, each of which opens a fresh context and is issued a fresh anonymous
device - were never on anyone's list. Then "Bindings 3" was WRITTEN INTO THE HANDOFF WITHOUT
BEING SELECTED. A hand-maintained list cannot be complete, and the count that would have caught
it was reported instead of run. Same class as the a11y count that was printed every run and
asserted on none of it.
THE RULE THAT WOULD HAVE WORKED, and which I used: do not enumerate what you created, ask
v_automation_devices what is there. It is a view, it already existed, and it was right.

STILL THERE, AND I AM NOT DELETING IT UNASKED: the same 18 devices still own
   hand_history 58 rows | leaderboard 18 | analytics_events 1,382 | chip_transactions 150
   achievements 29 | heatmap_events 18
hand_history is 301, and 301 - 58 = 243, the "back to 243" those sprints reported. So that
number was not true either. Deleting rows from hand_history and leaderboard is a bigger,
irreversible act than clearing bindings and it moves the ladder, so it is YOUR CALL, not mine.

=== 6 - A CORRECTION TO THE BRIEF'S OWN FIGURE, AND TO MINE ===

The brief cited, and I had supplied the shape of:
   3-player non-practice rows 42, tied 0 | 2-player 119, tied 16 (13.4%)
and read it as "zero ties in 42, against 13.4% at two players".

EXCLUDING THE 18 HARNESS DEVICES, THAT CONTRAST DISSOLVES:
   2 players   real 71 rows, tied 0    harness 48 rows, tied 16   <- ALL 16 TIES ARE HARNESS
   3 players   real 42 rows, tied 0    harness 0
   4 players   real 28 rows, tied 0    harness 0
NO TIE HAS EVER BEEN RECORDED IN REAL PLAY AT ANY TABLE SIZE. The 13.4% baseline was our own
probe traffic. The honest statement is the flat one, not the contrast.
THIS DOES NOT WEAKEN THE FIX. The fix rests on the enumeration of both rule sources over every
reachable distribution, which is deterministic; the row counts were only ever reachability
evidence, and the 42 three-player rows are real play and remain the reachability point.

=== 7 - THE WATCH ===

CUTOFF: 2026-08-27 12:13:46 +03, the moment caps.ftable.co.il first served the seat fix
(the workflow's own "Wait for ... to serve new SHA" step completing).
FIRST REAL 3-PLAYER TIE: NONE YET. Zero hands of any kind have been played since the deploy,
so there is nothing to report and nothing to mistake for a result.
NOTHING BACKFILLED - confirmed. Pre-cutoff 3-player rows stay wrong; some recorded 'lost' were
ties and the distributions are gone (boards_data NULL), so a correction would be a guess.
DERIVATION STILL TAKES BOARDS AND NOTHING ELSE - confirmed twice: the signature is
`deriveHandOutcome(boards: readonly OutcomeBoard[])`, one parameter, and all six call sites
(results x3, achievements, statsEngine x2, shareHand) pass boards alone. The property test
asserting arity 1 is still green.

=== 8 - INSTRUMENT FAILURES: 2, NAMED ===

1. A bundle fetch returned a 1,902-byte error page and my marker grep on it reported
   "winnerSeat: 0" - which reads exactly like "the fix is not deployed". It was a dead read of
   a failed fetch. Caught by a size sanity check; refetched at 3.8 MB and the real answer was 10.
   Rule 9, on my own evidence, twice in two sessions.
2. A bundle-hash sample came back EMPTY on a transient fetch and my compare printed
   "NOT STABLE". Nothing had changed. Retried to three clean samples.
Both are the same failure: believing a value read from a call that did not succeed.

=== 9 - PRODUCTION UNCHANGED ===

No payment flag enabled. iap_enabled, RevenueCat and App Store Connect untouched. verify_jwt
still false on resolve-hand. Faucet, rescue, ad amount, rake and record_hand_net / record_reward
not in any diff. Missions still inactive. Card.tsx untouched. No migration, no schema change,
no backfill. The only DB writes this session were the 18 device_identity DELETEs and this
handoff row.

=== 10 - NEXT ===

1. THE BACKSTOP BASELINES. 23 commits of drift, needs a human eye on the diffs, then
   `gh workflow run backstop-baseline.yml` on Linux and a reviewed commit. Until then the
   deploy job stays red on that step even though everything before it passes.
2. THE FULL final-qa MATRIX on a machine with real network and both engines. Nothing in this
   container can run it, and I would rather hand it over than fake it.
3. The 58 hand_history + 18 leaderboard harness rows: your call.
4. Watch for the first real 3-player tie. It will be the first ever recorded, and it will look
   wrong before it looks right.
