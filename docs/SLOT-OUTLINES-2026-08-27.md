CAPS - SLOT-OUTLINES: the outline is drawn through a dead animation, the ledger is empty, and the
fixture now means its name (2026-08-27)

MAP: vamos_handoffs id 115. main b68542d (merged and deployed). Live bundle
index-a1020704 -> index-477bf329. Branch claude/vamos-caps-align-celebration-flppo0 @ b68542d.
resolve-hand v11, verify_jwt false. jest 2,654/2,654, tsc clean. Gold, mint, the neutral cue, the
felt and the panel all untouched and PROVEN untouched by bundle delta.

=== 1 - WHAT THE OUTLINE IS ACTUALLY DRAWN ON ===

Established before anything changed, and it is not one surface but three facts:

  1. IT HAS TWO NEIGHBOURS, not one. The resting slot is a 1px dashed border around a
     rgba(255,255,255,0.045) fill, so the line has the FILL on its inside and the BOARD PANEL on
     its outside. A single "outline vs panel" figure describes one edge and ignores the other.
  2. THE WHOLE SLOT IS MULTIPLIED BY 0.6. EmptySlotAnimated renders behind
     useSharedValue(0.6) - the initial value of a pulse that NEVER RUNS, because KILL_Board is a
     hardcoded `true` left by the 2026-03 crash bisect whose Phase 4 was never carried out. The
     component's own comment already says so; nothing had connected it to contrast.
  3. SO THE ARITHMETIC IS: border 0.30 over fill 0.045 -> 0.3315, x 0.6 -> effective 0.199.
     Predicted rgb(70,96,83). MEASURED off the render rgb(68,95,82). The model is confirmed.

  outline vs the fill it encloses   1.73:1
  outline vs the panel outside it   1.82:1

MY 2.59 LAST SPRINT WAS WRONG. It was an analytic composite against ONE neighbour and it ignored
the 0.6 multiplier entirely, so it overstated the real contrast by about 40%. The gap to 3:1 was
never 0.41; it was 1.27. Same class of error as measuring the neutral cue against the felt when it
sits on the card - a number computed against a substrate the pixel does not have.

=== 2 - THE FIX, SWEPT RATHER THAN SOLVED ON PAPER ===

Because the token does not predict the pixel here, the new value was chosen by walking the LIVE
element through nine candidates and reading the PAINTED contrast back each time:

  candidate            painted        vs fill   vs panel   effective alpha
  0.30 1px dashed      rgb(68,95,82)     1.73      1.82       0.192   <- shipping before
  0.45 1px dashed      rgb(89,113,101)   2.29      2.40       0.283
  0.60 1px dashed      rgb(108,130,119)  2.94      3.08       0.369
  0.75 1px dashed      rgb(129,146,137)  3.70      3.87       0.449   <- chosen
  0.90 1px dashed      rgb(148,164,156)  4.65      4.86       0.540
  0.45 2px dashed      rgb(89,113,101)   2.29      2.40       0.283
  0.45 1px SOLID       rgb(89,113,101)   2.29      2.40       0.283

WIDTH AND BORDER-STYLE DO NOT MOVE THE RATIO AT ALL - they change how many pixels the line covers,
not their colour, so a 2px dashed and a 1px solid land on the same value as 1px dashed at the same
alpha. Alpha was the only lever, which is worth knowing before anyone reaches for a thicker line.

  constants/paintThemes.ts  boardSlotDash       0.30 -> 0.75   (classic AND fiveo)
                            boardSlotDashActive 0.72 -> 0.95   (classic AND fiveo)

THE ACTIVE STATE ROSE ONLY TO KEEP THE ORDER INTACT. At resting 0.75, a 0.72 "active" would have
been DIMMER than the state it escalates from. Active is also solid and 1.5px against resting's
dashed 1px, so the step does not rest on alpha alone.

VERIFIED FROM A REAL EXPORT, not from the injected sweep:
  chromium   3.71 vs fill   3.94 vs panel
  webkit     3.66 vs fill   3.95 vs panel
Both clear 3:1 with margin, on both neighbours, on both engines.

⚠️ THE 0.75 IS CALIBRATED AGAINST THE 0.6 MULTIPLIER, and the token says so. If KILL_Board is ever
flipped, the pulse runs 0.72<->1.0 and this outline paints far brighter than intended, and pulses.
Fixing the dead pulse is the root fix and is NOT taken here - a crash-isolation flag from an
unfinished bisect is not something to flip inside a contrast change. Reported, section 6.

=== 3 - THE FULL SET, RE-MEASURED. NOTHING ELSE MOVED. ===

393 / 2P, every slot filled, against the panel's own rendered ground:

                            before    after
  card face vs panel        13.09    13.09
  mint cue vs panel          7.49     7.49
  free back (classic)        1.30     1.30
  paid back (slate)          1.68     1.68
  empty slot outline    1.73/1.82  3.71/3.94   (fill / panel, MEASURED)
  widths                3 gold / 2 mint / 1 neutral - UNCHANGED
  greyscale, panel 49:  card 201 · mint 141 · free back 19 · paid back 31

SAME HAND PROVEN across all six cells: card face and mint shares identical to two decimals, and
non-trivial (10.36% / 1.45% at 393/2P), so the equality is not two zeroes agreeing.

GOLD, MINT AND THE NEUTRAL CUE UNTOUCHED - by bundle delta across the deploy, not by assertion:
#FFD700 50->50, #4FD6A8 59->59, rgba(0,0,0,0.45) 3->3. Panel 1C1F2640 2->2 and felt #003115 1->1
as well, so neither of the last two sprints' decisions moved either.

CLIP-AWARE SWEEP with a pre-change control, all three board counts at 320 and 393, BOTH ENGINES:

  chromium   P0 / SHIP / SLOT   0,0,0 · 0,0,0 · 0,0,0 · 2,2,2 · 0,0,0 · 0,0,0   none added
  webkit     P0 / SHIP / SLOT   28,28,28 · 21,21,21 · 25,25,25 · 40,40,40 · 28,28,28 · 14,14,14   none added

FIRST TWO-ENGINE SWEEP, AND WEBKIT SEES FAR MORE PAIRS - 468 across the run against Chromium's 2.
Every one is card-intrinsic: 405 are a suit glyph over a suit glyph, and the other 63 are a card's
RANK glyph over its own SUIT glyph at 38-45%. All are present in the P0 control, so none belongs
to this change or the last one; WebKit's text metrics simply give those glyph boxes enough overlap
to cross the 35% threshold where Chromium's do not. Reported, not fixed.

=== 4 - THE PAYMENT-ADJACENT TABLES, ASKED PROPERLY ===

Not "check the two we happen to name". Every base table in `public` carrying a money-ish column
(price / receipt / sku / amount / currency / transaction / purchase / refund / entitlement /
subscription / order / invoice / charge) or a money-ish name:

  table                                   rows   what it is
  purchases                                  0   the generic ledger. Empty, as reported.
  chip_purchases                             1   the chip-pack ledger. ONE row, the test receipt.
  starter_pack_redemptions                   0   live starter-offer funnel. Empty.
  _backup_starter_redemptions_20260816     649   ⚠️ a BACKUP nobody had mentioned
  chip_transactions                       4327   in-game chip ledger. No real currency.
  economy_log                              340   in-game economy events. No real currency.
  caps_simulation_runs                       -   has `chip_purchase_rate`; a SIMULATION input.
  achievement_definitions                    -   matched only on `sort_order`. Not money.

THE BACKUP IS NOT 649 SALES, and it would be easy to read it as such. Every row carries
price_usd = 2.99 and receipt_id NULL - the price is a static column default, not revenue. The
columns that decide are the funnel ones: 649 offer_shown, 177 offer_dismissed, and
ACTUALLY REDEEMED = 0. Dates 2026-05-17 to 2026-06-22. It is a funnel snapshot taken on 2026-08-16,
with zero conversions. The live table being empty is consistent with the harness purge in handoff
110 removing those device-keyed rows. NOT DELETED - not mine, not asked for, and real funnel data.

REPORTED BEFORE DELETING, and nothing beyond the one row was touched.

  DELETED: chip_purchases where receipt_id = 'test-receipt-001' AND price_usd = 2.99 AND
           created_at < '2026-05-01'  ->  1 row.
  VERIFIED BY A FRESH SELECT, not by the DELETE's own RETURNING: chip_purchases 0, test rows 0,
  purchases 0, and get_caps_dashboard() -> monetization.purchases now reports "0".
  (The delete's own CTE reported rows_after = 1 - a data-modifying CTE reads the pre-delete
  snapshot. Believing that number would have read as "the delete did nothing".)

The first real sale will now read as the first.

=== 5 - THE FIXTURE THAT RECORDED A FIRST RUN AS "ONBOARDED" ===

FIXED AT SOURCE. tests/bootstrap-storage-state.js visits the live site as a brand-new visitor, so
what it saved was a FIRST RUN under the name "onboarded": home's own first-run effect writes
guidedModeForced='true' while the script is standing on the home screen, and caps_games_played was
never set. game.tsx computes `guided = played === 0 || guidedVal === 'true'`, so either half turns
on the first-hand coaching tips - which render a toast AND dim the whole screen to ~0.6.

The bootstrap now sets the onboarded keys before capture, clears the flag again in case the app
re-armed it, and then ASSERTS the saved file is onboarded - exiting non-zero rather than writing a
fixture that contradicts its own name. Proven in CI output: the regenerated caps-onboarded.json
contains ZERO occurrences of guidedModeForced and does contain caps_games_played.

THE OTHER TWELVE CONSUMERS, AND WHAT EACH INHERITED. All of them replay this file's localStorage,
so every one of them was loading the app as a first-run user:

  tests/wcag-audit.js                   THE ONE THAT MATTERS. The accessibility gate, and the gate
                                        that gates BackstopJS in web-deploy.yml. It was auditing
                                        /game with the coaching toast up and every colour behind a
                                        ~0.6 veil - i.e. measuring contrast on a screen no settled
                                        player sees, in the audit whose entire job is contrast.
  backstop_data/.../onBefore.js         produced two bad baseline sets last sprint. Already strips
                                        the flag defensively; that stays as belt and braces.
  tests/qa-council-2026-05-21.js        dated QA sweep - captured a coached /game
  tests/qa-visual-mocks-2026-05-22.js   dated QA sweep - same
  tests/qa-451-verify-2026-05-22.js     dated QA sweep - same
  tests/qa-layout-before-2026-05-22.js  dated QA sweep - same
  tests/qa-latest-design-2026-05-22.js  dated QA sweep - same
  tests/qa-card-visual-before-2026-05-22.js / -after-2026-05-23.js   CARD COLOUR comparisons, run
                                        through a 0.6 veil on any board screen
  tests/qa-prb-before-2026-05-24.js     dated QA sweep - same
  tests/probe-home-404.js               home only; the tips are a /game overlay, so unaffected
  tests/panel-compare.mjs · panel-sweep.mjs · slot-probe.mjs · slot-sweep.mjs   MINE, and they set
                                        caps_games_played themselves, which is why this sprint's
                                        numbers are not veiled

The dated 05-2x scripts are historical artefacts and their outputs are already spent; the live
inheritance was the WCAG gate and the baseline hook. Both are now clean.

=== 6 - BASELINES ===

REGENERATED, because the outline change moves them - and LOOKED AT before committing, for the
fourth time this sprint sequence. Three moved: /game (the outlines, which is the change), plus
home and rank by a few bytes from the regenerated fixture. All twelve scan clean: /game's most
common colour is #FCFAF3 at 13.5% and veiled pixels are 0.02%, so no toast and no veil.

The /game capture is also the only view of the shipped outlines on PRODUCTION available from here
- browser egress to the live site is still blocked in this container but not on the runner - and
they are plainly visible in it as dashed white rectangles on the felt.

=== 7 - BUNDLE ===

  before  index-a102070404f0cd79da89d7a11c262528.js
  after   index-477bf3293287ff46aedafac70ec51a1a.js
Three matching samples each.

  rgba(255,255,255,0.30)   old resting outline   5 -> 3    (-2: classic + fiveo)
  rgba(255,255,255,0.75)   new resting outline  18 -> 20   (+2)
  rgba(255,255,255,0.72)   old active outline    3 -> 1    (-2)
  rgba(255,255,255,0.95)   new active outline    0 -> 2    (+2)
  #FFD700     GOLD CUE     50 -> 50   <- CONTROL
  #4FD6A8     MINT CUE     59 -> 59   <- CONTROL
  rgba(0,0,0,0.45) NEUTRAL  3 ->  3   <- CONTROL
  1C1F2640    PANEL         2 ->  2   <- CONTROL, last sprint's decision unmoved
  #003115     FELT          1 ->  1   <- CONTROL, not lifted

The counts are not unique to these tokens - 0.30 and 0.75 both appear elsewhere - so only the
DELTA proves anything, and it is exactly -2/+2 on each, which is classic plus fiveo.

=== 8 - PRODUCTION UNCHANGED ===

iap_enabled=false · web_payments_enabled=false · hand_rake_pct=5 · rewarded_ad_chips=100 ·
rewarded_ad_max_daily=5 · rewarded_ad_enabled=true - all as found, none written.
purchases 0 · chip_purchases 0 (the one test row deleted, section 4) · starter_pack_redemptions 0 ·
the 649-row backup UNTOUCHED · 0 active missions. Faucet, rescue, ad amount, rake, record_hand_net
and record_reward untouched. RevenueCat and App Store Connect untouched. No migration, no backfill.
No game_rooms or room_players row hand-edited. No repository setting changed.

=== 9 - STILL OPEN ===

  - THE DEAD PULSE. KILL_Board has been a hardcoded true since 2026-03-22; the bisect's own Phase 4
    was never run, and the empty slot has rendered at a pulse's initial value ever since. The new
    0.75 is calibrated against that 0.6, so flipping the flag without revisiting the token would
    make the outlines far too bright. Either finish the bisect or make 0.6 an explicit constant -
    it is currently a leftover masquerading as a design value.
  - WEBKIT'S 468 GLYPH OVERLAPS. Card-intrinsic and pre-existing, but the first two-engine sweep
    found them and nobody has looked at whether rank-over-suit is actually visible on a device.
  - NATIVE HAS STILL NEVER BEEN EXERCISED in 108-115.
  - THE DATED 05-2x QA SCRIPTS all read the fixture and none has been re-run since it was fixed;
    their committed outputs were produced through the veil.
  - No real 3-player tie yet; there has never been an attributable 3-player hand in production.
