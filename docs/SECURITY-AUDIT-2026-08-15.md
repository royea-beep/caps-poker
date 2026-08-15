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

---

# Part 2 — attack surface (FA1, partial)

## Bundle secrets — CLEAN

Live bundle `index-bdb96dec…js`, 3.83 MB. **No `service_role` key, no API secrets, no admin
endpoints.** Two JWTs are present; both decode to the **same** token,
`{"iss":"supabase","ref":"gxrpunvhjcrzqnitbqah","role":"anon"}` — the expected anon key, merely
duplicated by the bundler. One Supabase origin, the project's own.

`secret` ×7, `password` ×55, `Bearer ` ×9 appear as **substrings in library code and UI strings**
(field labels, auth-flow text), not as literal credentials — verified by decoding every JWT-shaped
match. **No source maps** (`sourceMappingURL` count 0), which also pre-answers part of EZ3.

## Headers on `caps.ftable.co.il` — one of six present

| header | status |
|---|---|
| `Strict-Transport-Security` | **present** — `max-age=63072000` |
| `Content-Security-Policy` | **MISSING** |
| `X-Frame-Options` | **MISSING** |
| `X-Content-Type-Options` | **MISSING** |
| `Referrer-Policy` | **MISSING** |
| `Permissions-Policy` | **MISSING** |

No CSP and no `X-Frame-Options` means the site can be framed — clickjacking is available against
any in-app action, and there is no script-source restriction if any injection point exists.

## Storage buckets — one is public

| bucket | public |
|---|---|
| `screenshots` | **TRUE** |
| `bug-recordings` | false |
| `crash-recordings` | false |
| `debug-screenshots` | false |
| `signing-vault-backup` | false |

`screenshots` being public means anything written there is world-readable by URL. Contents not
enumerated. `signing-vault-backup` is correctly private, but a bucket by that name existing at all
is worth Roye knowing about.

## PII — where it is, and an important qualification

Columns matching personal-data patterns, with the **table-level `anon` SELECT grant** and RLS
state. Highest concern first:

| column | RLS | anon SELECT grant |
|---|---|---|
| `push_tokens.token` | on | **granted** |
| `bug_notifications.approval_token` | on | **granted** |
| `account_deletion_requests.ip_address` | on | **granted** |
| `account_deletion_requests.user_display_name` | on | **granted** |
| `bug_reports.tester_name` | on | granted |
| `user_profiles.display_name` · `leaderboard.player_name` · `room_players.display_name` · `club_members.display_name` · `clubs.name` · `game_rooms.host_name` · `hand_history.opponent_name` · `sit_and_go_players.player_name` | on | granted |

**The qualification matters and I am not going to blur it:** `anon SELECT` here is the *table
grant*. **RLS is ON for every one of these tables**, so whether any rows are actually returned
depends on the row policies, which I did **not** enumerate. The grant is a necessary condition for
exposure, not proof of it. `push_tokens.token`, `bug_notifications.approval_token` and
`account_deletion_requests.ip_address` are the three worth proving or disproving first — a push
token is a send-capability, an approval token is an authorisation, and an IP address is
regulated personal data.

## Not reached in FA1

**Reachable-without-a-session enumeration** (which tables/RPCs actually return data to the anon
key over PostgREST) — not run. **Rate limiting** — not probed; nothing proven, and the honest
statement is that I do not know, not that there is none. **Edge Function `verify_jwt`** — not
checked; MEMORY's "6 of 11 false" is unverified. **Branch run** to prove the five economic
functions — not started.

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
