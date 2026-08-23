# CAPS — MP-RECORDING: boards decide the win, in multiplayer as in solo (2026-08-23)

Three fixes, one deploy. `resolve-hand` is at **version 10**. All three were proven on real hands,
and the tie came up naturally on the very first one.

---

## MAP — carried forward, extended

- `vamos_handoffs` is the channel. Latest: id 106.
- **Protocol Rule 7 held again.** The branch came up with **5 tables of 56** and status
  `MIGRATIONS_FAILED`. An explicit minimal replica was built and is named as such.
- **Protocol Rule 8 earned its place immediately.** Enumerating `session_type` consumers found one
  that would have **silently removed** multiplayer's achievement credit. A bare equality on a
  closed set, exactly the shape the rule exists to catch.
- **One definition of winning now exists.** Boards decide it in solo and in multiplayer.
- `resolve-hand` v10 · `verify_jwt` **false**, unchanged.

## 1 — A tie is a tie in multiplayer

`result` was `chipDeltas[i] > 0 ? 'won' : 'lost'`. It now uses `'tied'`, which has existed in the
CHECK since yesterday and was going unused.

**The stale comment is fixed too.** It said *"hand_history_result_check allows only
won/lost/folded/timeout — there is no 'tie'"*. That stopped being true yesterday, and a stale
comment is precisely what credited a non-existent function and cost two sprints. It now explains
what the value is and when it arrived.

**Ladder behaviour — confirmed, not assumed.** On the branch replica, three `'multiplayer'` rows:

```
won  -> games_played +1, wins +1, elo +20
tied -> games_played +1, wins +0, elo   0     <-- moves games_played and NOTHING else
lost -> games_played +1, wins +0, elo -10
practice row -> wrote its row, ladder UNCHANGED
result: elo 1010, games_played 3, wins 1  (a 4th row existed: the practice one)
```

Then confirmed again on a **live** MP tie: both seats `games_played 1`, `wins 0`, `elo 1000`,
`elo_last_delta 0`.

## 2 — Multiplayer is distinguishable from solo

`session_type` gains **`'multiplayer'`**. The CHECK is now
`sng | quick_poker | practice | custom | multiplayer`.

### Every consumer, enumerated before the change

| consumer | what it does with `session_type` | effect of a new value |
|---|---|---|
| `tg_hand_history_leaderboard_counters` | `IF NEW.session_type = 'practice' THEN RETURN NULL` | **safe** — a new value is not `'practice'`, so MP still counts. Confirmed on the branch. |
| **`check_achievements`** | `session_type = 'quick_poker' AND result = 'won'` | ⚠️ **would have silently stopped crediting MP wins.** Fixed — see below. |
| `record_hand_result_d` | whitelists 4 values, **falls back to `'practice'`** | ⚠️ would have silently downgraded a `'multiplayer'` argument. Widened. |
| `get_hand_history` | optional filter `session_type IS NULL OR = p_session_type` | safe — and now usefully filterable by `'multiplayer'` |
| `get_hand_replay` | selects it, no branching | safe |
| client (`game.tsx`, `results.tsx`) | only **write** `'practice'`/`'quick_poker'`; nothing **reads** it | safe |
| triggers / views | none other | — |

### ⚠️ The one that mattered

`qp_win_1` ("Quick Draw") and `qp_win_10` ("Speed Demon") count
`session_type = 'quick_poker' AND result = 'won'`. Multiplayer hands filed as `'quick_poker'`
**today**, so they already credited those achievements — a live MP hand unlocked `qp_win_1`
yesterday. Relabelling MP without touching this would have **quietly taken that credit away**.

One line changed, and only that line:

```sql
count(*) FILTER (WHERE session_type IN ('quick_poker','multiplayer') AND result = 'won')::int
```

### Existing rows

**Untouched — confirmed.** Existing rows are only `'quick_poker'` (141) and `'practice'` (102), both
still allowed, so the constraint validated **without modifying a row**. Nothing was backfilled.

⚠️ **Multiplayer hands played before today are unidentifiable, and will stay that way.** They are
filed as `'quick_poker'`, mixed in with solo, with no column that separates them. Guessing at them
from `player_count` would be inference dressed as data — `player_count > 1` is true of every row,
solo included, because it counts seats at the table and solo plays against bots. So the honest
statement is: **the count starts today.**

## 3 — Boards decide the win

MP decided per-seat from **chips**; solo decides from **boards won**. Now both decide from boards.

### The tie rule at 3–4 players, verbatim

> A seat's boards-won is the number of boards it won **outright** (a board that itself tied awards
> nobody). Let `max` be the highest boards-won across the seats. If exactly **one** seat holds
> `max`, that seat is `'won'` and every other seat is `'lost'`. If **two or more** share `max`, each
> of those is `'tied'` and every other seat is `'lost'`.

- `2/1/1/0` → **one winner, three losers.** Not a tie.
- `2/2/0/0` → two `'tied'`, two `'lost'`.
- all boards tied → every seat `'tied'`.
- At two players this reduces exactly to solo's `playerWins > botWins ? win : < ? loss : tie`.

### Chips are untouched

`record_hand_net` still settles from `chipDeltas`, zero-sum with the rake. **This changes what the
hand record says, not who gets paid.**

### ⚠️ `result = 'won'` with a negative `chips_delta` is now possible — and correct

A seat can take the most boards and still be net-negative once the COMPLETE bonus and pot splits are
applied. **Nothing downstream treats the pair as a consistency check** — verified rather than
assumed:

| consumer | what it does |
|---|---|
| `generate_weekly_recap`, `generate_weekly_recap_d` | compute `wins` from `result='won'` **and** `earned`/`lost`/`net` from `chips_delta` — **side by side, never compared** |
| `get_hand_history`, `get_hand_replay` | select both, no branching |
| `check_achievements` | reads `result` only |
| `tg_hand_history_leaderboard_counters` | reads `result` only |
| the client | `/hand-history` derives display from **boards**; reads neither |

Not yet observed in the wild (**0 such rows so far**) — it needs a COMPLETE bonus or a pot-split
shape. Stated as possible-and-correct rather than claimed as demonstrated.

## 4 — Proof

### Positive control + tie, in one hand

The first MP hand after the deploy came up **2–2**:

| device | session_type | result | chips_delta | boards_won | rows | server-written |
|---|---|---|---:|---:|---:|---|
| A | **multiplayer** | **tied** | 0 | 2 | **1** | yes |
| B | **multiplayer** | **tied** | 0 | 2 | **1** | yes |

Ladder: both `games_played 1`, `wins 0`, `elo 1000`, `elo_last_delta 0`. Chips 2,000 → 2,000 both
sides. **One row per seat — the guard restored last sprint is still holding.**

### A decisive hand, including a board that tied

A took 3 boards, **board 2 tied outright and awarded nobody**, B took 0:

| device | result | chips_delta | boards_won | games_played | wins | elo |
|---|---|---:|---:|---:|---:|---:|
| A | **won** | +75 | **3** | 1 | 1 | **1020** |
| B | **lost** | −75 | **0** | 1 | 0 | **990** |

3 + 0 of 4 boards — the "outright only" clause working, and the boards rule deciding the result.

### The dropped seat still gets its row

`tests/mp-drop-hand.mjs` — the guest places nothing and its context is **closed mid-hand**:

```
1cee-6f01-8cfa   multiplayer  lost  -50  boards_won 1   server-written   <- the dropped seat
79e3-8fe3-5ef5   multiplayer  won   +50  boards_won 3   server-written
```

Ladder moved once each (`990` / `1020`). **The capability only the server has survives the change.**

### Solo unchanged — re-measured, not assumed

| row | session_type | result | boards_won | written by |
|---|---|---|---:|---|
| hand 1 | `quick_poker` | **tied** (2–2) | 2 | client |
| hand 2 | `quick_poker` | **won** (3–1) | 3 | client |
| practice | `practice` | lost | 1 | client |

Ladder: `games_played 2`, `wins 1`, `elo 1020` = 1000 + **0** (tie) + 20 (win). Practice excluded.
**Solo was not relabelled** and its rows are still client-written.

### "How many multiplayer hands were played" — a real answer

```sql
SELECT count(*) AS mp_seat_rows, count(DISTINCT device_id) AS distinct_players,
       count(*) FILTER (WHERE result='won')  AS won,
       count(*) FILTER (WHERE result='lost') AS lost,
       count(*) FILTER (WHERE result='tied') AS tied
FROM hand_history WHERE session_type = 'multiplayer';
```

```
mp_seat_rows 6 · distinct_players 6 · won 2 · lost 2 · tied 2
first identifiable MP hand: 2026-08-23 12:21:05 +03
```

**That is the acceptance test for §2, and it passes** — the question is answerable for the first
time. Six seat rows across the three hands played above.

---

## Loop

Two cells, both engines (webkit 393/3p, chromium 375/2p) — proportionate to a server-side change
plus a comment, on screens the loop already covers. **0 findings, 0 `console.error`** in both.

## Instrument failures — 1

**A deploy landed mid-run** on the first attempt at both cells, producing one A11Y finding each
(`/stats` on webkit, `/lobby` on chromium — different routes, which is what a random chunk failure
looks like) alongside `'text/html' is not a valid JavaScript MIME type`: the server returning the
HTML fallback for a bundle chunk that had just been replaced. **Identical to last sprint's
signature.** The bundle hash was sampled three times to confirm it had settled, and **both cells
re-ran clean**. Not filed.

⚠️ **Worth noting as a pattern rather than an incident:** this is the second sprint running where
pushing immediately before starting the loop produced false A11Y findings. The loop should not be
started until the bundle hash has been stable across two samples.

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `purchases` **0** · daily reward
**150** · `emergency_chips_amount` **200** · `hand_rake_pct` **5** · `rewarded_ad_chips` **100** ·
`record_reward` and the settlement path untouched · `record_hand_net` untouched · `verify_jwt`
untouched (`resolve-hand` still **false**) · **missions still inactive (0 of 20)** · no `app_config`
key touched · **no `game_rooms` or `room_players` row edited** — the drop test's room `6ZH5`
**self-healed to `finished`** on its own · `Card.tsx` untouched · the client's
`update_leaderboard_elo` call was **not** re-added.

**DB changes, in full:** `hand_history.session_type` CHECK gains `'multiplayer'` ·
`check_achievements` counts `session_type IN ('quick_poker','multiplayer')` for the quick-poker
condition (one line) · `record_hand_result_d` whitelist widened so `'multiplayer'` cannot be
silently downgraded to `'practice'`. **No historical row modified, nothing backfilled.**

**Edge Function:** `resolve-hand` **v9 → v10**, `verify_jwt` false, deployed with all four assets
(`index.ts` plus the three generated `_shared` files, which passed `gen-edge-shared --check`).

**Cleaned:** 11 harness devices (3 MP pairs, the solo control, 4 loop cells) across `hand_history`,
`achievements`, `chip_transactions`, `analytics_events`, `device_identity`, `leaderboard` and the
rest. `hand_history` back to **243** rows — the historical set, untouched — and therefore **0
`'multiplayer'` rows remain**: the acceptance-test count of 6 was my own proof traffic and was
removed with it. The mechanism is proven; the counter starts at zero for real play. Bindings **3** ·
`test-` devices **0** · leaderboard **1,088**. Real player `6956-24d1-5ee4` **untouched** — 2,530
chips.

*(handoff: `vamos_handoffs` id 106 · shipped `main 1a0e878` · `resolve-hand` v10)*
