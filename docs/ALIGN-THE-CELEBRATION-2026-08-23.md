# CAPS — ALIGN-THE-CELEBRATION: one definition of winning, everywhere (2026-08-23)

Roye ruled (a). The record, the ladder, `/rank`, `/stats` and the server achievements had derived a
win from **boards** since the boards rule shipped. The celebration still derived it from **chips**.
That is now closed.

---

## MAP — carried forward, extended

- `vamos_handoffs` is the channel. Latest: id 108.
- **One derivation, eight readers.** `utils/handOutcome.ts` owns the rule and returns three states.
- **A tie is a third state in every reader**, never "not a win".
- `resolve-hand` **v11** · `verify_jwt` **false**, unchanged. No DB change this sprint.
- **New:** `result_viewed_duration` **never fires on web** — it is emitted from a `useEffect`
  cleanup, and a full-page navigation tears down the JS context without running React cleanups.
  Pre-existing, not introduced here, but it means the funnel relies on `hand_completed` /
  `game_ended`, not on that event.

---

## One derivation, eight readers

`utils/handOutcome.ts` → `deriveHandOutcome(boards): 'win' | 'loss' | 'tie'`. Boards won **outright**
decide it; a board that itself tied awards nobody. At two players this is solo's original rule
unchanged; at three and four it matches `resolve-hand`'s server rule exactly.

| # | reader | was | now |
|---|---|---|---|
| 1 | local hands-won counter + win/lose sounds | `netChips > 0` / `< 0` | `handOutcome` |
| 2 | battle-pass win XP | `netChips > 0` | `handOutcome === 'win'` |
| 3 | `games_won` mission tick | same variable as 2 | `handOutcome === 'win'` |
| 4 | server mission RPC tick | `netChips > 0` | `handOutcome === 'win'` |
| 5 | analytics `result_viewed_duration` | `netChips > 0 ? 'win' : 'lose'` | three values |
| 6 | the win overlay — trigger, gate and copy | `netChips > 0` (practice: boards) | `handOutcome === 'win'` |
| 7 | local achievement check | `netChips > 0` | `deriveHandOutcome(...) === 'win'` |
| 8 | session W-L tally | `netChips > 0` / `< 0` | `handOutcome` per record |
| + | `hand_completed` / `game_ended` | a **second copy** of the boards rule | `handOutcome` |

**Six and seven were the brief. One, four and eight I found auditing the survivors**, and the two
funnel events I found by probing the wire. The hands-won counter and the celebration sounds sat
inside the same `netChips` branch; the server mission tick would have disagreed the moment missions
were switched on; and the session tally counted positive nets as wins even though `HandRecord`
carries the boards.

### The two funnel events were the subtlest

They were already boards-derived, so they read as fine. They carried their own copy of the rule:

```ts
won: bWonCount > revealData.boards.length - bWonCount
```

Wrong twice. It is a **two-branch boolean over a three-way outcome**, so every tie logged as
`won: false` — indistinguishable from a loss in the funnel these events exist to feed. And
subtracting from the total treats **a board that itself tied** as the opponent's.

`won` keeps its name and boolean type so rows already recorded stay comparable; `outcome` is added
alongside it.

---

## Tie treatment, per reader

A tie **neither celebrates nor mourns**.

| reader | on a tie |
|---|---|
| overlay | **does not fire.** The headline says `TIE GAME` in mint, and the tie-bonus line still reports the chips if positive |
| sounds | **silent.** Previously a tie with a positive net got the winning fanfare and a tie with a negative net got the losing one, purely on chips |
| XP | game XP and per-board XP still awarded — a tie still won boards — but **no win bonus** |
| `games_won` | not ticked |
| local achievements | `hard_mode_win` / `online_win` do not unlock; `handsWon` does not increment |
| analytics | `outcome: 'tie'`, `won: false` |

## What the analytics event now carries

`hand_completed` and `game_ended`, caught on the wire on the exact production shape:

```
hand_completed  {"boards_won":1,"boards_total":2,"efficiency_pct":50,"won":false,"outcome":"tie",…}
game_ended      {"boards_won":1,"boards_total":2,"won":false,"outcome":"tie","net_chips":50,…}
```

Four players, two boards, **one board each, +50 chips → `outcome: "tie"`**. That is the divergence
that started this, logged honestly. `result_viewed_duration` carries `'win' | 'lose' | 'tie'` with
`'lose'` keeping its existing spelling — but see the MAP note: **it does not fire on web at all.**

## Settlement untouched

`record_hand_net` is zero-sum and was not touched. **This changes what is celebrated, not what is
paid.** The surviving `netChips` checks are all statements about money and are correct as they are:
the "+N chips earned" line, the tie bonus, `updateBiggestWin`, the Net Result figure, and the chip
animation guard.

One consequence needed handling: the overlay quoted *"You won N chips!"*, and now that **boards**
open it, a board win can arrive with a net of zero. It states a chip figure only when there is a
positive one, and says *"You won the hand!"* otherwise.

---

## Proof, on the case that exposed it

At four players the board count is **2**, so "one board each" is a 1-1 split — reachable by playing
real four-player hands until one comes up. No fixture and no forced state.

⚠️ Two instrument corrections were needed before this measured anything real, both mine:

1. `?players=4` is honoured **only in practice** (`game.tsx:122`). The first run asked for four
   players, got four **boards** — which is two players — and would have "proved" the alignment on
   the wrong table size entirely.
2. `numberOfPlayers` lives under `state.config`, and only `config` is in the store's `partialize`.
   Seeding `state.numberOfPlayers`, the obvious guess, persists nothing.

**Result — every surface agrees:**

| boards | net | headline | overlay | win XP | analytics | tie bonus |
|---|---:|---|---|---|---|---|
| **1/2** | **+50** | **TIE GAME** | **no** | **no** | **`tie`** | **yes** |
| 2/2 | +150 | YOU WIN | yes | yes | `win` | – |
| 0/2 | −50 | YOU LOSE | no | no | `lose` | – |

The first row is the production shape. **Before this change it showed the win overlay and credited
win XP over a hand the record and the ladder both called a tie.**

## Clean win and clean loss unchanged · solo unchanged

Re-measured rather than assumed, across the same runs — a clean win still celebrates fully and a
clean loss still does not, at both 2-player (4 boards) and 4-player (2 boards). The risk in this
change was over-correcting a rare case into a common one; the win and loss rows above are the
control, and they are unchanged.

## Winner cue, re-measured after touching the overlay

| width | colour | meaning |
|---|---|---|
| **3px** | `rgb(255, 215, 0)` gold | won |
| **2px** | `rgb(79, 214, 168)` mint | the field |
| **1px** | `rgba(0, 0, 0, 0.22)` | neutral |

`distinct border widths present: [3,2,1]` — **in greyscale the width still carries it.** Unchanged.

## Tests

`utils/__tests__/handOutcome.test.ts` is new and covers the production case directly. Two existing
achievement tests **asserted the defect**: they expressed a win as `netChips: 100` on top of a
fixture whose boards are one-each, and passed only because the check read chips. They now express a
win as boards, and the tie-with-positive-chips case is asserted in **both** directions — it must not
unlock, and a board win with a zero net must.

**2,642 passed, 0 failed.**

---

## Final confirming run — and an unplanned control

Six real four-player hands, chromium, with the analytics read off the wire from `game_ended`:

| hand | boards | net | headline | overlay | win XP | analytics |
|---|---|---:|---|---|---|---|
| 0 | **1/2** | **+50** | **YOU WIN** | yes | yes | `win` |
| 1 | **1/2** | **+50** | **TIE GAME** | **no** | **no** | **`tie`** |
| 2 | 0/2 | −50 | YOU LOSE | no | no | `loss` |
| 3 | **1/2** | **+50** | **TIE GAME** | **no** | **no** | **`tie`** |
| 4 | 1/2 | +100 | YOU WIN | yes | yes | `win` |
| 5 | 0/2 | −50 | YOU LOSE | no | no | `loss` |

`all sampled hands agree across headline / overlay / XP / analytics`

**Hands 0, 1 and 3 are the argument for the whole sprint.** All three show `boards 1/2` and `net
+50` — identical on both counters — yet 0 is a **win** and 1 and 3 are **ties**. The difference is
that hand 0's other board *itself tied* and awarded nobody, so one board outright beat zero; in 1
and 3 a bot took it. **Chips cannot tell those three hands apart. Boards can.** Under the old rule
all three fired the win overlay and credited win XP; now each is celebrated as what it was.

