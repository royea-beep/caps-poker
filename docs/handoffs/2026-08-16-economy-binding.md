# 2026-08-16 — The economy accepts any device_id

**No app code changed this run.** Investigation plus probes only; `spend_chips` is deferred to Roye
for the reason below. Nothing deployed.

## Step 1 — `spend_chips`

**Which overload the client calls.** `utils/supabaseEconomy.ts:294-296` sends `p_device_id` (text),
so it resolves to `spend_chips(text, text, integer)`. Its only caller is `app/shop.tsx:139`
(`spendChips(deviceId, item.event_type, item.cost)`).

The `uuid` overload is **not reachable from any client**: its grants are `{postgres, service_role}`
only — no `anon`, no `authenticated`. It already carries the ownership check the device version
lacks (`auth.uid() <> p_user_id → RAISE`). So the guard exists; the client simply cannot get to the
guarded version.

**Does a real spend ever happen while anonymous? YES.**

- `app/shop.tsx:4` states it outright: *"device_id only — no user auth."*
- `chip_transactions`: **43 of 66 `debit` rows have `user_id` NULL**, across 39 devices.
- CAPS is anonymous by default; Google sign-in is only prompted after games 3-5.

**Proven on the wire.** Against a probe wallet I created (never a real player), calling as `anon`
with a `device_id` the caller does not own and has no relationship to:

```
call 1 -> 200 {"ok":true,"success":true,"chips_spent":400,"new_balance":600}
call 2 -> 200 {"ok":true,"success":true,"chips_spent":400,"new_balance":200}
call 3 -> 200 {"ok":false,"reason":"insufficient_chips","required":400,"new_balance":200}
```

1000 → 200 in two calls. Nothing stopped it but the balance running out. No ownership check, no
cap, no idempotency. Probe wallet and its ledger rows deleted.

**Fix: DEFERRED to Roye — deliberately, not by omission.**

The brief's two options resolve like this:

- *Bind to `auth.uid()`* — cannot work. For an anonymous caller there is no server-side identity at
  all, so a passed `device_id` is unverifiable **by construction**. Adding the binding would protect
  only signed-in callers, and an attacker simply would not sign in. It buys nothing.
- *Revoke from `anon`* — would work, and would break the shop for the default user. Anonymous
  spending is not an edge case here; it is the product's normal path and the tester path.

So the honest answer is the one the brief anticipated: **anonymous players do spend, therefore this
is a design decision.** The real options are (a) put spending behind authentication, or (b) leave
the binding open and add a server-side rate limit / per-device spend cap, which is a new control and
Roye's call under the no-new-controls rule. I changed nothing rather than pick for him.

Worth stating plainly: the exposure is now **much narrower than it was this morning**. Harvesting
another player's `device_id` was possible through the four tables closed earlier today. The lock was
fitted; this is the door it protects.

## Step 2 — the other eleven, classified

**No RPC other than `spend_chips` can lower a balance.** Checked structurally across all ten
remaining functions: none contains a `total_chips - …` debit. `spend_chips` is genuinely the only
one that removes value.

| RPC | class | cap, verified by REPEATING the same device_id |
|---|---|---|
| `claim_daily_reward` | GAIN | **CAPPED** — `already_claimed`, `next_claim_at: 2026-08-17` |
| `claim_daily_streak` | GAIN | **CAPPED** — `already_claimed: true`, reward 0 |
| `claim_low_chip_rescue` | GAIN | **CAPPED** — `already_claimed_today`, `next_claim_at` |
| `claim_winback_rescue` | GAIN | **CAPPED BY ELIGIBILITY** — granted 1000 once, then `chips_too_high` |
| `record_reward` | GAIN | **CAPPED** with `p_once` — `already_granted: true`, granted 0 |
| `earn_chips` | GAIN | **NO CAP** — repeat credited again (+100, +100) |
| `submit_score` | GAIN (raise only) | **NO CAP** — repeat credited again (+2000, +2000) |
| `claim_mission_d` | GAIN | **UNTESTED** — `not complete`; needs a genuinely completed mission |
| `claim_share_reward` | GAIN | **UNTESTED** — `unknown_share`; needs a real share id |
| `redeem_referral` | GAIN | **UNTESTED** — needs a valid code |
| `redeem_starter_offer` | GAIN | **UNTESTED** — needs a valid receipt |

**HARM: none of the eleven. GAIN: all of them. NEITHER: none.** `submit_score` raises only, clamps
per call, and never lowers — it cannot hurt the target, but see below.

### The two that are genuinely uncapped

`earn_chips` and `submit_score` each clamp **per call** (1500 and +2000) but have **no per-device
cap and no idempotency**, so an anonymous caller can loop them against any `device_id` and inflate
that wallet without bound. Self-inflation is the obvious use: infinite chips for your own device.
It is not *harm* to the target in the brief's sense — nobody loses anything — but it is unbounded
economy inflation, and it is the second-most consequential finding after `spend_chips`. Not fixed:
the eleven are report-only in this brief.

### A correction to my own probe

My first cap run reported `claim_low_chip_rescue`, `claim_winback_rescue`, `claim_mission_d` and
`claim_share_reward` as **CAPPED**. That was wrong, and the fault was in my verdict rule: I scored
"capped" as *the second call credited nothing*, which is also exactly what a call that **never ran
at all** looks like. Those four had returned `chips_too_high` / `not found` / `unknown_share` — the
eligibility gate fired before any cap was reached, so nothing was tested.

Re-run after making the probe device eligible (balance forced to 0, missions assigned): the two
rescue RPCs then genuinely credited and genuinely refused the repeat, so those two are now real
results. The other two remain untested and are reported as such. Same family as "a test against a
row that does not exist returns success regardless" — here it was "a call that was refused up front
looks identical to a call that was capped".

## Step 3 — the duplicate overloads: **do not drop either**

The brief expected a `record_hand_result_d`-style cleanup. It does not apply — **neither overload is
unused.**

| overload | who calls it |
|---|---|
| `earn_chips(text, …)` | the client, and `sng_eliminate` |
| `earn_chips(uuid, …)` | `add_xp`, `check_winback`, `claim_mission`, `watch_rewarded_ad` |
| `spend_chips(text, …)` | the client (`shop.tsx:139`) |
| `spend_chips(uuid, …)` | `accept_friend_challenge`, `start_quick_poker` |

Confirmed by extracting the call sites from the function bodies, e.g.
`PERFORM earn_chips(p_user_id, 'winback_bonus', winback_chips)` and
`PERFORM spend_chips(p_user_id, 'quick_poker_buyin', buyin)`.

Dropping the `uuid` overloads would break level-up bonuses, winback, mission claims, rewarded ads,
friend challenges and quick-poker buy-ins. Nothing dropped. Resolution is unambiguous anyway: the
client always passes text, and the `uuid` versions are not granted to `anon`/`authenticated`.

## `econ_requires_session`

Still **absent** (`count = 0`), and deliberately so. `econ_authz_probe` exists (1) and is
instrumentation, not a gate — `PERFORM`ed for logging, blocking nothing. Anonymous play is the
default, so a blanket session requirement would break the product. Any gate belongs only where the
identity is load-bearing, which today means `spend_chips` and the two uncapped inflators.

## DB state

Every probe trace removed. Swept **all 27 tables carrying a `device_id`** for `probe-%`:
`leaderboard`, `chip_transactions`, `chip_rescue_log`, `daily_rewards`, `player_streaks`,
`user_missions`, `economy_log`, `analytics_events`, `audit_logs`, `player_levels`,
`player_poker_stats`, `device_cups`, `player_cups`, `achievements`, `heatmap_events`,
`starter_pack_redemptions`, `referral_links` — all zero. No `game_rooms` / `room_players` rows
touched.

## MACHINE

`tsc` exited **-1073741819 (0xC0000005, access violation) with ZERO output** — the crash printed
nothing, which is exactly what "clean" looks like if you read output instead of the exit code. The
correction I made last run caught it on its first outing. No app code changed this run, so there was
nothing new to typecheck; CI remains the verdict. Memory test still not run.

=== STRATEGIST HANDOFF — ECONOMY BINDING ===
spend_chips:
  - which overload does the client call? spend_chips(text,text,int) via
    utils/supabaseEconomy.ts:294-296; sole caller app/shop.tsx:139. The uuid overload is NOT
    granted to anon/authenticated and already has the auth.uid() ownership check.
  - does a real spend ever happen while anonymous? YES — shop.tsx:4 says "device_id only, no user
    auth", and 43 of 66 debit rows in chip_transactions have user_id NULL across 39 devices.
  - fix applied: DEFERRED to Roye. Binding to auth.uid() cannot work — an anonymous caller has no
    server identity, so a passed device_id is unverifiable by construction; it would protect only
    signed-in callers and an attacker would just not sign in. Revoking from anon works but breaks
    the shop for the default user. Real options: auth-gate spending, or add a per-device spend cap
    (a new control = Roye's call).
  - verified on the wire as anon? YES, against a probe wallet I created and deleted:
      call1 {"ok":true,"chips_spent":400,"new_balance":600}
      call2 {"ok":true,"chips_spent":400,"new_balance":200}
      call3 {"ok":false,"reason":"insufficient_chips"}
    1000 -> 200 on a device the caller does not own. Only the empty balance stopped it.
The other eleven — HARM / GAIN / NEITHER:
  HARM: NONE. None of the ten besides spend_chips contains a total_chips debit.
  GAIN: claim_daily_reward, claim_daily_streak, claim_low_chip_rescue, claim_winback_rescue,
        claim_mission_d, claim_share_reward, record_reward, earn_chips, redeem_referral,
        redeem_starter_offer. submit_score raises only (clamped +2000, never lowers).
  - capped, verified by REPEATING the same device_id: claim_daily_reward (already_claimed +
    next_claim_at), claim_daily_streak (already_claimed), claim_low_chip_rescue
    (already_claimed_today), record_reward with p_once (already_granted). claim_winback_rescue is
    capped by ELIGIBILITY not idempotency — the grant lifts the balance past the threshold.
  - NO cap and no idempotency: earn_chips (+100 then +100) and submit_score (+2000 then +2000).
    Per-call clamps only; loopable against any device_id for unbounded inflation. Report-only here.
  - UNTESTED, eligibility never satisfied: claim_mission_d ("not complete"), claim_share_reward
    ("unknown_share"), redeem_referral (needs a code), redeem_starter_offer (needs a receipt).
    NOTE: my first run scored these as CAPPED. That was my probe's fault — "second call credited
    nothing" is also what a call that never ran looks like. Corrected.
Duplicate overloads: client resolves to the TEXT overload. Dropped the unused one? NO — NEITHER is
  unused. earn_chips(uuid) is called by add_xp, check_winback, claim_mission, watch_rewarded_ad;
  spend_chips(uuid) by accept_friend_challenge and start_quick_poker. Dropping either breaks real
  paths. This is NOT the record_hand_result_d situation.
econ_requires_session: still absent (0), deliberately. econ_authz_probe exists but is logging, not
  a gate. Anonymous play is the default; a blanket requirement would break the product.
MACHINE: tsc crashed with 0xC0000005 and printed nothing — the exact failure the last handoff
  flagged, caught on its first outing by checking the exit code. Memory test still not run.
tsc: exit code -1073741819 (CRASH, no verdict). No app code changed this run; CI is the verdict.
HANDOFF: file + vamos_handoffs slug 2026-08-16-economy-binding + chars, code-point match? Y
WHAT I DID NOT CHECK: four RPCs remain untested for caps (claim_mission_d, claim_share_reward,
  redeem_referral, redeem_starter_offer) because each needs a real completed mission / share id /
  code / receipt; I did not test the uuid overloads' behaviour end to end; I did not touch
  Card.tsx:458 TS1355, which still blocks a clean typecheck.
=== END ===
