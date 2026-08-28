# VAMOS CAPS — PLAY-NOT-PRESENCE (2026-08-28)

The faucet now pays for playing. Measured first, changed second, played end to end third.

Branch `claude/vamos-caps-align-celebration-flppo0`. tsc clean · jest **2,654/2,654**.

---

## 1. THE CURRENT SHAPE, WRITTEN DOWN BEFORE ANYTHING MOVED

### 1.1 Every faucet — amount, trigger, cap, cooldown

| faucet | amount | trigger | cap | cooldown |
|---|---|---|---|---|
| **`daily_streak`** (83%) | **500 / 600 / 750 / 1,000 / 1,500 / 2,500 / 10,000** at streak 1 / 2 / 3–4 / 5–6 / 7–13 / 14–29 / 30+ | opening the app | streak caps at 30 | 1/day; a "streak shield" forgives one missed day at streak ≥7 |
| `daily_reward` (2%) | day ≤7: `25+5d` (30…60) · ≤14: `50+5d` · ≤21: `100+5d` · else `200+5d`; **+100/+200/+300/+500** on days 7/14/21/30 | opening the app | day caps at 30 | 1/calendar day, `(device_id, claim_date)` unique |
| `daily_login` (13%) | 50 | — | — | **dead — see §1.4** |
| `hand_won` (0.6%) | ~46 avg | winning | — | — |
| `first_game` | 500 | first game | once | — |
| `low_chip_rescue` | **500** | balance < `min_playable_chips` (100) | 1/day | `granted_date` |
| `winback_rescue` | 1,000 | balance < 50 **and** 24h since last hand | 1 per 7 days | — |
| achievements | 100–1,000 | unlock | once each | — |
| rewarded ads | 100 configured | — | — | **never fired** |

### 1.2 Every sink

| sink | amount |
|---|---|
| **hand buy-in** | `potPerBoard(25) × boards` → **2P = 100 · 3P = 75 · 4P = 50** |
| **rake** | 5% of a positive net, `app_config.hand_rake_pct` — live, not dormant |
| cosmetics | `buy_emotes` 150 each, `buy_avatar` 200 |
| rebuy | 500 |

**The buy-in is not a sink.** It is zero-sum: every chip paid in returns to the winners of the
boards. The only chips genuinely destroyed are the rake and the cosmetics — **500 chips, ever**.

### 1.3 Per-day totals, four behaviours — BEFORE (day 1, 3 players)

| behaviour | chips/day |
|---|---|
| opens and leaves | **+530** (streak 500 + reward 30) |
| plays one hand | **+530** — the hand is zero-sum, EV 0 before rake |
| plays five hands | **+530** — identical |
| loses everything | **+1,030** (530 + rescue 500) |

**Playing changed nothing.** A player and a non-player received the same 530. At streak 30 an
opener receives **10,350 a day** for opening the app, against a 75–100 buy-in. There was no moment
where anyone needed to buy. That, not price and not the storefront, is why purchases are zero.

### 1.4 `daily_login` — dead, and already sealed

110,850 chips, 13% of everything ever minted, last transaction **2026-07-02** — the day
`app/(tabs)/index.tsx:858` removed the call ("HOTFIX 2026-07-02 (economy leak)").

**I planned to add a guard and checked first: one already exists**, in *both* `earn_chips`
overloads:

```sql
IF p_event_type IN ('daily_login', 'daily_reward') THEN
  RETURN ... 'gated', p_event_type || '_retired';
```

So it is dead by a **guard**, not merely by the absence of a caller, and no future caller can
reopen it by typing the string. **Writing the guard I intended would have replaced a working
function with a worse one. Nothing was changed.** The 110,850 already minted are not reversed.

*(That gate blocks the `earn_chips` route only. `claim_daily_reward` is a separate function and
still pays — 2% of the faucet, left alone.)*

---

## 2. THE CHANGE

### 2.1 Where every value lives — `app_config`, not code

| key | value | meaning |
|---|---|---|
| `presence_grant_multiplier` | **0.4** | scales the whole streak ladder; the shape that drives retention is kept, only the magnitude moves |
| `play_grant_per_hand` | **80** | paid for **finishing** a hand, win or lose |
| `play_grant_practice_pct` | **50** | practice pays 40 |
| `play_grant_daily_cap` | **800** | ten paid hands a day |

All four are read **fresh on every call**, so a retune takes effect with no deploy and no build —
which matters because none of these numbers can be validated yet (§4).

### 2.2 One writer

The grant is paid **inside `record_hand_net`**, the existing settlement path — not beside it. That
path already carries `econ_authz_probe`, `econ_rate_ok` (throttle), `econ_bind_ok` (identity), the
±10,000 clamp, a 20,000/day `hand_net` ceiling and per-hand idempotency. A new chip writer would
have been the third dual-writer bug in this project.

A 4-argument overload with **no default** was added and the original 3-argument function kept as a
delegating wrapper. So:

- `results.tsx` for solo hands — unchanged, picks up the grant automatically;
- **`supabase/functions/resolve-hand/index.ts:228`, which settles multiplayer server-side —
  unchanged, picks up the grant automatically**;
- practice is the only client change.

### 2.3 Practice is not starved — and cannot be farmed

Practice previously wrote **nothing** here (`if (!isPracticeGame && !isMultiplayer)`), so moving
the faucet to play would have starved the group that plays most and earns least: someone learning.

Practice now calls the same function with **net 0** and `p_is_practice: true`. The hand stays
chip-neutral exactly as before — no buy-in, no winnings, XP only, Roye's rule unchanged — and the
only chips that move are the grant, at half rate. Real play therefore stays strictly the better
deal, so the grant cannot become a reason to avoid opponents.

### 2.4 Per-day totals, four behaviours — AFTER

| behaviour | before | after | delta |
|---|---|---|---|
| **opens and leaves** | +530 | **+230** | **−300 — the opener is worse off ✓** |
| plays one hand | +530 | +310 | −220 |
| **plays five hands** | +530 | **+630** | **+100 — the player is better off ✓** |
| plays ten hands (cap) | +530 | +1,030 | +500 |
| loses everything | +1,030 | +810 | −220 |

**The two numbers the brief asked for: the opener drops 530 → 230; the player who plays five hands
rises 530 → 630.** Three hands is the break-even point.

### 2.5 A player at zero can always start — exactly how

Three mechanisms, in order:

1. **The grant is paid on a LOSS too.** Proven below: a hand with net −3,000 still paid 80. At 3P
   the buy-in is 75 against an 80 grant, so **playing is net +5 per hand even when you lose every
   board**; at 4P it is +30. Only heads-up is negative (100 in, 80 back = −20/hand).
2. **`low_chip_rescue`** grants 500 whenever the balance falls below `min_playable_chips` (100),
   once per calendar day. 500 covers five hands at 2P or six at 3P.
3. **The balance floors at zero** (`GREATEST(0, ...)`), so no debt is possible.

Worst case — heads-up, losing every hand — is −20 a hand from a 500 rescue: 25 hands before zero,
against a 10-hand daily grant cap. **A player can always start a hand.**

### 2.6 The grind cap, and how it is enforced

**800 chips per device per calendar day** (`play_grant_daily_cap`), enforced by **summing the
ledger**, not by trusting a counter — the ledger is the same table the payout writes to, so the cap
cannot drift from what was actually paid. It is **partial**: the hand that crosses the ceiling is
paid the remainder rather than refused, so the last hand of the day still settles normally.

Three ceilings already sit above it, unchanged: `econ_rate_ok` throttles call volume, the ±10,000
clamp bounds any single hand, and `hand_net` is capped at 20,000/day. Plus **per-hand idempotency**
— a new partial unique index `uq_play_grant_ref` on `(device_id, reference_id)`, mirroring
`uq_hand_net_ref`, so one hand pays one grant forever.

---

## 3. PROVEN — RPC LEDGER AND BOTH ENGINES

### 3.1 The four behaviours, real ledger rows

Run against real RPCs on `caps-e2e-*` devices, then deleted (§5):

| device | streak | reward | play_grant | grant rows | hand_net | rescue | **earned** |
|---|---|---|---|---|---|---|---|
| opener | 200 | 30 | 0 | 0 | 0 | 0 | **+230** |
| one hand | 200 | 30 | 80 | 1 | 0 | 0 | **+310** |
| five hands | 200 | 30 | 400 | 5 | 0 | 0 | **+630** |
| ten+ hands | 200 | 30 | **800** | **10** | 0 | 0 | **+1,030 (capped)** |
| practice | 0 | 0 | **40** | 1 | 0 | 0 | +40/hand |
| loses to zero | 200 | 30 | 80 | 1 | **−3,000** | **500** | balance **0 → 500** |

### 3.2 Guards, each exercised

| guard | evidence |
|---|---|
| **idempotency** | replaying hand id `e2e-1h-a` returned `{duplicate: true, play_grant: 0}` — no second grant |
| **grind cap** | hands 1–10 paid 80 each (=800); hands **11 and 12 paid 0** with `play_grant_reason: "play_grant_cap_daily"`, and the hand still settled `ok: true` |
| **practice rate** | `{practice: true, play_grant: 40}` — exactly `play_grant_practice_pct` of 80 |
| **loss still pays** | net −3,000 → `play_grant: 80`, `new_balance: 0` |
| **throttle / bind** | `econ_rate_ok` and `econ_bind_ok` run on the same path ahead of every call above; each returned `ok:true` having passed both |
| **one writer** | one function, one ledger row per grant; solo and multiplayer both reach it unchanged |

### 3.3 Both engines, in the real app

`tools/verify-play-grant.mjs` plays a practice hand through the app's own controls and asserts the
client actually reaches the writer — because a practice hand that pays nothing *because the client
never called* would pass every server-side test ever written.

```
chromium  reached /results: true
  record_hand_net {"p_device_id":"…","p_net":0,"p_hand_id":"h-…","p_is_practice":true}   PASS
webkit    reached /results: true
  record_hand_net {"p_device_id":"…","p_net":0,"p_hand_id":"h-…","p_is_practice":true}   PASS
```

---

## 4. WHAT THIS DOES NOT FIX

1. **It does not create demand. It creates the possibility of demand.** Chips now track play, so
   they can become scarce — but **there is still no real sink**: the buy-in returns to the winners,
   and only the 5% rake and the cosmetics destroy anything at all. Until something removes chips,
   no faucet change alone makes the shop matter. That is the next item, not this one.
2. **The 1,219,217 chips already outstanding do not move.** No balance was reset, adjusted or
   backfilled. New players meet the new curve; existing balances are what they are. **I am not
   proposing a reset.**
3. **With 26 devices that have ever played a hand, none of these four values can be validated.**
   0.4, 80, 50% and 800 are reasoned from the current curve, not fitted to behaviour. They are in
   `app_config` precisely so the first real cohort can move them without a build.
4. It does not touch the win-count split, the ledger/float reconciliation gap (384,493 chips), or
   the 35 `chip_config` rewards that have never fired — all still open from handoff 120.

---

## 5. STATE

- **Devices cleaned: 5** (`caps-e2e-opener`, `-1hand`, `-5hand`, `-practice`, `-zero`) across
  `leaderboard`, `chip_transactions`, `daily_rewards`, `player_streaks`, `chip_rescue_log`.
  Verified by fresh SELECT: 0 rows remain, `play_grant` rows total **0**, and the float is back to
  **1,219,217 — byte-identical to before this sprint.** They were deliberately *not* named to fall
  into `v_automation_devices`, so they are deleted explicitly rather than left to pollute the real
  figures the way the harness did.
- **Production unchanged where it must be:** `hand_rake_pct` 5, `iap_enabled` false,
  `web_payments_enabled` false, `chip_purchases` 0, missions completed 0, `chip_config` untouched
  at 48 rows. **No price, no clamp, no rake, no cosmetics catalogue changed.** The ±10,000 clamp
  and the 20,000/day ceiling are exactly as they were.
- **No balance reset, no backfill.** `build_history` untouched. No `game_rooms` or `room_players`
  row edited.
- Felt, panels, cues, derivation and every payment flag untouched. iOS build not merged or
  triggered — 509 has not shipped.
- Changed: 3 database functions (1 new overload, 2 replaced), 1 index, 4 `app_config` keys,
  2 client files, 1 verification tool, 1 doc.

### One thing found on the way

`ensure_leaderboard_row` grants a new device **2,000 starting chips and writes no ledger row** —
every test device started at 2,000 with an empty ledger. That is the source of the 384,493-chip
float-versus-ledger gap reported in handoff 120, now identified precisely. Not fixed here (it is
option A from that handoff and needs its own sprint), but it is no longer a mystery.
