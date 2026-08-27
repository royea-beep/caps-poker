CAPS - ALIGN-THE-CELEBRATION: THE SIXTH DEFINITION WAS INSIDE THE ONE DERIVATION (2026-08-27)

MAP: vamos_handoffs id 108. (The sprint doc already claimed "Latest: id 108" - THAT ROW DID
NOT EXIST when this session opened; the channel's max was 107 and the ALIGN-THE-CELEBRATION
handoff never landed. This row is that missing 108, written now.)
Branch claude/vamos-caps-align-celebration-flppo0 @ 9c532d9 | main 945cc12 | resolve-hand v11
verify_jwt false, unchanged. NO DB CHANGE. NO DEPLOY.

=== 0 - WHAT I FOUND ON ARRIVAL ===

The brief's work was ALREADY DONE AND ALREADY ON MAIN. main == the branch == 945cc12, five
commits past the 810c0d9 the brief was written at: the celebration alignment, the analytics
fix, the gated-surface override, the proof harness and the proof table. So I did not redo it.
I verified it - Rule 14 - and verification found the thing below.

=== 1 - THE FINDING: ONE DERIVATION, BUT NOT THE SERVER'S RULE ===

utils/handOutcome.ts carried this sentence:
    "At two players this is solo's original rule unchanged. At three and four it matches the
     server's rule in resolve-hand: share the maximum and it is a tie."
A CLAIM, NOT EVIDENCE, and no test looked at it. It was FALSE.

RevealBoardData.winner is 'player'|'bot'|'tie'. EVERY OPPONENT COLLAPSES INTO ONE TOKEN.
Counting it gives the opponents' COMBINED total. resolve-hand compares against the HIGHEST
SINGLE seat (index.ts:200-221, verbatim: below the max is 'lost', sharing it is 'tied',
holding it alone is 'won'). Those are different functions.

Both transcribed from source and run over EVERY reachable distribution:
    2 players / 4 boards    81 distributions    0 disagree
    3 players / 3 boards    64 distributions    6 disagree - ALL ONE SHAPE
    4 players / 2 boards    25 distributions    0 disagree

THE SHAPE: THREE SEATS, ONE BOARD EACH.
    resolve-hand   boards_won 1-1-1, three seats share the max     -> 'tied'  for all three
    the client     mine 1 vs COMBINED 2                            -> YOU LOSE to all three

The four-player case the whole sprint was built on - two seats, one board each, +50 apiece -
sits in a column where the two rules AGREE. That is why it never surfaced. The sprint closed
chips-vs-boards and left BOARDS-vs-BOARDS one level down: the same defect class, inside the
single derivation that was built to end it.

=== 2 - IT WAS NOT ONLY THE CELEBRATION ===

In SOLO the client is the recorder. queueHandResult sends this same outcome and
record_hand_result_d maps `p_won IS NULL -> 'tied'` (read from pg_get_functiondef, not assumed).
So a solo 3-player 1-1-1 hand was WRITTEN TO hand_history AS 'lost' and moved the ladder as a
loss, while the identical shape in multiplayer was written 'tied' by resolve-hand.
SAME BOARDS, TWO RECORDS. The record was wrong, not just the cue.

=== 3 - REACHABILITY, MEASURED ===

hand_history, non-practice:
    3 players / 3 boards    42 rows    15 at boards_won=1    'tied' rows: ZERO, EVER
    2 players / 2 boards    24 rows                          'tied' rows: 13
Not one 3-player hand has ever been recorded a tie.

I CANNOT NAME A SPECIFIC HISTORICAL 1-1-1 HAND, and I am not going to imply that I can.
boards_data is NULL on those rows - PRESENT AND EMPTY, Rule 9 - so the opponents' distribution
is unreconstructable; boards_won=1 of 3 is equally consistent with 1-1-1 and with 1-2-0, and
both net exactly 0 chips. The shape is proved DETERMINISTICALLY instead, by enumeration and in
a browser. Guessing from the 15 rows would be inference dressed as data.

=== 4 - THE FIX ===

Boards carry winnerSeat - 0 = me, each opponent a DISTINCT index, -1 = the board itself tied -
through ALL FOUR PRODUCERS. Fixing fewer would have aligned part of the table:
    utils/gameLogic.ts          solo (seat 0 is already the player; heads-up set from the token)
    app/multiplayer-game.tsx    MP HOST path   - builds its reveal from the EF response
    app/multiplayer-game.tsx    MP GUEST path  - builds its OWN from the BOARD_REVEAL broadcast
    utils/handHistory.ts        the session hand record, so the W-L tally asks the same question
The MP seats are ROTATED so the local player is 0 and every opponent keeps a distinct index
(seats below mine shift up by one) - a bijection, so each opponent's own count is preserved.

deriveHandOutcome now compares against the best SINGLE opponent, which is the server's rule.
It STILL TAKES BOARDS AND NOTHING ELSE, so the "it never sees chips" property test stands
untouched - the seat rides on the board objects, not on a second argument.

Records written before the field existed have no seat and fall back to the collapsed count,
rather than reading a missing seat as 0. Mixed input is treated as unseated.

SETTLEMENT UNTOUCHED. record_hand_net, record_reward, the faucet, rescue, ad amount and rake
are not in the diff. RevenueCat, iap_enabled and verify_jwt untouched. No flag enabled, no
backfill, no missions reactivated, Card.tsx untouched, the client's update_leaderboard_elo not
re-added. This changes what is CELEBRATED and RECORDED, not what is PAID.

=== 5 - PROOF ===

DETERMINISTIC. handOutcome.test.ts transcribes the server rule from resolve-hand/index.ts and
asserts agreement across EVERY distribution at 2, 3 and 4 players. THE SELF-TEST WAS PLANTED:
reverting the seat rule fails EXACTLY the two 3-player assertions and nothing else - 2P and 4P
still pass. That is the blast radius demonstrated rather than described.

IN A BROWSER, on a production export CONTAINING THE FIX (tests/parity-3p-probe.mjs, using the
documented EXPO_PUBLIC_CAPS_FIXTURE=1 mechanism from celebration-gate-probe.mjs; revealData
substituted one level ABOVE the rule, never the rule itself; Supabase aborted at the network
layer so no fixture can reach the ledger). Read off the RENDERED headline and the overlay's own
nodes - 7/7 at 393, 320 AND 430 px, 0 page errors:

  1  3P one board each          TIE GAME   overlay 0 dots    <-- WAS "YOU LOSE"
  2  3P one opponent takes two  YOU LOSE   overlay 0 dots        unchanged
  3  3P player takes two        YOU WIN    overlay 20 dots       unchanged
  4  3P every board tied        TIE GAME   overlay 0 dots        unchanged
  5  CONTROL 2P clean win       YOU WIN    overlay 20 dots       unchanged
  6  CONTROL 2P clean loss      YOU LOSE   overlay 0 dots        unchanged
  7  CONTROL 4P sprint's case   TIE GAME   overlay 0 dots        unchanged

EXACTLY ONE ROW MOVES. The tie neither celebrates nor mourns.

TESTS: 2,648/2,648 green, 43 suites, on the committed tree. tsc --noEmit clean.

=== 6 - INSTRUMENT FAILURES: 1, NAMED ===

The probe read null from EVERY row off a page painting at 74 rAF/s. The bundle contains
import.meta (a redux-devtools guard) and the export produced in this container emits
`<script defer>` - a PARSE error, so React never mounted. caps.ftable.co.il serves the SAME
bundle as `<script type="module">`; the probe's server now normalises the tag to match the
deployed one. CHECKED AGAINST THE LIVE index.html, NOT ASSUMED. Without the Rule 14a paint
preamble, seven null headlines would have read as seven passing absences.

=== 7 - WHAT I DID NOT DO, AND WHY - READ THIS ===

THE FULL FINAL LOOP WAS NOT RUN AGAINST THIS FIX, AND I WILL NOT CLAIM IT WAS.
  - BOTH ENGINES IS NOT POSSIBLE HERE. Only Chromium is installed (build 1194, and the
    project pins 1217, so even it needed an explicit executablePath). THERE IS NO WEBKIT IN
    THIS CONTAINER. Every browser number above is Chromium-only.
  - THE LIVE SITE DOES NOT CONTAIN THIS FIX. caps.ftable.co.il serves main@945cc12; bundle
    hash index-f40ddcc45276de5b70929e3470f663b4.js, STABLE ACROSS THREE SAMPLES (the first
    sample came back EMPTY on a transient fetch - Rule 9 again - and was retried rather than
    reported as a change). Running the loop there would measure the PRE-FIX build.
  - So the gated-screen override, the a11y sweep and the visual/BackstopJS gate have NOT been
    re-run against this change. NOTHING WAS DEPLOYED.

NOT DONE, DELIBERATELY: no DB write of any kind, including no test row into hand_history to
demonstrate the 'tied' record. Proving it that way means writing production rows, and the
standing rules put that out of bounds. The write path is proved by reading
record_hand_result_d's own definition instead.

=== 8 - NEXT ===

  1. Roye's call: deploy the branch, then run the FULL loop against it - both engines, all
     widths, all board counts, gated screens by config override, self-test planting its
     defects, bundle hash stable across two samples first.
  2. The 3-player ladder will start showing ties. It never has. That is the fix landing, not
     a regression - but it is the first thing that will look wrong in the data.
  3. Pre-2026-08-27 3-player rows are WRONG AND WILL STAY WRONG. Some recorded 'lost' were
     ties. Not backfilled: the distributions are gone (boards_data NULL), so a correction
     would be a guess. The count starts at the deploy, exactly as the MP relabel did.
