# The binding jump, 7 → 30 — what the 23 are

**Date** 2026-09-07 · **Project** `gxrpunvhjcrzqnitbqah` · read from the database, not from memory.

---

## The count first, because the premise needs one correction

| Measure | Value | How |
| --- | --- | --- |
| Bindings now | **30** | `select count(*) from device_identity` |
| Bound **before** 2026-09-05 | **6** | Aug 20 ×2, Aug 21 ×1, Aug 28 ×3 |
| Bound **since** 2026-09-05 | **24** | the jump |

The jump is **24, not 23**, and the earlier "7" almost certainly counted `3cde-fc79-2767`
(bound 2026-09-05 17:47) as one of the old ones. It is not — it is the first of the new burst.
The shape of the answer does not change.

## What the 24 are

| Class | Count | Evidence |
| --- | --- | --- |
| **Harness / automation** | **22** | present in `v_harness_devices` via `automation_fingerprint`, and `properties->>'webdriver' = 'true'` on **every** client event |
| **Real iPhone, native build 515** | **1** | `4e45-123f-54b4` |
| **iOS Simulator, native build 515** | **1** | `c634-9816-87a6` |

⚠️ **The mixture check was run per event, not per device.** Four devices once carried both an
automation signal and a human one, and a single sample per device hid it. So every event of every
one of the 24 was counted, not sampled:

- 20 of the 22 automation devices: `webdriver=true` on **100%** of their events, `webdriver=false` on **0**.
- `7843-d106-873f` (2 true, 1 null) and `3cde-fc79-2767` (22 true, 5 null) — the nulls are all
  `econ_authz`, a **server-side** event that carries no client properties at all. Not a second
  human on the device. Both are pure automation.
- The two non-automation devices are the mirror image: `webdriver=false` on **100%** of their
  events and `webdriver=true` on **0**.

**No device in the set carries both signals.**

## The two that are not automation

**`4e45-123f-54b4` — a real phone, and almost certainly Roye's second one.**

```
device_model    iPhone 12 Pro Max
screen          428 × 926
platform        ios      native_version 2.7.0      native_build 515
webdriver       false on all 32 events        ua: null (native app, no browser)
bound           2026-09-07 14:41:22
```

It opened the app, auto-claimed a 30-chip daily bonus, ran the three tutorial steps, dealt a
3-player practice hand, **rage-tapped once on `/game`**, placed one card by tap then used
Auto-Place for the rest, watched the reveal, lost the hand at −131 chips, and then sat on the
results screen for **208 seconds** before reopening the app. That is a person, on build 515,
nineteen minutes after the previous handoff told him to open TestFlight and refresh.

⚠️ Two things in that session are worth more than the binding count: a **rage tap during
placement**, and **208 seconds parked on results**. Both are the app's own instrumentation
reporting friction on the very first hand a real tester played on 515.

**`c634-9816-87a6` — an iOS Simulator, not a phone and not a tester.**

```
device_model    Simulator iOS
screen          402 × 874
platform        ios      native_build 515
webdriver       false on all 4 events
bound           2026-09-07 13:04:44
```

It opened, took the bonus, and sat still for 30 seconds. No automation fingerprint, so
`v_harness_devices` does not hold it — but it is development traffic, not a discovery. It should
be counted with the harness for hygiene, and it is the one row that no existing view will catch.

## Hands, 76 → 98

The 22 new hands are:

| Source | Hands | When |
| --- | --- | --- |
| 10 harness devices, 2 each | **20** | 2026-09-06 22:46 → 23:49 |
| `86c5-7eff-4e6b` — mobile Safari, real iOS 18.7 UA, `webdriver=false`, web build `bc20c299` | **1** | 2026-09-06 22:27 |
| `4e45-123f-54b4` — the real iPhone above | **1** | 2026-09-07 14:41 |

⚠️ `86c5-7eff-4e6b` carries **no automation signal of any kind** and is **not bound** — it has no
`device_identity` row, so it is not part of the binding jump at all. It is a human-shaped web
session on the live build: real Safari user agent, two rage taps, a 39-second pause before placing.
Whose phone it was I cannot tell from the database, and I will not guess.

## Is the round contaminated?

**YES for hands. NO for the played-players count.**

| Number | Contaminated? | Why |
| --- | --- | --- |
| 555 devices | no more than before | `leaderboard` row count; the harness has always inflated it |
| **25 have played** | **NO** | every harness device has `games_played = 0`. Not one of them moved that column |
| **98 hands** | **YES** | 20 of them are harness rows in `hand_history` |
| 30 bindings | **YES** | 22 of them are harness |
| gap 0 | **still 0** | `leaderboard.total_chips` matches the `chip_transactions` sum on every row, 0 rows differ |

The harness footprint across the whole database, not just the recent burst:

```
harness devices                57
  with a leaderboard row       54
  with a binding               22
  chips they hold             121,670
  games_played they moved           0
```

## Cleanup — proposed, NOT executed

⚠️ **Nothing has been deleted.** Reported first, exactly as asked.

The right instrument already exists and is the app's own: `delete_user_account(device_id, user_id)`.
It is `SECURITY DEFINER`, writes an `audit_logs` row, and removes the device from every table that
holds it — `chip_transactions` and `hand_history` included — so the gap invariant is preserved by
construction rather than by a hand-written delete that forgets one table.

Ask the view what exists; never enumerate what you think you created:

```sql
-- the set, derived, not typed
select h.device_id, di.auth_uid
from (select distinct device_id from v_harness_devices) h
left join device_identity di on di.device_id = h.device_id;

-- plus the one device no view catches
select device_id, auth_uid from device_identity where device_id = 'c634-9816-87a6';
```

Then, per row: `select delete_user_account(device_id, auth_uid);`

**Expected after:** bindings 30 → 7 (6 old + the real iPhone), hands 98 → 77, harness devices 0,
gap still 0. `4e45-123f-54b4` and `86c5-7eff-4e6b` are **kept** — one is a real tester on 515 and
the other has no automation signal, and deleting a real session to tidy a number is how a round
loses the only data it wanted.
