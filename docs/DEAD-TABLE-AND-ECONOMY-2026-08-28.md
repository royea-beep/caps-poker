# VAMOS CAPS — DEAD-TABLE-AND-ECONOMY (2026-08-28)

The lying report is stopped and proven stopped. The win drift is not what anyone thought. The
economy is re-measured post-purge, and nothing in it was changed.

Branch `claude/vamos-caps-align-celebration-flppo0`.

---

## 1. THE LYING REPORT — STOPPED

### 1.1 The authoritative source: the devices, not a table and not `app.json`

**`app.json` is a build INPUT, not evidence.** It says what the *next* build will be numbered — it
reads 509 the moment someone bumps it, days before that build exists — and the database cannot
read it at all. It matched the phone by coincidence of timing, not by being a source of truth.

The real source was already in the database and nobody was reading it. `utils/analytics.ts:68`
has been sending `Application.nativeBuildVersion` as `native_build` on every event since
**2026-08-09**:

```
native_build "508" · native_version "2.7.0" · 336 events · 81 devices · 2026-08-09 → 2026-08-27
```

**The database has known the true build for nineteen days while five sources reported otherwise.**
That is ground truth in the Iron Rule #9 sense — not a number a person typed, but what installed
binaries report about themselves.

New function **`get_live_build()`** derives it, and has the property the old table never had: it
**cannot silently go stale**, because it is derived rather than maintained. When it has nothing to
go on it returns `build_number: null` with a note, and a `stale` flag when no device has reported
in 14 days. A reader that prints "unknown" is recoverable; one that prints a confident wrong number
cost this project a sprint.

### 1.2 Every reader — before and after

| reader | when | before | after |
|---|---|---|---|
| `run_daily_digest()` | cron 21:00 | **471** — on 123 consecutive nights since 2026-04-28 | **508** + `build_source`, `build_stale`, `build_devices` |
| `get_current_build()` | on demand | **471** (a testflight row from 2026-04-27) | **508** |
| `get_build_changelog(n)` | on demand | **471**, and **`p_limit` inert — `(5)` returned all 46 rows** | **508**, and `(5)` returns **5** |
| `get_live_dashboard()` | on demand | 471 (delegates) | **508** |
| `get_caps_launch_dashboard()` | on demand | 471 (delegates) | **508** |
| `get_daily_digest()` | cron 06:00, WhatsApp | **465** from `app_config.current_build` | **508**, with `⚠️ מידע ישן` if ever stale |
| `auto_dismiss_stale_crashes(3)` | cron 03:30 | cutoff **468** | **508**-derived, and now fails safe — see §1.4 |
| `caps_release_pulse()` | cron 06:00 | already ordered by `started_at` — the one reader written correctly | unchanged; it scores build_history history, not current state |

**Why `get_current_build()` was wrong even within the stale table:** it ordered by `build_number`,
and build numbers are not monotonic in time because the testflight and production profiles ran
independent series. `max(build_number)` = 471 (2026-04-27) and `max(started_at)` = 451 (2026-05-08)
are **different rows**, and 451 is `in_progress` so `WHERE status='live'` excluded it entirely.

### 1.3 Tonight's digest — proof, not intention

`SELECT run_daily_digest();` run after the change:

```json
{ "date": "2026-08-27",
  "build": "508",
  "build_source": "device telemetry (analytics_events.native_build)",
  "build_stale": "false",
  "build_devices": "81",
  "new_devices": 30,
  "smoke": "8.0" }
```

### 1.4 `auto_dismiss_stale_crashes` was structurally broken, and repointing it would have ARMED it

Its matching rule is:

```sql
EXISTS (SELECT 1 FROM build_history b WHERE b.version = c.version
                                        AND b.build_number <= v_cutoff_build)
```

It joins builds to crashes on **`version`** — a marketing string. `crash_reports` has **no build
column at all** (its columns are `version`, `status`, `pipeline_last_status`). Every `build_history`
row is version `2.7.0`, so *any* 2.7.0 crash matches as long as *some* 2.7.0 build sits below the
cutoff — and dozens do. It is a version-wide sweep wearing a build-level cutoff.

That was inert only because zero crashes sit in the open statuses (349 rows, all dismissed or
fixed). **A brand-new crash from build 509 would have matched on version `2.7.0` and been
auto-dismissed on the very next nightly run.** Pointing it at the correct number does not fix that
— it arms it.

So it now **fails safe**: it dismisses only when a crash can be tied to an actual build below the
cutoff, which no column allows, and returns an explicit `blocked_reason` instead. It dismissed
nothing before this change and dismisses nothing after it; the difference is that it can no longer
start closing live reports the moment the number becomes right.

### 1.5 The gap, recorded not backfilled

`build_history` untouched: still **46 rows, max 471**. Its `COMMENT` now carries the cutoff:

```
authoritative up to   2026-05-08  (and read BY started_at, never by build_number)
silent                2026-05-09 → 2026-08-28   (builds 452-508, 57 builds)
```

`app_config.current_build` (**465**) and `next_build_number` (**466**) are left at their wrong
values **deliberately**. Writing 508 into them would recreate the exact trap that caused this — a
hand-maintained number that looks authoritative and goes stale in a week. No reader uses them, and
a new key `app_config.build_source_of_truth` says so in place.

**Why it stopped:** nothing automated ever wrote it. No caller of `register_build()` exists in the
repo or in any of its 1,418 commits. A person ran it by hand and stopped during the May pipeline
migrations. Recoverable from Actions run history + `app.json` at each SHA, and from App Store
Connect — not rebuilt, per the brief.

### 1.6 The self-contradicting doc — both halves, same commit

`docs/caps-build-checklist.md` said the table was dead at line 49 and then handed you
`UPDATE build_history SET status = 'live'` at line 242. **Four places fixed:**

1. line 3 — the frontmatter activation description ("about to mark a build status=live in
   build_history") → "about to declare a build live … must NOT write build_history".
2. line 15 — the trigger list, same change.
3. line 49 — the reference row now says HISTORICAL ONLY, names the 452–508 gap, points at
   `get_live_build()`, and warns to read by `started_at` not `build_number`.
4. line 242 — the procedure now says **DO NOT UPDATE `build_history`**, explains the incident it
   caused, and shows `SELECT get_live_build()` instead.

---

## 2. THE WIN-COUNT DRIFT — NOT PRACTICE. THE SURPLUS, NAMED.

### 2.1 The gap is NOT the practice hands

Measured now:

| | |
|---|---|
| devices with activity | 21 |
| **disagree** (`leaderboard.wins` vs `hand_history` wins) | **17** |
| disagree excluding practice | **15** |
| devices with a leaderboard win and **zero** hand_history rows | **13** |
| devices where the leaderboard **under**-counts | 1 |
| `sum(leaderboard.wins)` | 14 |
| `sum(hand_history wins)` | 6 (2 non-practice, 4 practice) |

Practice would make `hand_history` **larger** than the leaderboard. It is smaller, and the drift
runs in **both directions**. So: **NO — the gap is not exactly practice, and the item does not
close.**

### 2.2 The surplus, named — and it is not where anyone was looking

The drift is not `leaderboard` versus `hand_history`. **It is inside `leaderboard`, one row per
device, two counters that disagree:**

| | `wins` | `hands_won` |
|---|---|---|
| total | **14** | **35** |
| rows where they disagree | **10** of 21 active | |

and the same again for play counts: `games_played` **36** vs `hands_played` **59**, disagreeing on
**7** rows.

`hand_history` is also not a valid denominator: **70 rows in four months**, only **14** of which
match a leaderboard device, and **26 real devices have `hands_played > 0` with no hand_history row
at all**. It is an incomplete log, not a ledger — so measuring drift against it was always going to
produce a number that means nothing.

### 2.3 Two of them disagree ON SCREEN — this is the finding

| surface | reads | source |
|---|---|---|
| **`/rank`** | **`wins`** / `games_played` | `app/rank.tsx:71-72, 99, 188` |
| **`/leaderboard`** | **`hands_won`** / `hands_played` | `app/leaderboard.tsx:47-48, 61-62` |
| **`/stats`** | `hands_won` **falling back to** `wins` | `app/stats.tsx:193` — a *third* behaviour |
| `/hand-history` | derived locally from board winners in the local store, never the DB | `app/hand-history.tsx:303-306` |
| achievements | neither counter | — |

A real device makes it concrete:

```
device fc96-884e-2e27:   /rank shows 0 wins   ·   the leaderboard shows 3
```

Same player, same moment, two screens, two numbers. `/stats` would show a third answer depending on
which column is populated.

### 2.4 Structurally impossible rows already exist

- **6 rows have `hands_won > hands_played`** — wins out of fewer hands than were played.
- **6 rows have `hands_won > 0` with `hands_played = 0`** — wins with a zero denominator. The
  leaderboard's `hands_won / hands_played` is guarded, so it renders **3 wins at 0% win rate**.
- **26 of the 29 harness devices are still in the leaderboard**, so every public ranking includes
  them.

Historical rows are **not backfilled**; the cutoff stands. But the two-column split is live code,
not history — it will keep producing new disagreements on every hand played until one column wins.

---

## 3. THE ECONOMY — RE-MEASURED POST-PURGE

**The old 1,129,043 / ~7,200 / 158:1 figures are superseded and should not be quoted.**

### 3.1 Real vs harness, separated

Every figure below excludes the 29 devices in `v_automation_devices`. The separation matters: the
harness contributed **14,180 chips of faucet and 0 of sink** — it never spends, so leaving it in
inflates the ratio in exactly the wrong direction.

### 3.2 The numbers

| | real devices | harness |
|---|---|---|
| faucet (credits) | **827,985** | 14,180 |
| sinks (debits) | **7,641** | **0** |
| **ratio** | **108 : 1** | — |
| float (`sum(total_chips)`) | **1,153,037** | 66,180 |
| devices with any transaction | 1,882 | 29 |
| per-device average float | **2,270** | — |

**Faucet by source — one source is 83% of the entire economy:**

| source | chips | rows | avg |
|---|---|---|---|
| **`daily_streak`** | **685,100** | 1,339 | **511** |
| `daily_login` | 110,850 | 2,217 | 50 |
| `daily_reward` | 13,800 | 460 | 30 |
| `hand_won` | 4,875 | 106 | 46 |
| `first_game` | 3,000 | 6 | 500 |
| everything else | ~10,000 | — | — |

**Sinks, all of them:** `quick_poker_buyin` −4,400 · `quick_poker_buy_in` −1,500 · `hand_net` −575
· `rebuy_500` −550 · `buy_emotes` −300 · `buy_avatar` −200. **Total −7,641.**

**True destruction:** effectively zero. Every "sink" above is a buy-in that is returned to the
winner as a credit — it moves chips, it does not remove them. The only genuine removals are
`buy_emotes` and `buy_avatar`: **500 chips destroyed, ever.**

### 3.3 Structurally wrong at any scale

These are wrong whether there are 26 players or 26,000, and none depends on sample size:

1. **The float does not reconcile with the ledger.** `sum(leaderboard.total_chips)` = **1,219,217**
   but `sum(chip_transactions.amount)` = **834,724** — a **384,493-chip gap**, and it is not
   missing rows (zero devices hold chips with no ledger row). Balances are moving without matching
   transactions. **Before money exists, the ledger must explain the balance**, or a purchase
   dispute has no record to appeal to.
2. **`chip_config` is decorative.** 48 rows, **all 48 `is_active = true`, and only 13 have ever
   fired.** 35 configured rewards — including `sng_platinum_win` at 10,000 chips and `royal_flush`
   at 1,000 — have never once paid out. Worse, **14 of the 27 live transaction types are not in
   `chip_config` at all**, including `daily_streak`, the source of 83% of the faucet. The table
   that looks like the economy's control surface does not control it.
3. **The dominant faucet has no visible ceiling.** `daily_streak` grants up to **1,500 in a single
   credit** and averages 511. One real device has taken **38,850 chips** from the faucet — 17× the
   average player's entire balance — without playing a hand.
4. **Duplicate event names split every count.** `quick_poker_buyin` / `quick_poker_buy_in` and
   `hand_won` / `hand_win` are the same events under two spellings. Any per-type cap, report or
   analytic silently sees half of each.
5. **The faucet does not require playing.** 1,882 devices have transactions; **26** have ever
   played a hand. The economy pays for opening the app, not for playing the game.

### 3.4 The caveat, stated plainly

**26 devices have ever played a hand. Nine appear in `hand_history`. Nothing can be calibrated on
that.** Any faucet/sink target, price point or reward curve derived from this data would be fitted
to noise. I am not producing confident targets, and any number in this document presented as a
*target* rather than a *measurement* should be treated as unfounded.

What the sample **does** support is §3.3 — those are internal inconsistencies, provable from the
data's own structure, and they do not become correct at a larger n.

### 3.5 Options — nothing changed, Roye decides

**Nothing in the economy was modified.** No faucet, rescue, ad amount, rake, clamp or price was
touched; `chip_config` and `app_config` economy keys are untouched.

| # | option | effect | risk |
|---|---|---|---|
| A | **Reconcile the ledger first** — make every balance change write a transaction, then re-measure | the 384k gap becomes explicable; a prerequisite for any purchase dispute | none to players; work is in the write path |
| B | **Cap `daily_streak`** (a per-day and lifetime ceiling) | attacks 83% of the faucet at its source | changes a live reward; needs Roye's number |
| C | **Make one sink real** — a purchase that removes chips rather than moving them | today only 500 chips have ever been destroyed | needs a thing worth buying |
| D | **Collapse the duplicate event names** | counts and caps stop being split in half | pure correctness, no player-visible change |
| E | **Prune or wire `chip_config`** — 35 rewards that never fire either work or go | removes a control surface that misleads whoever reads it next | none if pruned; B-class if wired |

**My recommendation, in order: A, then D, then B.**

A and D are correctness — they are wrong at any scale and neither changes what a player receives.
**A is the one that must precede money**: a 384,493-chip unexplained gap is an annoyance today and
an unanswerable dispute the moment someone pays. B is a real balance decision and needs Roye's
number, not mine, and it should wait until A makes the measurement trustworthy. C and E are
product calls with no urgency at this sample size.

---

## 4. STATE

- **Production unchanged.** No `app_config` row touched today except the new
  `build_source_of_truth` note. `iap_enabled` false, `web_payments_enabled` false,
  `hand_rake_pct` 5, `current_build` still 465 (deliberately). `chip_purchases` 0, missions
  completed 0. `chip_config` untouched.
- **`build_history` not backfilled** — still 46 rows, max 471. No economy row altered.
- No `game_rooms` or `room_players` row edited; both read only.
- Felt, panels, cues, derivation and every flag untouched. No video committed.
- Changed: 7 database functions (1 new, 6 repointed), 2 migration files, 1 doc.
