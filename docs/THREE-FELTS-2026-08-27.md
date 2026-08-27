CAPS - THREE-FELTS: measured, not chosen - and the predicted failure was the wrong one (2026-08-27)

MAP: vamos_handoffs id 111. main 9092d47. Live bundle index-28c376a2, UNCHANGED - no felt was
applied, no token altered, nothing about the app's appearance shipped. resolve-hand v11,
verify_jwt false. No schema change, no DB writes this session beyond this handoff.

=== 1 - THE THREE PANELS ===

  https://claude.ai/code/artifact/487ed026-0cd7-48e7-ac7e-11a0f14ef45a

One page: the three surfaces at 393, the same three at 320, both again in greyscale, and every
measurement in a table beside the picture it belongs to. Opens in a browser, nothing to install.

  A  deep green      rgb(21,71,52)  #154734
  B  deep burgundy   rgb(74,26,34)  #4A1A22
  C  near-black with a real edge and a weave  rgb(28,28,34)  #1C1C22

SAME HAND IN ALL THREE - and it is enforced, not asserted. The hand is declared once in
tests/felt-compare.mjs and referenced three times; the felt is a CSS custom property and the only
thing that varies. Confirmed independently in the measurement pass: the card face occupies
11.78% of every panel, gold 1.19%, mint 0.79% - identical to two decimal places across A, B and
C. If anything but the surface had changed, those shares would differ.

RULE 3 HELD. There is exactly one pixel literal in the render - the viewport width under test -
and everything inside sizes from it in container units, so 320 and 393 are one layout at two
scales rather than two layouts. The board count is passed in rather than assumed, because 2P=4,
3P=3, 4P=2.

EVERY OTHER VALUE IS THE PRODUCT'S OWN, read from source, none invented:
  card face  #FCFAF3  paintThemes visual.classic.cardFace, and the measured live rgb(252,250,243)
  suit red   #c41e3a  Card.tsx V2_RED     (legacy #CC0000 measured alongside it)
  suit black #18181b  Card.tsx V2_BLACK
  page       #18181C  the measured live background rgb(24,24,28)
  cue        gold #FFD700 3px · mint #4FD6A8 2px · neutral rgba(0,0,0,0.22) 1px
             - the neutral one verified in source at Card.tsx:483, not taken from the doc

=== 2 - THE MEASUREMENTS ===

Computed twice: once analytically from the tokens, once by locating those same colours in the
rendered PNG. The script voids its own report if the two disagree. They did not.

CONTRAST (WCAG relative luminance)          A green   B burgundy   C near-black   needs
  card face vs felt                          10.14       13.75         16.23       3:1   all pass
  gold cue vs felt                            7.55       10.24         12.09       3:1   all pass
  mint cue vs felt                            5.81        7.88          9.30       3:1   all pass
  neutral cue vs felt (as a card edge)        6.01        8.16          9.63       3:1   all pass
  suit red vs felt (adjacency only)           1.81        2.46          2.90        -

THE PREDICTED BURGUNDY FAILURE DID NOT HAPPEN. The brief expected gold-on-burgundy to be the
combination most likely to fail. It is the SECOND BEST OF THE THREE at 10.24:1, against 7.55 on
green. No option fails any felt-dependent measurement.

CONSTANT UNDER ALL THREE - the pip sits on the CARD, which no felt changes:
  suit red #c41e3a vs card face      5.59   pass
  legacy   #CC0000 vs card face      5.64   pass
  suit black       vs card face     16.96   pass
  neutral cue      vs card face      1.69   FAIL

THE ONE FAILURE IS FELT-INDEPENDENT. The 1px neutral border composites over the card face to
rgb(197,195,190) - 1.69:1 against the card it is drawn on. As a card EDGE against the felt it is
fine on all three; as the THIRD STATE OF THE WINNER CUE it is not legible on any option,
including the one shipping today. Choosing a felt neither causes nor fixes it. It is a separate
pre-existing defect and it needs its own decision.

=== 3 - HUE COLLISION: THE BRIEF NAMED ONE RISK, THERE ARE TWO ===

A contrast ratio cannot see hue. Two colours can clear 3:1 and still be the same colour.

  suit red #c41e3a  vs  B burgundy felt   0.1 degrees apart   <- SAME HUE
  mint cue #4FD6A8  vs  A green felt      2.4 degrees apart   <- SAME HUE
  C near-black: saturation 9.7%, collides with nothing.

So each coloured option has exactly one same-hue relationship, and only one of them was
predicted. B puts the SUITS on the felt's own hue - luminance carries it (2.46:1) and the pip is
on the card so it stays legible, but red-on-red is real. A puts the WINNER CUE on the felt's own
hue - 5.81:1, passes, but the "field" cue is being drawn in the felt's colour. That is the
symmetric finding, and I would not have looked for it if the brief had not insisted the burgundy
risk be measured rather than assumed.

=== 4 - GREYSCALE: THE CUE IS A WIDTH ===

Perceived grey, 0-255:  card 250 · gold 217 · mint 190 · neutral edge 194
  felt A 65   felt B 46   felt C 34

  separation from its own felt      card   gold   mint   edge
    A deep green                     185    152    125    129
    B deep burgundy                  204    171    144    148
    C near-black                     216    183    156    160

ALL THREE SEPARATE, and nothing depends on hue. Gold (217) and mint (190) land close to each
other in grey - which is exactly why the cue is carried by WIDTH - and in the greyscale panels
Board 1's 3px still reads as visibly thicker than Board 2's 2px. The width cue survives all
three surfaces.

=== 5 - THE REAL FINDING UNDER "GREEN OR MAROON" ===

There is no playing surface in the live app. The card sits directly on the page background;
table -> felt -> card has collapsed into two layers. That is why every one of these three reads
as an improvement regardless of hue: C is the current colour and still looks different, because
it has been given an edge and a weave. The decision Roye is actually making is not "which
colour" but "should there be a felt at all, and then which one".

=== 6 - THE TWO BASELINE ITEMS ===

DROPPED: the join and host scenarios, and their two reference bitmaps. /lobby/join and
/lobby/host render "Unmatched Route"; no such route has ever existed in this repo's history, and
the real lobby routes are /lobby, /lobby/private and /lobby/table. This is a WRONG TEST
DEFINITION, so the scenarios are deleted rather than repointed - inventing a URL to make the
test pass would be the same mistake facing the other way. 14 scenarios -> 12.

HOME, RECAPTURED WITHOUT THE MODAL. app/(tabs)/index.tsx opens the InteractiveTutorial whenever
`has_seen_interactive_tutorial` is absent, so every capture of / caught it and the committed
baseline had "Place 4 cards on each board" frozen in as the expected appearance of the home
screen. The onBefore hook now seeds that key alongside the rest of the bootstrapped state.

CORRECTION TO MYSELF, from last session's chat: I said Backstop never uses the bootstrapped
storageState. IT DOES - via scenarioDefaults.onBeforeScript, which reads
tests/caps-onboarded.json. I had checked only the top-level key and stopped there. The modal
appeared DESPITE the seeding, not because of its absence, and that distinction is the whole
reason the fix is one seeded key rather than a scripted click. The claim never reached a handoff
or an artefact, but it was wrong when I said it.

A FILTER FOR THE BASELINE JOB. backstop-baseline.yml could only recapture everything or nothing,
which forces a reviewer to re-approve screens that did not change. It now takes an optional
scenario label. NOTE: .github/workflows/ and backstop.json sit outside the directories this
brief opened, and both had to change to carry out its own instructions - dropping scenarios
lives in backstop.json, and recapturing ONE screen was not expressible before the filter existed.

THE OTHER TEN BASELINES ARE UNTOUCHED - confirmed by git, and deliberately, because the felt
decision may move most of them and regenerating twice wastes the review.

=== 7 - CLAUDE.md vs THE CODE, READY TO UPDATE EITHER WAY ===

  CLAUDE.md:33   "Visual: maroon felt #5C1818, warm cards #FFFEF8, red/black suits"
  the code       DEFAULT_PAINT_THEME = 'streetStencil', described in its own source comment as
                 "the NEW default look: dark concrete + spray-yellow"
  measured live  card face #FCFAF3, background #18181C

THE LINE IS WRONG TWICE, not once. The felt is the obvious half - maroon against a near-black
concrete default. The second half is quieter and worth more: the card face is documented as
#FFFEF8 and ships as #FCFAF3. Nobody noticed either, and a stale doc is what credited a
non-existent function and cost two sprints. Whatever Roye picks, that one line needs both halves
corrected in the same commit as the felt.

=== 8 - INSTRUMENT FAILURES: 2, BOTH MINE, BOTH CAUGHT BEFORE THEY REACHED A NUMBER ===

1. I first composited the neutral cue over the FELT. It is the card's own border
   (Card.tsx:483), so it composites over the CARD FACE. The wrong version produced 1.24 / 1.13 /
   1.06 and would have been reported as "the neutral cue fails on all three felts" - a felt
   problem. Corrected, it is 6.01 / 8.16 / 9.63 against the felt and 1.69 against the card: the
   same failure, but belonging to the cue rather than to any option. Where a pixel SITS decides
   what it is being compared against.
2. The storageState claim in section 6.

=== 9 - NOTHING SHIPPED · PRODUCTION UNCHANGED ===

No felt applied. No colour token changed. No component touched - Card.tsx untouched. The only
code added is two files under tests/ that render and measure, plus the baseline-hook and
scenario changes in section 6. Live bundle unchanged at index-28c376a2.
No payment flag enabled. purchases 0. iap_enabled, RevenueCat and App Store Connect untouched.
verify_jwt still false. Faucet, rescue, ad amount, rake, record_hand_net and record_reward
untouched. Missions inactive. No migration, no backfill. The 4 mixed human/automation devices
and every device showing real play are untouched.

=== 10 - STILL OPEN ===

THE FULL LOOP has still never run against the deployed fix: no WebKit in this container and no
browser egress at all, so every browser number in handoffs 108-111 is Chromium-only. The felt
render works here only because it is served from localhost.
THE FIRST REAL 3-PLAYER TIE: still none. There has never been an attributable 3-player hand in
production at all. Cutoff 2026-08-27 12:13:46 +03 stands. Nothing backfilled.
THE NEUTRAL CUE: illegible against the card face today, on every felt including the current one.
Reported, not fixed - it is a cue decision, not a felt decision.
