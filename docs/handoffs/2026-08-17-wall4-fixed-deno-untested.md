# 2026-08-17 — Wall 4 is fixed and proven in a real runtime. Deno is one upload away.

**Shipped `ff2ee67`.** The generator now splits types from values, and **the generated evaluator
executes outside the app and gets a known board right.** The Deno deploy-and-call — the last step of
Task 1 — **was not done**: I ran out of room to upload the full generated file verbatim, and
truncating it would have been hand-editing the generated copy.

## The fix, in the generator

```
import { RANKS, SUITS } from './cards.ts';
import type { Card, Rank } from './cards.ts';
```

Two transforms now, both on the import line, neither on the algorithm. The source is untouched;
`--check` passes; the body below the import is byte-identical.

## Proven, not assumed — the known board

`tests/evaluator-runtime-check.mjs` runs the **generated** copy under Node's full type transform
(the closest non-Metro runtime available here) against the board from the last run: a spade flush
against trip aces.

```
flush  rank 5 (Flush)          score 501413120702   playerCardsUsed 2   boardCardsUsed 3
trips  rank 3 (ThreeOfAKind)   score 301409070000
flushBeatsTrips  true
usesTwoAndThree  true
```

**Three things are settled by that.** Wall 4a — the `enum` — survives a full transform. Wall 4b is
gone. And the evaluator is *correct* in the new runtime, not merely loadable: the flush beats the
trips, and the winning hand uses **exactly two cards from hand and three from board**, the
structural invariant the evaluator exists to enforce.

**What is still unproven is Deno specifically.** Node and Deno both do per-file transforms, and the
failure that bit us was a per-file-transform failure — so the fix addresses the right class. But
"should" is not "does", and the rule here has been that deployed is not running.

## What the next run should do first, and it is small

Deploy `supabase/functions/_shared/{cards.ts, handEvaluator.ts}` **verbatim** with a thin
`resolve-hand` entrypoint, and **call it** with the same flush-versus-trips board. Expected:
`rank 5`, `score 501413120702`, `playerCardsUsed 2`, `boardCardsUsed 3`. Anything else — including a
successful boot with different numbers — is the finding.

Only after that does the rest of Task 2 make sense.

## DB state — untouched

```
game_hands 0 · hand_history 151 · 11 public rooms, CJTK and QW7U 'CAPS Bot', 54YU untouched
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

Nothing created, deleted or migrated. `submit_placements` live and untouched. No app code changed —
only `scripts/gen-edge-shared.mjs` and a test probe.

=== STRATEGIST HANDOFF — WALL 4 TEST ===
TASK 1 THE TEST:
  - generator split applied? source untouched? YES to both. The generator now performs two
    transforms, both on the import line: the .ts extension, and splitting `Card`/`Rank` into an
    `import type`. utils/handEvaluator.ts is unchanged; `--check` passes; the body below the import
    is byte-identical.
  - deployed AND CALLED? NO — NOT DONE. I ran out of room to upload the full generated file
    verbatim, and truncating it would have been hand-editing the generated copy, which is forbidden
    and would have invalidated the test anyway.
  - known board evaluated correctly? YES, BUT UNDER NODE, NOT DENO. tests/evaluator-runtime-check.mjs
    runs the GENERATED copy under Node's full type transform against the flush-vs-trip-aces board:
      expected: a flush that beats trips, using 2 from hand + 3 from board
      actual:   flush rank 5, score 501413120702, playerCardsUsed 2, boardCardsUsed 3
                trips rank 3, score 301409070000
                flushBeatsTrips true, usesTwoAndThree true
    So it is CORRECT in the new runtime, not merely loadable.
  - VERDICT: NEITHER YET. Wall 4b is FIXED and the fix is PROVEN in a real non-Metro runtime, but
    the Deno-specific verdict is unclaimed. Node and Deno both do per-file transforms and the
    failure was a per-file-transform failure, so the fix addresses the right class — but "should" is
    not "does", and the standing rule here is that deployed is not running.
  - does the enum survive Deno's transform (wall 4a)? UNPROVEN IN DENO; it survives Node's full
    transform, which is the same class of tooling. Type STRIPPING still cannot handle it, so the
    evaluator can never be run by anything that only strips.
IF IT BOOTS — TASK 2: NOT REACHED. resolve_hand, auto-fill, both rows, chips, idempotency,
  results.tsx gating, p_full: none built. Equivalence harness not run — though the Node runner built
  this run is most of it: it can execute the generated evaluator directly, so comparing N deals
  against the server's answers is now cheap rather than blocked.
IF IT DOES NOT BOOT — TASK 3: not applicable; it was never deployed.
NEXT RUN, FIRST THING, AND IT IS SMALL: upload _shared/{cards.ts, handEvaluator.ts} VERBATIM with a
  thin resolve-hand entrypoint and CALL it with the same board. Expect rank 5, score 501413120702,
  playerCardsUsed 2, boardCardsUsed 3. Anything else — INCLUDING A SUCCESSFUL BOOT WITH DIFFERENT
  NUMBERS — is the finding.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot'
  and 54YU untouched, bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: not run — no app code changed (only the generator script and a test probe, and
  supabase/functions is excluded from tsconfig). CI unchanged at 44e1554 for app code; ff2ee67 adds
  no TypeScript the compiler sees.
HANDOFF: file + vamos_handoffs slug 2026-08-17-wall4-fixed-deno-untested | chars | match? Y
WHAT I DID NOT CHECK: Deno itself, which is the whole remaining question; whether the OTHER exports
  in the generated file (computeOmahaEquity and anything after it) also load cleanly, since the Node
  check imported only evaluateOmahaHand and compareHands and a module-level failure elsewhere would
  still break instantiation; and whether gameLogic.ts — which resolve_hand needs for the chip deltas
  — has the same enum and type-import shapes, which on this evidence it very likely does.
=== END ===
