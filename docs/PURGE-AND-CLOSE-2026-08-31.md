# PURGE-AND-CLOSE — 142 devices out, nine tables shut, and one instruction I could not obey

**2026-08-31.** The purge ran, and it took eleven more devices than the brief expected — including
eleven of my own. Nine permissive tables closed, two deliberately left open with named reasons.
And the gap moved, because arithmetic said it had to.

---

## 1 · The purge

### 1.1 The population is 77, not 66 — reported before anything was deleted

Handoff 131 measured **66** harness leaderboard rows holding **96,379** chips. Fresh measurement at
the start of this sprint: **77 rows, 119,299 chips.**

**The extra eleven are mine** — the Playwright sweeps run during CLOSE-THE-SIX itself, on 08-30 and
08-31. The detector counting the person using it is the detector working, and it is also the
clearest argument yet against a hand-maintained list: the population moves while you look at it.

Full frozen set: **142 device ids** — 62 `automation_fingerprint`, 80 `synthetic_device_id`.

### 1.2 Every device checked for real play. None shows any.

Four predicates, any hit = keep: a `hand_history` row · a binding in `device_identity` · a card
placement gap that could be a human hand · a user agent that is neither the Claude desktop app, a
Playwright emulation, nor headless. **Twenty-two devices tripped at least one**, and every one
resolved:

**26 devices carry `Macintosh; Intel Mac OS X 10_15_7`** — Playwright's WebKit default UA, which
the view's string pattern does not match. **All 26 have `webdriver = true`**, so the stronger signal
had them anyway. Not unexplained: my exclusion list was incomplete.

**Four devices are genuine mixtures**, and they are exactly what the cleanup rule exists for —
`f972-050b-7bbd`, `86f3-8423-ed3b`, `83f9-ef93-5114`, `dca6-320a-0b1e` each carry **both** an
automation UA and a human-looking one, with `webdriver` never true. Three independent facts settle
them:

1. The "human" UA is `Linux; Android 14; Pixel 8` on all four — and **that string appears on
   exactly four devices in the entire database, all four of them these.** A real Pixel 8 owner
   would be a fifth device somewhere. There is none.
2. **Zero sessions carry both UAs.** The same persisted `caps_device_id` was reused across separate
   contexts — what a Playwright run with a saved storage state does, and what a human cannot.
3. `f972` has **8 placements with `source: 'tap'`**, which reads as human until you time them.
   Its median gap across 435 placement gaps is **0.004 seconds**; only 35 of 435 exceed one second,
   and those are idle time *between runs*, not pacing.

> ⚠️ **The lesson, and it is the exact inverse of last sprint's.** Then, an `auto_all` burst looked
> like a robot and was one human tap. Here, `source: 'tap'` looks like a human and is a machine.
> **The source label is not the signal — the timing is.** Both readings would have been wrong from
> the label alone.

`dev-s2-host` and `dev-s2-guest` own two `hand_history` rows each. Their ids are synthetic, which
the app cannot produce, so they are the 2026-08-17 multiplayer QA rigs.

**Zero of the 142 appear in `device_identity`.** All six bindings are real people and none was
touched. Nor was any `game_rooms` or `room_players` row — there were none to touch.

### 1.3 Beyond the 66: the footprint reaches eleven tables

Reported before the delete, not discovered after:

| table | rows removed | of total |
|---|---|---|
| `analytics_events` | **2,118** | 10,850 |
| `chip_transactions` | **196** (70,136 chips) | 4,421 |
| `econ_rate_counters` | 142 | 851 |
| `leaderboard` | **77** (119,299 chips) | 562 |
| `player_streaks` | 49 | 1,616 |
| `daily_rewards` | 42 | 539 |
| `heatmap_events` | 8 | 567 |
| `economy_log` | 8 | 340 |
| `hand_history` | 4 | 75 |
| `achievements` | 4 | 158 |
| `chip_rescue_log` | 1 | 1 |
| `device_identity` | **0** | 6 |

The device list was **frozen into a snapshot table first**, and that was not fussiness:
`v_harness_devices` reads the very tables being emptied, so deleting straight from the view would
have shrunk the list as it ran. The snapshot was dropped afterwards.

### 1.4 ⚠️ The gap could not hold, and I said so before deleting

The brief requires the gap to stay at 384,493. **It cannot**, and the reason is worth stating
rather than discovering:

```
harness float  119,299        harness ledger  70,136        difference  49,163
```

The gap **is** unrecorded float — balance no transaction accounts for — and **49,163 of the 384,493
belonged to these devices**. Removing them necessarily removes their share. Deleting only the
leaderboard side would have moved it by the full 119,299, which is worse. Deleting both sides is
the only coherent option, and the remainder is a *truer* number: real players' unrecorded float,
with the test traffic taken out.

So the number was **predicted in advance and verified after**, which is a stronger test than
"unchanged":

### 1.5 After — by fresh SELECT, ten of ten predictions exact

| metric | predicted | after |
|---|---|---|
| leaderboard rows | 485 | **485** ✅ |
| float | 1,161,938 | **1,161,938** ✅ |
| ledger rows | 4,225 | **4,225** ✅ |
| ledger sum | 826,608 | **826,608** ✅ |
| **gap** | **335,330** | **335,330** ✅ |
| analytics_events | 8,732 | **8,732** ✅ |
| hand_history | 71 | **71** ✅ |
| bindings | 6, untouched | **6** ✅ |
| harness ids still visible | 0 | **0** ✅ |
| purchases | 0 | **0** ✅ |

Verified by fresh SELECT, never by counting what was deleted.

---

## 2 · The ledger-adjacent leftovers, in my order of risk

### 2.1 `analytics_events` — first, because it decides who is real

Not merely telemetry. **`econ_bind_ok` reads it** to decide whether an anonymous device has
continuity with a session, and **`v_automation_devices` / `v_harness_devices` read it** to decide
which devices are real. A table anyone with the public key could write to was deciding who counts
as a player and who counts as a robot — you could forge continuity to pass the binding guard, or
forge human-looking events to hide a device from the very purge above.

**Closed, write and read.** Safe, checked four ways: the client has **zero** direct
`.from('analytics_events')` sites and writes only through the `track_event` RPC
(`utils/analytics.ts:235`), which is SECURITY DEFINER; 12 functions read the table and every one is
definer or not anon-callable; the 7 views over it are postgres-owned, so they keep reading whatever
the base policy says. The read side went too — `Public read USING (true)` exposed every device id,
screen and session id to anyone holding the anon key.

### 2.2 `read_own_tx` — the ledger's read side, closed

CLOSE-THE-SIX narrowed the write and said plainly the read was left for a later pass. This is that
pass. `FOR SELECT TO public USING (true)` made the **entire ledger world-readable** — every
device's chip history with timestamps, which is a device-activity feed. Nothing client-side reads
the table, so it closes to `service_role` outright.

### 2.3 The ten permissive tables — eight closed, two open with the exact reason

| table | verdict | reason |
|---|---|---|
| `analytics_events` | **CLOSED** (r+w) | client writes via `track_event` only; readers all definer or postgres-owned views |
| `achievements` | **CLOSED** | 0 client writes; 1 definer writer (`check_achievements`) |
| `daily_rewards` | **CLOSED** | 0 client writes; 1 definer writer |
| `device_cups` | **CLOSED** | 0 client writes; 1 definer writer |
| `economy_log` | **CLOSED** | 0 client writes; **0 writers of any kind** |
| `debug_sessions` | **CLOSED** | 0 client writes; 0 writers of any kind |
| `learning_events` | **CLOSED** | 0 client writes, 0 functions — the web beacon that fed it is **commented out** in `utils/learning.ts`. A dead table with an open door. |
| `starter_pack_redemptions` | **CLOSED** | 0 client writes; 2 definer writers |
| `deploy_log` | **LEFT OPEN** | `scripts/deploy-ota.sh:20` POSTs straight to `/rest/v1/deploy_log` with `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Narrowing breaks OTA deploy logging — **and it fails silently there**, so the breakage would not announce itself. Fix is to move that write behind a definer RPC: a change to the deploy path, not to RLS. |
| `prompt_execution_log` | **LEFT OPEN** | `log_prompt_invocation` is **SECURITY INVOKER** (`prosecdef = false`) and granted to anon, so it inserts *as the caller* and depends on this policy. The app never calls it — zero references in `app/ components/ utils/ hooks/`. Fix is to make that function definer, which wants its own review. |

Four further tables — `bug_reports`, `crash_reports`, `heatmap_events`, `shared_hands` — were never
in this set: the client writes to them directly (7 / 3 / 2 / 1 call sites), so their permissive
INSERT is load-bearing until those writes move behind RPCs.

**The proof that makes all of it safe** is the same one that carried the chip_transactions fix:
every table is owned by `postgres` with `relforcerowsecurity = false`, so RLS never applied to a
SECURITY DEFINER function owned by postgres. Checked per table rather than assumed — **non-definer
writers: zero on every table closed.**

### 2.4 Tested from outside, and the app tested with it

`tests/verify-permissive-tables-closed.mjs`, live against production with the public anon key:

```
1 · MUST REFUSE — direct anon INSERT
   analytics_events · chip_transactions · achievements · daily_rewards · device_cups ·
   economy_log · debug_sessions · learning_events · starter_pack_redemptions   → 9/9 refused 42501

1b · MUST REFUSE — anon SELECT
   analytics_events · chip_transactions                                        → 2/2 refused

2 · MUST STILL WORK — the app's own paths
   track_event · record_hand_net · earn_chips · claim_daily_reward ·
   claim_daily_streak · record_hand_result_d · claim_low_chip_rescue ·
   claim_winback_rescue                                                        → 8/8 ran

  tables still accepting anon writes/reads that should not : none
  app paths broken by the closures                         : none
```

> **My own probe failed the project's own rule, once.** The first run sent `{session_name}` to
> `debug_sessions` — a column that does not exist — and got a **400 schema error**, which I very
> nearly recorded as "still accepts". A 400 is not a closed door and it is not an open one either;
> it is a request that never reached the policy. Re-shaped with the table's real NOT NULL columns,
> it returns 42501. **That is the same rule I wrote last sprint, turned back on me.**

### 2.5 `claim_low_chip_rescue` — guarded, and it was two functions, not one

The brief named one. Reading the catalogue rather than the note, **`claim_winback_rescue` is in
exactly the same state and grants twice as much** — 1,000 chips against 500. Neither called
`econ_authz_probe`, `econ_rate_ok` or `econ_bind_ok`, and every other chip-granting function in this
database opens with those three lines.

**What was actually exposed, without inflation.** Neither is a free tap: each refuses unless the
balance is under a floor (100 / 50), each is once per device per day / per seven days via
`chip_rescue_log`, winback additionally needs 24 hours of inactivity, and since CLOSE-THE-SIX an
attacker cannot mint the leaderboard row they would need. What was missing was the **throttle** —
without `econ_rate_ok` a caller can hammer these at any rate, probing device ids for one that
qualifies — and the **visibility**: without `econ_authz_probe` a refusal leaves no trace.

Both now carry all three. Amounts, thresholds, locks, return shapes and Hebrew messages are
byte-identical.

---

## 3 · The structural backup — cost, coverage, and what is actually at risk

### 3.1 The size of the drift, measured

| | |
|---|---|
| migrations recorded in the database | **359** |
| migration files in the repo | **24** |
| a fresh branch replays to | **5 tables, 0 functions** — against 72 and 188 live |
| live objects never named in any migration statement | 4 tables · 1 view · 7 functions · 12 policies |
| also live, and not in the history | 31 cron jobs · 14 triggers · 100 policies |

**335 of 359 migrations exist only inside the database's own history table** — applied through the
dashboard or the API, with no file in version control and therefore never reviewed as a diff. That
is precisely how `insert_tx` (a world-writable ledger) came to exist and how the 2026-05-17
lockdown came to be written and never applied.

*The "never named" counts understate the gap: a name appearing in some migration does not mean the
object was created there.*

### 3.2 What repair would take — reported, not attempted

**The realistic repair is not to fix 359 migrations. It is to squash to a baseline.**

1. `pg_dump --schema-only` of the live database, committed as one `00000000000000_baseline.sql`.
2. Replace `supabase_migrations.schema_migrations` with that single entry.
3. Replay it into a fresh branch until it comes up green — **that green replay is the exit test**,
   and without it the work has not been done.
4. Require every future change to go through a file. That is the part that keeps it fixed.

**Cost: about half a day of focused work and one development branch.** The fiddly parts are
predictable: a Supabase dump needs hand-editing for extensions, `auth`/`storage` references,
ownership and grants, and **the 31 cron jobs will not come across in a `public`-schema dump** — they
need to be scripted separately. It needs the database password, which I do not have and should not.

### 3.3 Do managed backups cover recovery? Probably — and I cannot verify it from here

**What I can verify:** development branches are creatable on this organisation and cost
$0.01344/hour — I created and dropped one last sprint. **Supabase does not offer branching on the
free tier**, so the org is on a paid plan, and paid plans carry automatic daily physical backups.

**What I cannot verify from here, and will not assert:** the retention window, and whether
Point-in-Time Recovery is enabled. Both live in the dashboard under Database → Backups. **That is a
sixty-second check and it is Roye's to make.**

### 3.4 What is actually at risk today, plainly

**Not disaster recovery.** If the database were lost, Supabase's managed backups are almost
certainly what restores it — not the migration history, which could not rebuild it anyway. Framing
this as "no backup" would be wrong.

**What a broken history definitely costs is two things:**

1. **Branch-based QA — and Iron Rule #11 depends on it.** Last sprint the ledger fix had to be
   tested on a *hand-built* approximation because the branch came up with 5 tables and 0 functions.
   That worked because the fix turned on one mechanism I could reproduce exactly. The next change
   may not be so cooperative, and there is no branch to try it on.
2. **Review.** 335 changes reached production without ever being a diff. Every finding in the last
   three sprints that took the form "this was applied straight to the database and nobody saw it"
   is this cause.

**The honest ranking:** this is not urgent, it is *chronic*. It is not going to lose data. It is
going to keep producing findings like the ones this series has spent three sprints on.

---

## 4 · `starter_pack` — recorded where it cannot be missed

Not added: pricing is Roye's and payments are off. **Recorded in three places** so it cannot be
missed from any direction someone would approach it:

- **`docs/PAYMENTS-GO-LIVE.md`** — new, and it leads with this blocker.
- **`docs/PAYMENT-VERIFICATION-2026-08-22.md`** — the trust-boundary design doc, cross-linked at
  the top.
- **`supabase/migrations/20260831130000_earn_chips_stops_paying_for_purchases.sql`** — the migration
  that closed the old credit path, cross-linked in its header.

**And it is two missing packages, not one.** `chip_store_packages` holds
`small / medium / large / premium / mega`. The client buys **`starter_pack`** (`app/shop.tsx:74`)
and **`starter_pack_2x`** (`components/StarterOfferModal.tsx:40`). Neither exists, so
`credit_purchase` would answer `unknown_package` — **after the money has already left the
provider**, with the client showing *"Purchase received — chips did not arrive."*

---

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `hand_rake_pct` **5** ·
`presence_grant_multiplier` **0.4** · `play_grant_per_hand` **80** · `play_grant_practice_pct` **50**
· `play_grant_daily_cap` **800** · `min_playable_chips` **100** · `starter_pack_chips` **5,000** ·
`starter_pack_2x_chips` **10,000** · `econ_binding_enabled` **true** · `econ_throttle_enabled`
**true** · `mp_server_adjudication_enabled` **true** — all read back after the work, all unchanged.
**Daily missions still inactive: 0.** No art, felt, panel, cue or colour touched — **not one file
under `app/` or `components/` was modified this sprint**. `KILL_Board` and `KILL_game` still `true`.
Nothing merged, no build dispatched, nothing to App Store Connect.

**State after everything, by fresh SELECT:**

```
leaderboard 485 rows · 27 devices have played · hand_history 71 · float 1,161,938
ledger 4,225 rows / 826,608 · GAP 335,330 · bindings 6 · purchases 0
harness ids still visible 0 · probe residue 0
```
