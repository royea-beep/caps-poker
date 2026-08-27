CAPS - FELT-UNDER-THE-BOARDS: the panel is painted twice, the free card back is invisible on it,
and the paid one stops being worth buying (2026-08-27)

MAP: vamos_handoffs id 113. main 4585b61, UNCHANGED - no token altered, no component touched,
nothing about the app's appearance shipped. Live bundle unchanged. resolve-hand v11, verify_jwt
false. No schema change, no DB write beyond this handoff. Gold, mint and the neutral cue untouched
and PROVEN untouched. The felt token was not lifted again.

  https://claude.ai/code/artifact/43fe45d2-5281-492e-92ed-40504d365fd6

=== 1 - THE FINDING THAT WAS NOT IN THE BRIEF, AND RESETS WHAT EVERY OPTION IS WORTH ===

ON WEB THE BOARD PANEL IS PAINTED TWICE. The container paints it as a CSS gradient
(Board.tsx:660) and an absolute-fill <LinearGradient> child paints it AGAIN (Board.tsx:683) - at a
different angle. Read out of the live DOM, not off the source:

  container  linear-gradient(165deg,   rgba(28,31,38,0.55), rgba(16,18,24,0.55))
  child      linear-gradient(131.6deg, rgba(28,31,38,0.55), rgba(16,18,24,0.55))

Two 0.55 layers composite to 1-(1-0.55)^2 = 0.80. So "the panels are ~55% over the felt" - which I
wrote in handoff 112 and the brief then repeated back to me - IS WRONG ON WEB. It is ~80%. Native
paints it once, exactly as the token's own comment intends, so web has been half again as opaque
as native since the panel-felt batch landed.

Every option below removes the duplicate web layer, because otherwise the alpha written in the
token is not the alpha that renders and an option would be measuring a number it does not have.
P0S in the artefact isolates that fix alone so its cost is separable from any colour choice.

=== 2 - THE OPTIONS, MEASURED OFF REAL BUILDS ===

Six genuine `expo export`s with the panel tokens patched, each served from localhost and
photographed. Not the synthetic panel that chose the felt: the questions here - what happens to the
slot outlines, to the card backs, to the felt behind - have no answer outside the real component
tree. 393 and 320, at 2P/3P/4P, two states each (arrangement, and every slot filled). 72 captures.

State B, 393, 2P - the densest cell. Contrast is against each variant's OWN rendered ground:

                        P0 today   P0S once   V1 0.25   V2 none   V3 felt-hue   V4 raised
  panel as rendered     23,33,33   23,41,35   23,51,37  24,60,39   29,61,44     42,78,58
  card face vs panel      15.76      14.59      13.09     11.73      11.45         8.94
  mint cue vs panel        9.03       8.36       7.49      6.72       6.56         5.12
  classic back (FREE)      1.08       1.16       1.30      1.45       1.48         1.90
  slate back (PAID)        2.02       1.87       1.68      1.50       1.47         1.15
  empty slot outline       2.72       2.67       2.59      2.51       2.48         2.27
  panel grey /255            36         42         49        56         58           72

THE ONE THAT COSTS CARD CONTRAST IS V4, and it is flagged beside its picture: 8.94 is BELOW the
10.28 the brief said to protect. V1, V2 and V3 all clear it. Note 10.28 was card-vs-FELT from last
sprint; card-vs-PANEL is the pair that actually applies, and today it is 15.76.

=== 3 - THE CARD BACK NOBODY WAS WATCHING ===

TODAY'S PANEL IS VERY NEARLY THE SAME COLOUR AS THE DEFAULT CARD BACK. Panel rgb(23,33,33),
classic back #18181c = rgb(24,24,28). 1.08:1, and SIX steps of grey out of 255. The face-down
community cards are all but invisible on the surface they sit on. Every option improves it.

FIRST CORRECTION TO THE BRIEF. #4A5058 is SLATE, and slate is PURCHASABLE (cardBacks.ts, sku
buy_card_back). DEFAULT_CARD_BACK is 'classic' #18181c. So the back the brief asked me to protect
is the one most players do not have, and the one they do have is the invisible one. Both measured.

  panel            classic (free)   slate (paid)   slate's advantage
  P0 today             1.08             2.02            1.87x       <- consistent with "1.7x"
  V1                   1.30             1.68            1.29x
  V2                   1.45             1.50            1.03x       <- the paid back stops paying
  V4                   1.90             1.15            0.61x       <- INVERTED: free beats paid

So slate survives V1 and stops being worth buying past it. That is a product consequence, not a
contrast number, and it is Roye's to weigh - someone paid for that back.

=== 4 - WHAT NO OPTION HERE CAN MOVE, VERIFIED RATHER THAN ASSUMED ===

THE GOLD WINNER CUE NEVER RESTS ON A BOARD PANEL. It needs `revealed`; a revealed hand is either
the full-screen BoardReveal (cards on bare felt, no panel at all) or /results, whose
BoardResultCard paints COLORS.surface #161922. 12.52:1 there, unchanged by every variant. I drove
the app to confirm it rather than reading it off Board.tsx - which passes `highlighted` and so
LOOKS like it puts gold on the panel. Seeding skipBoardReveal proved /game jumps straight to
/results: there is no resting revealed-board state carrying panels.

THE NEUTRAL CUE, 3.31:1, UNCHANGED. It is the card's own 1px border, so it composites over the
card face and never over the panel. The width channel - 3px gold, 2px mint, 1px neutral - is
untouched by all of this. MINT IS THE COMMUNITY-CARD CUE (`isCommunityCard`), so mint is the one
cue that IS on the panel: 9.03 today, 5.12 at worst.

=== 5 - V3 COLLAPSED, AND I BUILT THE THIRD OPTION AGAIN ===

The brief's third option is "a lighter panel tint that still reads as a panel but stops looking
like a dark box". I first tinted the panel with the FELT'S OWN HUE - and that is nearly a no-op
over the felt. V3 lands at rgb(29,61,44) against V2's rgb(24,60,39): FIVE PARTS IN 255. It stopped
looking like a dark box and stopped reading as a panel at the same time, so it was not a third
option, it was V2 with a warmer cast.

A panel only reads as a panel if it differs from the felt in LIGHTNESS. Toward the felt is a no-op;
so V4 goes ABOVE it - a raised area of table rather than a scrim laid over it. That is the option
the brief actually asked for, and it is also the only one that breaks the card-contrast floor. Both
are in the artefact, V3 marked as collapsed rather than quietly dropped.

=== 6 - INSTRUMENT FAILURES: 4, ALL MINE, ALL CAUGHT BEFORE THEY REACHED A CONCLUSION ===

1. "SAME HAND: YES" OFF FOUR ZEROES. The first measurement pass reported the shares identical
   across all five variants. Every share was 0.00, so it was comparing nothing to nothing - Rule 9
   exactly. Cause: the capture was behind a tip-toast veil (below), so the card face rendered
   rgb(156,155,150) and matched #FCFAF3 nowhere. The check now REFUSES to call shares equal unless
   they are non-trivial. Fixed, the proof is real: card face 10.36% and mint 1.45%, identical to
   two decimals across all six variants in all six cells.
2. THE WHOLE SCREEN WAS DIMMED AND I NEARLY MEASURED IT. The first-hand coaching tips apply a
   ~0.61 veil over everything. Found by LOOKING at the picture, not by any check I had written -
   the histogram's top colour was rgb(156,155,150), which is exactly #FCFAF3 x 0.61. Every contrast
   number in that pass was measured through it. `caps_games_played` suppresses the tips;
   `has_seen_interactive_tutorial` alone does NOT, it gates a different overlay. The capture now
   records whether a tip is visible so this cannot pass unnoticed again.
3. THE SWEEP DEALT A DIFFERENT HAND EVERY RUN. I pinned Math.random in the capture harness and
   forgot it in the overlap sweep. Pair counts wandered 1/3/2/1/2 purely with the cards, and since
   a pair is keyed by glyphs AND coordinates, every pair looked "new" and the pre-change control
   was worthless. Pinned: all six variants now return IDENTICAL counts.
4. I READ THE PANEL TOKEN OUT OF THE WRONG NAMESPACE FIRST. paintThemes and visualThemes both
   define boardPanelTop, with different values (#1C1F268C vs streetStencil's #5a5a60), and
   DEFAULT_PAINT_THEME is 'streetStencil'. Board.tsx reads VISUAL_THEMES. Traced the whole chain
   before measuring: visualTheme null -> getTheme(null) -> classic -> activePaint.visual.classic ->
   #1C1F268C. DEFAULT_PAINT_THEME is INERT for this - `activePaint = currentPaint` is hardwired,
   not PAINT_THEMES[DEFAULT_PAINT_THEME]. Confirmed independently by the persisted store, which
   carries visualTheme "classic".

=== 7 - VERIFICATION ===

SAME HAND. Practice deals through utils/deck.ts on Math.random and no seed parameter exists
anywhere in the app, so the harness pins Math.random to a mulberry32 before any app code runs -
identical deal by construction - and then PROVES it by share-of-pixels. State B: identical to two
decimals in all 36 comparisons. State A: identical in 35 of 36; one cell (393/3P, V2) differs by
0.01 in mint share, an antialiasing difference while the deal settles. Card-face share is identical
in all 72. Reported rather than rounded away.

NO LAYOUT CHANGE. Board-surface and first-board geometry byte-identical across all six variants at
all six cells. Board count never assumed - every seat count walked, because 2P=4, 3P=3, 4P=2.

CLIP-AWARE OVERLAP SWEEP, against a PRE-CHANGE CONTROL, all three board counts at 320 and 393:
identical pair counts in every variant. The only pairs are two pre-existing ones at 320/2P - a
card's own corner pip over its centre suit, card-intrinsic geometry. No variant adds one.

jest 2,653/2,653, 43 suites. tsc --noEmit clean.

WEBKIT: STILL NOT AVAILABLE. Its download host closes the connection in this container and browser
egress to the live site is blocked. Every browser number in handoffs 108-113 is Chromium-only.

=== 8 - NOTHING SHIPPED - PRODUCTION UNCHANGED ===

No token altered, no component touched, no bundle deployed. tests/panel-variants.sh patches
paintThemes.ts and Board.tsx, exports, and restores them on every exit path; `git diff` on both is
empty and the working tree carries only the four new harness files, this doc, and a .gitignore
line. Gold, mint and the neutral cue untouched. The felt token was NOT lifted again - that is
measured and settled.
No payment flag enabled. purchases 0. iap_enabled, RevenueCat and App Store Connect untouched.
verify_jwt still false. Faucet, rescue, ad amount, rake, record_hand_net and record_reward
untouched. Missions inactive. No migration, no backfill. No game_rooms or room_players row
hand-edited. The 4 mixed human/automation devices and every device showing real play untouched.
The ten baselines are NOT regenerated. No repository setting changed.

=== 9 - RECOMMENDATION, IN VISUAL TERMS - BUT ROYE PICKS ===

V1, more transparent, painted once. The felt reads clearly as the table's surface right up to the
cards, and each board still reads as its own slightly recessed region instead of leaning entirely
on a 1px accent border to say where it ends. It also keeps the most in reserve: card contrast
13.09, well clear of the floor; the free card back meaningfully better at 1.30; and slate still
worth its price at 1.29x.

V2 is the honest fuller commitment and costs only card contrast you can afford - but it spends the
slate back. V4 is the most table-like of the four and the only one I would not ship as measured.

=== 10 - STILL OPEN ===

  - THE EMPTY SLOT OUTLINES FAIL 3:1 ON EVERY OPTION INCLUDING TODAY'S: 2.72 down to 2.27. White
    at 0.30 alpha over the panel. Pre-existing, mildly worsened by every option here, and it wants
    its own decision - it is not a panel choice.
  - THE DOUBLE PAINT is a real defect independent of which option is chosen, and it is still in
    production. If no option ships, that one still should.
  - The full loop has never run against any of this - no WebKit, no browser egress.
  - The ten baselines await the panel decision, then one regeneration.
  - No real 3-player tie yet; there has never been an attributable 3-player hand in production.
