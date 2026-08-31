# CLOSE-THE-SIX — five closed, one retired, two of my own claims corrected

**2026-08-31.** The ledger was open when this sprint started. It is not now.

---

## 0 · Two corrections first, because they change what the other findings mean

**(a) The unnamed control was not the bot's card.** VERIFY-EVERYTHING named
`components/Board.tsx:796` — the bot's face-down card — as the only unnamed interactive element
in a 33-route sweep. **Wrong.** I matched the sweep's 28×33 unnamed div to a Pressable I found by
*reading the source*, instead of asking the page which element it was. I labelled that Pressable,
rebuilt, re-measured, and the count did not move: still 16 unnamed per cell. Dumping the DOM
settled it in one look — `<div tabindex="0">` around a dashed 36×42 box. **The empty card slots**,
four per board, sixteen in a two-player hand.

**(b) "Not one row in the whole database has `webdriver=true`" was wrong.** There are **565 such
events across 46 devices**, and `v_automation_devices` returns **50** device ids today. The query
behind that claim was scoped to a filtered subset — the devices in a card-placement timing
analysis — and I generalised its `false` into a statement about the whole table. That is Iron
Rule #8, and I broke it. The view was never blind in the way I said. It *is* blind in two other
ways, measured below.

Both were caught the same way: by measuring the thing again instead of trusting the write-up.

---

## 1 · The ledger — closed

### What was open, and where it came from

`chip_transactions` carried `insert_tx FOR INSERT TO public WITH CHECK (true)`. Any holder of the
anon key — which ships inside the web bundle and the iOS binary — could insert an arbitrary ledger
row.

**Neither `insert_tx` nor `read_own_tx` appears in a single statement in
`supabase_migrations.schema_migrations`.** They were applied straight to the database, outside the
migration history, and were never reviewed as a diff.

**And the repo has believed this was fixed since 2026-05-17.**
`supabase/migrations/20260517000000_audit_rls_lockdown.sql` is committed, makes this exact change
("Only allow insert via service role … no client-direct writes"), and **was never applied** — the
applied history jumps `20260516115223` → `20260517123843`. A fix in the repo, absent from the
database, for fifteen weeks.

### The migration

`20260831120000_ledger_insert_service_role_only` —

```sql
DROP POLICY IF EXISTS insert_tx ON public.chip_transactions;
CREATE POLICY insert_tx_service_only ON public.chip_transactions
  FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.chip_transactions FROM anon, authenticated;
```

**The `TRUNCATE` grant deserves its own sentence, and an honest one.** `anon` held
`DELETE, INSERT, TRUNCATE, UPDATE` on the ledger, and **TRUNCATE is not subject to RLS** — Postgres
filters SELECT/INSERT/UPDATE/DELETE and not TRUNCATE. That sounds like "anyone could erase the
ledger". It is not: PostgREST exposes no TRUNCATE verb, and Supabase does not expose the anon role
over a direct Postgres connection, so the grant was **latent, not live**. It should still not have
existed, and a policy fix that left it in place would have been relying on PostgREST's surface
rather than on permissions.

### Tested on a branch, with a BEFORE — Iron Rule #11

Branch **`close-the-six-ledger`** (`agjcjsakasapbsfvbwmv`), **created and dropped**.

An "after" alone proves nothing: it would pass identically on a database where the bug never
existed, which is exactly what a fresh branch is. So the branch first reproduced production's two
policies verbatim and the attack had to **succeed**:

| phase | anon direct INSERT | SECURITY DEFINER writer |
|---|---|---|
| **before** (`insert_tx` present) | **201** — forged +1,000,000 row landed | 200, inserted |
| **after** (fix applied) | **401 / 42501** permission denied | 200, **still inserted** |

> **The branch could not rebuild production, and that is worth saying rather than hiding.** Supabase
> builds a branch by replaying the migration history; this one came back **`MIGRATIONS_FAILED`**
> with **5 tables and 0 functions** — it stopped around the fifth migration. **The project's
> migration history does not rebuild the database.** So the test bed was reproduced by hand: the
> exact columns, the two production policies read out of `pg_policies`, the real grants, and a
> SECURITY DEFINER writer owned by `postgres`. Those are the only things the outcome turns on.

### Why it cannot break a writer — proved, not argued

All fifteen writers are `SECURITY DEFINER` owned by **`postgres`**, which **owns** the table, and
`chip_transactions` has `relforcerowsecurity = false`. **Postgres does not apply RLS to a table's
owner unless FORCE is set** — so these policies have never applied to any of them. And nothing
client-side writes here: `grep -rn "from('chip_transactions')" app/ components/ utils/ hooks/`
returns three comments and zero insert sites.

**Then every one of them was called anyway.** Ten are reachable with the public anon key; the
other five were exercised through the SQL path and the leaderboard trigger:

| writer | reached by | outcome |
|---|---|---|
| `record_hand_net` | anon | ✅ wrote `hand_net` +120, `rake` −6, `play_grant` +80 |
| `earn_chips(text,…)` | anon | ✅ wrote `first_game` +100 |
| `record_reward` | anon | ✅ wrote `share_hand` +50 |
| `spend_chips(text,…)` | anon | ✅ wrote `rebuy_500` −25 |
| `claim_daily_streak` | anon | ✅ wrote `daily_streak` +200 |
| `claim_daily_reward` | anon | ✅ wrote `daily_reward` +30 |
| `claim_share_reward` | anon | ✅ ran (`unknown_share` — its own rule) |
| `claim_emergency_chips(text)` | anon | ✅ ran (`still_have_chips`) |
| `claim_winback_rescue` | anon | ✅ ran (`chips_too_high`) |
| `claim_low_chip_rescue` | anon | ✅ ran (`chips_too_high`) |
| `credit_purchase` | service role | ✅ wrote `purchase_chips` +2,000 |
| `ledger_starting_grant` | leaderboard trigger | ✅ wrote `starting_grant` +2,000 |
| `claim_emergency_chips(uuid)` | service role | ✅ wrote `emergency_chips` +200 |
| `earn_chips(uuid,…)` | service role | ✅ wrote `first_game` +100 |
| `spend_chips(uuid,…)` | service role | ✅ wrote `rebuy_500` −25 |

**Writers blocked by the change: 0 of 15.** Ten distinct event types landed rows.

### The attack, re-run against production

```
POST /rest/v1/chip_transactions   {"amount":1000000,"event_type":"AUDIT_RLS_PROBE",…}
  -> 401  {"code":"42501","message":"permission denied for table chip_transactions"}
```

### The same shape elsewhere — it is a pattern, and here is the whole of it

**Fifteen tables** carry a permissive INSERT policy for `public`/`anon` with `WITH CHECK (true)`.
They are not equal, and the split is what matters:

| group | tables | verdict |
|---|---|---|
| **fixed** | `chip_transactions` | closed today |
| **client writes here by design** — narrowing breaks the app | `bug_reports`, `crash_reports`, `heatmap_events`, `shared_hands` | leave, or move to an RPC first |
| **no client writer, and an anon INSERT succeeded (201)** | `achievements`, `analytics_events`, `device_cups`, `economy_log` | **open** |
| **no client writer, refused only on a NOT-NULL/column error** — i.e. a correctly-shaped row would land | `daily_rewards`, `debug_sessions`, `deploy_log`, `learning_events`, `prompt_execution_log`, `starter_pack_redemptions` | **open** |

*A 400 is not a closed door and is not counted as one.* Every one of those six answered with a
schema error, never a permission error.

**None of the ten open ones can mint chips**, and that is the reassuring part — but two have real
consequences:

- **`achievements`** — `check_achievements` uses this table as its *idempotency record*. A forged
  row therefore **denies** a player the achievement's chips rather than minting any. A denial-of-
  reward, not a mint.
- **`analytics_events`** — feeds `econ_bind_ok`'s continuity check *and* `v_automation_devices`.
  Forged rows could influence a binding decision, or hide a harness device from the detector.

**`hand_history` is closed** (`42501`), and that matters: its `trg_hand_history_achievements`
trigger is the one path from a forged row to real chips, and `USING (auth.uid() = user_id)` shuts
it to an anonymous caller. *A signed-in user inserting a row under their own `user_id` is a
narrower open question — reasoned from the catalogue, **not exercised**, because testing it needs
an account and account creation is outside what I may do.*

---

## 2 · `earn_chips` with no session — half design, half hole

**The finding was one sentence and it needed to be two.**

### Not a hole — the anonymous path, working as designed

CAPS is a device-anonymous product. Essentially every device plays without an account, so
`econ_bind_ok` returning `true` when `auth.uid() IS NULL` is **deliberate and correct**. The
gameplay grants are *supposed* to be reachable that way, and they are already fenced by four
server-side controls, all measured working: an event-type allowlist, a server-owned clamp (my
caller-supplied `999999` came back as `1500`), a 5,000/day per-device cap, and a 30/minute throttle
that refused on call 31. **Requiring a session here would lock out the players the product is built
for.** Retired as a finding, loudly.

### A hole — the two purchase-shaped event types

`iap_starter_pack` and `starter_pack_2x` are not gameplay grants. They are the credit half of a
**real-money purchase**: the device resolved a RevenueCat purchase and then *told the server it
happened*, and the server paid 5,000 chips on that say-so.

**This project already built the replacement and already deployed it.** Migration `20260822145848`
says so in its own header: *"Today the client calls earn_chips('iap_starter_pack') after a purchase
resolves ON THE DEVICE. There is no proof a payment happened."* `verify-purchase` (verify_jwt on,
HMAC over the raw body) and `credit_purchase` (service_role only) are the verified path, and eight
attacks against them were refused last sprint. **The old door was simply left open beside the new
one.**

`20260831130000_earn_chips_stops_paying_for_purchases` — the two types now return
`purchase_not_verified`. Nothing else in the function changed: same signature, same guards in the
same order, same allowlist, same clamp, same cap.

### Anonymous players still reachable — proved, with no session

```
MUST REFUSE   iap_starter_pack  →  {"ok":false,"reason":"purchase_not_verified"}   ✓
              starter_pack_2x   →  {"ok":false,"reason":"purchase_not_verified"}   ✓

MUST STILL WORK — all 15 gameplay event types, public anon key, NO SESSION
  hand_won · first_game · share_hand · quick_poker_win · rebuy_500 · streak_5_wins ·
  sit_n_go_win · buy_emotes · buy_avatar · emergency_chips · low_chip_rescue ·
  daily_streak · hand_win · quick_poker_buyin · quick_poker_buy_in
                                                    →  all 15 {"ok":true}          ✓

  real-money grants still paying : 0
  gameplay grants locked out     : 0 of 15
```

**No client is affected today.** The only caller — `app/shop.tsx:95 handleBuyStarterPack` — is
behind `Platform.OS !== 'web' && isIapEnabled()` (`app/shop.tsx:233`), and `iap_enabled` is
`false`.

> ⚠️ **One thing this does not fix, and it must be done before `iap_enabled` is flipped.**
> `credit_purchase` resolves packages from `app_config.chip_store_packages`, whose ids are
> `small/medium/large/premium/mega`. **There is no `starter_pack` entry**, so the verified path
> would answer `unknown_package` for the RevenueCat starter pack. Adding one is an economy *value*
> change — Roye's call, not this sprint's.

---

## 3 · The three small ones

### 3.1 Privacy Policy and Terms of Use — 44pt effective

**Before 68×12 and 65×12. After 92×44 and 89×44**, at 320/375/393/430, on Chromium and WebKit —
sixteen cells, all ≥ 44. The before numbers are read back out of
`docs/verify-everything/full-loop.json`, not retyped from the report.

**Fixed with real box height, not `hitSlop`, and the distinction is the whole point.**
`react-native-web` implements `hitSlop` **only in its legacy `Touchable` export** — grep its dist,
the string does not appear in `Pressable` at all, and `Pressable` is what this app uses. A target
"fixed" with `hitSlop` stays 12pt on web while looking correct on iOS. `minHeight: 44` grows the
box, so the same number is true on both platforms and a harness can see it. 44 is deliberately not
run through `rs()`: a responsive scale would put it *under* 44 on a 320pt screen, the one size that
needs it most.

### 3.2 The unnamed control — named, and it was not what I said it was

See §0(a). The elements are the **empty card slots** (`EmptySlotAnimated`, `components/Board.tsx`),
sixteen of them in a two-player hand.

**Named, not de-focused, and a card *is* a control here** — tapping a slot is how a card gets
placed; it is the primary interaction of the placement screen. It announces board *and* position,
because "button" sixteen times tells a screen-reader user nothing about where the card is going:

> *"Board 1, empty slot 1 of 4. Select a card first."* — and *"Tap to place the selected card
> here."* once a card is held, mirroring the active border a sighted player reads.

**After: 0 unnamed controls, 16 named slots per cell**, both engines, all four widths.

*The bot's face-down card genuinely had no name either, so that label is kept — but it is not
focusable during placement, so it is **unverified in this state** and is not claimed as fixed.*

### 3.3 `hand_history.player_count` — what it invalidates, stated before the fix

`record_hand_result_d(p_device_id, p_won, p_boards_won, p_boards_total, p_session_type,
p_client_hand_id)` is the **only** writer and **has no `player_count` parameter**. All 73 rows took
`DEFAULT 2`. The value is not wrong occasionally — **it has never once been written.**

**What it does NOT invalidate: anything on a screen.** The `player_count` references in the app are
`game_rooms.player_count` (lobby and club table sizing) and an analytics event property — a
different column on a different table. No shipped surface reads this one.

**What it does invalidate — every breakdown of this table by table size, ours included:**

- `docs/DEPLOY-THE-SEAT-FIX-2026-08-27.md` §6 published *"2 players real 71 rows, tied 0 | 3 players
  real 42, tied 0 | 4 players real 28, tied 0"* and concluded **"NO TIE HAS EVER BEEN RECORDED IN
  REAL PLAY AT ANY TABLE SIZE."** A per-table-size split cannot come from a constant, and those row
  counts do not reconcile with the 73 rows present today either.
- ⚠️ **And that conclusion is now false on its own terms.** Reading `boards_total`, which *is*
  written: **one tie has been recorded in real play** — device `c0bd-67d6-1f6f`, 2026-08-28,
  `boards_total` 4 (a two-player hand), and that device is not in `v_harness_devices`.
- Handoff 130's *"zero hands ever recorded at 3 or 4 players"* was corrected inside that same
  document via `boards_total`, and the corrected reading is confirmed again: of 22 real rows,
  **2 four-player, 10 three-player, 10 two-player**.

**The fix derives rather than adds a parameter**, because a parameter needs a client change and a
build and this sprint ships neither. `boards_total` determines the player count exactly — it is the
inverse of `getBoardCount()`. Both misleading defaults are dropped (`boards_total`'s was **5**, not
a legal board count at any table size), history is derived, and the writer now sets it:

| boards_total | 4 | 3 | 2 | 9 (illegal) |
|---|---|---|---|---|
| player_count written | 2 | 3 | 4 | **NULL** |

Round-tripped through the live RPC at all four. NULL is the honest answer for "unknown"; `2` was
not. Nothing is lost — `boards_total` is untouched.

---

## 4 · `v_automation_devices` — it did not break, and I said the wrong thing about it

See §0(b) for the correction. What is actually true, measured:

The view matches on `webdriver = true` or a `ua` containing Headless / Playwright / Claude/ /
Electron/ / bot. Those keys come from the **AN1 client fingerprint, which shipped 2026-08-01**
(commit `0ba09a6`, `utils/analytics.ts`). So it has **two blind spots, and neither is a
regression** — it has never been able to see them:

1. **Everything before 2026-08-01 19:51:12.** No event before that carries `ua` or `webdriver` at
   all: **April 758, May 540, June 1,566, July 3,709** events, every one invisible to it.
2. **Any device that never sends a web fingerprint.** A harness writing through SQL or an RPC never
   runs `navigator`. **80 device ids** across six tables cannot have come from the app, and the
   view catches **zero** of them.

*Like `insert_tx`, `v_automation_devices` was never created by a migration either. Both instruments
this project leans on live outside version control.*

### The second signal, and why it is exact rather than a heuristic

`getDeviceId()` (`utils/leaderboard.ts:40`) is the only producer of a device id in the app:

```js
'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))
// with one fallback on a SecureStore failure: 'anon-' + Date.now().toString(36)
```

So a real client emits `^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$` or `^anon-[0-9a-z]+$` **and nothing
else**. `eqh-eqs1-a`, `rig3p-b`, `rig2p-loser`, `dev-s2-host`, `test-ah1-verify` are not things the
app can produce. This rule needs no fingerprint, works retroactively over all history, and cannot
be defeated by a harness presenting an ordinary user agent — **which is exactly the case that made
me read a real player's Auto-Place tap as a robot last sprint.**

`20260831140000_harness_devices_two_signals` adds **`v_harness_devices`**, the union, with a
`signal` column so a device can be argued with rather than silently excluded.
`v_automation_devices` is **kept unchanged** — earlier handoffs quote its counts (28 on 08-27, 29
on 08-28, 50 today) and rewriting it would silently restate history — but is now commented with
what it does and does not cover.

### Re-run over the whole database — the actual residue

| signal | device ids |
|---|---|
| `automation_fingerprint` (browsers) | **50** |
| `synthetic_device_id` (ids the app cannot make) | **80** |
| **total** | **130** |

The two are **complementary and today disjoint**: the view catches automated *browsers* using
real-format ids (our own Playwright sweeps); the format rule catches *synthetic ids* written
straight to the database. Neither alone is the answer.

| table | harness rows | of total |
|---|---|---|
| `analytics_events` | **1,988** | 10,673 |
| `chip_transactions` | **177** (47,216 chips) | 4,396 |
| `leaderboard` | **66** (96,379 chips) | 551 |
| `player_streaks` | 45 | 1,612 |
| `heatmap_events` | 8 | 564 |
| `hand_history` | 4 | 73 |
| `device_identity` (bindings) | **0** | 6 |

**66 harness rows hold 96,379 chips — 7.7% of the float.** And **0 of the 6 bindings**, which
confirms a third time that all six are real people.

**Nothing was deleted.** The view identifies; it does not purge. Removing 66 leaderboard rows moves
the ladder and is Roye's call.

---

## 4b · The regression check — the same 264-cell sweep, before and after

`tests/verify-full-loop.mjs` re-run on a build of the changed source. Self-test 6/6 on both engines
first, as always. The BEFORE is the file the last sprint committed; the AFTER is saved beside it as
`docs/verify-everything/full-loop-after-close-the-six.json`.

| | before | after |
|---|---|---|
| cells with an unnamed control | 8 | **0** |
| unnamed elements in total | 128 | **0** |
| `/settings` distinct sub-44 targets | 11 | **9** ← the two legal links |
| navigation failures | 0 | 0 |
| blank routes | 0 | 0 |
| horizontal overflow | 0 | 0 |
| app-originated console errors | 0 | 0 |
| `/game` distinct sub-44 targets | 89 | **156** ⚠️ |

> **That last row is my instrument, not a regression, and it is the sort of number that would
> otherwise read as "the fix made it worse".** Nothing on `/game` changed size. The sixteen slots
> were previously *unnamed*, so they collapsed into a handful of distinct entries in a key built
> from `label + size`; now each announces its own board and position, so each is distinct. Same
> elements, same 28×33, a more specific key.
>
> **And they are still under 44pt, deliberately.** A card slot is sized to the card it will hold —
> growing it to 44 would change the board layout at every player count, which is a design change and
> not an accessibility fix. Named and under-size is strictly better than unnamed and under-size;
> the size is a separate question and it is Roye's.

---

## 5 · Still open, for Roye's decision

1. **`read_own_tx` makes the whole ledger world-readable.** `FOR SELECT TO public USING (true)` —
   every device's chip history, to anyone with the public key. The 2026-05-17 lockdown intended
   `user_id = auth.uid()`. **Deliberately not fixed here**: this sprint was scoped to the write
   path, nothing client-side reads the table directly (so it is probably safe to narrow), but
   changing SELECT semantics on a surface I have not finished mapping is a separate change with a
   separate test.
2. **Ten more tables carry the same permissive-INSERT shape** (§1). None can mint chips; two —
   `achievements` and `analytics_events` — have real consequences. The four that the client writes
   to directly need an RPC before they can be narrowed at all.
3. **`credit_purchase` has no `starter_pack` package** (§2). Must be added before `iap_enabled` is
   flipped, or the verified path answers `unknown_package`.
4. **A signed-in user forging a `hand_history` row** would fire `trg_hand_history_achievements` and
   earn chips. Reasoned from the catalogue, **not exercised** — it needs an account.
5. **The migration history does not rebuild the database.** A branch built from it came back
   `MIGRATIONS_FAILED` with 5 tables and 0 functions. Every future branch-based QA hits this.
6. **66 harness leaderboard rows hold 96,379 chips** and 177 ledger rows hold 47,216 (§4). Deleting
   them moves the ladder, so it is Roye's call, not mine.
7. **`claim_low_chip_rescue` is the one economy RPC with no guards at all** — no
   `econ_authz_probe`, no `econ_rate_ok`, no `econ_bind_ok`. Bounded (500/day/device, and only
   below 100 chips), carried forward from the last audit, still open.

---

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `hand_rake_pct` **5** ·
`presence_grant_multiplier` **0.4** · `play_grant_per_hand` **80** · `play_grant_practice_pct`
**50** · `play_grant_daily_cap` **800** · `min_playable_chips` **100** · `econ_binding_enabled`
**true** · `econ_throttle_enabled` **true** · `mp_server_adjudication_enabled` **true** —
all read back after the work, all unchanged. Missions still inactive. `KILL_Board` and `KILL_game`
still `true`, untouched. **No art, felt, panel, cue or colour was touched**: the only two app files
changed are `app/settings.tsx` (+28 lines, box height and comments) and `components/Board.tsx`
(+65, accessibility props and comments) — no geometry, no palette. Baselines not regenerated,
nothing merged, no build dispatched, nothing uploaded to App Store Connect.

**Every probe row removed, and removal verified by re-reading the totals rather than trusting the
delete:**

```
ledger 4,396 rows / 873,514   float 1,258,007   gap 384,493   leaderboard 551   purchases 0
```

Identical to the pre-sprint reading, to the chip. No `game_rooms` or `room_players` row was touched.
