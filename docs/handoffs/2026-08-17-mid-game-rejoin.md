# 2026-08-17 — Mid-game rejoin

**Fixed and deployed** (`f982359`, run 32012080851 success, CI `tsc` artifact 0 bytes). A player who
drops now gets back in, on both engines. **But "back into the hand you left" is only true for a
network drop — a closed tab returns you to the *next* hand, and I can show why.**

## Task 1 — the contract

`GAME_STATE_SNAPSHOT` carried ten fields. Only one was private:

| field | own or shared |
|---|---|
| **`yourCards`** | **own — the only card-bearing field** |
| `boards[].openCards`, `closedCardCount` | shared — community state every seat already sees |
| `phase`, `handId`, `playerCount`, `cardsPerBoard`, `timeLimit`, `boardCount` | shared |
| `playerIndex`, `alreadyReady` | one seat's, but not secret — a seat number and a boolean |

**Remove `yourCards` and nothing is left to protect.** So yes: the whole thing moves to the public
channel and the cards come from `deal_hand`. That was the outcome to aim for and it is reachable.

## Task 2 — the fix

`utils/realtimeMultiplayer.ts:785` — `sendGameStateSnapshot` now calls `broadcastToAll('STATE_SNAPSHOT', …)`
instead of `sendToPlayer('GAME_STATE_SNAPSHOT', …)`. Card-free, on the shared channel, carrying
`forPlayerId` so only the seat it names acts on it.

`utils/realtimeMultiplayer.ts:1180` — the client handles `STATE_SNAPSHOT`, ignores it unless
`forPlayerId` is its own id, calls `dealHandSlice(roomCode, playerId, handId)`, and hands the
reassembled snapshot to the **existing** `onGameStateSnapshot` callback. `table.tsx` is unchanged.

**No cards on a broadcast.** **`PRIVATE_MESSAGE_TYPES` untouched, `sendToPlayer` still present** —
this path simply stopped using it.

Idempotency per `(room, hand_no)` is what makes this correct rather than merely functional: the
returning player is dealt *the hand they were already dealt*, not a new one.

**A client already inside `/multiplayer-game` never reaches this handler** — it is on a different
screen with different callbacks — so there is no risk of re-entering a game you are already in.

### Mid-hand placements

They live in `client.boardAssignments` on the host, set only when `PLAYER_READY` arrives. **Cards
placed but not yet confirmed are local to the dropped screen and do not survive** — that predates
this work and is unchanged. What does survive is `alreadyReady`, so a player who had confirmed
returns to the waiting state rather than being asked to place again.

## Task 3 — proof, with a real disconnect

### Network drop — the case that matters most, and it fully passes

Guest context offline for 9 s mid-hand, then back:

```
stayedInGame   true        (never left /multiplayer-game — the socket reconnected under it)
sameCommunity  true
sameHole       true        the ORIGINAL cards
```

A phone that locks or a four-second blip loses nothing. No snapshot is even needed.

### Tab close — the player gets back in, but into the next hand

Guest tab closed and re-entered through the table route, chromium and WebKit:

```
chromium (BTK8)  rejoined true   sameCommunity false   sameHole false
webkit   (S853)  rejoined true   sameCommunity false   sameHole false
```

**`rejoined: true` is the defect fixed** — before this, that client sat forever, because the
snapshot it needed was denied. It now lands in `/multiplayer-game` holding cards.

**The cards differ because the hand it left no longer exists.** Measured, not inferred:

```
room GVVG   hand 1 dealt 11:54:34   hand 2 dealt 11:54:39   5.2 s apart
room BTK8   hand 1 dealt 11:56:17   hand 2 dealt 11:56:22   5.2 s apart
```

`handleIncomingPresence` (CAPS 10) auto-readies a guest who disconnects mid-hand so the table cannot
wedge; the hand resolves and the next is dealt within about five seconds. Shortening the gap to
1.2 s did not beat it. So the returning player is correctly dealt into hand 2 — `deal_hand` returned
exactly the right thing, and hand 1's board 0 (`10♦ J♣ K♦`) versus hand 2's (`2♥ Q♥ 9♣`) is the
proof it is a different hand rather than a re-deal of the same one.

**Returning to the hand you left after a tab close would require changing the auto-resolve** — the
alternative is the remaining player waiting on someone who may never come back. That is a product
decision, not a bug in this path, and I did not make it.

### Host rejoin — works, and idempotency is why

```
host tab closed and re-entered (86GB)   rejoined true   sameCommunity true   sameHole true
```

The host has no snapshot path at all (`sendGameStateSnapshot` returns early for `isHost`). It works
anyway: a fresh page starts a fresh `RealtimeServer` with `handId` 0, `startGame` increments to 1,
and `deal_hand` **returns the original hand 1** rather than dealing a new one. Server-side
idempotency makes a host restart non-destructive.

**The edge I did not test, and it is a real one:** if the host had already advanced to hand 2 before
dropping, a fresh page restarts at `hand_no` 1 and would *replay* the old hand, because `handId`
lives in client memory rather than on the server.

### `hand_history`

**Still 151 — no run reached `/results`.** These runs interrupt the hand by design, so no hand
completed and no rows were written. The 1 → 2 result from stage 1C stands; this stage did not
re-prove it and I am not claiming it.

### Observed in passing — two carried items move

`startNewHand` **ran and dealt hand 2 through the server** in both close-mode runs, so `hand_no`
incrementing past 1 in a live game is now observed rather than reasoned. Its `onError` branch is
still unobserved.

## Git

**Not repaired.** `refs/remotes/origin/main` is still a broken ref, and it now blocks `git fetch`
outright (`fatal: bad object refs/remotes/origin/main`). `git update-ref -d` fails the same way as
before — every route reads the ref before locking it. Pushes still work with an explicit refspec
(`git push origin main:refs/heads/main`), which is how everything this session shipped. It needs the
same one-liner as the last one, run outside my permissions:
`rm .git/refs/remotes/origin/main && git fetch origin`.

## DB state

```
11 PUBLIC rooms, all waiting — CJTK and QW7U still 'CAPS Bot', 54YU untouched   BASELINE INTACT
14 private rooms (5 rejoin runs added to the 9 before) — is_public false, left to expire
game_hands 0 (test deals removed) · hand_history 151 · bug_reports 250 · backup 649
phase0_channel_authz_enforced = true
```

No `game_rooms` or `room_players` row was deleted.

## MACHINE

`tsc` exit 0 — but only after three `0xC0000005` crashes, and one run printed a V8 fatal while
reporting exit 0 because the output was piped through `Select-Object`, which makes `$LASTEXITCODE`
the pipeline's rather than the compiler's. Re-run unpiped: exit 0. Same trap as "exit code, not
output", wearing a different hat.

=== STRATEGIST HANDOFF — MID-GAME REJOIN ===
TASK 1 CONTRACT:
  - GAME_STATE_SNAPSHOT carried: phase, handId, yourCards, boards[{boardIndex, openCards,
    closedCardCount}], playerIndex, playerCount, cardsPerBoard, timeLimit, boardCount, alreadyReady.
  - OWN vs SHARED: only `yourCards` is private. boards/phase/handId/counts/timeLimit are community
    state every seat already sees; playerIndex and alreadyReady are one seat's but not secret — a
    seat number and a boolean.
  - what remains after the cards are removed: everything else, and none of it needs protecting.
  - can the whole thing move to the public channel + deal_hand? YES — and it did.
TASK 2 FIX:
  - realtimeMultiplayer.ts:785 sendGameStateSnapshot now broadcastToAll('STATE_SNAPSHOT', …) with
    forPlayerId, instead of sendToPlayer('GAME_STATE_SNAPSHOT', …).
  - realtimeMultiplayer.ts:1180 client case 'STATE_SNAPSHOT' — ignores it unless forPlayerId is its
    own id, calls dealHandSlice(roomCode, playerId, handId), and passes the reassembled snapshot to
    the EXISTING onGameStateSnapshot callback. table.tsx unchanged.
  - any cards on a broadcast? NO.
  - PRIVATE_MESSAGE_TYPES untouched, sendToPlayer still present? YES to both — this path just
    stopped using it.
  - mid-hand placements: they live in client.boardAssignments on the HOST, set only when
    PLAYER_READY arrives. Cards placed but NOT yet confirmed are local to the dropped screen and do
    NOT survive — pre-existing, unchanged. `alreadyReady` does survive, so a player who confirmed
    returns to waiting rather than being asked to place again.
TASK 3 PROOF (two contexts, both engines):
  - GUEST NETWORK DROP (9s offline, room EPP3): stayedInGame TRUE, sameCommunity TRUE, sameHole
    TRUE — the ORIGINAL cards. Never left /multiplayer-game; the socket reconnected under it. This
    is the phone-locks case and it fully passes.
  - GUEST TAB CLOSE: rejoined TRUE on chromium (BTK8) and webkit (S853) — THE DEFECT IS FIXED, that
    client used to sit forever. But sameCommunity/sameHole FALSE, because THE HAND IT LEFT NO LONGER
    EXISTS. Measured: GVVG hand 1 at 11:54:34 and hand 2 at 11:54:39; BTK8 hand 1 at 11:56:17 and
    hand 2 at 11:56:22 — 5.2 s apart in both. handleIncomingPresence (CAPS 10) auto-readies a guest
    who drops mid-hand so the table cannot wedge; the hand resolves and the next is dealt. A 1.2 s
    return did not beat it. deal_hand returned exactly the right thing for hand 2 — board 0 was
    10♦ J♣ K♦ in hand 1 and 2♥ Q♥ 9♣ in hand 2, so it is a different hand, not a re-deal.
    RETURNING TO THE HAND YOU LEFT WOULD REQUIRE CHANGING THAT AUTO-RESOLVE — a product decision
    (the alternative is the other player waiting on someone who may never return). Not made.
  - HOST REJOIN (86GB): rejoined TRUE, sameCommunity TRUE, sameHole TRUE. The host has NO snapshot
    path (sendGameStateSnapshot returns early for isHost) and works anyway: a fresh page starts a
    fresh server at handId 0, startGame increments to 1, and deal_hand returns the ORIGINAL hand 1.
    Server-side idempotency makes a host restart non-destructive. Adjudication intact — the host
    still calls dealHandFull and still evaluates.
  - hand_history still gains 2 rows? NOT RE-PROVEN — still 151. These runs interrupt the hand by
    design, so none reached /results. The 1 -> 2 result from stage 1C stands; this stage did not
    re-prove it and I am not claiming it.
  - webkit? YES — tab-close run on webkit matches chromium exactly.
  - OBSERVED IN PASSING: startNewHand RAN and dealt hand 2 through the server in both close-mode
    runs, so hand_no incrementing past 1 in a live game is now OBSERVED, not reasoned. Its onError
    branch is still unobserved.
GIT: origin/main ref repaired? NO. It now blocks `git fetch` outright (fatal: bad object
  refs/remotes/origin/main) and update-ref -d fails identically — every route reads the ref before
  locking it. Pushes work with an explicit refspec, which is how everything shipped this session.
  Still needs, outside my permissions: rm .git/refs/remotes/origin/main && git fetch origin
STILL NOT DONE (all true): adjudication untouched (host-only p_full stays until stage 2) | practice
  untouched and client-dealt | equity and outs local | phase0_channel_authz_enforced still true |
  engine still in the bundle.
DB: baselines verified — 11 public rooms all waiting, CJTK and QW7U 'CAPS Bot', 54YU untouched;
  game_hands 0 (test deals removed), hand_history 151, bug_reports 250, backup 649. 14 private rooms
  left to expire; no game_rooms or room_players row deleted.
tsc: exit code 0 (after three 0xC0000005 crashes; and one run printed a V8 fatal while REPORTING 0
  because the output was piped through Select-Object — $LASTEXITCODE was the pipeline's, not the
  compiler's. Re-run unpiped: 0). CI artifact 0 bytes on f982359 — CI is the verdict.
HANDOFF: file + vamos_handoffs slug 2026-08-17-mid-game-rejoin | chars | code-point match? Y
WHAT I DID NOT CHECK: a host that drops AFTER hand 2 — a fresh page restarts at hand_no 1 and would
  REPLAY the old hand, because handId lives in client memory rather than on the server, and that is
  a real edge I did not exercise; whether a guest returning mid-REVEAL (rather than mid-arranging)
  is handled, since every drop here was during placement; 3P and 4P rejoin — all runs were 2P; what
  the REMAINING player sees while the other is away, which I never asserted on; and startNewHand's
  onError branch.
=== END ===
