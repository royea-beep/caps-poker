# 2026-08-17 — A 30-second grace before auto-place

Shipped `fd08d22`, deploy success, CI `tsc` artifact 0 bytes. **Branch A passes on both engines.
Branch B delays correctly — and turned up the one thing that cannot be fixed on this side of
stage 2: the absent player still gets no `hand_history` row.**

## Task 1 — the grace window

`utils/realtimeMultiplayer.ts:343` — on presence loss, a per-player timer
(`DISCONNECT_GRACE_MS = 30000`, `realtimeMultiplayer.ts:33`) is armed instead of auto-readying
immediately. **The clock starts at presence loss, not at hand start.**

`utils/realtimeMultiplayer.ts:326` — a return inside the window `clearTimeout`s it and the rejoin
path (`STATE_SNAPSHOT` + `deal_hand`) takes over. Nothing else changed there.

**On expiry the behaviour is byte-for-byte what it was**: `client.isReady = true`,
`nextHandRequests.add(id)`, then `checkAllReady()` / `checkNextHandReady()`. Auto-ready leaves
`boardAssignments` null, and `runRevealSequence` fills from the hand that player was dealt — so they
are **auto-placed, not forfeited**, and can still win on their own cards. Only *when* it fires moved.

**The timers live on the host**, because the host is what observes presence and drives the hand. So
**if the host drops, the grace timers die with it** — `stop()` clears them
(`realtimeMultiplayer.ts:1000`). A host that drops mid-hand leaves the table to the existing
host-lost handling, which is unchanged and outside this brief.

### What the remaining player sees

One line in `topCenter`, the slot that already exists, using `waitingHeaderText`, the style that
already exists:

```
Guest disconnected — the hand continues shortly
```

Measured live on the host during branch B: **`hostSeesAway: true`**, text read back as
`✕ Guest disconnected — the hand continues shortly 💰 2,000 vs G Guest placing cards`.

No countdown. A ticking clock invites staring at it, and the brief asked for it only if free.

The signal is card-free and symmetrical: broadcast as `PLAYER_AWAY` to guests, and fired locally
through the same callback shape on the host, so whichever side stays is told.

## Task 2 — both branches

### Branch A — returns in time. Passes on both engines.

```
chromium (HDTD)  returned after 12.0 s   rejoined true   sameCommunity TRUE   sameHole TRUE
webkit   (74Z4)  returned after 14.0 s   rejoined true   sameCommunity TRUE   sameHole TRUE
```

**It resumed the hand it left, with its own original cards.** Before this change that was
impossible — the hand was gone in about five seconds.

`hand_history` **151 → 153**, one row per player:

```
0df0-a551-e78f | quick_poker | 12:38:28
b6eb-0d6c-e913 | quick_poker | 12:38:28
```

And both saw `reveal_started` within 74 ms of each other (12:37:51.086 / 12:37:51.160) — the
returning guest played the hand through to the end, not just back onto the screen.

### Branch B — never returns. The delay is right; the record is not.

**Measured from the analytics timeline** (room NFHJ), which is a timestamped server-side record
rather than a stopwatch in the harness:

```
mp_game_started            12:35:20.85
guest tab closed           ~12:35:26      (probe: +3 s settle, then host auto-place + ready)
mp_game_ended              12:35:56.27
reveal_started             12:35:56.27
                           -> ~30.3 s from presence loss to the hand resolving
```

**~30 s, against the ~5.2 s measured before this change.** That is the window doing its job.

**Auto-placed, not forfeited**: the hand resolved into a full reveal with four boards rather than
being abandoned, which is only possible because the absent seat's cards were played. Their
`boardAssignments` stayed null and `runRevealSequence` filled from their dealt hand — the path I did
not touch.

### The finding: an absent player leaves no record, and I cannot fix it here

**`hand_history` stayed at 151 in branch B. Not 2, not even 1.**

`record_hand_result_d` is called **from the results screen, by each client, for itself**
(`app/results.tsx:572`). A player who is gone never reaches `/results`, so **they cannot write their
own row** — and in that run the host's reveal was still playing when the probe gave up, so it wrote
nothing either.

By the brief's own definition — *"an auto-placed player who leaves no record has been forfeited in
all but name"* — **branch B's key assertion is not met, and it cannot be met while rows are written
client-side by whoever reaches the results screen.** The fix is the server writing the row when it
adjudicates, which is stage 2. I am flagging it rather than bolting on a second writer, because a
second writer beside the first is this project's established failure mode.

## DB state

```
11 PUBLIC rooms, all waiting — CJTK and QW7U still 'CAPS Bot', 54YU untouched   BASELINE INTACT
18 private rooms (four grace runs added to the fourteen) — is_public false, left to expire
hand_history 151 · game_hands 0 · bug_reports 250 · backup 649
phase0_channel_authz_enforced = true
```

No `game_rooms` or `room_players` row was deleted.

## MACHINE

`tsc` exit 0 on the second attempt; the first died with `0xC0000005`.

=== STRATEGIST HANDOFF — GRACE WINDOW ===
TASK 1:
  - implemented at utils/realtimeMultiplayer.ts:343 (arm) and :326 (cancel on return), constant
    DISCONNECT_GRACE_MS = 30000 at :33. TIMER STARTS AT PRESENCE LOSS, not at hand start? YES — it
    is armed inside the `!presentIds.has(id) && client.connected` branch.
  - a return inside the window cancels it and the rejoin path takes over? YES — clearTimeout in the
    reconnect branch, then the existing STATE_SNAPSHOT + deal_hand path runs unchanged.
  - on expiry: auto-place, NOT forfeit? YES, and the expiry body is byte-for-byte the old behaviour:
    isReady = true, nextHandRequests.add(id), checkAllReady/checkNextHandReady. Auto-ready leaves
    boardAssignments null and runRevealSequence fills from that player's DEALT hand. Confirmed in
    branch B by the hand resolving into a full four-board reveal rather than being abandoned.
  - if the HOST drops, does the grace timer die with it? YES — the timers live on the host because
    the host is what observes presence, and stop() clears them (:1000). A host that drops falls to
    the existing host-lost handling, unchanged and outside this brief.
  - what the remaining player sees: one line in the EXISTING topCenter slot with the EXISTING
    waitingHeaderText style — "<name> disconnected — the hand continues shortly". No countdown.
    Measured live on the host in branch B: hostSeesAway TRUE, read back as
    "✕ Guest disconnected — the hand continues shortly 💰 2,000 vs G Guest placing cards".
    Card-free and symmetrical: PLAYER_AWAY broadcast to guests, same callback fired locally on host.
TASK 2 PROOF (two contexts, both engines):
  BRANCH A — returns at ~10s:
    - chromium (HDTD) returned after 12.0 s: rejoined TRUE, sameCommunity TRUE, sameHole TRUE.
      webkit (74Z4) returned after 14.0 s: rejoined TRUE, sameCommunity TRUE, sameHole TRUE.
      IT RESUMED THE HAND IT LEFT with its own original cards — impossible before this change.
    - alreadyReady preserved: NOT ASSERTED — the guest had not confirmed placement before dropping
      in these runs, so the flag was false either way. Not claimed.
    - hand completes | hand_history 151 -> 153, ONE ROW PER PLAYER:
        0df0-a551-e78f | quick_poker | 12:38:28
        b6eb-0d6c-e913 | quick_poker | 12:38:28
      and both saw reveal_started within 74 ms (12:37:51.086 / .160) — the returning guest played
      the hand to the end, not just back onto the screen.
  BRANCH B — never returns:
    - measured delay from presence loss to resolution: ~30.3 s (was ~5.2 s). From the analytics
      timeline of room NFHJ: mp_game_started 12:35:20.85, guest closed ~12:35:26, mp_game_ended and
      reveal_started both 12:35:56.27. Server-side timestamps, not a harness stopwatch.
    - absent player's cards AUTO-PLACED, not forfeited? YES — the hand resolved into a full
      four-board reveal, which requires the absent seat's cards to have been played.
    - hand_history rows: 151, UNCHANGED. NOT 2, NOT EVEN 1. THE ASSERTION IS NOT MET AND CANNOT BE
      MET HERE: record_hand_result_d is called FROM THE RESULTS SCREEN BY EACH CLIENT FOR ITSELF
      (app/results.tsx:572), so a player who is gone never reaches it and cannot write their own
      row; in that run the host's reveal was still playing when the probe ended, so it wrote none
      either. By your own definition that is "forfeited in all but name". THE FIX IS THE SERVER
      WRITING THE ROW WHEN IT ADJUDICATES — stage 2. I did not bolt on a second writer, because a
      second writer beside the first is this project's established failure mode.
  - webkit? YES for branch A, a full pass of its own. Branch B was measured on chromium only.
STILL NOT DONE (all true): adjudication untouched (host-only p_full stays until stage 2) | practice
  untouched and client-dealt | equity and outs local | phase0_channel_authz_enforced still true |
  engine still in the bundle.
DB: baselines verified — 11 public rooms all waiting, CJTK and QW7U 'CAPS Bot', 54YU untouched;
  hand_history 151, game_hands 0, bug_reports 250, backup 649. 18 private rooms left to expire; no
  game_rooms or room_players row deleted.
tsc: exit code 0 (second attempt; first died with 0xC0000005). CI artifact 0 bytes on fd08d22 —
  CI is the verdict.
HANDOFF: file + vamos_handoffs slug 2026-08-17-grace-window | chars | code-point match? Y
WHAT I DID NOT CHECK: branch B on webkit — the delay was measured on chromium only, though the
  timer is server-side and engine-independent; alreadyReady preservation across a drop, since the
  guest never confirmed placement before dropping in these runs; what happens if BOTH players drop
  inside the window; whether a 30-second wait feels acceptable to the player who stayed, which is an
  eye-test not a measurement; and the host-drop case, which falls to the existing host-lost handling
  I did not exercise.
=== END ===
