CAPS - SHIP-THE-GREEN: the premise was wrong, the collision was in his own value, and the edge
is not a colour problem (2026-08-27)

MAP: vamos_handoffs id 112. main 35a91d3. resolve-hand v11, verify_jwt false. No schema change,
no DB writes beyond this handoff. Gold and mint untouched.

=== 1 - THE PREMISE DID NOT SURVIVE CONTACT WITH THE APP ===

"There is no playing surface; three layers have collapsed into two" was MY reading, carried into
the brief, and it is wrong.

BoardSurface exists. It is inset, has a rail and an inner shadow, sizes every dimension through
rs(), carries testID="board-surface", and renders at every width and every board count. The live
/game capture is 22.4% GREENISH. My green detector required g>90 and could not see a dark green,
so I reported a missing layer that was in front of me the whole time. The card-face/background
pair I quoted as "measured live" came from /results, not from the table.

WHAT IS TRUE is smaller and more precise: the felt was too dark to READ as green. That is worth
fixing. It is not a missing layer.

=== 2 - MINT ON GREEN: DOES IT READ POORLY? YES, MILDLY - AND THE COLLISION WAS IN HIS VALUE ===

Looked at it before touching anything, as instructed. At 2x magnification the mint border is
obviously fine. AT TRUE PHONE SCALE it is not obviously anything: it reads as a thin pale edge on
green - legible, but it looks like panel furniture where the gold above it announces itself. For
a marker whose job is to say "the field", that is a real weakening. Not the burgundy-style false
alarm; a mild, genuine one.

THEN THE PART THAT MATTERS. The 2.4-degree collision was measured against MY SYNTHETIC PANEL,
which used Roye's nominal rgb(21,71,52) (hue 157.2). THE APP'S FELT ALREADY RENDERS AT HUE 144.5
- fifteen degrees off mint. So the app does not have the collision. SHIPPING HIS LITERAL VALUE
WOULD HAVE CREATED IT.

So the felt moved, exactly as the brief directs - but it moved in LIGHTNESS to where he pointed,
and its HUE was held where it already was:

  token   FELT_GRADIENT.classic  ['#10281A','#0E2418'] -> ['#003115','#062E18']
  ships   lifted table top rgb(26,70,44)   hue 144.5   15.0 degrees from mint

The token is DARKER than his value on purpose: BoardSurface lifts the base toward white (0.10
top / 0.055 bottom) before painting, so writing rgb(21,71,52) into the token would have shipped
lighter than he chose. Verified on a true-scale render: at hue 157 the mint border reads as an
edge, at 144 it reads as a marker.

ALL FOUR RE-MEASURED after the change (analytic from the tokens, on the lifted top that ships):
  card face / felt   10.28      gold cue / felt   7.65      mint cue / felt   5.89
  greyscale  card 250 · felt 64 · gold 217 · mint 190 · neutral 137
  separation from felt   card 186 · gold 153 · mint 126
  widths unchanged   gold 3px · mint 2px · neutral 1px
Everything clears 3:1 with room, and the separation is luminance, not hue - remove colour and
the table is still a table.

=== 3 - THE NEUTRAL CUE ===

  rgba(0,0,0,0.22) -> rgba(0,0,0,0.45)      components/Card.tsx
  over the card face #FCFAF3:  rgb(197,195,190) 1.69:1  ->  rgb(139,138,134) 3.31:1

1.69 was illegible against the card it is drawn on, on every felt including the one shipping
before this. 0.42 was the first value to clear 3:1, at 3.02 - sitting exactly on the line, so
0.45 was taken for margin. Still black, still 1px. The WIDTH channel is untouched and the cue is
still a width in greyscale. GOLD AND MINT NOT TOUCHED - verified in the diff.

=== 4 - WHAT I TRIED, MEASURED, AND PUT BACK ===

The felt reads 1.00:1 against the page ground just outside the rail. The cause is structural: the
SCREEN ROOT paints the same FELT_GRADIENT, so raising the token raises the room and the table
together and the step never grows. BoardSurface's lift is the only knob that moves the table
without the room - and its own doc says it was added for exactly this.

So lift went 0.10 -> 0.22. Predicted table top rgb(56,94,72), edge 2.48.

IT DID NOT SHIP THAT. Measured by DIFFING two real renders - the pixels that CHANGED are by
definition the felt, which beats guessing at coordinates, and I had already mis-sampled a gold
border and a mint accent as "felt" twice before adopting it:

  felt  rgb(16,22,22) -> rgb(19,26,26)     about 4/255
  edge  1.00 -> 1.03

Because the felt is almost never bare: translucent board panels (#1C1F268C, ~55%) and their
shadows sit over it. Paying card contrast 10.28 -> 7.02 for one percent of edge is a bad trade.
REVERTED, and the measurement is recorded in BoardSurface.tsx so nobody re-runs it.

THE EDGE IS NOT A COLOUR PROBLEM. Until the panels over the felt change, no felt value makes the
table read as a table. The green now shows mostly as the SURROUND, with the table still dark
inside it - the inverse of a felt table. That is a design decision about the board panels and it
is Roye's, not something to slip into a felt commit.

=== 5 - VERIFICATION ===

393 and 320, at 2P / 3P / 4P - six cells on a real production export, not the synthetic panel:
  surface present in all six · inset 8 at 393 and 7 at 320, so rs() is responding (Rule 3)
  board count never assumed - every seat count walked, because 2P=4, 3P=3, 4P=2
WEBKIT: STILL NOT AVAILABLE. Its download host closes the connection in this container and
browser egress to the live site is blocked, so the render is a LOCAL export served from
localhost, in Chromium only. Every browser number in handoffs 108-112 is single-engine.

CLIP-AWARE OVERLAP SWEEP, run against this build AND against a pre-change control build:
  /                     3 pairs, IDENTICAL coordinates in both
  /game 3P              1 pair,  same glyphs in both
  /game 4P, /play, /profile   0 pairs
The pairs are a card's own 9px corner pip over its 27px centre suit - card-intrinsic geometry,
not layout. THIS CHANGE ADDS NONE: the control proves it rather than my asserting it.

jest 2,653/2,653, 43 suites. tsc --noEmit clean.

=== 6 - CLAUDE.md:33, BOTH HALVES, SAME COMMIT ===

  was   "Visual: maroon felt #5C1818, warm cards #FFFEF8, red/black suits"
  now   the green token, its lifted value, and card face #FCFAF3

HOW LONG IT WAS WRONG: it was false THE DAY IT WAS WRITTEN. The line was ADDED in 3ed2b8a on
2026-08-22 - the same commit that introduced the paint-theme system and set cardFace to #FCFAF3.
It documented the app it was replacing. The app has never rendered #FFFEF8. Five days, and the
same commit that shipped the stale baselines and the theme the doc contradicted.

The card-face half is the quieter and more useful one, exactly as the brief said: a documented
colour the app has never used, sitting in the file every session reads first.

=== 7 - backstop-baseline.yml: THE OPTIONS, AND A RECOMMENDATION ===

The capture half WORKS - it produced the home recapture last session in 5 seconds. Only the final
step fails: "GitHub Actions is not permitted to create or approve pull requests", a repository
setting. That is also why its only earlier run, 2026-08-09, failed.

  1. Change the repo setting (Settings > Actions > Allow GitHub Actions to create pull requests).
     Roye's to make. NOT CHANGED BY ME.
  2. Push the branch and stop claiming to open a PR - the branch already lands correctly, so this
     is deleting the broken step and printing the branch name.
  3. Commit straight to main - fastest, and wrong: it removes the human review CLAUDE.md requires
     for baselines.

RECOMMENDED: (2). It is a two-line workflow change, needs no permission, and preserves review -
the reviewer opens the PR from the pushed branch. (1) is fine too and is less typing, but it is a
setting and settings are yours. I took the PNG off the pushed branch by hand last session, which
is (2) done manually, and it worked.

=== 8 - BUNDLE ===

  before  index-ae903ba6a121ba0d33946eb6b4dad9c8.js
  after   index-7377bb411127be106592495027bb51e1.js
Sampled three times each. The first sampling caught the deploy MID-PROPAGATION - two old, one
new - and was re-sampled to three matching rather than reported.

NOT JUST A NEW HASH - proven by a TWO-WAY delta, with two controls that must NOT move:
  #10281A     old felt token   1  ->  0
  #003115     new felt token   0  ->  1
  0,0,0,0.22  old cue          2  ->  1     (BoardSurface still uses one - correct)
  0,0,0,0.45  new cue          2  ->  3     (two already existed elsewhere)
  #FFD700     GOLD CUE        50  -> 50     <- CONTROL: unchanged, as required
  #4FD6A8     MINT CUE        59  -> 59     <- CONTROL: unchanged, as required

The cue markers matter BECAUSE they are not unique: 0.45 already appeared twice before the
change, so only the DELTA proves anything - a presence check would have "confirmed" a deploy
that never happened. And the gold/mint counts are the evidence for "gold and mint untouched":
not my word for it, the shipped bundle's.

=== 9 - PRODUCTION UNCHANGED ===

No payment flag enabled. purchases 0. iap_enabled, RevenueCat and App Store Connect untouched.
verify_jwt still false. Faucet, rescue, ad amount, rake, record_hand_net and record_reward
untouched. Missions inactive. No migration, no backfill, no DB write beyond this handoff. The 4
mixed human/automation devices and every device showing real play are untouched. The ten
non-home baselines are NOT regenerated - the felt moves them and regenerating twice wastes the
review.

=== 10 - STILL OPEN ===

  - THE TABLE STILL DOES NOT READ AS A TABLE. Section 4. Needs a decision about the board panels.
  - The full loop has never run against any of this - no WebKit, no browser egress.
  - The ten baselines await the felt decision, then one regeneration.
  - No real 3-player tie yet; there has never been an attributable 3-player hand in production.
