# 2026-08-17 — Deno runs the evaluator, and every predicted number matches

**Task 1 passed exactly.** The generated evaluator is deployed to Deno, was **called**, and returned
the predicted answer to the digit. Route 2 is validated. **Task 2 was not started** — the upload and
verification is where this run ended.

## The result

```
GET /functions/v1/resolve-hand
{"booted":true,"rank":5,"score":501413120702,"playerCardsUsed":2,"boardCardsUsed":3,
 "name":"Flush","tripsRank":3,"tripsScore":301409070000,"flushBeatsTrips":true}

cold 718 ms · warm 554 ms
```

| predicted | actual |
|---|---|
| `rank 5` | **5** |
| `score 501413120702` | **501413120702** |
| `playerCardsUsed 2` | **2** |
| `boardCardsUsed 3` | **3** |

**VERDICT: matches.** Not "boots" — *matches*. The score is a twelve-digit encoding of rank plus
five kickers, so an identical value is a strong statement that the evaluator behaves the same in
Deno as in the app: same rank, same tie-break ordering, same two-from-hand and three-from-board
selection. `flushBeatsTrips` confirms the comparator too.

**Wall 4a is settled as well** — the `enum` survives Deno's transform. It compiled, and
`HAND_RANK_NAMES[HandRank.Flush]` came back as `"Flush"`, which only works if the enum is real at
runtime.

The two files were uploaded **verbatim** from `supabase/functions/_shared/` — no truncation, no
summary, no hand-edit. The known-board check doubles as the transcription check: any deviation in a
12 KB file would show as a different score or a failure to boot.

## What this closes

Four walls, one route, and the route holds. Server-side adjudication can run **the same evaluator
the client runs**, which was the entire premise of route 2 and the reason PL/pgSQL was rejected.

## Not built

`resolve_hand`'s actual body — reading `game_hands`, auto-fill, writing both `hand_history` rows,
chips through `record_hand_net`, idempotency per `(room, hand_no)` — plus the equivalence harness,
the `results.tsx` gating, `p_full`'s deletion, and all seven proofs. **None of it.** What is deployed
today is a verification entrypoint, not the adjudicator.

**Next run starts from a validated foundation**: the evaluator runs, `submit_placements` validates
and stores, `game_hands` holds the deal, and the Node runner from the previous run can execute the
same generated file for the equivalence harness.

## DB state — untouched

```
game_hands 0 · hand_history 151 · 11 public rooms, CJTK and QW7U 'CAPS Bot', 54YU untouched
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

Nothing created, deleted or migrated. No app code changed this run.

=== STRATEGIST HANDOFF — DENO + resolve_hand ===
TASK 1 UPLOAD:
  - deployed AND CALLED? YES, called:
    {"booted":true,"rank":5,"score":501413120702,"playerCardsUsed":2,"boardCardsUsed":3,
     "name":"Flush","tripsRank":3,"tripsScore":301409070000,"flushBeatsTrips":true}
  - rank 5? YES. score 501413120702? YES. playerCardsUsed 2? YES. boardCardsUsed 3? YES.
    All four predicted values matched EXACTLY.
  - VERDICT: MATCHES — build proceeds. Not merely "boots": the score is a twelve-digit encoding of
    rank plus five kickers, so an identical value means the same rank, the same tie-break ordering
    and the same 2-from-hand/3-from-board selection. flushBeatsTrips true confirms the comparator.
  - wall 4a: SETTLED IN DENO. The enum compiled and HAND_RANK_NAMES[HandRank.Flush] returned
    "Flush", which only works if the enum exists at runtime.
  - if size blocked the upload — reported, not truncated? N/A — it fit. Both files went up VERBATIM
    from supabase/functions/_shared/. The known-board check doubles as a transcription check: any
    deviation in a 12 KB file shows as a different score or a failed boot.
  - COLD START: 718 ms first call | 554 ms warm. One call per hand, at the moment the reveal is
    already animating — the same bar deal_hand's 76 ms was judged against, and better hidden.
TASK 2 IF IT MATCHES: NOT STARTED. resolve_hand's body (read game_hands, auto-fill, both
  hand_history rows, chips via record_hand_net, idempotency per (room, hand_no)), the equivalence
  harness, results.tsx gating and p_full deletion: NONE of it. What is deployed is a VERIFICATION
  ENTRYPOINT, not the adjudicator — it evaluates a hardcoded board and returns the numbers above.
TASK 3 PROOF: NOT RUN — there is no adjudicator to prove yet.
WHAT THIS CLOSES: four walls, one route, and the route holds. Server-side adjudication can run THE
  SAME EVALUATOR the client runs, which was the entire premise of route 2 and the reason PL/pgSQL
  was rejected. Next run starts from a validated foundation: the evaluator runs in Deno,
  submit_placements validates and stores, game_hands holds the deal, and the Node runner from the
  previous run executes the same generated file for the equivalence harness.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | p_full still present | results.tsx still writes for MP.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot'
  and 54YU untouched, bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: not run — no app code changed this run. CI unchanged at ff2ee67.
HANDOFF: file + vamos_handoffs slug 2026-08-17-deno-matches | chars | code-point match? Y
WHAT I DID NOT CHECK: only ONE board was evaluated — it proves the module loads and that this hand
  is right, not that N hands agree, which is what the equivalence harness is for and it was not run;
  whether gameLogic.ts (needed for the chip deltas) imports cleanly under the same treatment, which
  is the next likely seam; and the cold-start number came from one sample on one connection, not a
  distribution.
=== END ===
