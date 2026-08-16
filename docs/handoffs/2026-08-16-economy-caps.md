# 2026-08-16 — All three economy holes closed

Three migrations. **No app code changed** — every guard is server-side, so nothing deployed and no
client code path was added. Refusals reuse shapes the client already handles.

## Every ceiling sized from measured data

| scope | observed max / device / day | p95 | p99 | ceiling chosen | headroom |
|---|---|---|---|---|---|
| `spend_chips` debits | **1800** (9 × quick_poker_buyin) | 800 | 1800 | **5000/day** | 2.8× |
| single debit (any) | **250** ever recorded; priciest shop item **500** | — | 250 | **1000/call** | 2× the priciest item, 4× the largest real debit |
| `earn_chips` credits | **1650** (its own event types only) | 500 | 1000 | **5000/day** | 3× |
| `submit_score` gain | no ledger existed — see below | — | — | **5000/day** | per-call clamp of 2000 unchanged |

The `earn_chips` figure counts **only the event types `earn_chips` itself writes**. Counting every
credit would sweep in `claim_daily_streak`, `record_reward` and the rest, and a real player would
hit the ceiling through no fault of their own.

## Task 1 — `spend_chips`

Two guards, because a daily cap alone would not have stopped the demonstrated attack.

**Per call (1000).** This is the sharper of the two. `p_amount` is client-supplied and was
previously unbounded, so a single call could empty any wallet no matter what the daily total said.

**Per device per day (5000).** Counted from the `chip_transactions` rows this function writes.

Refusals reuse the existing `insufficient_chips` shape — `ok:false, success:false, chips_spent:0`
plus a `reason` — so `utils/supabaseEconomy.ts` maps them to the failure path it already has.

### Verified by exploit, then by play

```
EXPLOIT A — one oversized call:
  {"ok":false,"reason":"spend_cap_per_call","cap":1000,"required":19000,"chips_spent":0}

EXPLOIT B — the original 400-a-time drain loop:
  calls 1-12 succeed (4800 taken)
  call 13: {"ok":false,"reason":"spend_cap_daily","cap":5000,"spent_today":4800,"chips_spent":0}

NORMAL purchases, same function, fresh device:
  500 (priciest shop item)      -> {"ok":true,"chips_spent":500,"new_balance":4500}
  200 (quick_poker buy-in)      -> {"ok":true,"chips_spent":200,"new_balance":4300}
  250 (largest debit ever seen) -> {"ok":true,"chips_spent":250,"new_balance":4050}
```

The heaviest real day on record (1800) is four more such calls — comfortably under the ceiling.

### What this does NOT do — stated plainly

It bounds the damage; it does not make an unverifiable `device_id` safe. A wallet holding **less
than 5000** can still be emptied within a day, because legitimate daily spend (1800 observed) is
already close to a default 2000-chip wallet. **No daily ceiling sized above real play can protect a
wallet smaller than that ceiling.** The residual fix is the one Roye ruled out for now: put spending
behind authentication. What changed today is that theft is bounded at 5000 per device per day and a
one-shot drain is impossible.

## Task 2 — `earn_chips` and `submit_score`

**`earn_chips`** — daily ceiling 5000, counted from its own credits.

```
call 1-3: {"ok":true,"chips_earned":1500}   (4500 total)
call 4:   {"ok":false,"reason":"earn_cap_daily","cap":5000,"earned_today":4500,"chips_earned":0}
after the refusal, a normal 100 credit: {"ok":true,"chips_earned":100}
```

That last line matters: it is a **ceiling, not a lockout**. A player who reaches the cap with a big
win can still bank ordinary credits up to the limit.

**`submit_score`** — it writes `leaderboard` directly and produces no `chip_transactions` row, so
there was nothing to count. Added the smallest possible ledger: `econ_score_gain_daily
(device_id, day, gained)`, RLS on, no policies, no `anon`/`authenticated` grants — a server-side
guard the client never reads.

It **clamps rather than errors**. `submit_score` is called on every results screen as a stats echo;
returning an error there would break a normal screen to stop an abuse it can simply cap. Only the
*raise* is metered — an echo (gain 0) always passes.

```
call 1 asked 3000 -> {"ok":true,"total_chips":3000,"gain_capped":false,"gained_today":2000}
call 2 asked 5000 -> {"ok":true,"total_chips":5000,"gain_capped":false,"gained_today":4000}
call 3 asked 7000 -> {"ok":true,"total_chips":6000,"gain_capped":true, "gained_today":5000}
                      ^ balance stops rising; the extra 2000 is refused
```

`claim_*` and `record_reward` were left alone — already capped and verified.

## Task 3 — the two untested caps: both were already capped

Made the probe device genuinely eligible first, since a refusal at an eligibility gate proves
nothing.

**`claim_mission_d`** — inserted a completed, unclaimed `play_3` mission for today:

```
call 1: {"ok":true,"chips":50,"xp":10}
call 2: {"ok":false,"reason":"already claimed"}
call 3: {"ok":false,"reason":"already claimed"}
```

Idempotent per mission per day via `IF um.claimed`. **Nothing added.** Worth noting separately: it
returns a `chips` figure but does **not** credit the balance itself — the client does. So the RPC is
a claim marker, not a chip mover, which is why it cannot inflate anything on its own.

**`claim_share_reward`** — inserted a real `shared_hands` row:

```
call 1: {"ok":true,"granted":50,"new_balance":1050}
call 2: {"ok":true,"granted":0,"new_balance":1050,"already_claimed":true}
call 3: {"ok":true,"granted":0,"new_balance":1050,"already_claimed":true}
```

Idempotent per share. **Nothing added.** One detail for whoever tests it next: the `p_share_id` is
the `shared_hands.id` column — passing `share_code` returns `unknown_share`, which is exactly the
"eligibility gate, not a cap" trap that made this untestable last run.

## Cleanup

Every probe wallet and ledger row deleted, verified by query. Swept all `device_id`-bearing tables
plus the new guard table for `probe-%`:

```
leaderboard 0 | chip_transactions 0 | user_missions 0 | shared_hands 0 | econ_score_gain_daily 0
game_rooms 11 (untouched) | room_players 0 | bug_reports 250
```

Devices used and removed: `probe-cap2-7z`, `probe-norm-1`, `probe-earn-1`, `probe-sub-1`,
`probe-mis-1`.

## MACHINE

`tsc` completed this time — exit code **2**, one error: the pre-existing `Card.tsx:458` TS1355. No
app code changed this run, so nothing new to typecheck. Memory test still not run; local checks
remain PROVISIONAL and CI is the verdict.

=== STRATEGIST HANDOFF — ECONOMY CAPS ===
TASK 1 spend_chips:
  - observed max debit per device per day: 1800 (9 calls, quick_poker_buyin); p95 800, p99 1800.
    Largest single debit ever: 250. Priciest shop item: 500.
    Ceilings: 1000 PER CALL and 5000 PER DEVICE PER DAY.
    Headroom: 2.8x the observed daily max; the per-call cap is 2x the priciest item and 4x the
    largest real single debit. The per-call clamp matters most — p_amount was client-supplied and
    unbounded, so one call could empty any wallet regardless of a daily total.
  - refusal shape matches insufficient_chips? YES — ok:false, success:false, chips_spent:0, reason.
    No new client code path.
  - EXPLOIT re-run as anon: one-shot 19000 refused immediately (spend_cap_per_call). The 400-a-time
    loop refused at CALL 13 after 4800:
      {"ok":false,"reason":"spend_cap_daily","cap":5000,"spent_today":4800,"chips_spent":0}
  - NORMAL purchase still succeeds:
      500 -> {"ok":true,"chips_spent":500,"new_balance":4500}
      200 -> {"ok":true,"chips_spent":200,"new_balance":4300}
      250 -> {"ok":true,"chips_spent":250,"new_balance":4050}
  - LIMIT, stated plainly: a wallet under 5000 can still be drained within a day, because real
    daily spend (1800) is already near a default 2000 wallet. No ceiling sized above real play can
    protect a wallet smaller than the ceiling. Theft is now BOUNDED, not prevented.
TASK 2 earn_chips + submit_score:
  - earn_chips: observed max/device/day 1650 (own event types only) | ceiling 5000 | loop refused
    at CALL 4 (earned_today 4500). A normal 100 credit AFTER the refusal still lands — ceiling,
    not lockout.
  - submit_score: no ledger existed, so added econ_score_gain_daily (RLS on, no policies, no anon
    grant). Ceiling 5000/day of GAIN; per-call 2000 clamp unchanged. Loop CLAMPED at CALL 3
    (gain_capped true, gained_today 5000, balance stops rising). Clamps rather than errors because
    the client calls it on every results screen as an echo.
  - a real hand still credits normally? YES — normal-size credits and echoes both pass; only the
    excess is refused.
TASK 3 the two untested:
  - claim_mission_d: made eligible by inserting a completed unclaimed play_3 mission for today.
    Repeat refused? YES — "already claimed" on calls 2 and 3. Already capped; nothing added.
    Note: it returns a chips figure but does NOT credit the balance; the client does.
  - claim_share_reward: made eligible by inserting a real shared_hands row. Repeat refused? YES —
    already_claimed true, granted 0. Already capped; nothing added. p_share_id is shared_hands.id,
    NOT share_code — passing the code returns unknown_share, which is what made this untestable.
  - caps added where missing? NONE needed for these two.
CLEANUP: probe wallets and ledger rows deleted? YES, verified by query — leaderboard 0,
  chip_transactions 0, user_missions 0, shared_hands 0, econ_score_gain_daily 0. game_rooms 11
  untouched, room_players 0, bug_reports 250.
MACHINE: tsc completed this run (exit 2, not a crash); memory test still not run.
tsc: exit code 2 — one error, the pre-existing Card.tsx:458 TS1355. No app code changed this run.
HANDOFF: file + vamos_handoffs slug 2026-08-16-economy-caps + chars, code-point match? Y
WHAT I DID NOT CHECK: redeem_referral and redeem_starter_offer still untested for caps (each needs
  a valid code / receipt); I did not exercise a real in-app shop purchase through the UI, only the
  same RPC the shop calls with the same amounts; the uuid overloads of earn_chips/spend_chips are
  uncapped but unreachable by anon and reached only through already-gated callers.
=== END ===
