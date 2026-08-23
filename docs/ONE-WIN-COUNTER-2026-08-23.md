# CAPS — ONE-WIN-COUNTER: two counters, one truth (2026-08-23)

The drift is gone: `leaderboard.wins` and `games_played` are now a **projection** of `hand_history`,
written by the row itself. And the hunt for it surfaced something bigger than the drift —
**multiplayer hands have never been recorded at all.**

---

## MAP — carried forward, extended

- `vamos_handoffs` is the channel. Latest: id 104.
- ⚠️ **`resolve_hand` does not exist.** A code comment credited it with writing multiplayer rows;
  `pg_proc` says otherwise. **MP hands have never produced a `hand_history` row** — invisible in
  `/hand-history`, and they only counted on the ladder because the old second writer moved the
  counters directly.
- **A branch cannot reproduce this database.** CAPS' schema predates its tracked migration history:
  a fresh branch came up with **5 tables** (production has 56) and an **older `leaderboard` shape**.
  A faithful minimal replica had to be built by hand to prove anything.
- **`CREATE OR REPLACE FUNCTION` cannot alter parameter defaults.** Production defaulted **four**
  parameters of `record_hand_result_d`; declaring one is an error, not a silent widening.
- **A duplicate reply must still carry what was applied.** The first version returned no
  `elo_delta` on the idempotent path, and because `game.tsx` queues at the reveal and wins the
  race, the results screen never drew the ELO badge. The data was right; the report of it was not.

## 1 — One source of truth for "wins"

### Authoritative: `hand_history`

| | `hand_history` | `leaderboard.wins` |
|---|---|---|
| shape | one **row** per hand | a bare integer |
| who writes | only a `SECURITY DEFINER` function — a client cannot forge one | a second network call |
| repeat safety | idempotent on `(device_id, client_hand_id)` | none |
| can express a tie | **yes**, now | no |

`leaderboard` is not demoted — it is **derived**. Nothing that *reads* it changed, so `/rank`, the
leaderboard and `get_player_stats` keep working untouched.

**What reads changed: nothing.** The only client change is which call *writes*.

### One write, not two

The counters moved into an **`AFTER INSERT` trigger on `hand_history`**
(`trg_hand_history_leaderboard`) — the same pattern `trg_hand_history_achievements` already uses,
as instructed, rather than a second invention.

- **A retry cannot double.** The insert is idempotent, so a repeat inserts no row and the trigger
  never fires a second time.
- **A failure cannot skip.** The update is in the **same transaction** as the row: if it raises,
  the row does not land either, and the outbox retries the whole thing.

The client now makes **one** call — `record_hand_result_d` — which records the hand, moves the
counters, and returns `elo_delta` for the badge. The separate `update_leaderboard_elo` call is
**deleted from the client**.

`update_leaderboard_elo` itself is **kept as a read-only calculator**, not dropped: a player on a
stale cached bundle still calls it, and it must neither double-count nor hard-error. It now writes
nothing and reports what the trigger already applied.

### Practice exclusion, visible in code

In `tg_hand_history_leaderboard_counters`, as the first statement:

```sql
-- PRACTICE IS A DELIBERATE EXCLUSION, NOT DRIFT. … THIS LINE is why hand_history (which DOES
-- record practice, for the player's own history) and the leaderboard (which must not) differ ON
-- PURPOSE. Do not "fix" it back: the gap between the two counters should be exactly the practice
-- hands, and nothing else.
IF NEW.session_type = 'practice' THEN RETURN NULL; END IF;
```

It moved **into the trigger**, so it now applies to every writer rather than to one call site.

### The tie is countable as neither

`p_won` **NULL** → stored `result = 'tied'` → the trigger moves `games_played` (a game was played)
and **nothing else**: no win credited, no ELO movement. Carried end-to-end by a new
`HandOutcome = 'win' | 'loss' | 'tie'` in the outbox, replacing `won: boolean`. Entries queued by
an older build are migrated on read; a legacy tie is indistinguishable from a legacy loss — that
information was never stored — so it stays a loss rather than being guessed at.

## 2 — The stored outcome can now say "tie"

**CHECK constraint changed** to `won | lost | tied | folded | timeout`. Existing rows are only
`'won'` (115) and `'lost'` (128), both still allowed, so it validated **without modifying a row**.

### Every consumer of `result`, checked first

| consumer | what it does with `result` | a third value? |
|---|---|---|
| `check_achievements` | `count(*) FILTER (WHERE result = 'won')` | safe — a tie is not a win |
| `generate_weekly_recap`, `generate_weekly_recap_d` | `result='won'` | safe |
| `get_play_of_the_day_v2` | `result = 'won'` ×2 | safe |
| `get_hand_history`, `get_hand_replay` | pass the value through, no branching | safe |
| `run_daily_digest` | touches `hand_history`, never `result` | safe |
| the client | reads **none** of them — `/hand-history` derives from boards | safe |

**Nobody computes losses as `result <> 'won'`.** Every consumer asks *"is it a win?"* by equality,
and a tie correctly answers no. That is what made the constraint change small.

### ⚠️ The 22 existing board-tied rows — options, and a recommendation

15 stored `'lost'`, 5 `'won'`, 2 otherwise.

| option | consequence |
|---|---|
| **a. backfill to `'tied'`** | ⚠️ would create a **new** disagreement: the trigger only fires on INSERT, so rewriting the rows would **not** move the counters those rows already contributed to under the old writer. The store and the counter would then disagree in the opposite direction. |
| b. leave them | the store keeps 22 rows that say something the app no longer believes |
| **c. leave them and record the cutoff** ⭐ | same as (b), but the boundary is written down so nobody later reads the mixture as a live bug |

**Recommended: (c), and that is what was done — nothing was backfilled.** Beyond the mechanical
argument, the stored value was what the app believed at the time, and these rows belong to harness
and early devices, not to players. **Cutoff: 2026-08-23 07:20 +03.** Rows before it were written by
the two-writer world; rows after it by the single counter.

## 3 — Proof

### Branch first

Branch **`one-win-counter`** (`rrkxwzjkuumechryjavb`), cost **$0.01344/hour**, **deleted** after use
and **confirmed by listing** — only `main` remains.

⚠️ **The branch could not reproduce production**: it came up with **5 tables** and an older
`leaderboard` shape, because CAPS' schema predates its tracked migration history. A faithful
minimal replica of `hand_history` + `leaderboard` (real column types, the real CHECK constraint, the
real partial unique index) was built explicitly rather than pretended, and the migration proved
there:

```
win, loss, tie, the SAME tie replayed TWICE, then a practice hand
 -> elo 1010   games_played 3   wins 1   elo_last_delta 0
 -> 4 hand rows from 6 calls          (the two retries inserted nothing)
 -> games_played == non-practice rows (3 == 3)
 -> wins         == non-practice wins (1 == 1)
```

Note the migration **touches no existing row**: the constraint swap only validates, and the new
column is a metadata-only add in PG11+.

### Then real hands on live

Six non-practice hands (4 wins, 2 ties) plus one practice hand, played through the browser:

| | `hand_history` | `leaderboard` |
|---|---:|---:|
| non-practice hands | 6 | `games_played` **6** |
| wins | 4 | `wins` **4** |
| all rows (incl. practice) | 7 | — |

`elo 1080` = 1000 + 4×20 + **2×0** — the ties moved nothing, and the practice hand wrote its row
without touching the ladder. A second run reproduced it: 5 games / 3 wins / elo 1060 / 2 ties.

### Drift after

Across every device whose hands were **all** recorded under the single counter:

```
devices 2 · hand_history games 11 = leaderboard games 11 · wins 7 = wins 7
practice rows excluded: 2 · devices disagreeing: 0 on games, 0 on wins
```

**The remaining gap is exactly the practice hands.** Historical rows cannot retroactively agree —
they were counted by the old two-writer world — which is what the cutoff records.

### Surfaces agree

| surface | shows |
|---|---|
| `/rank` | ELO **1080** · **6 Games** · **4 Wins** · **67%** |
| `get_player_stats` (what `/stats` renders) | `hands_played 6` · `hands_won 4` · `win_rate 66.7` · rank 902 |
| `leaderboard` | same row, same numbers |
| achievements | counts `result='won'` from `hand_history` — **the same 4** |

⚠️ `/stats` and `/hand-history` showed their **empty states** in the browser check, because both
gate on **local** hand history and only the device id was pinned. Stated as a harness limitation,
not a pass: the server numbers those screens render were read directly from the RPC instead.

### The tie: forced, not simulated

Ties came up naturally — **2 of 6** hands in the first run, 2 of 5 in the second, plus the practice
hand. No deterministic substitute was needed this time; the previous sprint's interceptor method
was not required.

---

## FINAL CYCLE

| engine | 320 | 375 | 393 | 1280 |
|---|---|---|---|---|
| **webkit** | 2p · **4 boards** | 4p · **2 boards** | 3p · **3 boards** | 4p · **2 boards** |
| **chromium** | 2p · **4 boards** | 3p · **3 boards** | 4p · **2 boards** | 2p · **4 boards** |

Each engine covers all four widths and all three board counts.

**Self-test caught its planted defects in every run: confirmed** — all eight printed
`planted overflow caught=true  planted clip caught=true`.

**What the cycle found: NOTHING.** 8 of 8 cells: **0 findings, 0 `console.error`**. `pageerror` was
0 on three webkit cells and 1 `AbortError` on one (the harness aborting in-flight requests as it
walks 22 routes); 2–4 on chromium cells, all the autoplay `NotAllowedError` that handoff 101 proved
benign against a 0-error idle page.

This one touched a live write path, and the loop is what showed it working in the wild: **every
loop cell's device ended with `hand_history` = 1 row and `games_played` = 0** — the practice hand
each cell plays wrote its row and left the ladder alone, exactly as the trigger's practice
exclusion intends.

## Instrument failures — 2, both named

1. **A deploy landed mid-run** on the first two loop cells and produced one A11Y finding each
   (`/settings` and `/coaching`, "zero exposed controls") alongside a
   `'text/html' is not a valid JavaScript MIME type` error — the signature of a bundle chunk 404ing
   because the server returned the HTML fallback for a file that had just been replaced. Different
   routes each time, which is what a random chunk failure looks like rather than a screen defect.
   The bundle hash was sampled three times to confirm it had settled, and **both cells re-ran
   clean**. Not filed.
2. **A browser crash** (`Target crashed`) during the second real-hands proof, on the practice hand
   after five non-practice hands had already been recorded. The device id was never printed, so it
   was recovered from the database instead; the counters for it were read and agreed.

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `purchases` **0** · daily reward
**150** · `emergency_chips_amount` **200** · `hand_rake_pct` **5** · `rewarded_ad_chips` **100** ·
`record_reward` and its clamp untouched · `verify_jwt` untouched · **missions still inactive (0 of
20 active, all 20 definitions kept)** · no `app_config` key added, deleted or edited · no
`game_rooms` or `room_players` row edited · `Card.tsx` untouched.

**DB changes, in full:** the `hand_history.result` CHECK constraint gains `'tied'` ·
`leaderboard.elo_last_delta` added (metadata-only) · `record_hand_result_d` learns the third
outcome and returns `elo_delta` · new trigger `trg_hand_history_leaderboard` ·
`update_leaderboard_elo` becomes read-only. **No historical row was modified, and nothing was
backfilled.**

**Cleaned:** 12 harness devices — the 2 proof devices and the 10 loop cells — across
`referral_links`, `referral_redemptions`, `user_missions`, `hand_history`, `chip_transactions`,
`daily_rewards`, `analytics_events`, `device_identity` and `leaderboard`. `hand_history` back to
**243** rows (the historical set, untouched) with **0** `'tied'` rows remaining, bindings back to
**3**, `test-` devices **0**, leaderboard **1,083**. Real player `6956-24d1-5ee4` **untouched** —
2,530 chips.

*(handoff: `vamos_handoffs` id 104 · shipped `main a7357b7`, `b572e16`)*
