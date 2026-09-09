# Purge before the round — done, and the instrument gap is bigger than one row

**Date** 2026-09-07 · Project `gxrpunvhjcrzqnitbqah` · every number below from a fresh `SELECT`.

---

## Predicted before deleting, then compared. Eleven of eleven.

| Measure | Before | Predicted | Actual | |
| --- | --- | --- | --- | --- |
| Devices (`leaderboard` rows) | 555 | **500** | **500** | ✅ |
| Have played (`games_played > 0`) | 25 | **25** | **25** | ✅ |
| Hands | 98 | **78** | **78** | ✅ |
| Bindings | 30 | **7** | **7** | ✅ |
| Float (chips) | 1,128,120 | **1,004,220** | **1,004,220** | ✅ |
| Gap rows | 0 | **0** | **0** | ✅ |
| Gap total | 0 | **0** | **0** | ✅ |
| `v_harness_devices` | 57 | **0** | **0** | ✅ |
| Simulators still present | 113 | **112** | **112** | ✅ |
| Roye's phone `4e45-123f-54b4` | present | **kept** | **kept** | ✅ |
| Human-shaped `86c5-7eff-4e6b` | present | **kept** | **kept** | ✅ |

⚠️ **Correcting my own number.** Handoff 185 predicted hands would land on **77**. It is **78**.
98 − 20 = 78; the earlier figure was an arithmetic slip in the proposal, not a change in the data.

## What was deleted

58 devices: the 57 in `v_harness_devices`, plus `c634-9816-87a6` — the iOS Simulator — named
explicitly and reported before the purge, because no view held it.

| Table | Rows |
| --- | --- |
| `analytics_events` | 1,244 |
| `chip_transactions` | 211 |
| `referral_links` | 55 |
| `leaderboard` | 55 |
| `daily_rewards` | 53 |
| `player_streaks` | 53 |
| `device_identity` | 23 |
| `user_profiles` | 21 |
| `hand_history` | 20 |
| `achievements` | 16 |
| `heatmap_events` | 10 |

58 `audit_logs` rows record the deletion, one per device.

**Safety, re-confirmed rather than taken from the summary:** all 58 had `games_played = 0`; none
had a single `webdriver=false` event except the simulator, whose evidence is `device_model`; and
the two protected devices were asserted **out of the set** in the query rather than assumed absent
(`protected_in_set = 0` before the run).

## ⚠️ Two defects in `delete_user_account`, found by running it

The first attempt aborted and rolled back cleanly — nothing was deleted. Both defects are in the
app's own account-deletion RPC, the one a real player's "delete my account" would call.

**1. It cannot delete an account that has an auth user.** It writes an `audit_logs` row carrying
`user_id = p_user_id` at the top, then at the bottom runs `DELETE FROM auth.users WHERE id =
p_user_id`. `audit_logs_user_id_fkey` is `NO ACTION`, so **the function's own audit row blocks its
own delete**:

```
ERROR: 23503: update or delete on table "users" violates foreign key constraint
       "audit_logs_user_id_fkey" on table "audit_logs"
CONTEXT: SQL statement "DELETE FROM auth.users WHERE id = p_user_id"
         PL/pgSQL function delete_user_account(text,uuid) line 60
```

Earlier purges never hit it because they only ever deleted **unbound** devices. This is the first
purge with bound accounts in it. ⚠️ **A real user asking to be deleted would hit this today.**

**2. It never touches `device_identity`.** A successful call leaves the binding row behind — so
the count this purge exists to correct would not have moved at all.

**Neither was fixed here.** Changing an account-deletion RPC and an audit-trail foreign key is a
production change of its own, and the brief's line is not to touch security. The purge worked
around both, visibly: `p_user_id` was passed as `NULL`, which skips the failing branch while every
`DELETE` still matches on `device_id`; then `device_identity` and `user_profiles` were cleared for
the same derived set. That the workaround is complete was measured, not assumed — there were
**0 rows** in `analytics_events`, `chip_transactions`, `hand_history` or `leaderboard` keyed to
those users but not to those devices.

**Residue, stated rather than hidden:** 23 anonymous `auth.users` rows for the purged devices
remain. Removing them requires deleting or nulling their own `audit_logs` rows, and an audit trail
is not something to edit to make a cleanup look tidier. They appear in none of the numbers above.

## ⚠️ The instrument gap is 113 devices, not one

This is the real finding, and it is larger than the brief expected.

`v_harness_devices` has two signals and **both ask "is this a robot?"** — an automation
fingerprint, or a device_id that does not look real. A simulator is not a robot. It is a
developer: it reports `webdriver: false`, carries no Headless or Playwright user agent, and its
device_id matches `^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$` perfectly.

Searching on `device_model` instead finds **113 devices** reporting `Simulator iOS`, first seen
**2026-07-06**, of which **108 hold a leaderboard row and 216,920 chips**. **Not one** was in
`v_harness_devices`.

| Simulator devices | 113 | Caught by the old view | **0** |
| --- | --- | --- | --- |
| With a leaderboard row | 108 | With `games_played > 0` | **0** |
| Chips held | 216,920 | Hands contributed | **0** |
| Bindings | 1 (the one purged) | Protected devices hit | **0** |

So they inflate the **device count** and the **float**, and barely touch hands or bindings — the
two numbers the tester round is actually measured against.

### The fix, and why it is a companion view

`supabase/migrations/20260907000000_simulator_devices_companion_view.sql` adds
`v_simulator_devices` and `v_harness_devices_v2`. Proven **before** the purge, while the evidence
still existed:

```
c634-9816-87a6   caught_by_old_view: false
                 caught_by_new_signal: true
                 caught_by_v2: true
4e45-123f-54b4 in v2: false      86c5-7eff-4e6b in v2: false
v1: 57 devices   simulators: 113   v2: 170
```

⚠️ **`v_harness_devices` was deliberately NOT widened in place.** Every purge here is driven by
"select from the view", and that is the right rule — which is exactly why folding this signal into
it would have turned the next routine run of the same command from a 58-device purge into a
170-device one. A decision nobody made, executed by a habit. The signal belongs in the instrument;
the decision belongs to Roye.

`tests/harness-simulator-signal.test.ts` pins the rule in both directions against the real
`device_model` values this database holds — including `iPhone 12 Pro Max`, so a future widening
that would sweep Roye's own phone fails the suite instead of the round.

### Pending decision: the other 112

Not deleted, not recommended either way here. Removing them would take devices 500 → ~392 and the
float down by roughly 216,920, and would change **no** hand, **no** binding and **not** the 25.
Worth doing before the numbers are quoted to anyone outside; not urgent for a round of four.

## The public link, in one sentence Roye can act on

**Anyone who clicks the CAPS TestFlight link today gets an empty page and installs nothing —
every build behind that link has expired.**

**Option A — submit build 515 for Apple's beta review, and the link starts working for strangers.**
Cost: usually under a day, sometimes up to two, and Apple can reject it, most often for missing
test credentials or an unclear "what to test" note. Nothing else changes.

**Option B — turn the link off until there is a reason for strangers to have it.** Cost: nothing.

**Recommendation: B.** The first round is four people Roye knows, and he invites them by email —
they never touch the link. Leaving it on means the one thing a stranger could stumble into is a
door that opens onto nothing, which reads as a broken product rather than a closed one. Turning it
off costs nothing and is reversible in a minute; option A spends a review, and a possible
rejection, on a door nobody is currently walking through. Submit when there is something to
attract strangers to — not before.

⚠️ **Nothing was submitted.** That queue carries his name.
