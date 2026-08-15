# Security audit — 2026-08-15 (PARTIAL: EZ1 only)

Roye's two questions: **can we be attacked**, and **can we be copied**. This document answers a
third of the first one. Scope reached is stated at the bottom; nothing here is a claim I did not
verify against the live database.

## Correction to the known posture — the surface is more than twice what we thought

Every prior brief has said **81 SECURITY DEFINER functions, 13 audited, 68 remaining.** Queried
against `gxrpunvhjcrzqnitbqah` today:

| measure | value |
|---|---|
| SECURITY DEFINER functions in `public` | **169** |
| …that ever consult `auth.uid()` | **19** |
| …that never consult it | **150** |
| …that take a client-supplied identity (`device_id` / `user_id`) | **91** |
| …**anon-EXECUTE-able** | **129** |
| …with the NULL-passthrough guard shape | 2 |

The 81 figure understates the surface by **more than double**, and "68 unaudited" understates the
unexamined remainder by roughly the same. Any plan sized against 81 is sized against the wrong
number.

**The intersection that matters — anon-executable ∧ takes a client identity ∧ never consults
`auth.uid()`: 69 functions.** Full list captured, grouped by blast radius: 12 economic, 18
state-changing, 2 telemetry, 37 read/other.

## This is mostly BY DESIGN, and saying otherwise would be the wrong alarm

MEMORY records the standing rule: *"auth.uid() is NULL for device-anon (CAPS majority), so
ownership checks are a no-op; anon chip-mutating RPCs MUST use cap+idempotency."* So a function
accepting an arbitrary `device_id` is **not** automatically a hole — impersonation is unavoidable
for anonymous devices, and the agreed defence is a cap plus idempotency, not ownership.

The real question is therefore not "who can call it" but **"which of the economic ones actually
carry the defence the rule requires."** That is testable, and I tested it.

## The finding: five economic/state functions have NO idempotency

Checked every anon-callable economic and state-mutating function for idempotency markers
(`ON CONFLICT`, existence checks, dedup), a cap or window, and a time gate:

| function | idempotency | cap/window | time gate |
|---|---|---|---|
| `earn_chips(p_device_id, p_event_type, p_amount)` | **NO** | yes | no |
| `spend_chips(p_device_id, p_event_type, p_amount)` | **NO** | yes | no |
| `add_xp(p_device_id, p_xp, p_source)` | **NO** | yes | no |
| `update_leaderboard_elo(p_device_id, p_won)` | **NO** | yes | no |
| `update_mission_progress(p_device_id, p_type, p_amount)` | **NO** | yes | yes |
| `claim_daily_reward` · `claim_daily_streak` · `claim_share_reward` · `claim_winback_rescue` · `claim_low_chip_rescue` · `claim_mission_d` · `record_reward` · `record_hand_net` · `submit_score` | yes | yes | yes |

The nine `claim_*`/`record_*`/`submit_score` functions follow the standing rule correctly — that
part of the hardening held and is re-verified.

**The five above do not.** They are anon-callable, accept any `device_id`, and carry no dedup, so
a repeated call credits repeatedly. `earn_chips` and `add_xp` take the **amount as a parameter**.
`update_leaderboard_elo` takes `p_won boolean` — the client asserts whether it won.

**Not yet proven exploitable.** Proving it needs a write against a `test-` device, which per
Iron Rule #11 belongs on a branch, and I have not created one (cost unstated, and the brief
requires stating it first). The signature and the absence of dedup are strong evidence, not
proof, and I am labelling them as such rather than asserting a working exploit.

## Ranked by blast radius — what was reached

1. **`earn_chips` / `add_xp`** — anon, arbitrary device, **caller-supplied amount**, no dedup.
2. **`update_leaderboard_elo`** — anon, arbitrary device, client asserts the win.
3. **`spend_chips`** — anon, arbitrary device, no dedup (griefing: drain another device's balance).
4. **`update_mission_progress`** — anon, arbitrary device, no dedup, time-gated only.
5. **The other 64** of the 69 — enumerated and grouped, **not individually examined**.

## Scope actually reached

**EZ1: partial.** 169 enumerated and classified; the 69-function impersonation set identified; the
14 economic/state functions tested for the required defence; five found lacking. The remaining 64
of 69 are grouped but not read individually. No exploitability proven; no branch created.

**EZ2 (attack-surface panel): NOT STARTED.** Bundle secrets, reachable-without-a-session
enumeration, rate limiting, storage buckets, Edge Function `verify_jwt`, HTTP headers, PII — none
of it done.

**EZ3 (can we be copied): NOT STARTED.** No source-map check, no bundle-exposure review, no moat
analysis.

This is roughly a third of one of the two questions Roye asked. Sizing it honestly: EZ2 and EZ3
are each a session, and EZ1's remaining 64 functions are another.

**Nothing was fixed. No revoke, no policy, no header. Read-only queries against production only.**
