# 2026-08-17 — The body was not attempted, and starting it would have been worse than not

**Nothing built this run. Nothing deployed, no migration, no code changed.** I am stopping before
`resolve_hand`'s body because I do not have the room to finish it, and **this is the one change in
the sequence where a half-finished version is actively harmful.**

## Why not start it

The brief is explicit that the writes and the client gating land together: *"Never gate the client
before the server writes — that would leave multiplayer with no writer at all."* **The reverse is
worse.** If the function starts writing `hand_history` rows and calling `record_hand_net` while
`results.tsx` still writes for multiplayer, every hand gets **two rows per player and two chip
deltas** — double-writing into the exact table this stage exists to make trustworthy, and into the
economy.

So this change has no safe partial state. It is: server writes **and** client gated, or neither.

The work needed in one run is the adjudicator body (read `game_hands`, auto-fill, evaluate, two row
writes, `record_hand_net` per seat, idempotency on `(room, hand_no)`), a re-upload of the 12 KB
evaluator alongside it, the client gating, `p_full`'s removal, the equivalence harness, and seven
proofs across two engines. I would get partway and have to leave it deployed or half-reverted.
**Neither is acceptable for this particular change**, so I did not begin.

## What is ready, so the next run is a straight build

| piece | state |
|---|---|
| the evaluator in Deno | **runs, matched to the digit** (`rank 5`, `score 501413120702`, 2+3) |
| `submit_placements` | live, validates by set equality, stores on `game_hands` |
| `game_hands` | holds the deal, keyed `(room_id, hand_no)` |
| the generator + `--check` | produces `_shared/` from source, fails on drift |
| the Node runner | executes the same generated file — the harness is nearly free |
| `resolve-hand` (deployed) | a **verification entrypoint only**; it evaluates a hardcoded board |

**The one ordering rule to carry into it:** deploy the body and gate `results.tsx` in the same
change, and do not call the new function from any client until the gating is live.

## DB state — untouched

```
game_hands 0 · hand_history 151 · 11 public rooms, CJTK and QW7U 'CAPS Bot', 54YU untouched
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

=== STRATEGIST HANDOFF — resolve_hand BODY ===
TASK 1 BUILD: NOT ATTEMPTED. Nothing deployed, nothing changed, nothing to call.
  - WHY, and it is not the usual "ran out of room": THIS CHANGE HAS NO SAFE PARTIAL STATE. You wrote
    that gating the client before the server writes leaves MP with no writer. The reverse is worse:
    if the function starts writing hand_history rows and calling record_hand_net while results.tsx
    still writes for MP, every hand gets TWO ROWS PER PLAYER AND TWO CHIP DELTAS — double-writing
    into the table this stage exists to make trustworthy, and into the economy. It is server-writes
    AND client-gated, or neither.
  - the run needs: the adjudicator body (read game_hands, auto-fill, evaluate, two row writes,
    record_hand_net per seat, idempotency on (room, hand_no)), a re-upload of the 12 KB evaluator
    beside it, the client gating, p_full's removal, the equivalence harness, and seven proofs across
    two engines. Partway through leaves it deployed or half-reverted. Neither is acceptable HERE,
    so I did not begin.
  - auto-fill / rows / chips / idempotency / results.tsx gating / p_full: NONE.
TASK 2 EQUIVALENCE: not run.
TASK 3 PROOF: not run.
GUEST READY PATH: not reached.
READY FOR THE NEXT RUN — a straight build from a validated foundation:
  - the evaluator RUNS IN DENO and matched to the digit (rank 5, score 501413120702, 2 from hand,
    3 from board, cold 718 ms / warm 554 ms).
  - submit_placements is live and validates by set equality; game_hands holds the deal keyed
    (room_id, hand_no); the generator with --check produces _shared/ from source and fails on drift;
    the Node runner executes the same generated file, so the harness is nearly free.
  - `resolve-hand` is deployed but is a VERIFICATION ENTRYPOINT ONLY — it evaluates a hardcoded
    board. It must be replaced by the body, not extended alongside it.
  - THE ORDERING RULE TO CARRY: deploy the body and gate results.tsx in the SAME change, and do not
    call the new function from any client until the gating is live.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | p_full still present | results.tsx still writes for MP.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot'
  and 54YU untouched, bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: not run — no code changed. CI unchanged at ff2ee67.
HANDOFF: file + vamos_handoffs slug 2026-08-17-body-not-attempted | chars | code-point match? Y
WHAT I DID NOT CHECK: anything new — this run measured nothing. The open unknowns are unchanged
  from the last handoff: only one board has been evaluated in Deno rather than a distribution;
  gameLogic.ts's import chain, which the chip deltas will need, is untraced; and the cold-start
  figure is one sample.
=== END ===
