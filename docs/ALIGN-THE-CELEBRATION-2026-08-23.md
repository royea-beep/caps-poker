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
decide it; a board that itself tied awards nobody.

> **CORRECTION (2026-08-27) — this section previously claimed "at three and four it matches
> `resolve-hand`'s server rule exactly". THAT CLAIM WAS FALSE, and nothing tested it.**
>
> The derivation compared my boards against the opponents' **combined** total, because
> `RevealBoardData.winner` collapses every opponent into the single token `'bot'`. The server
> compares against the **highest single seat**. Enumerating every reachable distribution at every
> table size found they disagree on exactly one shape — **three players, three boards, one board
> each**: the server records `'tied'` for all three seats, the client returned `'loss'` to every
> one of them. Two players (4 boards) and four players (2 boards) agreed on all 81 and all 25
> distributions, which is why the four-player production case this sprint was built on was right.
>
> So the sprint closed the chips-vs-boards split and left a **boards-vs-boards** one: a sixth
> definition of winning, in the one derivation itself. It is now fixed. Boards carry
> `winnerSeat` (local player `0`, each opponent a distinct index, `-1` = board tied) through all
> four producers — solo, the MP host path, the MP guest path, and the session hand record — and
> the rule compares against the best single opponent, which is the server's rule. The parity
> claim is no longer a sentence: `handOutcome.test.ts` transcribes the server rule from
> `resolve-hand/index.ts` and asserts agreement across **every** distribution at 2, 3 and 4
> players. Reverting the seat rule fails exactly the 3-player cells and no others.

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

---

## FOLLOW-UP (2026-08-27) — the sixth definition of winning was inside the one derivation

The ruling was "one definition of winning, everywhere". This sprint removed the chips-derived one
and left a **boards-derived one that was not the server's**. Recorded here because the failure mode
is the same one the sprint was called to fix, one level down.

### How it was found

Not by walking the chain. By refusing the sentence. The section above claimed the derivation
"matches `resolve-hand`'s server rule exactly" at three and four players — a claim, not evidence
(Iron Rule 14). Both rules were transcribed from source and run against **every reachable
distribution** at every table size:

| table | boards | distributions | disagreements |
|---|---|---|---|
| 2 players | 4 | 81 | **0** |
| 3 players | 3 | 64 | **6** — all one shape |
| 4 players | 2 | 25 | **0** |

The single disagreeing shape is **three seats, one board each**:

| | boards_won | rule | result |
|---|---|---|---|
| `resolve-hand` | 1-1-1 | three seats share the max → each `'tied'` | **TIE** |
| `deriveHandOutcome` (was) | mine 1 vs *combined* 2 | `mine < theirs` | **LOSS** |

`RevealBoardData.winner` is `'player' | 'bot' | 'tie'`, so **every opponent collapses into one
token**. Counting it yields the opponents' *combined* total; the server compares against the
*highest single* seat. Identical at two seats, identical at four (two boards cannot make a
three-way split), different at three. The four-player production case the sprint was built on sits
in a column where the two rules agree, which is why it never surfaced.

### Reachability — measured, not argued

`hand_history` holds **42 non-practice rows at 3 players / 3 boards**, 15 of them at
`boards_won = 1`. **Not one row at three players has ever been recorded `'tied'`**, against 13 ties
in 24 rows at two players. The 3-player distributions cannot be reconstructed from history:
`boards_data` is **NULL** on those rows — present and empty, Rule 9 — so the shape is proved
deterministically instead, not asserted from the ladder.

**This was not only the celebration.** In solo the client is the recorder: `queueHandResult` sends
this same outcome, and `record_hand_result_d` maps `p_won IS NULL → 'tied'`. So a solo 3-player
1-1-1 hand was **written to `hand_history` as `'lost'`** and moved the ladder as a loss, while the
identical shape in multiplayer was written `'tied'` by `resolve-hand`. Same boards, two records.

### The fix

Boards now carry `winnerSeat` — `0` = the local player, each opponent a **distinct** index, `-1` =
the board itself tied — through **all four producers**: solo (`utils/gameLogic.ts`), the MP **host**
path and the MP **guest** path (`app/multiplayer-game.tsx`, separate builders — fixing one aligns
half the table), and the session hand record (`utils/handHistory.ts`). `deriveHandOutcome` compares
against the best **single** opponent, which is `resolve-hand`'s rule. The signature still takes
boards and nothing else, so the "it never sees chips" property test stands.

Records written before the field existed have no seat; those fall back to the collapsed count
rather than reading a missing seat as `0`.

### Proof

`handOutcome.test.ts` transcribes the server rule from `resolve-hand/index.ts` and asserts
agreement across **every** distribution at 2, 3 and 4 players. **Reverting the seat rule fails
exactly the two 3-player assertions and nothing else** — the blast radius, demonstrated rather
than described.

In a browser, on a production export containing the fix (`tests/parity-3p-probe.mjs`, the fixture
mechanism from `celebration-gate-probe.mjs`), read off the rendered headline and the overlay's own
nodes — **7/7 at 393, 320 and 430 px, 0 page errors**:

| # | shape | headline | overlay dots | |
|---|---|---|---|---|
| 1 | **3P one board each** | **TIE GAME** | **0** | **was YOU LOSE** |
| 2 | 3P, one opponent takes two | YOU LOSE | 0 | unchanged |
| 3 | 3P, player takes two | YOU WIN | 20 | unchanged |
| 4 | 3P, every board tied | TIE GAME | 0 | unchanged |
| 5 | CONTROL 2P clean win | YOU WIN | 20 | unchanged |
| 6 | CONTROL 2P clean loss | YOU LOSE | 0 | unchanged |
| 7 | CONTROL 4P, the sprint's own case | TIE GAME | 0 | unchanged |

Exactly one row moves. The tie neither celebrates nor mourns: headline TIE GAME, overlay absent.

### One instrument failure, named

The probe read `null` from every row off a page that was painting at 74 rAF/s. The bundle contains
`import.meta` (a redux-devtools guard) and the export produced in this container emits
`<script defer>` — a **parse** error, so React never mounted. `caps.ftable.co.il` serves the same
bundle as `<script type="module">`; the probe's static server now normalises the tag to match the
deployed one. Checked against the live `index.html`, not assumed. Had the Rule 14a paint preamble
not been there, seven `null` headlines would have read as seven passing absences.
