# CAPS — Three decisions, built and measured (2026-08-21)

Two of the three shipped. The third was **not** built, because the measurement says the instruction
would change nothing and the thing we believed was missing already exists.

---

## 1. Bind on a non-anonymous uid — **built**

Migration `bind_non_anon_uid_and_derive_rescue_threshold`. One branch **added** to `econ_bind_ok`,
after the existing-binding check and before the anonymous continuity path, which is untouched:

```sql
SELECT is_anonymous INTO v_is_anon FROM auth.users WHERE id = v_uid;
IF v_is_anon IS FALSE THEN <bind>; RETURN true; END IF;
```

**Why this carries no land-grab risk** (the justification, preserved in the migration comment): the
attack the continuity rule prevents is *"whoever calls first claims a real player's device."* That
works with anonymous uids because anyone can mint one on demand. It cannot work here — a
non-anonymous uid is produced only by completing a real sign-in as that account holder, so
first-caller-wins requires already owning the account. **There is nothing to grab.**

**Branch proof** — QA copy first, then live, QA copy dropped. Device seeded to the exact shape that
never bound before (leaderboard row present, zero continuity rows):

| run | result |
|---|---|
| live `econ_bind_ok`, non-anon caller, **before** | 0 bindings |
| QA `econ_bind_ok_qa`, same caller and device | **1 binding** |
| live `econ_bind_ok`, non-anon caller, **after** | **1 binding** |
| anonymous sessions A and B, same device | allowed, **not** bound — unchanged |

*Method note:* `updateUser({email})` does **not** clear `is_anonymous` (Supabase needs a confirmed
identity), so the non-anon case was exercised by setting `request.jwt.claims` to a real
non-anonymous uid for one transaction — which is why this proof is SQL-side, not client-side.

> ### Coverage today is **zero**
> No Google sign-in has ever completed on this build, and both currently-bound devices are bound to
> **anonymous** uids. This branch protects **nobody** until the Google callback is verified and the
> prompt ships. It is infrastructure placed ahead of the traffic — not a fix that helps a live
> player today.

## 2. Rescue threshold, derived not literal — **built**

`claim_emergency_chips(p_device_id text)` now computes the threshold instead of testing `chips = 0`:

| term | source | value |
|---|---|---|
| `v_pot` | `app_config.pot_per_board` | 25 |
| `v_min_boards` | **MIN of the keys** of `app_config.complete_bonus_pct_by_boards` | 2 |
| `v_threshold` | `v_pot × v_min_boards` | 50 |

The board map's keys *are* the supported board counts, so the cheapest match falls out of config that
already exists. Missing config refuses (`config_missing`) rather than guessing.

**Literal `50` absent** — verified by regex over the deployed function body: ABSENT.

**Proof on the live function:** 30 chips → ok, 200 granted · 75 chips → `still_have_chips` · exactly
50 → `still_have_chips` (boundary correct — 50 *is* affordable) · foreign session on a bound device →
`identity_mismatch`. Unchanged: 200/day, once-per-day, both guards. **5 of 5** devices at 1–49 are now
eligible; the 21 at zero are unaffected.

### ⚠️ Premise correction — mine to make

**The "21 players stuck" story is wrong.** `claim_low_chip_rescue` already exists, grants **500**
(not 200) to any device below `app_config.min_playable_chips` (100), once per day — and
`get_poker_shop` **calls it automatically on every home load**.

Proven live: seeded a device to 0, called `get_poker_shop` → balance 500, persisted, with a ledger
row and a `chip_rescue_log` row. *(The first read looked like a failure — sibling subqueries in the
same statement read a pre-statement snapshot. Re-read separately, the write was there. Instrument
error, not a bug.)*

So those 21 devices are not stuck; they are **absent**. Anyone who opens the app is healed to 500 the
same second. The emergency path is a real *second* route firing at game-over rather than home load,
and the derived threshold is still correct work — but it is not the rescue of 21 stranded players.

## 3. Trim the top + build the sink — **neither built**

### Current curve

d1 500 · d2 600 · d3–4 750 · d5–6 1000 · d7–13 1500 · d14–29 2500 · d30+ 10000

### Actual minting, all time — 953,900

| day | claims | minted | share |
|---:|---:|---:|---:|
| **1** | **1,825** | **912,500** | **95.66%** |
| 2 | 19 | 11,400 | |
| 3 | 9 | 6,750 | |
| 4 | 7 | 5,250 | |
| 5 | 6 | 6,000 | |
| 6 | 2 | 2,000 | |
| 7–13 | 1 each | 10,500 | |
| **14+** | **0** | **0** | **never reached** |
| **30** | **0** | **0** | **never reached** |

**Trimming the top saves exactly zero.** The 2,500 and 10,000 tiers have never paid out once. The
instruction — trim days 14 and 30, leave the base — would change the minting rate by **0 chips**. I
did not ship it: shipping a change that provably does nothing is worse than not shipping.

**And the "retention hook" framing was also wrong — that one was mine.** 1,793 distinct devices have
claimed day 1; **1,783 of them claimed it exactly once**. Only 10 devices ever lapsed and re-claimed.
**4 players are past day 1 right now.** Best streak ever recorded: 13.

So the daily streak is not a streak. It is a **one-time 500-chip welcome grant wearing a streak
costume**, and it is 95.7% of the largest faucet in the economy. Cutting it means cutting the signup
bonus — a very different decision, and Roye's.

### The catalogue already exists

`chip_config` already carries the cosmetic sinks, priced, active, served by `get_poker_shop`:
**table theme 500 · card back 300 · avatar 200 · emotes 150.**

**What is actually missing is ownership.** `spend_chips` writes **no entitlement**, and `purchases`
(`id, user_id, device_id, item_id, item_type, price, purchased_at`) has **zero rows**. A player who
buys today loses the chips and receives nothing durable — which is why the entire ledger holds 2
`buy_emotes` rows and 1 `buy_avatar`. Adding catalogue rows would sell more nothing.

**Pricing against the float:** 2,457,144 over 1,038 devices = **2,368 average**. The *existing*
catalogue totals **1,150 per device = 48.6%** of the average balance; if ownership worked and every
device bought everything, maximum drain ≈ **1.19M, 48% of the float**. **The prices do not need
raising — the entitlement needs building.**

**Size:** a write in `spend_chips`, a `purchases` read, client gating for four cosmetic families, and
a shop surface that actually grants. More than the remainder of this sprint, so — per the brief's own
instruction — I am saying so rather than shipping half.

> **The number that reframes all of it: 4 players are past day 1.** No sink drains a float nobody is
> spending, and no faucet trim matters when the faucet is a signup grant. The economy is not
> inflationary because it is generous — it is 1,793 signups and almost no play. Fixing the ratio is a
> retention problem wearing an economy costume.

---

**Cosmetics only, no new controls:** confirmed — nothing added to the shop, no setting, no toggle.
**Nothing else changed:** anonymous continuity rule untouched · no cap or faucet raised · no stake
tiers, stakes UI or tournaments · MP prompt untouched · visual audit untouched · no keys · QA
functions dropped · all test rows and test auth users cleaned (0 test devices, 0 test bindings, 0 QA
functions remain).

*(handoff: `vamos_handoffs` id 82)*
