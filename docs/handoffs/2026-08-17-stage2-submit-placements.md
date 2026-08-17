# 2026-08-17 — Stage 2, part 1: each seat submits its own placements

**`submit_placements` is built and the authority gate is proven.** `resolve_hand` is **not** built,
and I am stopping before it — **not at the guest ready path the brief anticipated, but one step
earlier and for a harder reason.** No client code changed, nothing deployed.

## What was built

```
ALTER TABLE public.game_hands ADD COLUMN placements jsonb NOT NULL DEFAULT '{}'::jsonb
      -- device_id -> Card[][] (one array per board)

FUNCTION public.submit_placements(p_room_code text, p_hand_no int, p_device_id text,
                                  p_assignments jsonb) RETURNS jsonb
      SECURITY DEFINER · EXECUTE to anon, authenticated
```

Placements live on the **existing** `game_hands` row rather than in a new table — one hand already
has exactly one row there, and a second table beside the first is this project's known failure mode.

**The host cannot submit for anyone else, by construction: there is no "on behalf of" parameter.**
A caller speaks only for `p_device_id`, and only if that device is seated in that room.

### The authority gate, proven

Room `5WRJ`, hand 1, 2P / 4 boards:

```
one card swapped for a card not dealt to that seat
    -> {"ok": false, "reason": "cards_not_dealt_to_this_seat"}
two boards submitted instead of four
    -> {"ok": false, "reason": "wrong_board_count", "expected": 4, "got": 2}
a caller not seated in the room
    -> {"ok": false, "reason": "not_seated"}
the seat's own sixteen cards, four per board
    -> {"ok": true, "hand_no": 1, "board_count": 4, "seats_submitted": 1}
```

The check is set equality, not membership: the submitted cards must be **exactly** what the server
dealt that seat — no extras, no substitutions, no duplicates, no omissions.

## Why I stopped before `resolve_hand`

The brief anticipated the guest ready path being the hard part. It is not. **The hard part is that
`resolve_hand` has to evaluate Omaha, and there is no server-side evaluator.**

Adjudication means the server computing, per board, which seat wins — `evaluateOmahaHand` over
`C(4,2) × C(5,3)` = 60 candidates per seat per board, with straights including the wheel, flushes,
straight flushes and full kicker tie-breaks. That is a rewrite of `utils/handEvaluator.ts` in
PL/pgSQL, or the same code running in an Edge Function.

**And the risk is not writing it — it is proving it agrees with the client.**

The reveal is rendered client-side from the client's evaluator (that is settled and untouched). If
the server's evaluator disagrees on even one hand, the reveal shows one winner and `hand_history`
records another. That is a silent, intermittent contradiction in the most-regressed area of the
codebase, and it is exactly the class of defect this sequence has been unpicking.

**I could write the SQL. I could not, in this run, prove it equivalent** — and an unproven evaluator
deciding real hands is the thing every prior brief has praised refusing to ship.

### The two routes, with their real costs

1. **PL/pgSQL evaluator.** No cold start, no new deployment surface, and it lives beside the deal.
   Cost: a full reimplementation, and equivalence must be demonstrated rather than assumed.
2. **Edge Function running the existing TypeScript.** `utils/handEvaluator.ts` is 4.8 KB and already
   proven by `utils/__tests__/omahaHighlight.test.ts` (2,000+ evaluator checks). Running *the same
   code* removes the equivalence problem rather than solving it. Cost: cold start on the first
   resolve of a hand, and it contradicts the stage-1 reasoning that chose an RPC — though that
   reasoning was about *dealing*, which needs no algorithm.

**Either way, an equivalence harness is the gate**: N random deals, both evaluators, compare the
winner per board. For route 2 that harness is nearly free (same code, one import); for route 1 it
is the bulk of the work.

**My recommendation: route 2.** The engine's correctness is the one thing here that is already
proven, and re-deriving it in a second language to compare against the first is how two sources of
truth get created — the exact shape this stage exists to remove.

### What is still not done, therefore

`resolve_hand`, the server-written `hand_history` rows, chips through `record_hand_net`, the
practice-only gating of `results.tsx`, and deleting `p_full` — **all untouched.** Gating the client
calls before the server writes anything would leave multiplayer with *no* writer at all, so those
move together with `resolve_hand` or not at all.

## DB state

```
game_hands 0 (probe deal removed) · placements column present · hand_history 151
11 PUBLIC rooms, all waiting — CJTK and QW7U still 'CAPS Bot', 54YU untouched   BASELINE INTACT
19 private rooms (one probe room added) — is_public false, left to expire
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

No `game_rooms` or `room_players` row deleted.

=== STRATEGIST HANDOFF — STAGE 2 BUILD ===
BUILD:
  - submit_placements created: submit_placements(p_room_code text, p_hand_no integer,
    p_device_id text, p_assignments jsonb) RETURNS jsonb, SECURITY DEFINER, EXECUTE to
    anon+authenticated. Storage: a new `placements jsonb` column on the EXISTING game_hands row
    (device_id -> Card[][]), not a new table.
    resolve_hand: NOT CREATED — see the stop below.
  - each seat submits for ITSELF, host cannot submit for others? YES, BY CONSTRUCTION — there is no
    "on behalf of" parameter. A caller speaks only for p_device_id and only if that device is
    seated in that room.
  - validation against game_hands — a foreign card rejected? YES:
      foreign card   -> {"ok": false, "reason": "cards_not_dealt_to_this_seat"}
      2 boards not 4 -> {"ok": false, "reason": "wrong_board_count", "expected": 4, "got": 2}
      not seated     -> {"ok": false, "reason": "not_seated"}
      own 16 cards   -> {"ok": true, "hand_no": 1, "board_count": 4, "seats_submitted": 1}
    The check is SET EQUALITY, not membership: exactly the cards dealt to that seat, no extras, no
    substitutions, no duplicates, no omissions.
  - auto-fill for a seat that never submitted: NOT BUILT — it belongs in resolve_hand.
  - both hand_history rows server-side / chips_delta shape: NOT BUILT.
  - chips via record_hand_net, idempotent on hand identity: NOT BUILT.
  - results.tsx calls now practice-only? NO, DELIBERATELY. Gating them before the server writes
    anything would leave multiplayer with NO writer at all. They move with resolve_hand or not at
    all.
  - p_full deleted? NO — nothing has replaced it yet; the host still adjudicates.
  - engine still in bundle? YES.
WHY I STOPPED, AND IT IS NOT WHERE YOU EXPECTED:
  The guest ready path is not the hard part. resolve_hand has to EVALUATE OMAHA, and there is no
  server-side evaluator: 60 candidates per seat per board, wheel straights, flushes, straight
  flushes, full kicker tie-breaks — a rewrite of utils/handEvaluator.ts in PL/pgSQL, or the same
  code in an Edge Function.
  THE RISK IS NOT WRITING IT, IT IS PROVING IT AGREES WITH THE CLIENT. The reveal is rendered from
  the CLIENT's evaluator (settled, untouched). If the server's disagrees on one hand, the reveal
  shows one winner and hand_history records another — a silent, intermittent contradiction in the
  most-regressed area. I could write the SQL; I could not prove it equivalent in this run, and an
  unproven evaluator deciding real hands is what every prior brief was right to refuse.
  ROUTE 1 — PL/pgSQL: no cold start, lives beside the deal. Cost: full reimplementation AND an
    equivalence proof.
  ROUTE 2 — Edge Function running the EXISTING TypeScript: handEvaluator.ts is 4.8 KB and already
    proven by omahaHighlight.test.ts (2,000+ evaluator checks). Running THE SAME CODE removes the
    equivalence problem instead of solving it. Cost: cold start on the first resolve, and it
    contradicts stage 1's "no Edge Function" reasoning — which was about DEALING, an operation with
    no algorithm in it.
  EITHER WAY THE GATE IS AN EQUIVALENCE HARNESS: N random deals, both evaluators, compare the
  winner per board. Nearly free under route 2; the bulk of the work under route 1.
  RECOMMENDATION: ROUTE 2. The engine's correctness is the one thing already proven here, and
  re-deriving it in a second language to compare against the first is how two sources of truth get
  created — the exact shape this stage exists to remove.
PROOF: 1-7 NOT RUN — resolve_hand does not exist, so there is no adjudication to prove. The only
  thing proven this run is the authority gate above, which is items 4's first half (foreign card
  rejected) at the DB level.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | p_full still present | results.tsx still writes for MP.
DB: baselines verified — 11 public rooms all waiting, CJTK and QW7U 'CAPS Bot', 54YU untouched;
  game_hands 0 (probe deal removed), hand_history 151, bug_reports 250, backup 649. 19 private
  rooms (one probe room added) left to expire; no game_rooms or room_players row deleted.
tsc: not run — no client code changed. CI unchanged at fd08d22.
HANDOFF: file + vamos_handoffs slug 2026-08-17-stage2-submit-placements | chars | code-point match? Y
WHAT I DID NOT CHECK: whether submit_placements should also refuse a SECOND submission from a seat
  that already submitted (today it overwrites — arguably right, since a player may re-arrange before
  the clock, but it means a seat can change its placements until resolve_hand runs and nothing
  freezes them); whether the guest ready path can carry this call without disturbing the countdown
  it starts; what a 3P/4P submission costs; and whether the placements column should be cleared when
  a hand resolves, which matters for how long hole-card arrangements sit in the database.
=== END ===
