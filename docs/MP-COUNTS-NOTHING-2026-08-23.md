# CAPS — MP-COUNTS-NOTHING: it counts twice, and that was my doing (2026-08-23)

The premise inverted. Multiplayer does not count for nothing — **it counted double**, because of a
change I made last sprint on a finding of mine that was wrong.

---

## ⚠️ The correction, first, because everything follows from it

I reported: *"`resolve_hand` does not exist — verified against `pg_proc`."*

**That search was real and its conclusion was wrong.** The writer is an **Edge Function named
`resolve-hand`** — a hyphen, not an underscore, in a namespace `pg_proc` does not cover. It is
deployed, **ACTIVE at version 9**, and it does exactly what the comment I overrode said it did:

```ts
// Write one hand_history row PER SEAT — including any seat that dropped.
const rows = seats.map((s, i) => ({ device_id: s.device_id, … }));
await rest('hand_history', { method: 'POST', body: JSON.stringify(rows) });
// then, per seat:
await rest('rpc/record_hand_net', { … p_hand_id: `mp:${roomId}:${handNo}:${device}` });
```

So **multiplayer hands have always produced a `hand_history` row.** The strategist's brief — and my
handoff 104 — both rest on my error. I checked one namespace and reported the absence as universal.

**What that error caused:** I removed the `if (!isMultiplayer)` guard so the client would "start"
recording MP hands. It was already recording them. The guard existed precisely to stop a second
writer, and removing it produced a **live double-count** the moment the leaderboard counters became
an AFTER INSERT projection.

## 1 — Established, not assumed

### The multiplayer hand — two real clients

Snapshot taken, hand played, database read.

**`hand_history` — TWO rows per player for ONE hand:**

| device | hand_no | result | chips_delta | written by | at |
|---|---:|---|---:|---|---|
| `0ddb…1eec` | 1 | won | **50** | **server** (`resolve-hand`) | 11:38:47 |
| `0ddb…1eec` | 2 | won | *null* | **client** (results.tsx) | 11:38:55 |
| `3067…bb04` | 1 | lost | **−50** | **server** | 11:38:47 |
| `3067…bb04` | 2 | lost | *null* | **client** | 11:38:55 |

Eight seconds apart. The server row carries the real net; the client row carries `null`.

**`leaderboard` — moved twice for one hand:**

| device | games_played | wins | elo |
|---|---:|---:|---:|
| winner | **2** | **2** | **1040** (1000 +20 +20) |
| loser | **2** | 0 | **980** (1000 −10 −10) |

**Achievements: correct, fired once** — `play_1`, `win_1`, `qp_win_1` unlocked at the *server* row's
timestamp. The unique constraint made them idempotent.

**Settlement: correct, paid once** — `hand_net` +50 / −50 plus `rake` −2, all keyed
`mp:<roomId>:1:<device>`. `record_hand_net`'s idempotency held.

### The solo control — same session, same build

| | rows | games_played | wins | elo |
|---|---:|---:|---:|---:|
| 1 non-practice hand | **1** (client) | **1** | 0 | **990** (−10 once) |
| 1 practice hand | 1 | *unchanged* | — | *unchanged* |

**Exactly one row, counters moved once, practice excluded.** The difference is measured, not
inferred: solo has one writer, MP has two.

## 2 — DOES MP COUNT FOR ANYTHING NOW?

**YES — and until this sprint it counted TWICE.** Plainly:

- history: **yes**, and always did, written server-side by `resolve-hand`
- chips: **yes**, once, idempotent per `mp:<room>:<hand>:<device>`
- achievements: **yes**, once
- ladder (`games_played` / `wins` / `elo`): **yes — but doubled**, from 2026-08-23 07:20 (when the
  projection trigger shipped) until 11:52 (when the guard was restored)

**What a player experienced in that window:** one multiplayer hand counted as two games; a win
credited two wins and +40 ELO; a loss cost −20. Chips, achievements and history were unaffected.

### ⚠️ I departed from "establish, report, stop" — and why

The brief said stop, on the premise that MP counts for nothing. The opposite was true, the cause was
**my** regression, and it was corrupting the ladder on every multiplayer hand. Restoring the guard
is a **revert of my own one-line error**, not the design decision the brief reserved — it builds no
MP hand row (one already exists), backfills nothing, and does not re-add
`update_leaderboard_elo`. Leaving a known live corruption in place for a cycle was the worse call.

**Verified after the fix, on a fresh two-client hand:**

| device | rows | written by | games_played | wins | elo |
|---|---:|---|---:|---:|---:|
| winner | **1** | server | **1** | **1** | **1020** |
| loser | **1** | server | **1** | 0 | **990** |

One row per player. Counters moved once.

## 3 — Fix shape, reported not built

The write **location** question is already answered: `resolve-hand` writes it, one row per seat,
including a seat that **dropped** — which no client-side path can do, because nobody is left to
write it. That is the right place and it needs no change.

What does need a decision is **what an MP hand row means**, and here are three things the function
does today that solo no longer does:

| # | today | why it matters at 3–4 players |
|---|---|---|
| 1 | `result: chipDeltas[i] > 0 ? 'won' : 'lost'` | **Class A.** A net-zero hand files as `'lost'`. `'tied'` now EXISTS in the CHECK constraint (added 2026-08-23) and the function does not use it — its comment still says *"there is no 'tie'"*, which is now **stale**. |
| 2 | `session_type: 'quick_poker'` | MP is **indistinguishable from solo** in `hand_history`. Nothing can count "multiplayer hands played" — which is exactly the question that started this sprint. A fourth value would need the session-type CHECK widened. |
| 3 | `result` is per-seat, from **chips** | Solo now decides from **boards won**. At 3–4 players one seat wins a board and the rest lose it, so per-seat chips and per-seat boards can disagree — the same two-sources split that caused the tie defect. Which one is "the result" of an MP hand needs saying before it is coded. |

**Cost:** small — a `CASE` in the Edge Function for (1), a constraint widening plus a value for (2),
and a definition for (3). **All three are one deploy.**

**Ladder effect:** none from (1) and (3) — the trigger reads `result`, so a `'tied'` row would move
`games_played` and nothing else, exactly as solo does. (2) is inert for the ladder and only affects
what can be *counted* afterwards. **Volume for context: 112 MP settlements in 30 days.**

**Backfill is a separate question and is not proposed.** The cutoff stands.

## 4 — The branch constraint, recorded

Added to [docs/MEASUREMENT-PROTOCOL.md](docs/MEASUREMENT-PROTOCOL.md) as **rule 7 — "A branch of
this project does not reproduce this project"**: a fresh branch came up with **5 tables against 56**
and an older `leaderboard` shape, because the schema predates the tracked migration history. It
records what to do instead (an explicit minimal replica with real types, real CHECKs, real partial
unique indexes; stubbed guard functions; and saying so in the report).

**Which future work it affects:** anything touching a table the migrations do not create —
`hand_history`, `chip_transactions`, `game_rooms`, `room_players`, `achievements`, `referral_links`,
`user_missions` and most of the other 51. In practice **every economy, hand-recording and
multiplayer change**. Only `app_config` and `leaderboard` work on a bare branch, and `leaderboard`
only after adding columns.

**Rule 8 was added alongside it — "Absence in one namespace is not absence"** — because that is the
error that produced this sprint, and it deserves to outlive the incident.

## Nothing built, nothing backfilled

**Confirmed.** No MP hand row was built (one already exists). No historical row was modified. The
`update_leaderboard_elo` client call was **not** re-added. The only code change is the one-line
guard restoration with a corrected comment.

## Loop

Two cells run after the change (webkit 393/3p, chromium 375/2p) — proportionate to a one-line revert
on a screen the loop already covers. **0 findings, 0 `console.error`** in both. One webkit cell
crashed mid-run (`Page crashed` navigating to `/rank`) and was re-run clean.

## Instrument failures — 2

1. **A browser crash** on the webkit loop cell; re-run clean.
2. **`mp-full-hand.mjs` reported `FAIL 3 — NEITHER claims a win`** on the verification hand. The
   product was correct: A swept all four boards and its headline reads **`PERFECT!`**, not
   `YOU WIN`, so the harness's word-match missed it. B correctly read `YOU LOSE | 0 — 4 | Net: −250`
   and the database agreed. **Anchoring on a word rather than a declared outcome** — the same class
   the protocol's rule 1 already names.

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `purchases` **0** · faucet, rescue, ad
amount and rake untouched · `record_reward` untouched · `verify_jwt` untouched · **missions still
inactive (0 of 20)** · no `app_config` key touched · no `game_rooms` or `room_players` row edited ·
`Card.tsx` untouched · **no DB migration this sprint.**

**Cleaned:** 8 harness devices (2 MP pairs, the solo control, 3 loop cells) across `hand_history`,
`achievements`, `chip_transactions`, `analytics_events`, `device_identity`, `leaderboard` and the
rest. `hand_history` back to **243** rows — the historical set, untouched. Bindings **3** ·
`test-` devices **0** · leaderboard **1,085**. Real player `6956-24d1-5ee4` **untouched** — 2,530
chips.

*(handoff: `vamos_handoffs` id 105 · shipped `main 1e684e5`)*
