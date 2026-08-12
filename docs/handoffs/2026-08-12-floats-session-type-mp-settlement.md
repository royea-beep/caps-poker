# 2026-08-12 — Floats, session type, MP settlement

Shipped `9bb066b` on `main`, deployed, verified on live on both engines.

## Task 1 — raw floats during the chip count-up (FIXED)

`components/BoardReveal.tsx:958` rendered the counter through `Animated.interpolate` with a
**string** `outputRange`. RN matches the numeric substring in the two patterns, interpolates it
linearly and formats it unrounded, so every frame of the 800ms count-up carried ~16 decimals and
only landed clean at `t=1`.

Fix: `components/ChipCountUp.tsx` (new) animates the **number** and rounds on render —
`Math.round`, matching what S68 did for the other counter. `potAmount` and every economy value are
untouched; this is presentation only. Kept as its own leaf because the listener sets state per
animation frame and `BoardReveal` is a heavy tree.

**No collision with S68.** S68 (`9ff01fc`, merge of `c280c6b`) touched `app/(tabs)/index.tsx`,
`app/referral.tsx`, `components/ChipsDisplay.tsx` and `hooks/useResultsAnimations.ts` — never
`BoardReveal.tsx`. Its commit message is also the reason this mattered beyond the animation: it
records that the counter showed decimals "when the stored balance was **fractional**", so
`potAmount` can be fractional in its own right and even the final frame was not safe.

The change also retires the 2026-06-17 crash workaround (both `outputRange` entries needing
identical non-numeric structure, or RN threw `invalid pattern` on every loss). Nothing interpolates
a string now, so the constraint is moot.

### Verified mid-animation, both engines

`tests/chip-countup-frames.mjs` installs an in-page `requestAnimationFrame` sampler and records
every distinct value the counter renders. Sampling from Node would add round-trip latency and miss
frames of an 800ms animation.

| | chromium | webkit |
|---|---|---|
| ramp | 19 rising frames, 0 → 50 over 666ms | 19 rising frames, 0 → 50 over 660ms |
| ~25% | `+20 🪙` (t=+133ms) | `+24 🪙` (t=+165ms) |
| ~50% | `+37 🪙` (t=+300ms) | `+38 🪙` (t=+320ms) |
| ~75% | `+46 🪙` (t=+467ms) | `+46 🪙` (t=+474ms) |
| frames with a decimal | **0** | **0** |

The cubic-out easing is visible in the spacing. Two measurement traps had to be cleared first, and
both would have produced a false pass:

1. The first sampler matched any `…🪙` text, which also caught `results.tsx:1337` — a different
   element that renders **without** a space. With two streams interleaving, the "changed since
   last sample" dedupe fired on every alternation and the quartiles reported the wrong element.
   Fixed by requiring the space that `ChipCountUp` emits.
2. Quartiles **by index** were meaningless: the counter rests at 0 between boards, so most frames
   read `+0` and the ramp is a thin slice. The probe now finds the longest strictly-rising run and
   quotes 25/50/75% through *that*, and treats a run with no ramp as INCONCLUSIVE rather than a
   pass — a run that never observed the count-up must not read as evidence.

The counter renders only for non-practice hands (`BoardReveal` returns null when `isPractice`), so
the probe plays real-chip hands.

## Task 2 — `session_type` hardcoded (FIXED — it was ACTIVE, not latent)

`record_hand_result_d` declared `v_session_type text := 'practice'` and never reassigned it.

**A non-practice path exists and was being hit.** The call site (`app/results.tsx:550`) is **not**
gated on `isPracticeGame` — the ELO block immediately above it at `:539` does `return` early, this
one never did. So real hands reached the RPC and were filed as practice with a zero delta. Active.

The table settled the vocabulary: `hand_history_session_type_check` allows
`sng | quick_poker | practice | custom`, and history holds 95 `practice` rows (delta 0) alongside
51 `quick_poker` rows (deltas 100–250) from before the old RPC was dropped.

**Parameter surface only. The gating is byte-identical.** `p_session_type text DEFAULT 'practice'`
added; `v_chips_delta := CASE WHEN v_session_type = 'practice' THEN 0 ELSE NULL END` unchanged.
Non-practice `chips_delta` stays NULL rather than a computed figure — the real movement is ledgered
by `record_hand_net`, and inventing one here would revive the chip path dropped on 2026-07-20.

Two deliberate details: unknown/NULL values clamp to `practice` so a bad argument can never raise
inside the insert (the client wraps the call in an empty catch, so a constraint violation would
silently lose the row); and the old 4-arg function was **dropped** rather than left beside the new
one, because with both present a 4-arg call matches the old signature exactly and would have kept
hitting the buggy version. The DEFAULT keeps existing 4-arg callers working.

### Round trip

| call | session_type | chips_delta |
|---|---|---|
| `'practice'` | practice | **0** — unchanged |
| `'quick_poker'` | quick_poker | NULL |
| 4-arg, no session type | practice | 0 |
| `'nonsense'` | practice (clamped) | 0 |

Confirmed again live, end to end: five real-chip solo hands and two MP players all wrote
`session_type='quick_poker'`. Before this they would every one have been `practice`/`0`.

## Task 3 — the multiplayer hand, driven to completion (DONE)

Reveal tapped through to the end on **both** clients (8 taps, `A done true | B done true`).

Run 1 — a decisive hand:

| | A (`7edc-f035-3f95`) | B (`acbc-7242-73a4`) |
|---|---|---|
| headline | `YOU LOSE  1 — 3` | `YOU WIN  3 — 1` |
| per board | L, L, **W**, L | **W**, **W**, L, **W** |
| `hand_history` | lost, 1/4, quick_poker | won, 3/4, quick_poker |

One row per player, mirrored, 1 + 3 = 4. Each client shows the other's cards under the opposing
label, and the two readings of every board match.

Run 2 — a 2-2 tie, both clients reading `final 2-2`. 6/7 assertions; the only failure is the 403
below.

**Chip movement — not what it looks like.** The wallets read 2000 → 200 and 2000 → 548. That is not
an 1800-chip loss: `leaderboard.total_chips` for those devices is **exactly** 200 and 548. The
client adopted its true server balance through `submit_score`'s absolute read-back (documented at
`results.tsx:347`). The 2000 was a fresh-device client-side default that was never real. Read only
one side and this looks like catastrophic chip loss.

**A correction to my own probe.** Run 1 reported "BOTH CLAIM THE WIN — clients disagree". That was
the probe, not the app. `claimsWin` tested the whole body, and the finished screen lists every
board with its own `✅ YOU WIN` / `❌ YOU LOSE` badge — so any hand where each side takes at least
one board reads as both claiming victory. It flagged a disagreement on a perfect mirror. Now judged
on the headline only, and it passes. Same class as the earlier "a per-board verdict is not the end
of the hand" trap.

## NEW FINDING — a silent 403 on every real hand, losing `boards_data`

Both MP runs reported `403 hand_history`. It is not `saveHandToHistory` (that writes AsyncStorage,
not the DB). It is `app/results.tsx:385`:

```js
await sb.from('hand_history').insert({ device_id, boards_data: …, boards_won: … })
```

A **direct table insert**, separate from the RPC at `:569`, gated on `!isPracticeGame` at `:379`.
Under RLS an anon client gets 403 and the empty catch swallows it. So every non-practice hand fires
a second, failing write, and the `boards_data` payload — the full per-board community/player cards
and hand names, which `record_hand_result_d` does not record — is discarded every time.

Not fixed: it needs either a new RPC or an RLS policy, and RLS is on the do-not-touch list. Reported
for the strategist to scope.

## Task 4 — REPORT ONLY: the unledgered wallet write

`app/gameover.tsx:57` calls `setChips(config.startingChips)` when a busted player confirms "Play
Again", reachable from `results.tsx:788`. `setChips` is `set({ chips })` (`gameStore.ts:204`) —
local and persisted, no RPC, no ledger entry. So the wallet is set to a game-config constant while
the server knows nothing about it, and the divergence persists until something does an absolute
read-back and overwrites it — which, per Task 3, is exactly what `submit_score` does after the next
hand. Nothing changed; no proposal.

## Observations, not defects

- The MP results screen labels the human opponent **"Bot"** on every board.
- A losing player's `leaderboard.games_played` stayed 0 while the winner's went to 1.
- `/game?players=3` without `practice=true` dealt **4** boards (a 2-player count). The `players`
  parameter appears not to apply on the non-practice route.

## DB state

Captured before, restored to that, verified by query. `room_players` 0 · `hand_history` 146 ·
`bug_reports` 250 · rooms **11/11** clean · `quick_poker` rows back to the original 51. All probe
rows deleted.

**One honest deviation:** the baseline had **10** rooms; there are now **11**. `54YU` was created
during the MP runs. Deleting `game_rooms` rows is on the do-not-touch list, so it was left in place
and restored to clean `waiting`/0/NULL like the rest rather than removed. `host_name` was restored
per room from the captured baseline — `CJTK` and `QW7U` are `CAPS Bot`, the other nine
`Open Table`; the inherited template would have stamped all of them `Open Table`.

## Carried forward

1. The `results.tsx:385` 403 and the lost `boards_data`.
2. `BoardResultCard` is dead in solo only — it renders in MP.
3. Google OAuth / anonymous-to-signed-in progression loss.
4. Performance and memory across 20 consecutive hands.
5. Audit blind spots: persisted profile still the most valuable open one.

=== STRATEGIST HANDOFF — FLOATS / SESSION TYPE / MP SETTLEMENT ===
TASK 1 FLOATS:
  - fix: components/ChipCountUp.tsx (new) replaces the string interpolate at BoardReveal.tsx:958.
    S68 touched index/referral/ChipsDisplay/useResultsAnimations, never BoardReveal — no collision.
  - mid-animation ~25/50/75%: chromium +20/+37/+46, webkit +24/+38/+46; ramp 0->50 over ~660ms.
  - potAmount / economy untouched? YES — presentation only.
TASK 2 SESSION TYPE:
  - non-practice path today? YES — the call site is NOT gated on isPracticeGame. ACTIVE, not latent.
  - parameter added (p_session_type DEFAULT 'practice'); gating CASE unchanged; old 4-arg dropped
    so 4-arg calls could not keep resolving to the buggy version.
  - ROUND TRIP: practice chips_delta 0 | quick_poker chips_delta NULL | 4-arg practice/0 | junk clamped.
TASK 3 MP SETTLEMENT:
  - reveal driven to completion on both clients? YES (8 taps, both reached /results).
  - A "YOU LOSE 1 — 3" / B "YOU WIN 3 — 1" — mirrored. Wallets 2000->200 and 2000->548 are NOT a
    loss: leaderboard.total_chips is exactly 200 and 548; the 2000 was a fresh-device default.
  - hand_history: one row per player, mirrored 1/4 and 3/4, session_type quick_poker on both.
  - rooms restored from CAPTURED baseline? YES, verified by query; CJTK/QW7U kept 'CAPS Bot'.
TASK 4: gameover.tsx:57 divergence described, nothing changed? YES.
LIVE: main 9bb066b | deployed | #root OK on chromium (1 kid/724 chars) and webkit (1 kid/717).
DB: bug_reports 250 | hand_history 146 | room_players 0 | rooms 11/11 clean (was 10 — 54YU created
    by the runs; not deleted, that is on the do-not-touch list).
HANDOFF written to file AND inserted into vamos_handoffs? slug 2026-08-12-floats-session-type-mp-settlement.
NEW: results.tsx:385 direct hand_history insert 403s on EVERY real hand, silently discarding
     boards_data. Needs an RPC or an RLS policy — both out of scope here.
WHAT I DID NOT CHECK: whether any non-web client sends the 4-arg call; the "Bot" label on human
     opponents; why players=3 dealt 4 boards on the non-practice route.
tsc: PASSED clean, no crash.
=== END ===
