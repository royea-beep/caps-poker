# 2026-08-17 — Stage 1: the server deals (multiplayer)

**Task 1 built and proven at the contract level. Task 2 measured. Task 3 NOT run — the client swap
was not made, so the guest is still broken.** Two migrations, no app code changed, nothing deployed.
`tsc` exit 0.

## Task 1 — `deal_hand`

### What was created

```
TABLE public.game_hands (room_id, hand_no, player_count, board_count, deal jsonb, created_at)
      PRIMARY KEY (room_id, hand_no) · RLS on · REVOKE ALL from anon, authenticated

FUNCTION public.deal_hand(p_room_code text, p_device_id text, p_hand_no int = 1, p_full bool = false)
      RETURNS jsonb · SECURITY DEFINER · EXECUTE granted to anon, authenticated
      -> { ok, hand_no, player_count, board_count, your_cards[], boards:[{board_index, open_cards[]}] }
```

**No policy on `game_hands`, on purpose.** One `SELECT` would hand over every seat's hole cards —
the exact leak this stage exists to end. The deal is reachable only through the RPC, which returns
one caller's slice.

### Proven, against a live room (2P, `8T39`)

```
ok                       true
board_count              4          <- 2P, read from the ROOM's max_players
your_cards               16         <- 4 boards x 4 cards per board
boards                   4 rows, 3 open_cards each
closed cards in payload  NONE   ("closed" does not appear in the boards a normal caller receives)
same caller, twice       identical cards
non-seated caller        {"ok": false, "reason": "not_seated"}
host with p_full         full deal returned, 2 closed per board
distinct cards in a deal 36   (16 hand + 4 boards x 5) — no duplicates
board-count derivation   players [2,3,4] -> [4,3,2]
```

Idempotency holds **across separate HTTPS requests**, not just within a statement: 25 anon calls in
the latency run all returned the same 16 cards from the one persisted `game_hands` row.

`get_game_config()` was not re-implemented — the RPC reads nothing from `app_config`, so there was
nothing to duplicate. The board rule is written out **once**, inside the function, from
`game_rooms.max_players`, never from a parameter.

### The tension I had to resolve, stated rather than papered over

The brief keeps adjudication with the host this stage — and **the host cannot adjudicate from its
own slice.** `evaluateAllBoards` needs every seat's cards and the closed cards.

So `deal_hand` keeps the contract that survives into stage 2 (caller's slice, no closed cards), and
a **host-only `p_full` branch** returns the whole deal until adjudication moves. It is honoured only
for the seat flagged `is_host`; a guest asking for it gets its slice.

**What stage 1 therefore buys, plainly:** the guest stops receiving anyone else's cards and stops
depending on a channel that can be denied. The host still holds the whole deal, exactly as today.
A strict improvement, not the finished article — the finished article is stage 2, when that branch
is deleted along with client adjudication.

### A correction to my own map

The map said "swap `dealCardsMultiplayer()`'s body". **That would be wrong now.** Roye's ruling made
practice permanently client-side, and `dealCardsMultiplayer` is shared by practice
(`initializeGameMulti`) and multiplayer (`dealNewHand`). The MP-only seam is **`dealNewHand`
(`gameLogic.ts:288`), whose sole caller is `realtimeMultiplayer.ts:570`.** Swapping there moves
multiplayer and leaves practice untouched; swapping the shared function would have moved both.

## Task 2 — the round trip, measured

25 anon calls over HTTPS from this machine:

```
p50  76 ms      p95  128 ms      max  339 ms      min  75 ms      25/25 ok
```

**My 150–400 ms estimate was pessimistic.** Judged against the bar the brief set — a player already
waiting for a deal, once per hand — 76 ms at the median is invisible, and even the 339 ms outlier
lands inside the animation the deal already plays. This is not a reveal-path cost; it is one call at
the one moment the player expects a pause. **Acceptable, comfortably.**

Caveat: measured from a desktop on a good connection. A phone on mobile data will be worse, and the
first call after a cold client also pays TLS setup.

## Task 3 — NOT RUN, and why

**The client swap was not made, so the regression net still reports `EXPECT=broken` and the guest is
still stuck.** I stopped deliberately rather than half-finishing.

The remaining work touches `RealtimeServer.startGame()` — which must become async — and its two
callers, which is the one multiplayer path that currently *works* for the host. Wiring it, deploying
it, and **proving it on two contexts in both engines** did not fit in what I had left, and shipping
an unproven change into the working half to claim the stage would be exactly the pattern this
project keeps paying for. Better to hand over a proven RPC and a precise plan than an unverified
swap.

**The wiring, exactly, for the next run:**

1. `utils/serverDeal.ts` — `dealHand(roomCode, deviceId, handNo, full)` wrapping the RPC and mapping
   `{rank, suit, id}` straight onto the client `Card` shape (already identical — no adapter needed).
2. `realtimeMultiplayer.ts:563` `startGame(config)` → `async`, replacing `dealNewHand(...)` with the
   `p_full` call for the host. `getDealtCards()` is unchanged; `this.boards` and `this.playerHands`
   are populated from the response, so adjudication carries on untouched.
3. Its callers: `table.tsx:160` (`dealAndGo`) and `realtimeMultiplayer.ts:549` (`startNewHand`) must
   await it. `dealAndGo` already has an error path — wire a failed deal to it. **No silent fallback
   to the local dealer:** a network blip should surface, not quietly restore the leak.
4. **The guest trigger.** `CARDS_DEALT` is in `PRIVATE_MESSAGE_TYPES`, so it routes to the private
   topic that is denied — and that file must not be touched. Add a **card-free `HAND_READY`** on the
   *shared* channel (`broadcastToAll('HAND_READY', { handId, playerCount, boards:[{board_index,
   openCards, closedCardCount}] })`), which is not a private type and therefore travels on the
   public room channel that already works. The guest handles it, calls `deal_hand` for its own
   cards, and navigates with the same params it uses today.
5. The private per-player topic then carries nothing. **It becomes dead, not removed** — flagged
   here, per the brief.

## What this stage did not do

Adjudication untouched · practice untouched · equity and outs still local · the client dealer still
present · `phase0_channel_authz_enforced` still `true` · the engine still in the bundle.

## Carried, and honestly still carried

* **`host_id` NULL on the create path** — not fixed. It belongs in the same commit as the client
  swap (`createTable` needs the `await ensureAnonymousAuth` that `joinTable` already has), and that
  commit was not made.
* **`dealCards()` at `deck.ts:81` believed dead** — still on a grep, not a bundle check. Not
  confirmed this run.
* **`source='timeout'`** — still never fired live; the solo branch is unreachable and MP is broken.
* **Discovered while probing:** `app_config.join_requires_session` is **`true`**. A `join_table`
  call without a session is refused (`{"ok":false,"error":"no_session"}`), which is why the seat
  probe had to go through the app. Consistent with the guest needing a session — worth knowing.

## DB state

```
11 PUBLIC rooms — all waiting, CJTK and QW7U still 'CAPS Bot', 54YU untouched   BASELINE INTACT
5 private rooms — the 4 earlier ones plus 8T39, created via create_table for the seat probe.
   game_rooms rows may not be deleted, so it is left to expire (private, never in the lobby).
game_hands 0 — the probe deal was deleted after verification
room_players 2 | bug_reports 250 | hand_history 151 | backup 649
phase0_channel_authz_enforced = true, UNCHANGED
```

## MACHINE

`tsc` crashed twice — a V8 fatal (`Object::ToArrayIndex`, exit 3) then `0xC0000005` — before
returning 0 on the third attempt.

=== STRATEGIST HANDOFF — SERVER DEALS (MP) ===
TASK 1 deal_hand:
  - CREATED: table public.game_hands(room_id, hand_no, player_count, board_count, deal jsonb,
    created_at) PK (room_id, hand_no), RLS on, REVOKE ALL from anon+authenticated — NO policy on
    purpose: one SELECT would hand over every seat's hole cards. And
    deal_hand(p_room_code text, p_device_id text, p_hand_no int = 1, p_full bool = false)
    RETURNS jsonb, SECURITY DEFINER, EXECUTE to anon+authenticated, returning
    { ok, hand_no, player_count, board_count, your_cards[], boards:[{board_index, open_cards[]}] }.
  - idempotent per (room, hand_no)? YES — same caller twice returns identical cards, and 25 separate
    HTTPS calls all returned the same 16 cards from the one persisted row.
  - different player, same hand -> their own cards from the same deal? NOT PROVEN WITH TWO SEATS.
    The deal is built once for ALL seats (one row, one `seats` array keyed by device_id) and each
    caller is served its own slice by device_id, so the mechanism is right — but the room I probed
    had one seat, because join_table now refuses a session-less join (join_requires_session = true),
    so a second seat can only be created through the app. Proven for one seat, reasoned for two.
  - board count read from the ROOM? YES — from game_rooms.max_players, never a parameter, written
    out ONCE in the function. Derivation verified: players [2,3,4] -> boards [4,3,2]; the 2P room
    returned board_count 4, 16 your_cards, 4 board rows, 3 open_cards each, 36 distinct cards in the
    stored deal with no duplicates.
  - closed cards withheld? YES — "closed" does not appear in a normal caller's payload.
  - non-seated caller refused? YES: {"ok": false, "reason": "not_seated"}. Unknown room:
    {"ok": false, "reason": "no_such_room"}.
  - HOST-ONLY p_full BRANCH ADDED, and why: adjudication stays with the host this stage, and the
    host CANNOT adjudicate from its own slice — evaluateAllBoards needs every seat's cards and the
    closed cards. Honoured only for the seat flagged is_host; a guest asking for it gets its slice.
    Stage 1 therefore buys: the GUEST stops receiving anyone else's cards and stops depending on a
    deniable channel. The HOST still holds the whole deal, as today. Delete this branch in stage 2.
  - dealCardsMultiplayer() swapped? NO — AND IT SHOULD NOT BE. My own map said to swap it; that is
    now wrong, because practice is permanently client-side and dealCardsMultiplayer is SHARED by
    practice (initializeGameMulti) and MP (dealNewHand). The MP-only seam is dealNewHand
    (gameLogic.ts:288, sole caller realtimeMultiplayer.ts:570). Client dealer untouched.
TASK 2 LATENCY (25 anon calls over HTTPS):
  - p50 76 ms | p95 128 ms | max 339 ms | min 75 ms | 25/25 ok.
  - MY 150-400ms ESTIMATE WAS PESSIMISTIC. Against the bar you set — one call per hand, at a moment
    the player is already waiting — 76 ms median is invisible and the 339 ms outlier still lands
    inside the deal animation. ACCEPTABLE, comfortably. Caveat: desktop on a good connection; a
    phone on mobile data will be worse and the first call also pays TLS setup.
TASK 3 PROOF: NOT RUN. The client swap was NOT made, so the net still reports EXPECT=broken and the
  guest is still stuck. I stopped deliberately: the swap makes startGame async and touches its two
  callers — the one MP path that currently WORKS for the host — and I could not wire, deploy AND
  prove it on two contexts in both engines with what I had left. Shipping it unproven into the
  working half to claim the stage is the pattern this project keeps paying for.
  NEXT RUN, EXACTLY: (1) utils/serverDeal.ts wrapping the RPC — the {rank,suit,id} shape is already
  identical to the client Card, no adapter; (2) startGame -> async, p_full for the host, populating
  this.boards/this.playerHands so getDealtCards() and adjudication are untouched; (3) await it in
  dealAndGo (table.tsx:160) and startNewHand (:549), wiring failure to dealAndGo's EXISTING error
  path — NO silent fallback to the local dealer, a blip must surface rather than quietly restore the
  leak; (4) THE GUEST TRIGGER: CARDS_DEALT is in PRIVATE_MESSAGE_TYPES and that file must not be
  touched, so add a CARD-FREE 'HAND_READY' via broadcastToAll on the SHARED channel (which already
  works — proven over the wire last run), guest handles it, calls deal_hand for its own cards, and
  navigates with today's params; (5) the private per-player topic then carries nothing — IT BECOMES
  DEAD, flagged here and NOT removed.
  - webkit? Not run — there is nothing yet to run it against.
  - rooms restored from captured baseline, verified by query? YES: 11 public rooms all waiting,
    CJTK and QW7U still 'CAPS Bot', 54YU untouched. One new PRIVATE room 8T39 was created via
    create_table for the seat probe and is left to expire (game_rooms rows may not be deleted; it is
    is_public=false so it never appears in the lobby). game_hands probe row deleted, table back to 0.
CARRIED: host_id await NOT fixed — it belongs in the same commit as the client swap, which was not
  made. dealCards() dead NOT confirmed in the bundle. timeout event still never fired. NEW:
  app_config.join_requires_session is TRUE — a session-less join_table is refused with
  {"ok":false,"error":"no_session"}.
NOT DONE (all true): adjudication untouched | practice untouched | equity local | phase0 flag on |
  engine still in bundle | client dealer still present.
tsc: exit code 0 (crashed twice first — V8 fatal exit 3, then 0xC0000005). No app code changed, so
  CI is unchanged at 68f8a5e. Nothing deployed.
HANDOFF: file + vamos_handoffs slug 2026-08-17-server-deals-stage1 | chars | code-point match? Y
WHAT I DID NOT CHECK: two seats calling the same hand (join_requires_session blocked a SQL-only
  second seat, so the multi-seat slice is reasoned from the stored shape, not observed); 3P and 4P
  end to end (the derivation was verified as an expression and via the 2P room, not by dealing a 3P
  or 4P hand); what happens when a player joins BETWEEN hands and is absent from an existing deal
  (the not_in_this_deal branch exists but was never exercised); whether the FOR UPDATE lock on
  game_rooms serialises two simultaneous first-callers acceptably under real concurrency; and the
  latency from a phone rather than a desktop.
=== END ===
