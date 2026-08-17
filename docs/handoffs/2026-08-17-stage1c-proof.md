# 2026-08-17 — Stage 1C: committed, deployed, and proven on the guest

**The server deals, and the guest plays.** Shipped `518bcd4`, deploy run 32009754707 success, CI
`tsc` artifact 0 bytes. The regression net flipped from `EXPECT=broken` to passing **on both
engines**, and `hand_history` went from one row to two.

## Task 1 — committed, pushed, deployed

Four files, one commit. `#root` carries **4,463 characters on both engines** on the live build — a
green workflow proves a deploy, not a mounted page, so it is asserted at the top of every net run
and the run aborts if it is empty.

**One thing did not fully recover from the ref corruption.** The push succeeded with an explicit
refspec, but `refs/remotes/origin/main` is *also* a broken ref:

```
d6f1e43..518bcd4  main -> main
error: update_ref failed for ref 'refs/remotes/origin/main': ... reference broken
```

Local `main` and the remote are both correct at `518bcd4` — this is only the local tracking copy,
so `git status` will keep saying the upstream is gone. Same one-line shape as before, and it can
wait: `rm .git/refs/remotes/origin/main && git fetch origin`.

## Task 2 — proven on the guest, both engines

```
                     chromium (room VE7T)        webkit (room 9SRB)
guestReachesGame     true                        true
sameCommunity        true                        true
differentHole        true                        true
bothReachResults     true                        true
mirroredSummary      true                        true
#root mounted        4463 / 4463                 4463 / 4463
verdict              matches EXPECT=fixed        matches EXPECT=fixed        EXIT 0 both
```

The guest is no longer stuck on "Waiting for the table to fill…" — it reaches `/multiplayer-game`,
holding cards it fetched itself.

**Same community cards, different hole cards** (chromium):

```
community  BOTH: J♥ Q♦ 4♦ A♠ A♠
host hole  4♠ 4♥ 5♦ 5♣ 6♦ 6♣ 8♥ 8♦ J♦ J♣ Q♥ K♥ 9♦ 10♦ A♦ 2♣
guest hole K♠ K♦ K♣ A♠ A♥ A♣ 3♠ 3♣ 2♠ 9♠ 6♥ 7♥ 4♣ 8♣ 10♣ Q♣
```

**Mirrored, not identical** — each renders its own perspective:

```
chromium  host "YOU WIN 3 — 1  +50 chips"      guest "YOU LOSE 1 — 3  +75 XP"
webkit    host "COMPLETE! You won ALL boards"  guest "YOU LOSE 0 — 4  +50 XP"
```

### `hand_history`: 1 → 2

The hardest number in the stage:

```
6264-b86d-b69d | quick_poker | 11:25:13
2ef7-df22-f586 | quick_poker | 11:25:13
```

One row per player, same second. Before this stage a completed hand produced exactly one row,
because only the host ever reached `/results`.

### `host_id` — the carried fix works

The room created by the fixed `createTable` has `host_id = 1a0f5d51-9572-4e32-b1e0-e6dd9c5899c3`.
Every room this path created before was NULL.

## The failure paths — tested, not assumed

Forced by aborting `**/rest/v1/rpc/deal_hand*` on one page at a time. Nothing on the server changed.

```
BLOCK THE HOST   screen: "Could not deal the hand. Check your connection and try again. Back to Lobby"
                 reached /multiplayer-game anyway: FALSE
BLOCK THE GUEST  screen: "Could not get your cards. Check your connection and try again. Back to Lobby"
                 reached /multiplayer-game anyway: FALSE
```

**That `FALSE` is the no-fallback proof.** If a local deal had quietly replaced the server one, the
page would be sitting in the game holding cards. It is not — it is on an error screen with a way
back, and `dealAndGo` reset `startedRef` so the table can be retried.

**`startNewHand`'s `onError` was NOT exercised.** It needs a second hand with both players
requesting one, which this harness does not drive. The code path is the same `await` shape, but I
am not claiming it as observed.

## Task 3 — what is dead, and two corrections to my own claims

### The private per-player topic is NOT fully dead. I said it would be; it is not.

`CARDS_DEALT` no longer travels — the host does not send it. But `sendToPlayer` is still called with
**`GAME_STATE_SNAPSHOT`** (`realtimeMultiplayer.ts:802`), and that is the *other* member of
`PRIVATE_MESSAGE_TYPES`. So the topic still carries the mid-game rejoin snapshot, and that snapshot
is still denied by exactly the authorisation this stage routed around.

**Consequence, stated plainly: mid-game rejoin is still broken.** It was broken before this stage
and it stays broken. `BOARD_REVEAL` and `HAND_COMPLETE` are *not* private types, so they ride the
shared channel and were never affected — which is why the reveal works in both runs above.

`PRIVATE_MESSAGE_TYPES` is untouched and nothing was removed, per the constraint.

### `onCardsDealt` rejoin / snapshot paths — not exercised, and reasoned to be still broken

Both remain registered. The `onGameStateSnapshot` path depends on the private topic above, so it is
expected to fail for the same reason. I did not exercise a rejoin.

### `dealCards()` — my "dead" claim was half right, and the half that shipped matters

`function dealCards(` appears **once in the deployed bundle**
(`index-ec14002b76d0305921be4638f91efc0d.js`, 3,832,430 bytes). It has no production *call site* —
that part of the grep held — but it is still **bundled**, because `initializeGame()` references it
and `gameLogic` is imported wholesale. "Dead by grep" and "not shipped" are different claims and I
had conflated them.

The same bundle confirms the new wiring is live: `HAND_READY` ×4, `deal_hand` ×6.

## DB state — every baseline restored

```
hand_history 151 (was 153 after the runs; my 4 device rows deleted) · game_hands 0
11 PUBLIC rooms, all waiting — CJTK and QW7U still 'CAPS Bot', 54YU untouched   BASELINE INTACT
9 private rooms (5 earlier + VE7T, 9SRB, GPG2, S2T7) — left to expire; game_rooms rows may not be
   deleted, and all are is_public=false so none appears in the lobby
room_players 4 | bug_reports 250 | backup 649 | phase0_channel_authz_enforced = true
```

## MACHINE

`tsc` returned 0 locally last run only on the fourth attempt; this run it was not re-run locally —
CI's artifact is 0 bytes and CI is the verdict. The git ref corruption is the same fault line.

=== STRATEGIST HANDOFF — STAGE 1C ===
- upstream restored, four files committed, pushed, deployed? sha 518bcd4, deploy run 32009754707
  SUCCESS, CI tsc-output artifact 0 bytes. NOTE: `git branch --set-upstream-to` FAILED —
  refs/remotes/origin/main is ALSO a broken ref, so the push needed an explicit refspec
  (`git push origin main:refs/heads/main`, which succeeded: d6f1e43..518bcd4). Local main and the
  remote are both correct; only the tracking copy is stale. Fix when convenient:
  rm .git/refs/remotes/origin/main && git fetch origin
- #root has real content on both engines? YES — 4,463 chars for host AND guest on chromium and on
  webkit. Asserted at the top of every net run; the run aborts if it is empty.
PROOF (two contexts, both engines):
  - net flipped from EXPECT=broken to passing? YES. chromium (room VE7T) and webkit (room 9SRB),
    both "matches EXPECT=fixed", EXIT 0, measured:true.
  - guest reaches /multiplayer-game (not stuck on Waiting)? YES, both engines.
  - same community cards? YES — chromium both saw J♥ Q♦ 4♦ A♠ A♠. different hole cards? YES —
    host 4♠4♥5♦5♣6♦6♣8♥8♦J♦J♣Q♥K♥9♦10♦A♦2♣ vs guest K♠K♦K♣A♠A♥A♣3♠3♣2♠9♠6♥7♥4♣8♣10♣Q♣.
  - hand completes | mirrored winner? YES both engines. chromium: host "YOU WIN 3 — 1", guest
    "YOU LOSE 1 — 3". webkit: host "COMPLETE! You won ALL boards", guest "YOU LOSE 0 — 4".
  - hand_history rows: 1 -> 2. TARGET HIT:
      6264-b86d-b69d | quick_poker | 11:25:13
      2ef7-df22-f586 | quick_poker | 11:25:13
    One row per player, same second. Before this stage only the host ever reached /results.
  - webkit? YES, a full pass of its own — not a chromium-only claim.
  - BONUS: host_id on the new room is 1a0f5d51-9572-4e32-b1e0-e6dd9c5899c3, non-NULL for the first
    time. The carried createTable fix works.
FAILURE PATHS (tested by aborting **/rest/v1/rpc/deal_hand* per page; nothing server-side changed):
  - host blocked: "Could not deal the hand. Check your connection and try again." + Back to Lobby.
    reachedGameAnyway FALSE. dealAndGo resets startedRef, so the table can be retried.
  - guest blocked: "Could not get your cards. Check your connection and try again." + Back to Lobby.
    reachedGameAnyway FALSE.
  - neither fell back to the local dealer? CONFIRMED BY THAT FALSE: a local deal would have left the
    page sitting in /multiplayer-game holding cards. Both probes exit non-zero if it ever does.
  - startNewHand via onError: NOT EXERCISED — it needs a second hand with both players requesting
    one, which this harness does not drive. Same await shape, but not observed. Not claimed.
NOW DEAD:
  - private per-player topic carries nothing? NO — I WAS WRONG AND AM CORRECTING IT. CARDS_DEALT no
    longer travels, but sendToPlayer is still called with GAME_STATE_SNAPSHOT
    (realtimeMultiplayer.ts:802), the OTHER member of PRIVATE_MESSAGE_TYPES. The topic still carries
    the mid-game rejoin snapshot, and that snapshot is still denied by the same authorisation.
    CONSEQUENCE: MID-GAME REJOIN IS STILL BROKEN — it was before this stage and it stays broken.
    BOARD_REVEAL and HAND_COMPLETE are NOT private types, ride the shared channel, and were never
    affected, which is why the reveal works in both runs. PRIVATE_MESSAGE_TYPES untouched, nothing
    removed, flagged as instructed.
  - onCardsDealt rejoin/snapshot paths: NOT EXERCISED, and reasoned to be still broken for the
    reason above. Both callbacks remain registered.
  - dealCards() dead confirmed in the DEPLOYED BUNDLE? NO — AND THIS CORRECTS MY EARLIER CLAIM.
    `function dealCards(` appears ONCE in index-ec14002b76d0305921be4638f91efc0d.js (3,832,430
    bytes). No production CALL SITE — that part of the grep held — but it still SHIPS, because
    initializeGame() references it and gameLogic is imported wholesale. "Dead by grep" and "not
    shipped" are different claims and I had conflated them. Same bundle confirms the new wiring is
    live: HAND_READY x4, deal_hand x6.
STILL NOT DONE (all true): adjudication untouched (host-only p_full branch stays until stage 2) |
  practice untouched and still client-dealt | equity and outs local | phase0_channel_authz_enforced
  still true | engine still in the bundle (evaluateOmahaHand x21).
DB: baselines restored and verified by query — hand_history 151, game_hands 0, 11 public rooms all
  waiting with CJTK and QW7U as 'CAPS Bot' and 54YU untouched, bug_reports 250, backup 649,
  phase0 true. 9 private rooms (5 earlier + the 4 from this run) left to expire; no game_rooms or
  room_players row was deleted.
tsc: CI artifact 0 bytes on 518bcd4 — CI is the verdict; not re-run locally this session.
HANDOFF: file + vamos_handoffs slug 2026-08-17-stage1c-proof | chars | code-point match? Y
WHAT I DID NOT CHECK: a SECOND hand in one room, so startNewHand's await and onError paths are
  unobserved and so is deal_hand's hand_no incrementing past 1 in a live game; mid-game rejoin
  (still broken, reasoned not measured); 3P and 4P multiplayer — every run here was 2P/4 boards;
  what a guest sees if the HOST's deal fails after the guest is already seated; and whether the
  deal_hand latency measured from a desktop holds on a phone.
=== END ===
