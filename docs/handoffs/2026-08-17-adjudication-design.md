# 2026-08-17 — Stage 2 design: the server adjudicates

**Design only. Nothing built, no migration, no code changed, nothing deployed.** I am stopping at
Task 1 as the brief instructs, because the shape raises **two questions** — and one of them is that
**the brief's own acceptance test cannot be passed by the smaller version of this change.**

## Task 1 — the shape

### What decides a hand today, and what it needs

`RealtimeServer.runRevealSequence(config)` — `utils/realtimeMultiplayer.ts:735`, *"Collect all
assignments, evaluate hands, return results"*. It walks `clientArray[i].boardAssignments`, writes
them into `this.boards[b].playerCards[i]`, auto-fills any seat whose assignments are null from that
seat's dealt hand, then calls `evaluateAllBoards` + `calculateChipDeltas`.

Its inputs are exactly three things: **every seat's placements**, **the closed cards** (to complete
each five-card board), and **the board count**. The first is client state; **the other two already
live on the server**, in `game_hands`.

### The multiplayer-only seam

**`runRevealSequence` itself is the seam.** It is a method on `RealtimeServer`, so it is
multiplayer-only by construction, and its sole caller is `app/multiplayer-game.tsx:405` on the host.

`calculateHandResultsMulti` / `evaluateAllBoards` / `calculateChipDeltas` are shared with practice
(`app/game.tsx:678`) and **must not be touched** — the same relationship `dealCardsMultiplayer` had
to `dealNewHand` in stage 1. **Practice is guaranteed untouched because the change stops at a class
it does not use.**

### Where placements live, and how they would reach the server

`client.boardAssignments: Card[][]`, set two ways: `setHostReady()` (`:724`) for the host, and the
`PLAYER_READY` message from each guest (`:452`). Both land in the host's `clients` map. **Today the
server never sees them.**

### What exists already — checked before proposing anything

**No adjudicating RPC exists.** Searched for `resolve`, `adjudic`, `placement`, `evaluate`,
`winner`, `showdown` — **zero matches**. The whole outcome surface is the four assertion RPCs:
`record_hand_result_d`, `record_hand_net`, `submit_score`, `update_leaderboard_elo`. There is
nothing to duplicate and nothing to reuse; `game_hands` + one RPC is the shape.

### Who writes `hand_history` afterwards

Today: `app/results.tsx:587`, called **by each client for itself**, and *not* gated on practice.

After: the server writes both rows when it adjudicates, and **that call site must become
practice-only** — otherwise MP rows have two writers, which is the failure this stage exists to end.
`record_hand_result_d` already takes `p_session_type`, so the gate is a one-line condition, and the
function stays for practice rather than being deleted.

One detail worth carrying: `record_hand_result_d`'s `chips_delta` is a **computed display value**
(100 per board won, −50 per board lost), not a balance mutation. Server-written rows must produce
the same shape or the HAND HISTORY screen changes silently.

### `handId` server-side — no question here

`game_hands` already keys on `(room_id, hand_no)`. **The current hand is `max(hand_no)` for the
room**, so no new column is needed, and a returning host asking "what hand is this" gets the right
answer instead of restarting at 1. That closes the replay edge cleanly.

## The two questions — and why I stopped

### Q1. The small version of this change cannot pass Task 3's own test.

Task 3 requires: *"a client that reports a false result must not change the outcome."*

The small version — **the host sends everyone's placements to the server** — cannot satisfy that.
A dishonest host would send its opponent's *own dealt cards* rearranged across boards. Every card
still belongs to that seat, so no server-side validity check catches it, and the winner changes.
The host stops asserting the *result* but starts asserting the *inputs*, which is the same
authority wearing a different hat.

Passing that test requires **each client to submit its own placements directly to the server**:

```
submit_placements(p_room_code, p_hand_no, p_device_id, p_assignments)   -- each seat, for itself
resolve_hand(p_room_code, p_hand_no)                                    -- once all seats are in
      -> validates each seat's cards against what game_hands dealt that seat
      -> auto-fills any seat that never submitted, from its dealt hand
      -> evaluates, writes BOTH hand_history rows, returns the outcome
```

That is the honest end state, and it also removes the host from the trust path entirely — which is
what makes a host-less table possible later. **But it is a bigger change than the brief's framing
implies**: it touches the guest ready path, not just `runRevealSequence`, and the ready protocol
currently runs host-ward over realtime.

**I am not choosing between "smaller but the test fails" and "bigger but correct" on my own.**

### Q2. Does the server move the chips too, or only write `hand_history`?

The brief says the server writes `hand_history`. It says nothing about **`record_hand_net`**, which
is how chips actually move and which **each client calls for itself**.

If the server decides the winner while the client still asserts the chip delta, there are two
sources of truth for one outcome — the split this stage exists to close. But making `resolve_hand`
write chips means deciding how it meets the economy work already in place: the **20,000/day gain
ceiling**, the **±10,000 per-call clamp**, and the **`p_hand_id` idempotency gate**. It must either
go through `record_hand_net` (and be bounded by it) or bypass it deliberately.

**That is an economy decision, not an implementation detail**, and getting it wrong either
double-credits or silently removes a ceiling.

## What I recommend, if it helps the decision

**Q1: take the bigger version.** The smaller one has to be redone the moment anyone tests the
authority claim, and Task 3 already asks for exactly that test.

**Q2: `resolve_hand` computes the deltas and calls `record_hand_net` internally, once per seat**,
with `p_hand_id = room_code:hand_no`. That keeps a single chip writer, reuses the idempotency gate
rather than duplicating it, and leaves the ceilings intact — a hand that would breach them is
refused the same way it is today.

## DB state — untouched

```
hand_history 151 · game_hands 0 · 11 public rooms · bug_reports 250
```

Nothing was created, deleted or migrated this run.

=== STRATEGIST HANDOFF — SERVER ADJUDICATION ===
TASK 1 DESIGN:
  - what calculateHandResultsMulti needs, exactly: every seat's PLACEMENTS, the CLOSED cards, and
    the BOARD COUNT. runRevealSequence (realtimeMultiplayer.ts:735) walks
    clientArray[i].boardAssignments into this.boards[b].playerCards[i], auto-fills any null seat
    from its dealt hand, then calls evaluateAllBoards + calculateChipDeltas. Two of those three
    inputs ALREADY LIVE SERVER-SIDE in game_hands; only the placements do not.
  - the multiplayer-only seam: runRevealSequence ITSELF — realtimeMultiplayer.ts:735, a method on
    RealtimeServer, sole caller app/multiplayer-game.tsx:405 (host). MP-only by construction, the
    same relationship dealNewHand had to dealCardsMultiplayer.
  - where placements live: client.boardAssignments (Card[][]) in the host's clients map, set by
    setHostReady() (:724) for the host and by the PLAYER_READY message (:452) for each guest. The
    server never sees them today.
  - existing RPCs/EFs checked before proposing new: searched resolve / adjudic / placement /
    evaluate / winner / showdown — ZERO matches. The whole outcome surface is the four assertion
    RPCs (record_hand_result_d, record_hand_net, submit_score, update_leaderboard_elo). Nothing to
    duplicate, nothing to reuse; game_hands + one RPC is the shape.
  - who writes hand_history after this: the SERVER, both rows, when it adjudicates. results.tsx:587
    must become PRACTICE-ONLY — it is currently called by every client for itself and is NOT gated
    on practice, so leaving it would give MP rows two writers. record_hand_result_d already takes
    p_session_type, so the gate is one condition and the function stays for practice.
    CARRY: its chips_delta is a COMPUTED DISPLAY VALUE (100/board won, -50/board lost), not a
    balance mutation — server-written rows must match that shape or HAND HISTORY changes silently.
  - does practice stay untouched? YES, guaranteed structurally: the change stops at a class practice
    does not use. calculateHandResultsMulti/evaluateAllBoards/calculateChipDeltas are shared with
    app/game.tsx:678 and are not touched.
  - handId server-side: no question — game_hands already keys on (room_id, hand_no), so the current
    hand is max(hand_no) for the room. No new column, and a returning host stops restarting at 1.
  - ANY QUESTION THAT SHOULD STOP THE BUILD? YES, TWO. I stopped.
    Q1 — THE SMALL VERSION CANNOT PASS TASK 3'S OWN TEST. If the HOST relays everyone's placements,
    a dishonest host sends the opponent's OWN dealt cards rearranged across boards: every card still
    belongs to that seat, no server-side validity check catches it, and the winner changes. The host
    stops asserting the RESULT and starts asserting the INPUTS — the same authority in a new hat.
    Passing "a false client report must not change the outcome" requires EACH CLIENT to submit its
    OWN placements: submit_placements(room, hand_no, device, assignments) per seat, then
    resolve_hand(room, hand_no) which validates each seat's cards against what game_hands dealt it,
    auto-fills anyone who never submitted, evaluates, writes BOTH hand_history rows, and returns the
    outcome. That is bigger than the brief implies — it touches the GUEST ready path, not just
    runRevealSequence, and ready currently runs host-ward over realtime. I am not choosing between
    "smaller but the test fails" and "bigger but correct" alone.
    Q2 — DOES THE SERVER MOVE THE CHIPS? The brief covers hand_history and is silent on
    record_hand_net, which is how chips actually move and which each client calls for itself. Server
    decides the winner + client asserts the delta = two sources of truth for one outcome, the split
    this stage exists to close. But writing chips means meeting the economy work already in place:
    the 20,000/day gain ceiling, the +/-10,000 per-call clamp, and the p_hand_id idempotency gate.
    Either it goes THROUGH record_hand_net and is bounded by it, or it bypasses them deliberately.
    That is an economy decision, and getting it wrong double-credits or silently drops a ceiling.
  - MY RECOMMENDATION, if it helps: Q1 take the bigger version — the smaller one must be redone the
    moment anyone runs the authority test the brief already asks for. Q2 resolve_hand computes the
    deltas and calls record_hand_net internally, once per seat, with p_hand_id = room_code:hand_no —
    single chip writer, reuses the idempotency gate instead of duplicating it, ceilings intact.
TASK 2 BUILD: NOT STARTED — stopped at design, as instructed.
TASK 3 PROOF: NOT RUN — nothing to prove yet.
STILL NOT DONE (all true): practice untouched | equity local | phase0 flag on | engine in bundle |
  adjudication still client-side | p_full branch still present.
DB: untouched this run — hand_history 151, game_hands 0, 11 public rooms, bug_reports 250. Nothing
  created, deleted or migrated.
tsc: not run — no code changed. CI unchanged at fd08d22.
HANDOFF: file + vamos_handoffs slug 2026-08-17-adjudication-design | chars | code-point match? Y
WHAT I DID NOT CHECK: whether the guest's PLAYER_READY path can carry a server call without
  disturbing the countdown that starts from it; whether resolve_hand can run inside the reveal's
  timing budget, since the host currently evaluates synchronously and I have measured no server
  round trip at that point in the hand; what a 3P or 4P resolve costs, since every measurement so
  far has been 2P; and whether spectators (broadcastToSpectators) depend on the host's local
  boardResults, which would make them a third consumer of whatever changes.
=== END ===
