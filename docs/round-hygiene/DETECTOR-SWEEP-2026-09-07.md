# The detector, widened and swept over the whole database

**Date** 2026-09-07 · `gxrpunvhjcrzqnitbqah` · every number from a fresh `SELECT`.

---

## First: the purge is done. Verified, not repeated.

```
devices 500 · played 25 · hands 78 · bindings 7 · float 1,004,220 · gap rows 0
v_harness_devices 0 · simulators still present 112 · rooms playing 0
4e45-123f-54b4 (Roye's phone)  leaderboard row 1, binding 1  — KEPT
86c5-7eff-4e6b (human-shaped)  leaderboard row 1            — KEPT
c634-9816-87a6 (the Simulator) leaderboard row 0            — GONE
```

## How a simulator is caught now

`v_harness_devices` has two signals and **both ask "is this a robot?"** — an automation
fingerprint, or a device_id that does not look real. A simulator is not a robot. It reports
`webdriver: false`, carries no Headless or Playwright user agent, and its device_id matches the
real-device pattern exactly. It walked straight through.

The signal that works is `device_model`. `v_simulator_devices` matches
`(simulator|emulator|sdk_gphone|android sdk built)` and `v_harness_devices_v2` is the union — the
view a purge should select from. `tests/harness-simulator-signal.test.ts` pins the rule in **both**
directions against the real device-model strings this database holds, including
`iPhone 12 Pro Max`, so a future widening that would sweep Roye's own phone fails the suite
instead of the round.

⚠️ `v_harness_devices` was deliberately **not** widened in place. Every purge here selects from
that view, which is the right rule — and exactly why folding a new signal into it would silently
turn the next routine run of the same command into a much larger one.

## Run over the whole database — what it finds that it did not before

Every device holding a leaderboard row, classified by the strongest signal present:

| Class | Devices | Chips | With real play |
| --- | --- | --- | --- |
| F · client events but **no fingerprint block at all** | 209 | 418,000 | 11 |
| E · fingerprinted as a real device | 177 | 357,530 | 14 |
| **B · simulator or emulator** | **107** | **214,690** | **0** |
| **D · server-side event only, never rendered a screen** | **6** | **12,000** | **0** |
| **A · no analytics event at all** | **1** | **2,000** | **0** |

⚠️ **My first version of this classification was wrong and I nearly reported it.** `bool_or` over
zero non-null inputs returns **NULL, not false**, and `NULL OR NULL` is not TRUE — so 209 devices
fell into "unclassified", while a cross-check written as `NOT has_flag` filtered the *same* rows
out and returned nothing. Two queries, opposite errors, one NULL. Redone with `coalesce`.

**Class F is not harness.** Its devices are bounded to 2026-06-29 → 2026-08-01 and **11 of them
have real play**. It is everything recorded before the fingerprint block was added to analytics.
Left alone.

### The second class the views miss

**Seven devices took the 2,000-chip starter grant and never rendered a single screen.** One has no
analytics event at all; six have only the server-side `econ_authz`. None is bound, none has a
hand, none has real play. Six arrived in machine-regular bursts — 2026-08-23 at 17:45:44, 17:46:03,
17:46:24 and 17:46:44, twenty seconds apart.

Published as `v_grant_without_session`. ⚠️ **Deliberately NOT part of `v_harness_devices_v2`,** and
this is the important part: **a real phone that crashed on launch, or lost the network right after
the grant call, leaves an identical trace.** The pattern is suspicious; it is not proof of a robot.
A view a purge selects from must never contain a signal that can describe a player whose app
crashed. It is published so it can be looked at, and quarantined so it cannot be swept.

## Anything new found — reported, not deleted

| Finding | Devices | Chips | Action |
| --- | --- | --- | --- |
| Simulators still present | 112 | 214,690 on 107 rows | **Reported. Not deleted.** |
| Grant without a session | 7 | 14,000 | **Reported. Not deleted.** |

Removing the simulators would take devices 500 → about 393 and drop the float by roughly 214,690,
and would change **no hand, no binding, and not the 25**. Worth doing before the numbers are
quoted to anyone outside; not urgent for a round of four. The seven need a decision about what
they are before anything happens to them at all.

## Nothing was deleted this sprint

`devices 500 · played 25 · hands 78 · bindings 7 · gap 0` — identical before and after.
