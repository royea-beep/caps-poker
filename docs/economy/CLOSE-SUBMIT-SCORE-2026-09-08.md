# CLOSE-SUBMIT-SCORE — 2026-09-08

The last known economic hole is closed. `submit_score` no longer grants chips from a number the
caller supplies. Applied to production after a branch-proven before/after, re-attacked from
outside, and confirmed against a real hand end to end.

Nothing else changed: no economy value, no flag, no cue, no layout, no card size, no 83px arc, no
room code hardening (Roye declined it), no Edge Function deployed, no payment enabled.

---

## What the real client needs from `submit_score` — read before changing it

There is exactly **one** caller: `utils/leaderboard.ts:107`, reached from `app/results.tsx:576`.
It runs **last** in a strictly sequenced block, and the results screen says what it is in its own
comment:

> `record_hand_net` (per-hand net, sole per-hand mover) → `record_reward`(each unlocked
> achievement) → `submit_score`(FINAL new_balance = stats **+ a no-op echo of the true post-delta
> total**)

It passes `latest ?? gs.chips`, where `latest` is the balance **the server itself just returned**
from the ledgered writers. And the wrapper discards the response entirely (`return !error`).

**So the legitimate path needs no grant at all.** That is why the fix is a removal, not a
re-derivation — there is no chip movement here to derive from a verified event, because the chip
movement already happened upstream and was ledgered.

## The fix

`total_chips` is no longer written by this function, at all. It writes stats and reads the balance
back for its return value.

Two details that matter more than they look:

- **UPDATE-only, never an UPSERT.** `leaderboard.total_chips` is `NOT NULL DEFAULT 2000`. An
  INSERT from this function that merely omitted the column would itself have granted 2,000
  unledgered chips by a second route. The row is created by the ledgered writers instead —
  `record_hand_net` runs first in the same block and creates it.
- **The signature is unchanged on purpose.** `p_total_chips` is still accepted and deliberately
  ignored, because build 515 is on TestFlight and still sends it. Changing the argument list would
  break every installed copy of the app.

⚠️ **Not a lower cap.** The cap was never the defect; it bounded the damage. A clamp on an invented
number is still an invented number, and lowering it would have left the shape intact.

## Branch before/after — Iron Rule 11

Preview project `ywxjotjcexkqjgxdzhwd`. Its migration replay failed (5 tables, 0 functions), so the
environment was rebuilt from production's own definitions: `econ_score_gain_daily` created, the
`total_chips` default aligned from 1000 to production's 2000, and production's **current**
`submit_score` installed verbatim. The two identity guards were stubbed to `true` so the test
exercises the worst case — a caller who has legitimately passed identity.

Four identical forged calls at `p_total_chips = 999999999`:

| | call 1 | call 2 | call 3 | call 4 | `gained_today` |
|---|---|---|---|---|---|
| **before** | 4,000 | 6,000 | 7,000 | 7,000 | 5,000 |
| **after** | 2,000 | 2,000 | 2,000 | 2,000 | NULL |

Read back separately from the statement that made the calls, because a `UNION ALL` subselect reads
the snapshot at statement start and reported a stale 2,000 the first time.

Two more cases on the branch, after the fix:

- **A legitimate echo** — a device on 2,450 submitting 2,450 — kept 2,450 and its stats were
  written (`player_name` Roye, 7 hands, 3 won, biggest 120).
- **No leaderboard row** — refused with `no_leaderboard_row`, no INSERT, no default grant.

## Re-attacked on production

A real anonymous session minted from the public key in one call (`role: authenticated,
is_anonymous: true`), exactly as the app does.

| step | result |
|---|---|
| `econ_bind_ok` for a brand-new device | **true** — anonymous still works |
| four forged `submit_score` calls, no row yet | **refused**, `no_leaderboard_row` ×4, no row created, no ledger row |
| `record_hand_net` net 120 on a real hand | `ok`, rake 6, play_grant 80, **new_balance 194** |
| `submit_score` echoing 194 | `ok`, `total_chips 194`, **`chips_written: false`** |
| two more forged calls **with a row present** — the real worst case | **194, unchanged, twice** |

Read back from the database:

```
total_chips 194   ledger_sum 194   GAP 0
ledger rows: rake=-6, hand_net=120, play_grant=80
elo 1000   games_played 0   wins 0
```

**A real hand lands correctly and the gap stays 0.** The ladder did not move, so **S2 holds**.

## What is still forgeable, and deliberately left

`hands_played`, `hands_won` and `biggest_win` are still caller-supplied, so a player can inflate
their **own** displayed stats — the forged device came out with `biggest_win 999999`. No chips, no
ELO, no ladder. Reported rather than folded into this fix, so the diff stays exactly "chips
removed".

## And a thing found on the way

The starting 2,000 has **never been ledgered at grant time**. It comes from the column default via
`ensure_leaderboard_row`, and the whole-database gap is 0 only because a one-off `reset_baseline`
backfill on 2026-09-01 wrote matching ledger rows for every device then alive — all three devices
sampled carry that identical timestamp as their first row. A device created today takes a
different path: `record_hand_net` creates its row and every chip is ledgered from the first hand,
which is why the fresh device above came out at gap 0. Recorded so nobody reads the 0 as proof
that the signup grant is ledgered. It is not; it currently grants nothing until a hand is played.

## Guards

`tests/submit-score-contract.test.ts` — three tests, two proven to fail by planting the defect:

- the client still sends all six arguments (planted: deleting `p_total_chips` → fails)
- `submit_score` stays sequenced **after** `record_hand_net` (planted: re-ordered → fails)
- nothing reads a balance out of its response

## Cleanup

Test devices deleted, branch dropped, verified by fresh SELECT:

```
devices 398 · played 25 · hands 78 · bindings 12 · max_chips 3,250 · float 800,920
purchases 0 · qa rows 0 · qa transactions 0 · LEDGER GAP 0
```

`max(total_chips)` is back to **3,250** — a real player's number.
