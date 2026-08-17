# 2026-08-17 — Stage 1B: the client wired to `deal_hand`

**The wiring is written and typechecks clean. It is NOT committed, NOT deployed and NOT proven —
the local git ref for `main` was corrupted mid-commit and I could not repair it without a permission
I do not have.** Four files changed on disk, `tsc` exit 0 on exactly this code.

**Roye: one command unblocks this. It is at the bottom of this file.**

## What was written

### 1. `utils/serverDeal.ts` — new

`dealHandSlice(roomCode, deviceId, handNo)` and `dealHandFull(...)` over the RPC. **No adapter, as
expected** — the RPC returns `{rank, suit, id}`, already the client `Card` shape, and an adapter
would only be a second place for the deck's shape to drift.

Every function **throws**. There is no catch anywhere that reverts to the local dealer. That is how
"no silent fallback" is enforced structurally rather than by discipline: a fallback would quietly
restore client dealing, and a silent security regression is invisible for weeks.

### 2. `realtimeMultiplayer.ts` — `startGame` is async, and the guest trigger moved

```
startGame(config): Promise<void>            (was sync)
  -> await dealHandFull(this.roomCode, this.hostId, this.handId)
  -> this.boards / this.playerHands built from the response
  -> getDealtCards() UNCHANGED, so host adjudication carries on untouched
```

`this.hostId` is already the device id (`start()` sets it from `getDeviceId()`), so nothing new had
to be threaded through.

**Seats map by device id, not array position.** `cardsFor(deviceId)` looks the seat up in the
response rather than trusting that the server's client order and `room_players.seat_index` agree.
A positional map would mis-deal silently if they ever diverged.

**`HAND_READY` replaces the per-guest `CARDS_DEALT` send**, on the shared channel, carrying
`{handId, playerCount, boardCount, cardsPerBoard, timeLimit, seats:[{id, playerIndex, seat}],
boards:[{boardIndex, openCards, closedCardCount}]}` — **no hole cards of any kind**. `openCards` are
community cards, which every seat sees anyway.

`PRIVATE_MESSAGE_TYPES` is **untouched**. `HAND_READY` simply is not one of its types, so it travels
the public room channel that was measured working last run. **The per-player private topic now
carries nothing — it is dead, and left in place.**

### 3. Both callers await

* `app/lobby/table.tsx:137` — `dealAndGo` is `async`, awaits `startGame`, and on failure sets the
  screen's **existing** error state ("Could not deal the hand…") and resets `startedRef` so a retry
  is possible. Called as `void dealAndGo(server)` from the presence handler.
* `realtimeMultiplayer.ts:543` — `startNewHand` is `async`, awaits, and on failure reports through
  `onError` instead of leaving the table wedged mid-hand.

### 4. The guest path

`table.tsx` registers `onHandReady` **before** `connect()`, alongside the existing callbacks: it
resolves its device id, calls `dealHandSlice`, and navigates with the same params it used before —
`yourCards` now from the server, `boards` from the card-free broadcast. On failure it shows an
error rather than sitting forever on "Waiting for the table to fill…", which is the exact failure
this stage exists to end.

`onCardsDealt` is left registered: the rejoin/snapshot paths still reference that shape, and the
host no longer sends it.

### 5. Carried fix — `host_id`

`utils/lobbyApi.ts:createTable` now resolves `ensureAnonymousAuth()` when no `hostId` was passed —
the same await `joinTable` has had at its choke point all along. Bounded: if auth fails, the table
is still created rather than refused.

**Session before `deal_hand`:** `deal_hand` keys on `device_id` and needs no session at all, so the
guest path does not depend on one. The guest has one regardless — `joinTable` awaits
`resolveJoinIdentity(ensureAnonymousAuth, …)` before seating, which is why its `join_identity` event
reports `source: 'uid'`. With this commit the host has one too.

## Why it is not proven

`git commit` failed with `fatal: cannot lock ref 'HEAD': unable to resolve reference
'refs/heads/main': reference broken`.

`.git/refs/heads/main` is **41 zero bytes** — a file allocated and never written, which is what this
machine's instability produces. It is the same fault line as the compiler: `tsc` crashed with
`0xC0000005` three times in a row before returning 0 on the fourth attempt this run.

Git cannot repair it from inside: `update-ref`, `update-ref -d` and `branch -f` all try to *read*
the ref before locking it, and all fail identically. The fix is to remove the corrupt file, which is
inside `.git` — the permission layer blocked both the direct write and the delete, correctly.

**Nothing is lost.** The four edited files are intact on disk, `tsc` passed on them, and the remote
still holds `d6f1e43`. The local reflog and `git ls-remote` agree on the same commit.

### The trap in the repair

`.git/packed-refs` carries a **stale** `main` at `fd2014c0` (an old commit). Deleting the corrupt
loose ref alone would silently fall back to that and roll `main` back months. **The `update-ref`
must follow the delete**, in the same sitting:

```bash
rm .git/refs/heads/main && git update-ref refs/heads/main d6f1e439a7dc059ecc87da39498cd566384f1a39 && git status
```

`d6f1e43` is confirmed by two independent sources — the local reflog and `git ls-remote origin`.
After that, the four staged files commit and push normally, and the regression net can run.

## DB state — unchanged by this run

```
11 PUBLIC rooms — all waiting, CJTK and QW7U still 'CAPS Bot', 54YU untouched   BASELINE INTACT
5 private rooms (all from earlier runs) — left to expire · game_hands 0 · room_players 2
bug_reports 250 | hand_history 151 | backup 649 | phase0_channel_authz_enforced = true
```

No migration was applied this run. No room was created, and none was deleted.

=== STRATEGIST HANDOFF — STAGE 1B WIRING ===
- serverDeal.ts written? YES — dealHandSlice() and dealHandFull(). NO ADAPTER NEEDED, as expected:
  the RPC returns {rank, suit, id}, already the client Card shape. Every function THROWS; there is
  no catch anywhere that reverts to the local dealer.
- startGame async, both callers awaiting? YES.
  realtimeMultiplayer.ts:563 startGame -> async, awaits dealHandFull(this.roomCode, this.hostId,
  this.handId); getDealtCards() unchanged so host adjudication is untouched; seats matched BY
  DEVICE ID, not array position, so client order and room_players.seat_index cannot silently
  disagree and mis-deal.
  app/lobby/table.tsx:137 dealAndGo -> async, awaits, and on failure uses the screen's EXISTING
  error path and resets startedRef so a retry is possible; invoked as void dealAndGo(server).
  realtimeMultiplayer.ts:543 startNewHand -> async, awaits, reports via onError rather than leaving
  the table wedged.
- HAND_READY on the SHARED channel, payload carries NO cards? YES — {handId, playerCount,
  boardCount, cardsPerBoard, timeLimit, seats:[{id, playerIndex, seat}], boards:[{boardIndex,
  openCards, closedCardCount}]}. openCards are COMMUNITY cards, which every seat sees anyway. No
  hole cards. It replaces the per-guest CARDS_DEALT send.
- PRIVATE_MESSAGE_TYPES untouched? YES. HAND_READY is simply not one of its types, so it rides the
  public room channel measured working last run. The per-player private topic now carries nothing —
  DEAD, and LEFT IN PLACE.
- failed deal surfaces, no fallback? ENFORCED STRUCTURALLY: serverDeal throws, startGame does not
  catch, dealAndGo catches only to show the error screen, startNewHand catches only to call
  onError, and the guest shows "Could not get your cards" instead of sitting on "Waiting for the
  table to fill". dealNewHand/dealCardsMultiplayer are still present for PRACTICE and as the revert
  path — nothing in the MP path reaches for them.
- host_id await added to createTable? YES, utils/lobbyApi.ts — ensureAnonymousAuth() resolved when
  no hostId was passed, bounded so a slow/failed auth still creates the table. host_id non-NULL on
  a new room? NOT VERIFIED — nothing was deployed.
- guest establishes a session before deal_hand? It does not need one: deal_hand keys on device_id.
  It has one anyway — joinTable awaits resolveJoinIdentity(ensureAnonymousAuth, …) before seating,
  which is why its join_identity event reports source 'uid'.
PROOF: NOT RUN. git commit FAILED — "cannot lock ref 'HEAD': unable to resolve reference
  'refs/heads/main': reference broken". .git/refs/heads/main is 41 ZERO BYTES, the same machine
  fault that crashed tsc three times this run before it returned 0 on the fourth. Git cannot fix it
  from inside — update-ref, update-ref -d and branch -f all READ the ref before locking and fail
  identically — and the repair is a delete inside .git, which the permission layer blocked (twice,
  correctly). NOTHING IS LOST: the four files are intact on disk, tsc passed on exactly them, and
  the remote still holds d6f1e43.
  ROYE, ONE COMMAND — and the SECOND HALF IS NOT OPTIONAL, because .git/packed-refs holds a STALE
  main at fd2014c0 and deleting the loose ref alone would silently roll main back months:
    rm .git/refs/heads/main && git update-ref refs/heads/main d6f1e439a7dc059ecc87da39498cd566384f1a39
  d6f1e43 is confirmed by the local reflog AND git ls-remote origin.
  - net flipped? NO — nothing deployed to flip it against.
  - guest reaches /multiplayer-game | same community | different hole cards: UNPROVEN.
  - hand completes | mirrored winner | hand_history 1 -> 2: UNPROVEN.
  - webkit? NO — nothing to run it against.
  - rooms restored from captured baseline, verified? YES: 11 public rooms all waiting, CJTK and
    QW7U still 'CAPS Bot', 54YU untouched. No room created or deleted this run; game_hands 0.
STILL NOT DONE (all true): adjudication untouched (p_full branch stays until stage 2) | practice
  untouched and still client-dealt | equity and outs local | phase0_channel_authz_enforced still
  true | private topic flagged dead but NOT removed | engine still in the bundle.
tsc: exit code 0 — on the FOURTH attempt; three prior runs died with 0xC0000005. CI has not seen
  this code, so CI is not yet the verdict on it.
HANDOFF: file + vamos_handoffs slug 2026-08-17-stage1b-wiring | chars | code-point match? Y
WHAT I DID NOT CHECK: nothing was deployed, so every runtime claim here is from reading and
  typechecking, not from playing — the guest fix is designed and typechecked but NOT observed;
  I did not confirm that GAME_STATE_SNAPSHOT (the mid-game rejoin path) still delivers, and it is
  the OTHER private-topic message type, so rejoin may still be broken even after this lands; I did
  not exercise a second hand (startNewHand's await path); dealCards() at deck.ts:81 is still
  believed dead on a grep, unconfirmed in the bundle; and source='timeout' still has never fired.
=== END ===
