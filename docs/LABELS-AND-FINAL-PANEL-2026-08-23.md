# CAPS — LABELS-AND-FINAL-PANEL: the labels closed, and what the panel actually found (2026-08-23)

The labels are fixed and proven on **both seats**. The panel produced **four confirmed findings**, of
which **three were fixed** and **one is reported for a ruling** because it lands on a protected path.
One candidate defect was **withdrawn as instrument error before filing**.

---

## MAP — carried forward, extended

- `vamos_handoffs` is the channel. Latest: id 107.
- **Working backwards from the pixel was the whole difference.** Two sprints of walking the payload
  chain forward found nothing, because nothing was wrong there.
- `resolve-hand` **v11** · `verify_jwt` **false**, unchanged.
- **New rule earned this sprint — Rule 9: a value can be present and empty.** Five link-checks
  looking for a *missing field* came back clean on a field that was there and held `[]`.

---

## PART 1 — THE LABELS. Closed, and the cause was on the server.

### The cause: TWO explicit literals in series, one per side

`resolve-hand` built its `playerResults` response as an object literal carrying `seat_index`,
`device_id`, `name`, `score` — and dropped the evaluator's card arrays. Then, once that was fixed,
`outcomeToRevealShape` on the client rebuilt each result as `({ name, score })` and dropped them
**again**.

**Class D twice over in a single path.** That is why every previous attempt came back clean: fixing
either one alone changes nothing, and inspecting either one alone shows a function that looks
perfectly reasonable.

### How it was found

`tests/label-fiber-diff.mjs` / `tests/label-fiber-mp.mjs` locate the DOM node that actually renders
`" beats "`, read its `__reactFiber$…` key, walk up to the component holding `props.board`, and dump
what it was handed. Solo and MP, same point, diffed:

| | component | board keys | `playerBestCards` | rendered |
|---|---|---:|---:|---|
| solo | `BoardResultCard` | 16 | **5** | "Ten-High Straight beats Pair of Aces" |
| MP (before) | `BoardResultCard` | 16 | **0** | "Two Pair beats Two Pair" |

**An empty array, not a missing field.** Same component, same sixteen keys, same spelling — nothing a
field-name check or a link-by-link walk could have caught.

### Proof after the fix — both seats, because they are different paths

The host builds its reveal from the Edge Function response; the **guest** builds its own from the
`BOARD_REVEAL` broadcast, a different literal on a different path. Reading only the host would have
proven the fix for half the players.

| seat | `playerBestCards` | rendered |
|---|---:|---|
| A — host | **5** | **"Pair of Sixes beats Pair of Twos"** |
| B — guest | **5** | **"Pair of Sixes beats Pair of Twos"** |
| solo control | **5** | "Pair of Sevens beats Pair of Fours" — unchanged |

Both seats show the **same** string, and that is correct rather than a leak of the other player's
view: `getComparisonText` is **winner-first** (`winner === 'player' ? "p beats b" : "b beats p"`), so
the winning hand is named first at every seat. Checked rather than assumed.

---

## PART 2 — THE PANEL

The question was narrow: *what will a tester hit that we have not already fixed.*

### FINDING 1 — economy seat — CONFIRMED, REPORTED, NOT FIXED (needs a ruling)

**Boards decide the record; chips still decide the celebration.**

`result`, the ladder and achievements now derive from **boards won**. The client decides "a win" from
**chips** in about a dozen places, including the win overlay (`app/results.tsx:1071`), the
battle-pass XP and `games_won` mission tick (`:543`), the local achievement check
(`utils/achievements.ts:62`) and the analytics event (`:732`).

**They demonstrably diverge — measured, not reasoned about:**

```sql
SELECT count(*) FILTER (WHERE boards_won*2 = boards_total AND chips_delta > 0)
FROM hand_history WHERE session_type <> 'practice';   -- 2 of 153 real rows
```

Both rows are one real hand from 2026-08-18: **4 players, 2 boards, two seats took one board each,
+50 chips apiece**. Under the boards rule that is `'tied'` — two seats share the max. So that hand
now produces:

| surface | source | says |
|---|---|---|
| headline | boards | **TIE** |
| win overlay | chips | **fires** |
| battle-pass XP + `games_won` | chips | **counts a win** |
| local achievements | chips | **counts a win** |
| analytics `result` | chips | **`'win'`** |
| `hand_history.result` | boards | **`'tied'`** |
| ladder (`wins`, `elo`) | boards | **nothing moves** |

**The chips the player receives are correct either way — settlement is untouched.** What disagrees is
the cue and the counters.

**Not fixed, deliberately.** The win overlay is the winner cue, which is on the report-don't-fix list,
and aligning it means changing a shipped, verified celebration on the strength of a 1-in-150 hand.
The one-line fix is to derive `isWinner` from boards exactly as the headline already does.
**Roye's call.**

⚠️ **Correction to my own note in handoff 106.** I recorded `result='won'` with a negative
`chips_delta` as "possible and correct". Measured across 153 real non-practice rows: **0 such rows**,
and 0 for `'tied'`-with-positive and `'lost'`-with-positive as well. It remains unobserved. The
divergence that *is* real is the one above, which I had not anticipated.

### FINDING 2 — economy seat — FIXED

**The invite screen claimed a credit that did not happen.**

The success state rendered `earned || WELCOME_BONUS`, falling back to the full figure whenever the
grant returned 0 — and **0 is a real outcome**. `record_reward` is once-per-device, so a player who
follows a **second** friend's link redeems successfully (a new referrer/redeemer pair) and receives
nothing, while the screen said *"+100 💰 welcome bonus added to your balance"* over an unchanged
balance.

Measured, not inferred:

```
record_reward('78c2-065b-aad7', 100, 'referral_welcome', true)
  -> {"ok": true, "granted": 0, "new_balance": 100, "already_granted": true}
```

The screen now states what actually moved, and says so plainly when the bonus was already claimed.

### FINDING 3 — QA seat — the referral path had never once been walked

3,140 codes minted, **0 redemptions in the entire history of the product**. The gate that made them
redeemable was fixed last sprint and the path was never exercised, so "fixed" rested on a code read.

Walked end to end on a device that has never played, **both engines**:

```
chromium  device 78c2-065b-aad7  ->  "You're in! +100 welcome bonus added to your balance."
webkit    device 39dd-9820-3d8d  ->  same, 0 console errors
```

Referrer paid **300** per redemption (600 across two), redeemer **100**, a second attempt on the same
pair correctly refused (`"Already redeemed"`), a different friend on the same code accepted. **The
referral loop works, for the first time.**

Product note, not a defect: the referrer earns **3×** what the person who actually joined receives.
Deliberate or not, that is a values question rather than a bug.

### FINDING 4 — accessibility seat — FIXED — a signal the harness printed and nobody read

The loop had been printing a focusable-but-roleless count on **every run since it was written** and
asserting on **none** of it. Five real controls rendered as `tabindex="0"` divs with no role — read by
a screen reader as plain text, with nothing to say they act:

| screen | control | what it does |
|---|---|---|
| `/hand-history` | `All (n)` · `Wins (n)` · `Losses (n)` | filter the history |
| `/battle-pass` | `UNLOCK PREMIUM — 5,000 chips` | **spends 5,000 chips** |
| `/battle-pass` | `CLAIM` | **claims a reward** |

All five now declare a role, a label, and — for the tabs — a selected state.

**The assertion is the durable part, and it earned itself immediately.** A direct sweep of both routes
reported them clean after the first four were fixed; the assertion, running inside the walk, caught
**`CLAIM` as a fifth** — because `CLAIM` only renders once a tier is claimable, and a device that has
never played never draws it. *A one-shot probe of a fresh session cannot see a control that state has
to earn.*

It asserts only on **named** roleless focusables. An empty one is react-native-web giving a ScrollView
`tabindex=0` so a keyboard can scroll it — home's is 393×788 and appears on nearly every screen.
Asserting on the raw count would have gone red everywhere and been switched off within a run.

### WITHDRAWN BEFORE FILING — the "Lo e" encoding bug that wasn't

A read of the same tabs reported them as **`"Win  (0)"`** and **`"Lo e  (0)"`** — a missing-glyph bug
of exactly the kind `CLAUDE.md` says to check for before any release. It was **my own instrument**:
the probe applied a `replace()` whose escaping degraded to `/s+/g` and ate every `s`.

Codepoints, with no string processing at all: `57 69 6e 73` — **`Wins`**. Both engines. The text was
never wrong. **Filed nothing.**

### Seats that found nothing to file

- **Security** — the new `bestCards` in the Edge Function response is showdown data, released at
  resolution, and is the same five the reveal already draws. No pre-showdown exposure. `verify_jwt`,
  `record_reward`, the clamp and the settlement path untouched.
- **Game-feel / casino-card UX** — the reveal arc, the winner cue and the card surfaces are shipped
  and verified; nothing this sprint touched them.
- **Simplicity advocate** — asked of every finding whether removing beats fixing. It does not in any
  of the four: three are one-line honesty or labelling fixes, and the fourth is a ruling, not code.
  The `Tie bonus` line at `results.tsx:1136` is the one place that already reports the divergent case
  honestly, so it stays.

---

## Loop

Six cells — **both engines × both widths × all three board counts** (2p/4 boards, 3p/3, 4p/2) — run
only after the bundle hash was stable across two samples. The self-test planted its overflow and its
clipped-text defect in every cell and **caught both every time**.

## Instrument failures — 2, both mine, both caught before they became findings

1. **The `/s+/g` mangling above**, which would have been a filed encoding bug.
2. **Two cells "completed" with no result.** Piping the harness through `head` closed the pipe and
   SIGPIPE'd the run at the self-test line. Both re-ran to completion without the pipe. **A cell that
   reports nothing is not a cell that passed** — worth stating, because the exit code was 0 both times.

## Production unchanged

`iap_enabled` **false** · `web_payments_enabled` **false** · `hand_rake_pct` **5** ·
`emergency_chips_amount` **200** · `rewarded_ad_chips` **100** · `mp_board_reveal_enabled` **true** ·
`record_reward`, `record_hand_net`, the faucet, the rescue and the settlement path **untouched** ·
`verify_jwt` untouched · **no `app_config` key written** · **no `game_rooms` or `room_players` row
edited** · `Card.tsx` untouched · missions still inactive · the client's `update_leaderboard_elo` call
**not** re-added · **no DB function, trigger or constraint changed this sprint** · nothing backfilled.

**Edge Function:** `resolve-hand` **v10 → v11** — one field added to the response literal.
