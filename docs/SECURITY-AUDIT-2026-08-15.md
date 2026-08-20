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

---

# Part 3 — anon reachability (FB1/FB2, partial)

Tested from a **real anon client over PostgREST** (Node `fetch`, the published anon key lifted
live from the bundle), not from SQL — because the grant is what SQL shows and rows-returned is what
SQL cannot.

## PII tables from a real anon client — the finding DE-ESCALATES

`SELECT * limit 1` on each of the twelve tables holding the flagged columns:

| table | anon result | verdict |
|---|---|---|
| `push_tokens` | 200, **0 rows** | RLS blocks — token NOT exposed |
| `bug_notifications` | 200, **0 rows** | RLS blocks — approval_token NOT exposed |
| `account_deletion_requests` | 200, **0 rows** | RLS blocks — ip_address NOT exposed |
| `bug_reports` | 200, **0 rows** | RLS blocks — tester_name NOT exposed |
| `user_profiles` | 200, **0 rows** | RLS blocks |
| `room_players` | 200, **0 rows** | RLS blocks |
| `hand_history` | 200, **0 rows** | RLS blocks |
| `leaderboard` | 200, **1 row** | player_name, device_id, chips, elo returned |
| `clubs` | 200, **1 row** | club name, owner_device_id returned |
| `club_members` | 200, **1 row** | display_name, device_id returned |
| `game_rooms` | 200, **1 row** | host_name, game_config returned |
| `sit_and_go_players` | 200, **1 row** | player_name, device_id returned |

**The three highest-concern columns from Part 2 — `push_tokens.token`,
`bug_notifications.approval_token`, `account_deletion_requests.ip_address` — return ZERO rows to a
real stranger.** RLS holds where it matters. This is exactly the disclosure the grant could not
confirm or deny, and it de-escalates the PII item from "14 columns exposed" (which would have been
wrong) to "five public-facing tables leak `device_id` alongside display names."

**What does leak, and is worth Roye deciding on:** every one of the five readable tables exposes
`device_id` next to a display name. `device_id` is the impersonation key for the entire anon
economy (Part 1). A stranger can page the leaderboard and harvest a `device_id`↔name map, and Part
1's functions take `device_id` as the identity. The leak and the impersonation surface compound.

## The five economic RPCs — reachable and anon-granted, exploit NOT proven this session

The empty-body probe returned `404 PGRST202` for all five — but that is **PostgREST overload
resolution** (it searched for a zero-argument version and found none), **not** an access block.
Catalog-side, last sprint's `has_function_privilege('anon', …)` already confirmed all five carry
the anon EXECUTE grant, and PostgREST exposes anon-granted functions by name. So the verdict is
**reachable + granted**; a correctly-shaped call from a stranger's browser reaches the function
body.

**What remains unproven is that repeated calls stack** — the idempotency finding from Part 1. That
proof requires a real write, which per Iron Rule #11 goes on the pre-authorised branch.

**I did not run the branch this session, deliberately.** A branch run is create → migrate → register
test device → call → observe → delete → confirm-deletion, and I am close enough to the context
limit that stalling mid-sequence would leave a branch undeleted — production-adjacent infrastructure
running and billing, the exact half-finished state the rules exist to prevent. Deferring it to a
run where it is the first action with full context is the safer call. No cost incurred; the branch
authorisation still stands.

## Rate limiting — NOT PROBED

Still not tested. I prioritised the reachability and disclosure questions, which size the rest.
Unchanged from last sprint: I do not know, rather than "there is none." Supabase provides no
per-RPC rate limiting by default; limiting is the caller's to add. That is a platform fact, not a
probe result, and it is labelled as such.

## Edge Functions `verify_jwt` — MEMORY confirmed exactly

11 active functions. **6 have `verify_jwt: false`:**

| function | verify_jwt | what it is / assessment |
|---|---|---|
| `telegram-bot-handler` | false | **deliberate** — a webhook; Telegram cannot send a JWT |
| `legal` | false | **deliberate** — serves terms/privacy, must be public |
| `log-error` | false | plausibly deliberate — clients log errors before auth; but it is an unauthenticated write endpoint, worth a rate check |
| `analyze-bug-report` | false | **review** — if it does AI/DB work on call, it should not be open |
| `flush-outbound` | false | **review** — sounds like an internal queue flush; open is wrong if so |
| `retriage-pending` | false | **review** — sounds like an internal cron; open is wrong if so |
| `sync-bugs-to-drive` · `whatsapp-bot-handler` · `crash-analyzer` · `auto-fix-crashes` · `anthropic-proxy` | true | gated; `anthropic-proxy` correctly so — it fronts a paid API key |

Two clearly deliberate, one plausibly so, **three worth reviewing** (`analyze-bug-report`,
`flush-outbound`, `retriage-pending`). Not fixed; their bodies not read this session.

## Headers config Roye would need — stated, NOT applied

The cheapest real fix on the whole audit: a `vercel.json` `headers` block, no code, no schema.
It would add, for `/(.*)`:

```
Content-Security-Policy: frame-ancestors 'none'   (closes clickjacking outright)
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

A full `script-src`/`connect-src` CSP is more work and risks breaking the app, so it needs its own
pass; `frame-ancestors` + `X-Frame-Options` alone closes the framing/clickjacking finding and is
safe to ship. **Not applied — this is the deliverable, not the fix.**

---

# Part 4 — branch-proof run (FC1)

## The branch failed, and the test pivoted honestly

Branch `sec-branchproof` (`lsvmztmptnlknjtyrdzw`) was created at the pre-authorised rate, but came
up **`MIGRATIONS_FAILED`** — the database provisioned (`ACTIVE_HEALTHY`) but the migration chain
errored before creating the five functions (`test_devices` and all five absent; `leaderboard`
present, so it failed partway). The dynamic double-call test could not run on it.

Per Iron Rule #4, I **deleted the branch immediately** and confirmed by listing (only `main`
remains). Elapsed ~13 minutes, cost a few cents.

**The double-call is not the only evidence available.** The accumulation question — is there
idempotency — is a property of the function *body*, and the body is readable from production
read-only via `pg_get_functiondef`. That is the **actual executed code**, not a signature guess
(the distinction Iron Rule #14 draws), and I confirmed there are **no triggers** on `leaderboard`,
`chip_transactions` or `user_missions` that could add a dedup the source does not show. This is one
step short of a live double-call — it cannot catch a runtime surprise the code and schema don't
contain — and it is labelled as code-read, not execution.

## `econ_authz_probe` — detection, not prevention (new)

Three of the five open with `PERFORM econ_authz_probe(fn, device_id)`. It is **not a guard**: it
`INSERT`s one `analytics_events` row for the `no_session` and `uid_mismatch` cases and is wrapped
in `EXCEPTION WHEN OTHERS THEN NULL` — *"instrumentation must NEVER break an economy call."* So
every anonymous economy call **is logged** (device_id, function, `no_session`), and **none is
blocked.** Abuse is observable after the fact, not silent — a real mitigating factor, and it is
why the tripwire exists.

## Per-function verdict, from the executed code

| function | accumulates? | bound | note |
|---|---|---|---|
| `earn_chips` | **YES** | `+v_amt` per call, clamped to **≤1500**, event whitelisted | `UPDATE leaderboard SET total_chips = total_chips + v_amt` — no dedup. N calls = N×1500. |
| `spend_chips` | **YES (griefing)** | down to the victim's balance | unconditional decrement; drains any device with a leaderboard row to 0 |
| `update_leaderboard_elo` | **YES** | **+20 per call, unbounded** | client asserts `p_won`; also inflates `games_played`, `wins`, `win_rate`. No dedup. |
| `update_mission_progress` | bounded | `LEAST(progress+amount, target)` | caps at the mission target, but forces `completed=true` without doing the mission |
| `add_xp` (device) | **NO for pure-anon** | returns `{ok:false, no_user}` if the device has no linked account | delegates to the uuid variant only when a user_id exists; that body not read |

**Absurd amount: NOT accepted.** `earn_chips` clamps `v_amt` to `GREATEST(-500, LEAST(1500, …))`.
This corrects the Part 1 worry — "takes the amount as a parameter" is real but **bounded to 1500
per call**, not unbounded. The unboundedness is in the *repetition*, not the per-call amount.

**Asserted win: accepted.** `update_leaderboard_elo` takes `p_won boolean` and applies `+20` on
`true` with no verification.

**Foreign `device_id`: acted on — YES.** No ownership check, and the probe does not block, so a
call operates on whatever `device_id` is passed, provided that device has a `leaderboard` row —
which every player has and which the public leaderboard leaks.

## Verdict

**Accumulation proven (from code) for four of five: `earn_chips`, `spend_chips`,
`update_leaderboard_elo` accumulate without bound across calls; `update_mission_progress`
accumulates but is target-capped. `add_xp` is safe for a pure-anon device.** Not a live
double-call — the branch prevented that — but read from the actual function bodies with the schema
confirmed to hold no compensating trigger.

**What an attacker can do, one sentence:** With any `device_id` harvested from the public
leaderboard, an unauthenticated caller can credit that account up to 1500 chips per call and
inflate its ELO by +20 per call with no cap on repetition, or drain any account to zero — every
call logged by `econ_authz_probe` but none prevented.

---

# Part 5 — economy fix design (FE1/FE2; FE3 deferred)

## FE1 — the caller map (`add_xp` excluded, proven safe)

| function | call site | trigger | award | session? |
|---|---|---|---|---|
| `earn_chips` | `app/shop.tsx:90` | shop rebuy / emergency chips | chips | yes (anon signed in) |
| `earn_chips` | `app/results.tsx:1185` | share a hand — **documented LEGACY fallback** (`:1177`); `claim_share_reward` is the guarded path | share reward | yes |
| `spend_chips` | `app/shop.tsx:139` | buying a shop item | −chips | yes |
| `update_leaderboard_elo` | `app/results.tsx:557` | end of a **non-practice** hand (`:546` — practice is XP-only, never touches the leaderboard) | ±ELO, games, wins | yes |
| `update_mission_progress` | `app/results.tsx:538-540` | end of a hand — `games_played +1`, `games_won +1`, `boards_won +N` (N = 1..4) | mission progress | yes |

Note the per-hand `earn_chips('hand_won')` credit was already **removed** (ECON-SW-P1, `results.tsx:500`),
so `earn_chips` today is only shop + the legacy share fallback.

## FE1.2 — every legitimate caller HAS a session, but there is NO usable binding

`signInAnonymously()` runs at `utils/auth.ts:43`, so every client carries a real `auth.uid()` — the
cheapest fix (ownership via `auth.uid()`) looked available. **It is not.** Measured on production:

| column | rows | that are a real `auth.users.id` |
|---|---|---|
| `leaderboard.user_id` | 764 | **0** |
| `push_tokens.user_id` | 3 | **0** |
| `chip_transactions.user_id` | 4890 | 274 (6%) |

`auth.users` has 2,839 rows (2,837 anon, 2 linked), and the economy tables' `user_id` points at
almost none of them. **The stored `user_id` is a client-generated / legacy id, not the Supabase auth
identity.** So `WHERE device_id = p_device_id AND user_id = auth.uid()` would match **zero rows and
break every legitimate call.** Ownership is not a small fix here — it requires **first building a
`device_id → auth.uid()` binding** (populate going forward, backfill 764 devices), then checking it.

## FE2 — design, per function, with real costs

**`earn_chips` — repetition.** Recommend **idempotency by natural key**, not ownership. The two real
awards already have guarded siblings: share → `claim_share_reward` (keyed on `p_share_id`, already
idempotent), rescue → `claim_low_chip_rescue`. Route the legacy share fallback to the sibling and
lock the `earn_chips` event whitelist to only genuinely self-limiting events (shop rebuy costs real
balance, so it is self-capping). *Cost:* medium — client change at 2 sites + a dedup key. *Breaks if
client not updated:* if a dedup-key param becomes required, old clients omit it → chips stop.

**`spend_chips` — griefing (drain a victim).** Idempotency does not fit — spending legitimately
repeats. **Ownership is the only real fix, and it needs the binding above.** *Interim:* this is pure
griefing (attacker gains nothing, victim loses), lower priority than self-enrichment, and
`econ_authz_probe` already logs it. *Cost:* high (binding infra). *Breaks if client not updated:* an
ownership check breaks every legitimate spend until the client proves the owning session — which
needs the binding first.

**`update_leaderboard_elo` — asserted win + repetition.** Fires only for **non-practice (MP)** hands,
where the room and reveal are server-mediated, so the result is knowable server-side. Recommend
**server-derived from the room result, keyed per hand/room id** — closes both the asserted win and
repetition. *Cheaper interim:* **idempotency per `hand_id`** — one ELO update per real hand; leaves
the win asserted but bounds it to the legitimate hand count. *Cost:* high (server-derived) / medium
(per-hand key). *Breaks if client not updated:* a required `hand_id` param → old clients stop
updating ELO.

**`update_mission_progress` — forces completion.** The exploit is a large `p_amount` (LEAST-capped at
target → `completed=true`). Recommend **deriving the increment server-side from the recorded hand**,
or clamping `p_amount` to the event's legitimate max. *Trap:* `boards_won` legitimately passes N=1..4
(`results.tsx:540`), so a flat clamp to 1 would under-award — the clamp must respect the real per-event
max. *Cost:* medium. *Breaks if client not updated:* a stricter server clamp under-awards the
`boards_won` mission unless the client's semantics match.

## Overarching recommendation

The **complete** fix is the `device_id → auth.uid()` binding + ownership on all four — it is the only
thing that closes `spend_chips` griefing and it simplifies the other three. If a faster tester-round
mitigation is wanted first, ship **per-hand / per-share idempotency on `earn_chips` and
`update_leaderboard_elo`** — that closes the two *self-enrichment* vectors (the ones where an attacker
profits) and leaves only the griefing vector, which is logged. Both are real; the binding is the
right end state.

## FE3 — branch proof DEFERRED, with the reason

296 migrations replay on every branch, and last run's branch came up `MIGRATIONS_FAILED`. Diagnosing
*which* migration fails needs that branch's migration logs — which means creating a fresh branch as
the **first** action of a run with a full context window, per the brief's own "branch first" rule. I
am past that point in this window, and creating one now risks the stall-mid-run state I correctly
avoided last time. The design above is the prerequisite for the branch test anyway — it defines what
the positive and negative controls are. Deferred, not skipped; no cost incurred.

## Leaderboard `device_id` exposure — noted, not designed (per FE4.3)

The other half of the compound finding. It may be the cheaper side: dropping `device_id` from the
anon-readable leaderboard projection (a view or column-level revoke) removes the impersonation *key*
without touching the economy functions at all. Not designed here — its own brief.

---

# Part 6 — close the key (FF1) + the leaderboard-write scare (FF2)

## FF2 first — anon leaderboard writes: the grant is there, RLS blocks it, PROVEN on live

`anon` and `authenticated` both hold `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` on `leaderboard`.
That is alarming until the policies and a live probe resolve it:

- RLS is **enabled**. The write policies — `srv_leaderboard_update`, `srv_leaderboard_delete`,
  `leaderboard_insert_service_only` — are all scoped to **`{service_role}`**. `leaderboard_select`
  is `USING true` for all roles (anon reads, expected). So anon has **no applicable write policy**.
- **Live probe from a real anon client, production:**
  - `INSERT` → **401 / 42501** `new row violates row-level security policy`. Blocked.
  - `UPDATE`/`DELETE` on a **nonexistent** row → 200 / `[]`. *Inconclusive* — 0 rows are eligible
    either way, so this cannot distinguish (the same vacuous-truth trap as the earlier PostgREST
    overload 404).
  - **`UPDATE` on a REAL row** (a harmless same-value no-op, `return=representation`) → **200 with
    empty `[]`.** The row was **excluded by RLS, not updated.** A successful write would have
    returned the row.

**Verdict: anon CANNOT update, delete or insert leaderboard rows.** The grant is present but RLS
denies it — grant necessary, not sufficient, the same principle that de-escalated the PII columns.
Not a finding. The nonexistent-row probe would have looked clean *and* proven nothing; the real-row
representation test is what settles it.

## FF1 — the leaked `device_id`, and the fix reuses code we already have

**Anon projections exposing `device_id`:** `leaderboard`, `clubs`, `club_members`, `game_rooms`,
`sit_and_go_players` (all `SELECT USING true`). The leaderboard is the harvestable one — a ranked,
paged list of every player's `device_id` next to a name.

**Does any client screen need it?** `app/leaderboard.tsx` uses `device_id` for exactly two things,
both the self-marker pattern:
- `item.device_id === myDeviceId` → the "this row is me" highlight (`:59`, `:63`)
- `entry.device_id?.slice(-4)` → a last-4-char display fallback when there is no name (`:22`)

No screen needs *other* players' `device_id`. And the server already computes the self-marker:
`get_leaderboard(p_device_id, p_limit)` (exists, anon-granted) emits `'is_me', (device_id =
p_device_id)` per row — **but it also still emits `'device_id', device_id`,** so routing through it
today would not close the leak. One field is the whole gap.

**Removal design (recommended): reuse + column-revoke, in three coupled parts.**
1. **Server:** drop the `'device_id', device_id` field from `get_leaderboard`'s row objects (keep
   `is_me`). One field removed from an existing function.
2. **Client:** switch `leaderboard.tsx` from `.from('leaderboard').select()` to
   `rpc('get_leaderboard', {p_device_id, p_limit})`; use `is_me` for the highlight; replace the
   last-4 `device_id` suffix with a non-sensitive fallback (rank number, or "Player").
3. **DB:** `REVOKE SELECT (device_id) FROM anon, authenticated` on `leaderboard` (column-level),
   closing the direct-table path too. The SECURITY DEFINER RPC still reads `device_id` internally
   for the comparison; it just never emits it.

**Why column-revoke over a view:** a view without `device_id` cannot compute `is_me` for an anon
caller (no server identity), so it would still need the device_id passed as a parameter — which is
exactly what the RPC already does. The RPC is the view-with-a-parameter, already written.

**Blast radius / what breaks if the client is not updated together:** the current client reads
`device_id` directly for the highlight and the suffix. If the column is revoked before the client
switches to the RPC, the direct `select` fails with a column-permission error → **the leaderboard
does not load**, and both the self-highlight and the name fallback break. All three parts land in
one release (the channel-work lesson).

**The other four tables** (`clubs`, `club_members`, `game_rooms`, `sit_and_go_players`) leak
`device_id` the same way but are not a ranked harvest list. Same pattern; lower priority; noted.

**This closes the compound finding's key half without any binding or backfill** — and it defuses
impersonation for all four economy functions at once, including `spend_chips`, which the interim
economy plan could not close.

---

# Part 7 — DROP-THE-KEY execution (parts 1+2 shipped; part 3 BLOCKED, honestly)

## Shipped and verified

- **Part 1** (`get_leaderboard_drop_device_id`, applied): the RPC no longer emits `device_id`;
  `is_me` and a rank-based `display_name` replace its two client uses; bot filter moved server-side.
  Verified live: payload has `is_me`, no `device_id`.
- **Part 2** (`ce2643e`, web deployed & verified both engines): `getLeaderboard()` routes through the
  RPC; `leaderboard.tsx` uses `is_me` and `display_name`. The screen renders "Player #N" fallbacks,
  no blank names, zero page errors, self-highlight logic intact.

**Order held:** client shipped and confirmed working before any revoke. Never revoke-first.

## Part 3 — the REVOKE is BLOCKED, and watch-it-run is why I know

I applied `REVOKE SELECT (device_id) … FROM anon, authenticated`. The migration **succeeded and did
nothing** — a real anon client still reads `device_id` (`SELECT device_id → 200`, value returned).
Cause: a **column-level REVOKE does not carve a column out of a table-level `SELECT` grant.** anon
holds table-wide `SELECT`, so the column stays readable. The migration is a no-op; the DB is
unchanged (nothing broken, nothing closed).

The correct form is **`REVOKE SELECT ON leaderboard FROM anon, authenticated` then
`GRANT SELECT (<every column except device_id>) …`**. That would work — **and it would break
`app/rank.tsx`**, which reads `leaderboard` at three sites and **filters on `device_id`**:
- `:64` `.eq('device_id', deviceId)` — my own row
- `:73`, `:79` `.not('device_id', 'like', 'bot_%')` — counts

Filtering on a column needs `SELECT` on it, so the column-grant that excludes `device_id` breaks all
three — on **every** client, web and native, until `rank.tsx` is migrated to an RPC in the same
release. That is the "do not break the game" line.

## Honest status of the key

**The app no longer transmits `device_id` through the leaderboard screen — but the raw column is
still anon-readable directly over PostgREST.** So the harvest vector is **not closed at the DB
layer.** Parts 1+2 are real (they remove the in-app UI path and are the prerequisite for the
revoke), but the compound finding's key half is **not** closed until:
1. `rank.tsx`'s three `device_id`-filtered leaderboard reads move to an RPC (e.g. `get_player_rank`
   by device), and
2. `REVOKE SELECT ON leaderboard FROM anon, authenticated; GRANT SELECT (<non-device_id cols>) …`.

Both land in one release. I did not apply the breaking revoke, and the no-op one changed nothing.

## What this closes and what it does not

- **Closes:** the leaderboard *screen* as a device_id source; the client no longer needs or fetches
  the key. Prerequisite done.
- **Does NOT close:** direct PostgREST `SELECT device_id FROM leaderboard` (still 200), and the four
  economy functions still accept any `device_id` obtained any way. This is one half of the compound
  finding and it is not yet sealed at the DB.

## The other four tables (FG3) — same shape, one existing RPC each where it matters

`clubs`, `club_members`, `game_rooms`, `sit_and_go_players` expose `device_id` to anon. Consumers:
`app/club/[code].tsx` and the lobby/table screens. None is a ranked harvest list. Same fix shape —
route reads through an RPC that omits `device_id`, then table-revoke + column-grant — and each has
the same `rank.tsx`-style trap: any client-side filter on `device_id` must move server-side first.
**Not fixed this sprint;** one follow-up brief once the leaderboard+rank pattern is proven end to end.

---

# Part 8 — CLOSE-IT-PROPERLY: the key is closed at the DB (FH1 + FH2 shipped & verified)

## FH1 — rank.tsx migrated off device_id

The three filters, by **intent** (not shape): `:64 .eq(device_id, mine)` = my own row;
`:73 .not(bot_%).gte(elo, mine)` = real players at/above my elo (my position); `:79 .not(bot_%)`
= total real players. `get_player_rank` takes `user_id` and there is no device→uid binding, so it
could not be reused. New RPC **`get_player_rank_by_device(p_device_id)`** (SECURITY DEFINER,
anon-granted) returns those five numbers and **emits no device_id**. SQL-verified equal to the old
output: top real player = rank #1 of 769; a no-row device = elo 1000, `has_row=false` (client skips
`setData`, exactly as the old `if (row)` did). Shipped `5c83acc`; rank screen renders on both
engines, 0 errors, "No rank yet" for a no-row device — the preserved behaviour.

**After FH1, grep confirms zero client code does `.from('leaderboard')`.** Home and profile read the
leaderboard only through SECURITY DEFINER RPCs, which run as the owner and bypass the anon column
grant — so the revoke cannot touch them.

## FH2 — the revoke that works

Restore statement written first: `GRANT SELECT (device_id) ON public.leaderboard TO anon,
authenticated;`. Applied:
```sql
REVOKE SELECT ON public.leaderboard FROM anon, authenticated;
GRANT SELECT (id, player_name, total_chips, hands_played, hands_won, biggest_win, updated_at,
              win_rate, games_played, wins, rank_change, elo, chips, user_id)
  ON public.leaderboard TO anon, authenticated;
```

**On the wire, from a real anon client:**
- `SELECT device_id` → **401 / 42501 permission denied**. Refused.
- `SELECT *` → **401** — PostgREST expands `*` to all columns and errors on the ungranted one, so
  it is *refused* rather than "returned without device_id". Safe, and no client does raw `*` (both
  readers use RPCs). Any future `select('*')` on this table must name columns.
- `SELECT player_name,total_chips` → 200. `get_leaderboard` → 200, no device_id, `is_me` present.
- filter `device_id=not.like.bot_%` → **401** (filtering needs the column grant) — which is exactly
  why rank.tsx had to move first.

**All four leaderboard-reading screens, both engines, post-revoke:** `/leaderboard`, `/rank`, `/`,
`/profile` — **0 page errors, no raw device_id visible anywhere.** Nothing broke; the restore
statement was not needed.

## What is now closed, and what is still open

- **CLOSED:** the leaderboard `device_id` harvest — an anon stranger can no longer read it, over the
  app or directly over PostgREST. The compound finding's **key half is sealed at the DB.**
- **STILL OPEN:** the four economy functions still accept any `device_id` (a device id obtained some
  other way still works), and the **other four tables** still expose `device_id`. The economy fix
  needs the binding project (Part 5); the four tables are the follow-up below.

## FG3 / FH3 — the other four tables (consumers + filter traps; NOT fixed)

| table | anon-reachable consumer | filters on device_id? |
|---|---|---|
| `clubs` | `app/club/[code].tsx` (club header) | via `my_clubs` / `list_club_tables` RPCs — check |
| `club_members` | `app/club/[code].tsx` (member league) | same RPCs |
| `game_rooms` | lobby / `app/lobby/*` | likely direct — audit before revoke |
| `sit_and_go_players` | SNG lobby / results | likely direct — audit before revoke |

Same fix shape (route reads through an RPC that omits `device_id`, then table-revoke + column-grant)
and the **same rank.tsx trap**: any client-side `device_id` filter must move server-side first, or
the revoke 401s the screen. One follow-up brief, now that the leaderboard+rank pattern is proven
end to end on the wire.

---

# Part 9 — four-table wire-check + rate limiting (2026-08-18)

## The four tables: direct access closed, but an RPC re-opens one

Wire, real anon client, published key:

| table | `SELECT device_id` | `SELECT *` |
|---|---|---|
| `club_members` | 401 permission denied | 401 |
| `sit_and_go_players` | 401 permission denied | 401 |
| `clubs` | 400 column does not exist | 401 |
| `game_rooms` | 400 column does not exist | 401 |

Direct table access for all four is refused — the grant is absent, and absence is sufficient. Two
never had the column.

**But the route the grant check cannot see is live.** `get_sng_status(p_session_id uuid)` is
SECURITY DEFINER, anon-EXECUTE, and its players projection is
`SELECT player_name, device_id, chips, is_eliminated, finish_position FROM sit_and_go_players`.
**Proven on the wire:** called with a real session id, it returns **200 with `device_id` in the
players array** (session `292d5afa…`, 6 players). Narrower than the leaderboard harvest — it needs a
valid `session_id` and exposes only that one session's ≤6 players — but it is a real anon `device_id`
leak, and `device_id` is the impersonation key for the four economy functions.

**Four-table item: NOT closed.** The tables are locked; one anon RPC re-exposes one of them. **Not
fixed this run** (stop-and-report per brief). Fix shape when briefed: drop `device_id` from the
`get_sng_status` players projection (the client needs name/chips/is_eliminated/finish_position, not
the id) — the same one-field removal as `get_leaderboard`. Sweep the other anon SNG/club read RPCs
for the same projection first (`my_clubs`, `list_public_tables`, `list_open_tables`,
`club_leaderboard`, `get_sng_activity_feed` all checked this run — none emit `device_id`).

## Rate limiting: none observed, none by default

Probe: `list_public_tables` (read-only, no writes, no accumulation). **400 sequential POSTs over
30.6s = 13.1 req/s sustained, all 200 — no 429, no `Retry-After`, no `ratelimit-*` headers.** Behind
Envoy (`x-envoy-*` present) but no per-RPC limit fired; the loop stopped at its own bound, not a
limit. **Platform default at this tier:** the Supabase Data API has no per-RPC / per-user rate
limiting by default — only coarse network-level gateway protection at far higher rates. Limiting is
the app's to add.

**What it means for the four economy functions:** with no throttle, unbounded repetition is unbounded
*in practice*, not only in principle — `earn_chips` and the others can be called as fast as the
network allows (13+/s from one key). `econ_authz_probe` logs it; nothing stops it.

Nothing built, nothing applied — read-only wire probes and SQL reads only.

---

# Part 10 — SNG leak closed + throttle designed (2026-08-18)

## get_sng_status leak — CLOSED, and the full emitter sweep

**Consumers: zero.** No client code calls `get_sng_status` (the only SNG client call is
`get_sng_activity_feed`, index.tsx:587, which emits no device_id and was untouched). So the field
dropped with no ordering risk and no screen to break. Recreated `get_sng_status`; players projection
is now `player_name, chips, is_eliminated, finish_position` — **device_id removed. Wire-verified**
(same real 6-player session): 200, no `device_id`.

**Full anon-DEFINER `device_id`-emitter sweep — the full set, not the likely set:**

| function | verdict |
|---|---|
| `get_sng_status` | **LEAK** — emitted every player's device_id to any caller with a session id. **FIXED.** |
| `deal_hand` | **NARROW emitter** — other seats' device_ids **only** in the `p_full AND v_is_host` branch (host, own room, the flag-off revert path). Membership-gated, not a harvest. Not fixed — touching it risks the MP revert; own brief. |
| `get_play_of_the_day` | **NARROW emitter** — returns the featured shared-hand's `data` blob wholesale, which carries the sharer's device_id (one/day, anon). Not fixed — needs a consumer check on `data`; own brief. |
| `join_table`, `submit_placements`, `on_app_open` (both), `get_cup_collection_by_user`, `record_club_game`, `get_leaderboard` | **clean** — device_id only in WHERE / INSERT / storage-key / boolean, never in output |

The grant audit cannot see any of these — an RPC is the one path that bypasses it. That is the rule
beside "a grant is necessary but not sufficient": **its absence is not sufficient either, if a
DEFINER function reads on the caller's behalf.**

## Throttle — designed, NOT applied

**Where:** a shared guard `econ_rate_ok(p_device_id)` called at the top of all four economy functions,
backed by a small `econ_rate_counters(device_id, window_start, count)` table. One source of truth, four
one-line call sites. Beats per-function counters (four copies to drift) and a gateway/Edge proxy
(Supabase has no per-RPC limiter; a proxy is a rework and moves the trust boundary).

**Legitimate rate, from `chip_transactions` (5,433 rows):** peak **11/device/min**, 21/hour; p99
4/min, 7/hour; avg 1.61/active min. The attack ran at **780/min (13 req/s) — 70× the peak.** Proposed
cap **30/device/min AND 120/device/hour** — ~3× peak legitimate (costs real players nothing), throttles
the attack 26× (`earn_chips` 1500/call × 30 = 45k/min vs 1.17M/min).

**Fail-open:** if the counter read/write errors, the award proceeds. A throttle is a rate-limiter, not
an auth gate; blocking paying players during a DB hiccup is worse than the logged, bounded,
leaderboard-recoverable abuse it prevents. Fail-open does not widen the identity hole.

**What a throttle does NOT buy:** it limits the **rate** of impersonation, not the **fact**. A leaked
device_id still acts as that device, just slower and more visibly. Only the `device_id → auth.uid`
binding closes the identity hole.

Only `get_sng_status` was changed (a read RPC; device_id dropped). No throttle applied; nothing on the
economy path touched.

---

# Part 11 — two emitters + throttle shipped (2026-08-18)

## get_play_of_the_day — FIXED

Consumer: `app/(tabs)/index.tsx:844` → `setPotd(data)`. The `PotdData` type (`:614`) reads only
`data.cards / pot_won / hand_name` (+ top-level `player`, `views`) — **never `device_id`.** Fix:
`RETURN … 'data', (v_hand.data - 'device_id') …` — strips the one key, keeps everything rendered.
Wire-verified: 200, no device_id, blob otherwise intact. No client change.

## deal_hand — a host CAN read opponents' ids, but the field is functionally used

**Yes:** a seated host calling `p_full=true` receives `'full' = v_deal`, whose `seats` carry every
device_id, and `realtimeMultiplayer.ts:676` **reads** them (`s.device_id === deviceId`) to
distribute/adjudicate cards in the **flag-off revert path**. Unlike the other two emitters, the
field is *functionally consumed* — stripping it breaks host-side adjudication. It is host-only,
own-room, flag-off-only, membership-gated — not a harvest. The right closure is the
`device_id → auth.uid` binding (adjudicate by uid), **not** a field strip. Left standing; `p_full`
is the flag's revert path and must not be deleted. Deferred to the binding project.

## Throttle — built, shipped, proven

**Infra:** `econ_rate_counters(device_id, bucket, window_start, count)` + `econ_rate_ok(p_device_id)`.
Caps **30/device/min AND 120/device/hour**. **Fail-open** on any error / missing id / kill-switch-off.
RLS on, no anon policy (DEFINER-only). Kill switch `app_config.econ_throttle_enabled` (default true).

**Wired** into `earn_chips`, `spend_chips`, `update_leaderboard_elo`, `update_mission_progress` — one
guard line each at the existing `econ_authz_probe` touchpoint, every other line verbatim, each
returning its own refusal shape (`{ok:false, reason:'rate_limited'}` / `0` / void).

**Controls, on the wire:**
- POSITIVE — a fresh device, 11 calls (the observed peak): **all pass.**
- NEGATIVE (`econ_rate_ok`): 40 calls, first false at **#31** (28–33: T,T,T,F,F,F).
- NEGATIVE end-to-end (`earn_chips` amount=1 so the daily cap never trips first): 30 ok, first
  **`rate_limited` at #31** (28–33: ok,ok,ok,rate_limited,rate_limited,rate_limited).
- Smoke: the other three execute cleanly post-rewrite.

**Revert path:** `UPDATE app_config SET value='false'::jsonb WHERE key='econ_throttle_enabled';` —
instant, no redeploy; all four keep working (guard returns true when off).

All synthetic test rows deleted; `econ_rate_counters` back to empty. Pre-existing `test-as1-guard`
(2026-08-01) left untouched — not mine.

**What a throttle does NOT buy:** the *rate* of impersonation, not the *fact*. A leaked device_id
still acts as that device, just ≤30/min and logged. Only the binding closes identity.

Nothing else touched — no client code changed (both fixes and the throttle are server-side; no
consumer read the dropped fields), no deploy needed.

---

# Part 12 — device_id→auth.uid binding: infra built INERT, enable blocked (2026-08-18)

Roye chose option א (build the binding before testers). The mechanism is built **inert and safe**;
enabling it hit a real external blocker that is Roye's to clear.

**Built (all inert):**
- `device_identity(device_id PK, auth_uid, bound_at)` — RLS on, DEFINER-only, 0 rows.
- `econ_bind_ok(p_device_id)` SECURITY DEFINER, anon-granted: switch-off → `true` (allow, bind
  nothing); `auth.uid()` null → `true` (fail-open, Q1); bound → `auth_uid = auth.uid()` (enforce);
  not-bound → **land-grab guard (Q3)**: bind only if new device (no leaderboard row) or the uid has
  continuity (`analytics_events` with this uid+device); else allow-without-bind (no lockout, no
  grab); `EXCEPTION → true`.
- `app_config.econ_binding_enabled = false` — the kill switch, **default OFF**.
- **Not** wired into the four economy functions (pointless while OFF and gated on linkIdentity).

**The blocker (why enable is not done):** enabling safely requires `linkIdentity` so a Google
sign-in keeps the uid (else a bound guest who signs in with Google gets a new uid → locked out —
the exact fear). But the current flow is `signInWithOAuth` (`auth.ts:106/114`, creates a new google
user — both existing linked users have identity_count=1, so `linkIdentity` has never worked here),
and `linkIdentity` requires Supabase "Manual Linking" enabled in the Auth dashboard, which I cannot
read/set via MCP and cannot test headless (a real Google OAuth would require entering credentials,
which I must never do). Per Iron #14 I did not swap the live login flow unverified. The prove+enable
DB steps (flipping the switch, executing `econ_bind_ok`) were also correctly blocked by the
auto-classifier as production-config changes.

**Next, in order:** (1) Roye enables "Manual Linking" in Supabase Auth settings; (2) swap
`signInWithGoogle` → `linkIdentity` (`auth.ts`), ship, test a real Google login keeps the uid;
(3) wire `econ_bind_ok` into the four economy fns (one line each, like the throttle); (4) flip
`econ_binding_enabled=true` (approval), prove on the wire with a signed-in test session, delete
synthetic rows; revert lever = `UPDATE app_config SET value='false'::jsonb WHERE
key='econ_binding_enabled';`.

A binding limits the *fact* of impersonation (the throttle limits only the rate) — but only once
enabled, and enabling is gated on the linkIdentity/dashboard step.

---

# Part 13 — linkIdentity shipped; binding-wiring gated on Roye's Google test (2026-08-20)

Manual Linking is enabled in the Auth dashboard (Roye confirmed), which unblocks the binding.

**linkIdentity swap — shipped (`2d26b56`, Web Deploy green).** `utils/auth.ts` gains
`startGoogleOAuth(client, options)` (same `{data,error}` shape; both web and native routed through
it): anon session present → `linkIdentity({provider:'google'})` (uid **preserved**); already-linked
/ manual-linking conflict → fall back to `signInWithOAuth` (won't break the 2 existing linked
users); no anon session (brand-new user) → `signInWithOAuth`. `merge_guest_to_user` left as-is
(harmless no-op; uid preserved makes it unnecessary).

**The one unsimulatable step — Roye's Google login test (verbatim):** *"On caps.ftable.co.il, first
play one practice hand so you have a chip balance/history. Then Sign in with Google. PASS = same
account afterwards (same chips, hands, rank). FAIL = a fresh/empty account (new uid was created
instead of linked) — do not enable the binding, tell the bot."* I cannot test a real Google OAuth
headless and must never enter credentials.

**Binding wiring — NOT done, gated on that test** (brief section 2: only after the login proves the
uid is kept). `econ_binding_enabled` stays **FALSE**. On PASS: wire `econ_bind_ok` into the four fns
(one line each, like the throttle), prove inert, then a separate approval flips the switch and
proves on the wire.

**Anon-user cost finding:** anonymous `auth.users` = **3,172** (the brief said 2,427 — it grew, and
this session's Playwright runs are a known inflator: each fresh browser context calls
`signInAnonymously`). Only **294 (~9%)** have any analytics activity under their uid; 91% are empty.
`anon_with_leaderboard=0` is confounded (`leaderboard.user_id` ≠ auth.uid). No UA/webdriver column
exists in the DB, so a precise automated count isn't available — the 9%-active proxy is the best
signal. **MAU cost:** anon users count toward Supabase MAU; 3,172 is well within Free (50k)/Pro
(100k), so no immediate cost — but with anonymous sign-in on and no captcha it's growable, and
mostly noise. **Captcha not enabled** (its own brief). Worth watching.

---

# Part 14 — binding proven without Google, and wired inert (2026-08-20)

Both automatable proofs pass (no Google, no credentials):

**Part 1 — the client chooses `linkIdentity`, not a new user.** The code (`auth.ts` `startGoogleOAuth`)
reads `getSession → is_anonymous → linkIdentity`, else `signInWithOAuth`. Endpoints differ (node,
real anon session): `signInWithOAuth` → `/auth/v1/authorize` (generic, separate user);
`linkIdentity` → a **session-bound** Google URL (`accounts.google.com/o/oauth2/v2/auth?…&state=<session>`),
which only resolves because the anon session exists. **No-session fallback:** `linkIdentity` with no
session → `ERROR "missing sub claim"`; `signInWithOAuth` with no session → OK `/authorize`. So the
guard (link only when an anon session is present, else plain OAuth) is correct and can't throw.

**Part 2 — uid preserved on anon→permanent.** An anon user has **0 identities** (0→1 on linking).
`updateUser({email})` (the same "modify current user" machinery as `linkIdentity`) → **uid identical
before/after**; `is_anonymous` flips only after email confirmation. Converting operates on the same
user and never mints a new uid. Both synthetic test users deleted.

**Residual (honest size):** the live Google OAuth callback attaching the identity to the same uid
can't be driven headless (Google + credentials). But it's Supabase platform behavior identical for
every provider, and the part *we* control (choose linkIdentity + session-bound + uid-preserving
machinery) is proven. **Small — a platform formality, not a code risk.** One real Google login would
close it but is no longer needed to de-risk our code.

**Finding — Google login is UNREACHABLE in the live UI.** The home nudge and the results
`LoginPromptModal` were both removed (VAMOS-UNIFY-FINAL), and there is **no** Google button in
settings despite the "settings-only flow" comment. So no player can currently sign in with Google.
The linkIdentity fix is correct but sits on a dead path: (a) the uid-change lockout scenario is
currently moot (nobody can link), making the binding *safer* to enable; (b) "keep your account with
Google" is unavailable — re-adding a sign-in entry is its own brief.

**Wired (inert).** `econ_bind_ok` added to all four economy fns (one guard line each after the
throttle guard, rest verbatim, `reason='identity_mismatch'` / elo 0 / mission void).
`econ_binding_enabled` stays **FALSE**. Inert proven on the wire: `earn_chips` (flag off) →
`{ok:true, chips_earned:1}`, no `identity_mismatch`. Test rows cleaned; `device_identity` back to 0.

**Enable is a separate approval** with a wire proof (flip the flag; prove a bound device rejects a
foreign uid and accepts its own with a signed-in session; revert = one `app_config` UPDATE).

---

# Part 15 — BINDING ENABLED and proven on the wire (2026-08-20)

**Revert, printed before flipping (never needed):**
`UPDATE app_config SET value='false'::jsonb WHERE key='econ_binding_enabled';`

**Gap found and fixed before flipping.** `econ_authz_probe` logs only `no_session` and
`uid_mismatch`, and `uid_mismatch` needs a `p_claimed_uid` that **none of the four functions pass**
— so an `identity_mismatch` refusal would have been **completely unlogged** and a locked-out real
player silent. Added an `analytics_events` insert in `econ_bind_ok`'s false branch (own
`BEGIN/EXCEPTION`, can never break an economy call). Verified firing below.

**Flipped at 2026-08-20 21:26:24.815+03.**

**Four states, real clients with real sessions** (`signInAnonymously`; a raw anon-key fetch has
`auth.uid()=NULL` and cannot test binding). Device `test-bind-mt1uvg3w`:

| # | state | result |
|---|---|---|
| 1 | **POSITIVE CONTROL** — unbound + session A | `{"ok":true,"chips_earned":1}` **and bound** (row -> `5899e471…`) |
| 2 | repeat, same session | `{"ok":true,"chips_earned":1}` — repeat play unaffected |
| 3 | **foreign session B** on the bound device | `{"ok":false,"reason":"identity_mismatch"}` **and logged** (bound_uid vs caller_uid) |
| 4 | no session (raw anon key) | `{"ok":true,"chips_earned":1}` — **fail-open as designed** |

State 3 is the impersonation the whole project existed to close.

**Real gameplay, both engines, binding ON:** practice 2P played through to `/results` —
Chromium `reachedResults=true` (4 pageErrors = known audio autoplay), WebKit `true` (0 errors).
**Honest scope:** practice is XP-only, so it calls `update_mission_progress` (one of the four,
`results.tsx:546-548`) but **not** `earn_chips`/`update_leaderboard_elo` (practice-guarded at
`:557`). So gameplay exercised one guarded function; `earn_chips` was proven on the wire instead.
**Also observed:** the browser gameplay did **not** create a binding row — its call arrived with
`auth.uid()` NULL (fire-and-forget auth) and took the fail-open branch. On web, binding binds
opportunistically only when the session lands in time.

**Watch:** 9m36s, **0 real `identity_mismatch`**, 0 real devices bound. **Qualifier:** real
`chip_transactions` in that window = **0**, so "0 rejections" is a low-traffic sample, not proof
under load. The stronger pre-flip evidence: zero real devices have *ever* called the four functions
without a session (all 5 sessionless devices were `test-%`), and only 2 non-anonymous users exist.

**Reverted: NO.** `device_identity` after cleanup: **0 rows**; all synthetic rows deleted.

**Google entry point — reported, not restored (Roye's product call):** it would go in
`app/settings.tsx` (the "settings-only flow" the removed code references) or a Profile row; cost is
one button + handler calling the existing `loginWithGoogle()`. 2 non-anonymous users out of 3,176 is
fully explained by there being no way in.

**Residual, verbatim, for whoever re-enables Google:** *"The link path is proven in code
(session-bound `linkIdentity`, uid preserved), but the live Google OAuth callback attaching the
identity to the same uid has never been exercised. With binding ON, if that callback ever mints a
new uid instead of linking, a bound player is locked out of their account. Verify one real Google
login end-to-end before shipping a sign-in entry point."*

---

# Part 16 — MP sign-in gate: investigated + designed, nothing built (2026-08-20)

Roye's ruling: sign-in returns **only at Multiplayer**; practice vs bots stays frictionless.

**Phone auth does not exist — it is a purchase decision.** `auth.identities` by provider: **google
only (n=2)**; `auth.users.phone` populated **0**; `phone_confirmed_at` **0**; and **no client code**
(`signInWithOtp`/`verifyOtp`) anywhere. Supabase phone auth needs a paid third-party SMS provider
(~$0.03–0.05/SMS to Israeli mobiles + number rental), every send *and retry* costs, and with
anonymous sign-ups open and no captcha an unthrottled OTP endpoint is a toll-fraud risk.
**Roye decided: Google only.**

**MP entry points — gate these four:** `app/(tabs)/index.tsx:1490` (Home "Play Online"),
`app/(tabs)/play.tsx:65` (Multiplayer Lobby), `app/(tabs)/play.tsx:74` (Quick Private Table),
`app/invite/[code].tsx` (deep link). **Do NOT gate the returns** — `game.tsx:1209`,
`lobby/table.tsx:88,95`, `multiplayer-game.tsx:547,587,641`, `results.tsx:799,831,1432` are all
`router.replace('/lobby')` *after* a game; gating the route would re-prompt a player already in and,
on decline, could trap them in a loop. The gate belongs at the **entry**, not the route.

**MP works today for anonymous users — the gate is 100% new friction.** `join_requires_session=true`
but `join_table` only checks `auth.uid() IS NOT NULL`, which an **anonymous** session satisfies.
`join_identity` telemetry: **117 events — 114 by anonymous users, 0 by linked users**, 3 no-uid. So
every MP join that has ever happened was anonymous; a hard gate would have blocked all 114.
**Roye decided: soft prompt** — "Not now" still enters the lobby.

**Design (next sprint):** reuse `components/LoginPromptModal.tsx` (already calls
`loginWithGoogle()`). Copy: *"Play against real people — sign in to keep your chips, rank and history
across devices."* Buttons: **Continue with Google · Not now**. Shows only for `isAnonymous`, at the
four entries, once per session. **Must not appear** in practice, the tutorial, results, or any
post-game return. **Chips/history are preserved** — `startGoogleOAuth` uses session-bound
`linkIdentity`, upgrading the *same* user, so `auth.uid` is unchanged and chips, leaderboard,
history and the `device_identity` binding all follow.

**Google residual — sharper but now detectable.** With binding live, a callback that mints a new uid
would leave the device bound to the old one → `identity_mismatch` → the player's economy actions
fail. The logging added last sprint makes that immediate instead of silent. **Verify before any gate
ships:** record the device's bound uid → Roye plays a hand and signs in once → confirm
`auth.identities` gained a google row on the **same** uid, `device_identity.auth_uid` unchanged,
chips intact, zero `identity_mismatch`. I cannot drive Google headless.

**Binding watch — now real evidence.** 2h12m since the flip: **0 real `identity_mismatch`, not
reverted**, and unlike the 9-minute sample there was real traffic — **7 real chip transactions and 2
real devices bound**, including `e519-8702-3cc6` (29 transactions, history to 2026-06-25). That
device has a leaderboard row, so it bound only because the **continuity guard** matched its uid —
land-grab protection working on a real player.

Nothing built, no cost incurred, no Auth setting changed, no prompt added to practice.

---

# Part 17 — sign-in was blocked by a live lockout trap (2026-08-21)

**Correction to Part 16.** I reported Google sign-in as "unreachable — no entry point exists". That
was **wrong**. `SideMenu` *has* a "Sign in" item wired to `loginWithGoogle`, and the menu opens from
the top-bar avatar (`index.tsx:1323/1336`, `aria-label="Open menu"`). The item was simply never
**rendered** for anonymous players.

**Root cause + a live trap.** `SideMenu.tsx:179` gated the auth row on `{!user ? …}`, but
`useAuthUser()` returns the **anonymous** Supabase user object, so `user` is truthy for every
anonymous player. Verified live on a fresh browser before the fix: the menu rendered **"SIGN OUT"**
and no "Sign in".

1. The Sign-in entry was never shown to anyone anonymous — **3,176 of 3,185 users**. *That* is why
   only 2 accounts exist, not "no entry point". It also blocked the Google-callback verification
   outright: there was no button to press.
2. **Worse, with binding enforcing:** an anonymous player who taps SIGN OUT loses the anon session,
   gets a **new uid** next launch, while `device_id` stays bound to the **old** uid →
   `identity_mismatch` → their economy calls fail **permanently**. Showing SIGN OUT to an anonymous
   user was a lockout trap, and enabling binding turned it from cosmetic into destructive.

**Fix (`6bc58fe`, Web Deploy success):** the condition only — `!user` → `(!user || user?.is_anonymous)`.
**Verified live on both engines after deploy:** anonymous menu now shows **"🔵 SIGN IN"**, SIGN OUT
gone; linked users still see their name + SIGN OUT.

**Pre-login state recorded** for the callback verification: `e519-8702-3cc6` → bound uid
`6db64e9f…`, 4,875 chips, 5 hands, 29 transactions, 3 hand_history, 0 identities (anonymous);
`7159-1e31-d433` → bound uid `48c36af9…`, 2,530 chips, 3 transactions, 0 identities.

**MP prompt: NOT built** — the brief gates it on the callback verification, which needs one real
Google login. Design unchanged and ready.

**Binding watch:** 0 real `identity_mismatch`, 2 real devices bound, not reverted.

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

---

## Part 18 — Correction: the 30-second sign-in test criterion was not diagnostic (2026-08-21)

**Status at time of writing:** Roye has not signed in yet. `google_identities`=2 (both pre-existing,
0 in the last 12h), `permanent_users`=2, `bound_devices`=2, `identity_mismatch` in 24h = **0**.
Baseline unchanged since Part 17: `e519-8702-3cc6` → `6db64e9f-…` 4,875 chips / 29 txns / 0
identities / anonymous; `7159-1e31-d433` → `48c36af9-…` 2,530 chips / 3 txns / 0 identities /
anonymous.

**The defect (mine).** Part 17 told Roye: *PASS = 4,875 chips, FAIL = 2,530 chips.* Before he ran
it I traced the read path:

| what he would look at | where it comes from | keyed to |
|---|---|---|
| chip count in the header | `store/gameStore.ts:351` — `chips` is in `partialize`, persisted locally under `caps-poker-storage` | the device's local storage |
| leaderboard / rank | `utils/leaderboard.ts:119` — `get_leaderboard({ p_device_id })` | `device_id` |
| hand history | `hand_history.device_id` | `device_id` |

**Nothing on that screen is keyed to `auth.uid`.** So in the exact failure we are testing for — the
callback mints a *new* uid instead of linking — the chip count still reads 4,875. The eyeball test
returns **PASS on a failed link**, and we would ship the MP prompt on top of broken binding. The
criterion also fails the other way: 2,530 is a real device's real balance, so a correct PASS on
`7159-1e31-d433` would read as "FAIL".

**Corrected protocol.** Roye signs in and says "done" — no comparison, nothing to note. The verdict
comes from the DB:

- **PASS** — the new `auth.identities` row with `provider='google'` carries `user_id` =
  `6db64e9f-…` (or `48c36af9-…`), i.e. the **same** uid; that user flips `is_anonymous=false`;
  the `device_identity` row is unchanged; **zero** `identity_mismatch` for his device afterwards.
- **FAIL** — the google row lands on a **new** uid. The device stays bound to the old uid, so his
  next economy call returns `identity_mismatch`. Revert immediately.

**Consolation that follows from the same finding:** because chips and history are device-keyed, a
FAIL does **not** lose his chips. It breaks binding, not his account. The "do not play" caution in
Part 17 was stronger than the evidence warrants — holding off merely keeps the observation window
clean.

**Unchanged:** the MP prompt is still **not built**, correctly gated on this verification.
**Revert lever:** `UPDATE app_config SET value='false'::jsonb WHERE key='econ_binding_enabled';`

*(handoff: `vamos_handoffs` id 75)*

---

## Part 19 — Pre-flight #2: which Google account he picks decides the result (2026-08-21)

Still not signed in; both `google` identities in the DB are old (2026-03-18, 2026-03-30).

**Roye already has a Google user in this project.** `d0cc66b9-e71d-4e5c-8e19-100c3f2b2cdb` /
`royearguan@gmail.com` — `is_anonymous=false`, last sign-in 2026-06-17, **274** `chip_transactions`
under `user_id`, bound to **no** device. (One other pre-existing google user, not his, likewise
unbound.) His playing device `e519-8702-3cc6` is bound to a **different** uid,
`6db64e9f-5e52-409d-afa1-bda38431e7ab`.

**Why that breaks the test.** `linkIdentity` attaches a provider identity to the *current anonymous
user*. If that Google account is already attached to another Supabase user, the server refuses —
it is a conflict, not a link. Two observables, both useless to us:

- **(a)** he returns still anonymous with an error in the callback URL. Most likely on web:
  `linkIdentity` redirects to Google *before* any conflict is known, so the client-side fallback at
  `utils/auth.ts:117` cannot fire. **Inferred, not measured** — I cannot drive Google headless.
- **(b)** he ends up signed in as `d0cc66b9` — a **different** uid from the one his device is bound
  to → `econ_bind_ok` returns `identity_mismatch` → we read FAIL and revert binding that is fine.

Either way the run would not have measured uid preservation, and (b) would trigger a revert of a
healthy system.

**Instruction change, one line:** sign in with a Google account that has **never been used on
CAPS** — explicitly **not** `royearguan@gmail.com`.

**The conflict is not exotic — it is the returning-user path, and it is untested.** Once a player
links Google on device A, then reinstalls or opens device B, that device gets a fresh anonymous uid
while the Google account is already attached to the user from device A. Every such sign-in hits
this same conflict. Today that is 2 people; after the MP prompt ships it is everyone with a second
device. It should be tested deliberately **after** the clean test passes — using
`royearguan@gmail.com` *precisely because* it is already attached — and whatever it does is its own
finding, not a binding failure.

Unchanged: prompt not built; baseline unchanged; `identity_mismatch` 24h = 0; binding not reverted.

*(handoff: `vamos_handoffs` id 76)*

---

## Part 20 — Web Google sign-in could not complete at all; fixed. Plus a retraction. (2026-08-21)

Still not signed in. Baseline unchanged, `identity_mismatch` 24h = 0, binding not reverted.

**The defect.** `utils/supabase.ts` carried `detectSessionInUrl: false` for **every** platform,
added in the original anonymous-auth commit `732a4b3` (2026-04-23) and never revisited. On web that
flag is the only mechanism that turns an OAuth callback into a session — the one explicit callback
handler, `app/_layout.tsx:555`, opens with `if (Platform.OS === 'web') return;`. So on web the user
went to Google, came back, and **nothing consumed the callback**: still anonymous, no error, no
message.

**Corroboration from the data:** both `google` identities in the DB were created *before* that
commit (2026-03-18, 2026-03-30). **Zero since** — across ~4 months and 3,185 users. This, not the
SideMenu bug alone, is why there are only two accounts.

**Fixed and deployed.** `detectSessionInUrl: Platform.OS === 'web'` — commit `0479451`, live bundle
`index-40a02df19629cad7fcdf25367943f02d.js`. Native stays `false`; it exchanges the code itself from
the deep link. `tsc` clean (one pre-existing, unrelated Deno error in `supabase/functions`).

### Retraction — my own commit message overclaims

`0479451` says *"Proven on the wire: loading the live site with `?code=` present fired 19 Supabase
calls and ZERO /auth/v1/token."* **That probe was invalid.** The live bundle sets
`flowType:"implicit"`, so the callback arrives as a URL **hash** (`#access_token=…`), never as
`?code=`, and the implicit flow never calls `/auth/v1/token` at all. I measured an endpoint that
would be silent either way. A follow-up hash probe with a fabricated token was also inconclusive —
the server rejects the fake before anything observable changes.

**So the wire probes prove nothing and I am not citing them.** What stands is the config flag and
its documented meaning, the web-excluded handler, the git history, and the identity-creation dates.
That chain is strong, but it is code-and-data evidence, **not** a wire demonstration. The only real
proof is a genuine Google round-trip — which is exactly the test Roye is about to run.

**What it means for the test:** it could not have succeeded before this fix, on any account. Had he
run it an hour ago he would have come back still anonymous, and the fourth wrong conclusion in a row
would have been *"binding is broken — revert it."*

**Still open, not fixed by this:** the callback **error** path has no UI anywhere — nothing in the
app reads `error` / `error_description` from the URL. The returning-user conflict of Part 19 will
therefore still fail silently. That needs a visible message before the MP prompt reaches testers.

Instruction unchanged: a Google account **never used on CAPS** (not `royearguan@gmail.com`), then
say "done". Prompt still not built.

*(handoff: `vamos_handoffs` id 77)*
