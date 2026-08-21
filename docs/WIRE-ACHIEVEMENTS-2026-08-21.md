# CAPS — achievements are earnable again, four months later (2026-08-21)

Roye chose option A: wire it, through `record_reward`, never `earn_chips`. Both known breaks are
fixed — and a **third** appeared only once the first two were, which is the interesting part.

---

## Award path: `record_reward` only — proven, not claimed

| assertion | result |
|---|---|
| `check_achievements` contains the string `earn_chips` | **false** |
| achievement chip rows *not* written by `record_reward` | **0** |
| duplicate `(device_id, event_type)` achievement grants, table-wide | **0** |

Every achievement row carries `description = 'reward ' || event_type` — `record_reward`'s own
format, so the writer is identifiable from the ledger alone.

## What the checker reads now

**Was:** `player_poker_stats` (2 rows, last written **2026-04-13**) behind
`IF stats IS NULL THEN RETURN '[]'` — that early return is literally why it returned `[]` for every
modern device — plus `player_levels` (1 row, dead since 2026-04-14).

**Now:** `hand_history` (244 rows, written today, one row per completed hand, records practice),
`leaderboard`, `player_streaks` (32,064 rows, written today), `device_cups`, `chip_transactions`.
**Neither dead table is revived** — a dead table with a new writer is how this class of bug
persists.

It also now implements **7 of 11** condition types. The old body only ever implemented 6, so even
with live data **18 of 36 could never have fired**.

### Still cannot fire — 12 of 36, reported rather than faked

| condition | count | why |
|---|---|---|
| `bluffs`, `all_ins` | 5 | `is_bluff` / `is_all_in` are false on **all 244** rows |
| `level` | 3 | `player_levels` is dead |
| `sng_wins` | 3 | no SNG result is recorded anywhere |
| `social` → `challenge_1` | 1 | no challenge-sent signal persisted (`share_1` **does** work) |

**24 of 36 are genuinely earnable today.** The other 12 need instrumentation that does not exist.

## Call site: an `AFTER INSERT` trigger on `hand_history`

**Not the `resolve-hand` EF**, which the brief suggested: `resolve-hand` settles **multiplayer
only**. Solo and practice — everything a tester plays — are settled client-side in `results.tsx`
via `record_hand_result_d`. `hand_history` is the **one table both paths write exactly one row to
per hand**, so a trigger there is the only single site covering both.

It is also genuinely unforgeable: the only RLS policy on `hand_history` is `users_own_hh`
(`auth.uid() = user_id`), which has never succeeded for a device-anon client — nothing but a
SECURITY DEFINER RPC can insert. A client cannot skip or replay an unlock.

The call is exception-wrapped so an achievement failure can never roll back the hand that earned
it; failures log to `analytics_events`. **Failures so far: 0.**

## Idempotency

The **pre-existing `UNIQUE (device_id, achievement_id)`** on `achievements` — the same shape as
`uq_hand_net_ref` / `uq_share_reward_ref`, and it already existed. The reward is gated on that
INSERT actually affecting a row (`GET DIAGNOSTICS ROW_COUNT = 1`), so **only the transaction that
created the unlock can pay for it**. `record_reward`'s `p_once => true` is the second layer.

I deliberately did **not** add a new unique index: it would raise inside the trigger, and an
exception there is worse than a duplicate we already cannot create.

**Double-award refused, proven four ways:** a direct second call returned `[]`; a second
`record_hand_result_d` left unlocks at 2, chip rows at 2, balance at 200; chromium played two hands
and stayed at exactly **1** unlock; table-wide duplicate count is **0**.

## Guards

`econ_bind_ok` + `econ_rate_ok` (both asserted present) plus `pg_advisory_xact_lock` per device.
Both **fail open and neither blocks an anonymous caller** — `econ_bind_ok` only refuses a session
claiming a device bound to someone else. That matters: CAPS is anonymous-majority, and a guard that
refused anon would have recreated the very 0/36 this sprint exists to remove.

## Practice counts: YES

Evidence, not preference: **every test device already receives `daily_streak` 500 and
`daily_reward` 30 while playing nothing but practice.** Chips already flow to practice-only
players. The results screen's *"Practice vs bot — XP only, no chips"* describes the **hand's net
chip delta**, not milestone rewards. Counting practice breaks no promise the app makes — and not
counting it would leave a tester at 0/36.

## The third bug — the screen said 0/36 while the row existed

With the wiring working server-side, the browser still showed 0/36.

`achievements.tsx` branched on `sb.auth.getUser()` being truthy. **CAPS signs players in
anonymously**, so `user` is truthy for almost everybody, and it called the user-scoped RPC — which
matches `achievements.user_id`, **NULL on every anonymous unlock**. Server correct, screen empty.

Fixed in three places: only a real account (`user.is_anonymous === false`) takes the user-scoped
branch; `get_achievements_list` now also matches unlocks earned on devices bound to that user; and
`check_achievements` stamps the bound account onto the row when there is one.

Every other `auth.getUser()` call site was checked — `achievements.tsx` was the **only** one
branching a *read* between user- and device-scoped RPCs.

## Five criteria — all pass, both engines

| engine | path |
|---|---|
| webkit/430 | `0/36` → **`1/36 unlocked`** (First Hand) → survives reload → hand 2 → **`2/36`** (First Win) |
| chromium/393 | `0/36` → **`1/36 unlocked`** (First Hand) → survives reload → hand 2 → **still `1/36`** |

The chromium run is the stronger idempotency proof: two hands, exactly one unlock. English only on
both, 0 dialogs, 0 page errors. Chromium needed one retry after a tab crash — the machine's known
memory fault, not the app. **Positive control ran before the negatives**, at DB level, on a device
with exactly one recorded hand.

## Two things I did not decide alone

1. **Eight definitions promise more than `record_reward`'s 2,000 clamp** — `cup_collector` 25,000,
   `cup_diamond` 10,000, `cup_platinum`/`level_20`/`sng_win_20` 5,000,
   `cup_gold`/`win_100`/`play_500` 2,500. They would silently pay 2,000. I surface `record_reward`'s
   `clamped` flag in the award payload rather than paying short in silence, but I did **not** raise
   a shared economy cap unilaterally. All eight are deep-tier and unreachable in a tester round.
2. **`hand_history` writes are lossy** — a fire-and-forget `void (async () => …)` in `results.tsx`.
   On 2026-08-21 a webkit run navigated away before it landed and 1 of 2 hands was never recorded.
   Achievements inherit that. The test now dwells on `/results` so it measures the wiring, not the
   race. **The race is a separate pre-existing defect worth its own fix.**

## The two small things

**Blocked cleanup retried: succeeded.** All three tables the sandbox refused last sprint went
through — 24 `chip_transactions`, 12 `daily_rewards`, 1 `hand_history` → 0/0/0.

**Ten `accessibilityLanguage` sites fixed** — and a correction to handoff 91: **ten** live, not
eleven. The eleventh (`shop.tsx:315`) is inside a dead `{false ? … : null}` branch. The gate above
all of them is `isHE = getLanguage() === 'he'`, always false, so the text was always English and the
tag always wrong.

## Cleanup

9 devices, all machine-paced (spans 0.4s–2m07s; the real player's signature is 13 placements over
**18 minutes**). **0 leftovers** across analytics_events, chip_transactions, achievements,
hand_history, daily_rewards, leaderboard, user_missions, device_identity. `purchases` 0. 0 `test-`
devices. `achievements` back to its **47** historical rows. Real bindings **3**. Real player
`6956-24d1-5ee4` untouched, 59 events intact.

**Nothing else changed:** no `earn_chips` for achievement awards · `delete_user_account` grant not
restored · DEVELOPER and the 7-tap gate untouched · no C5, stake tiers, stakes UI or tournaments ·
MP prompt untouched · no keys · `game`, `multiplayer-game`, `lobby/table`, `gameover` not started.

*(handoff: `vamos_handoffs` id 92 · shipped `main 524c8e1`, `0dc36ca`)*
