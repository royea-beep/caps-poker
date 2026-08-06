# REVEAL SEQUENCE SPEC — 2026-08-06

**Design document only.** No app code touched. Implementation waits until the RAM is cleared —
source edited here could be corrupted before commit, and every test validating it would run on the
same suspect memory.

## The decision (Roye, 2026-08-06, verbatim)

> "רגע החשיפה אמור להיות הרבה יותר קל ומהיר להבנה ואפשר גם לקחת עוד כמה שניות בשביל לחשוף טרן וריבר
> ושהשחקנים יבינו מבחינת אחוזים וגם מבחינת הקלפים מהם רוצים לבקש שיבוא. זה חלק מאוד חשוב מהעניין במשחק."

Three requirements, in his order: **(1)** easier and faster to understand · **(2)** stage the turn and
the river · **(3)** show the odds and the outs. Structure is **board by board**.

---

## ⚠️ TWO CORRECTIONS BEFORE THE SPEC — BOTH CHANGE WHAT THIS WORK IS

### 1. I was wrong that "the reveal is static" (panel finding B-3). Withdraw it.

My panel probe measured **geometry only** — `getBoundingClientRect` at five timestamps. It found card
sizes byte-identical and concluded the reveal doesn't move. But the existing reveal animates
**opacity, `rotateY` and `scaleY`**, none of which change a bounding box:

| Existing beat | What actually happens |
|---|---|
| `t(300)` | flop flips, 3 cards, sounds 50ms apart |
| `t(1600)` | turn flips, distinct `turnReveal` sound |
| `t(2800)` | **river squeeze** — `scaleY 1 → 0.08 → 1`, 250ms `Easing.inOut(cubic)` |
| `t(3300)` | river flip |
| `t(3600)` | hand names fade in + gold win-glow |
| `t(3700)` | **community spotlight** — non-winning cards drop to 0.35 opacity |
| `t(4100)` | result scales in, chip counter runs 800ms |

That is a real, considered beat structure. **A geometry-only instrument cannot see opacity or
rotation, and I reported its blindness as the app's stillness.** Same class of error as the
resize-measurement trap: the tool's limitation presented as a finding.

### 2. The actual defect is the opposite of what we assumed — and the codebase already documents it.

```js
const advanceMs = isLastBoard ? t(5600) : t(14000);
const progressMs = advanceMs - t(4100);   // = 9,900ms
```

The result is fully visible at **t(4100)**. The board then sits for **9.9 seconds** behind a depleting
progress bar. A 2026-06-17 comment in `BoardReveal.tsx` already names this — *"leaving ~9.9s of dead
wait"* — and fixed it **for the last board only**.

**Current real totals:** 2 boards **19.6s** · 3 boards **33.6s** · 4 boards **47.6s**.

So we are not adding seconds to a fast reveal. **We are replacing dead time with the content Roye
asked for.** Every requirement is funded from time the player is already spending, and the total
comes *down*.

---

# BO1 — THE BEAT SHEET

All times are per board, from that board taking focus. `t(x)` respects the existing
`SPEED_MULTIPLIER` (`fast .4 / normal 1.0 / cinematic 1.8`).

| t | Beat | What moves | Why |
|---|---|---|---|
| **0** | **Focus in** | Board N scales `0.96 → 1.0` (350ms, `cubic-bezier(.2,.8,.2,1)`); boards N±1 drop to **0.25 opacity** and `0.94` scale | Dim+scale, **not blur** — see below |
| **350** | **State before the turn** | Flop already face-up; both hands face-up; **equity bar** wipes in over 400ms | This is the "understand" frame |
| **750** | **Outs appear** | Up to 8 out-cards fan in face-up at 60% size, staggered **60ms** | Requirement 3, as cards not text |
| **2000** | **HOLD — the read beat** | Nothing new enters; equity bar has a slow 2% breathing pulse | Comprehension needs stillness. **Not dead time — the bar is alive and the player is reading** |
| **2600** | **TURN** | Existing squeeze (`scaleY 1→0.08→1`, 250ms) then flip 220ms | Reuses the river squeeze already built |
| **3100** | **Equity updates as a CHANGE** | Bar animates old%→new% over 500ms; a **delta chip** `+18%` / `−22%` rises 12px and fades over 900ms; bar tints green on gain, amber on loss | Requirement: *legible as a change, not just a new number* |
| **3900** | **Outs re-fan for the river** | Dead outs fade out (200ms) and shrink; surviving outs re-stagger | Shows the draw narrowing — this is the tension |
| **5200** | **HOLD — the second read** | Still | The player now knows exactly what they want |
| **5800** | **RIVER** | Squeeze + flip | |
| **6300** | **Resolve** | Winning five take `scale 1.06` (180ms) and hold; **losing hands drop to 0.5 opacity and desaturate over 240ms** | Existing spotlight, extended to hands |
| **6900** | **Names + result** | Hand names fade in; result scales in | Existing |
| **7600** | **Chips** | Counter runs 800ms — **starts only after the cards have held 700ms** | Numbers and cards must never compete |
| **8000** | **Focus out → board N+1** | 350ms cross-scale | |

### Totals

| Boards | New | Current | Change |
|---|---|---|---|
| 2 | **14.0s** | 19.6s | **−5.6s** |
| 3 | **22.0s** | 33.6s | **−11.6s** |
| 4 | **30.0s** | 47.6s | **−17.6s** |

*(non-last board 8.0s; last board 6.0s — no focus-out, chips resolve straight into the results screen)*

> **THE NUMBER FOR ROYE: 30 seconds at 4 boards** — exactly the top of his approved budget, **17.6
> seconds faster than today**, and it now contains the odds and the outs that today's version does not.

### Focus mechanism: **dim + scale. Not blur.**
Blur on RN Web needs a filter on a large subtree and is the most reliable way to drop frames on
mid-tier Android; it also makes card pips unreadable, which fights requirement 1. Opacity and
transform are compositor-only properties — the same ones the codebase already animates successfully.
`REMOVES` risk relative to any blur-based approach.

### Outs visualisation
A single row beneath the board: **the actual out-cards, face-up, at 60% scale**, with a count badge
(`7 outs`). A player recognises "I need a heart" from a heart faster than from a sentence — his point.
- Cap the row at **8 cards**; beyond that show 8 + `+5` overflow chip. Twelve tiny cards is noise.
- Group by rank/suit where they collapse cleanly ("any ♥" when the whole suit wins).
- When an out **dies** on the turn, fade + shrink it rather than removing it instantly — seeing the
  draw narrow is the drama.
- **Open question — see the end:** for 3–4 player boards, whose outs? Player's only, or every seat's?

---

# BO2 — COMPUTATION

### The finding that removes the performance problem: **none of this needs sampling.**

`computeOmahaEquity(playerCards, allBotCards, communityCards, maxSamples = 200)` already exists in
`utils/handEvaluator.ts` and already short-circuits to exact evaluation when `neededCards <= 0`.

For a 3-player board: 52 − 12 hole − 3 flop = **37 unseen**.
- **Post-flop** (2 to come): `C(37,2) = 666` exact combinations.
- **Post-turn** (1 to come): **36** exact.
- **Post-river**: 1, already exact today.

**666 is enumerable.** There is no reason to sample anything, at any street. That answers three
questions at once:

1. **Stable to 1%?** It is stable to **0.0%** — the number is exact and identical on every render and
   every device. No flicker, ever. The `maxSamples = 200 ≈ ±4%` default is simply not used.
2. **Outs enumerated, not sampled: confirmed** — and by the same mechanism. At the turn there are 36
   candidate rivers; evaluate each once and collect those that flip the winner. Exact, and it is the
   *same loop* that produces the post-turn equity, so outs are free.
3. **MP determinism** — see BO3.

### When it is computed: **pipelined, never on the critical path**

MEMORY records the trap precisely: `samplePermutations(5000) × 4 boards = 20,000 evaluator calls per
mount = 12+ seconds`, fixed with `InteractionManager` and a cap of 400. That is **~0.6ms per
evaluator call**, and it is the budget this design must respect.

Cost here: 666 combos × 3 hands ≈ **2,000 calls ≈ 1.2s per board.** Too slow for the critical path;
trivial when pipelined.

- **Board 1** computes at **READY**, deferred behind `InteractionManager.runAfterInteractions`. It is
  not needed until `t(350)`, and the flop/turn beats give **1.6s of runway** before the bar must
  render. Until it resolves the bar shows a skeleton, never a wrong number.
- **Boards 2..N** compute while the previous board is on screen — **8 seconds of runway each** for a
  1.2s job. Enormous slack.
- **Not at deal time**, and this is the one place the obvious answer is wrong: hole cards are not
  assigned to boards until the player finishes arranging, so there is nothing to compute at deal.

⚠️ **`InteractionManager.runAfterInteractions` never resolves on web** — MEMORY.md, the S54
DEAD-RENDER entry, where `visibleBoardCount` stays 0 forever for exactly this reason. **The web path
must use a different defer** (`requestIdleCallback`, or `setTimeout(…, 0)` after first paint). Any
implementation that reuses the native pattern verbatim will silently show a skeleton forever on web.

### Budget and verification
- **Must not add measurable time to the deal:** it does not run at deal.
- **Must not drop frames:** all reveal animation is opacity/transform (compositor-only); the equity
  work is off the animation thread and completes ≥1.6s before its first frame.
- **How to verify:** instrument `performance.now()` around each board's computation and assert
  `< 2000ms`; record the longest frame during a full 4-board reveal and assert no frame `> 32ms`
  (two dropped frames at 60fps). **Both measurements are only meaningful on clean RAM** — today's
  machine produces `0xC0000005` faults across six unrelated binaries, so any timing taken now is a
  coin flip, not a result.

---

# BO3 — MULTIPLAYER

### Who computes: **each client computes its own, and this is only safe because it is exact.**
Host-broadcast would add payload and a new failure mode (a client that misses the message shows
nothing). Client-side computation is normally risky precisely because two clients sampling
differently see different percentages — **but there is no sampling here.** Exact enumeration over an
identical known card set is deterministic, so every client independently arrives at the same integer.
Client-side gets the resilience without the desync. *(If sampling is ever reintroduced, this decision
must be revisited — it is the sampling that makes host-broadcast necessary.)*

### A player leaves mid-reveal
The reveal is already driven from a completed `BoardRevealPayload`; a departure changes nothing on
the remaining clients' screens. Their seat's equity/outs were computed from cards already dealt and
stay correct. **No recompute** — recomputing to exclude a leaver would change percentages mid-reveal
and destroy the one thing this design is for.

### The host leaves mid-reveal
Worse, and it is pre-existing: the sequence is host-driven via `sendBoardReveal`. Clients hold the
payload for the current board, so **the current board completes locally**, but no further board
arrives. Required behaviour: after `boardDuration + 3s` with no next payload, clients finish the
current board and route to results with what they have, rather than sitting on a frozen board. The
longer sequence widens this window from ~14s to ~30s per hand, so it needs handling — but the failure
exists today and is not created by this design.

### Noted, not solved
A longer reveal means hole cards sit **on the wire for longer**. The channel currently broadcasts them
in the clear — the known Phase 0 issue (`docs/PHASE_0_CHANNEL_AUTHZ.md`). This design does not make
the vulnerability worse in kind, only in duration. **Not addressed here.**

---

# BO4 — WHAT THIS CLOSES

### Closes
- **B-4 — "the only control during the reveal is Leave game."** The sequence gets tap-to-advance as a
  first-class affordance (see skip, below).
- **E5 — *"'Tap to reveal' הוא הטקסט הכי חלש במסך"*.** Replaced by a real staged interaction.
- **B-2 / type-hierarchy inversion — explicitly assigned, not inherited.** The spec fixes the sizes at
  the one screen where they matter most:

  | Element | Size | Today |
  |---|---|---|
  | Hand name ("Flush") | **22px semibold** | not the largest |
  | Equity % | **20px tabular numerals** | did not exist |
  | Opponent name | **13px minimum** | **7px** |
  | Decorative suit glyph | **≤ 20px** | **45px** |

### Partially closes
- **E3 — emotional contradiction** (*"'YOU LOSE' ענק בראש ומיד '✅ YOU WIN' בבורד 1"*). Board-by-board
  resolution means each board's result lands in its own moment, so a per-board win no longer sits
  under a global loss headline *during the reveal*. The contradiction on `/results` is untouched.
- **E1 — confetti too subtle.** The spec gives it a defined moment (t=6300, on resolve) but does not
  change its intensity.

### Does NOT address
- **E2 — the loss moment** (*"אדום סטטי; צריך להיות רך ומעודד"*). This is `/results`, not the reveal.
- **E6 — three stacked exits.** `/results`.
- **C2/C3/C4** — card-back hierarchy, visual ownership, undifferentiated frames. These are card-face
  design, not sequence design, and the spec deliberately does not touch them.
- **A5** — the wrong colourblind label, still live. The reveal leans on green/red; until A5 is fixed,
  colourblind players get a worse version of this sequence, not a better one.

### The disagreement this dissolves
The panel's sharpest split — **TV director** wanting a varied reveal order for drama, **casino UX**
wanting a fixed order because players verify results and variation reads as malfunction — **is
resolved by Roye's choice.** Turn-then-river board-by-board is inherently fixed and verifiable, and
the drama comes from **the hold and the odds**, not from shuffling the order. Both experts get what
they asked for.

### Skip
Skip already exists (`handleSkip` → jump to result state → `doAdvance` after 800ms) and **jumps to the
end of the current board, not the whole reveal.** With 4 boards at 30s that means four taps to get out.
**Recommendation: keep single-tap = skip current board, add long-press (500ms) = skip to final
result.** A 30-second sequence on the twentieth hand must have a one-gesture exit.

---

# OPEN QUESTIONS FOR ROYE

1. **Whose outs on a 3–4 player board?** Yours only (clear, but hides the story), or every seat's
   (complete, but four out-rows on one board is a lot)? *My read: yours only, with the winner's shown
   at resolve — but this is a product call.*
2. **Equity for 3–4 players: one number or a split?** "You 34%" is simple; "34 / 41 / 25" is the real
   picture and is what a broadcast shows.
3. **Does the hold get a voice?** A one-line call — *"needs a heart"* — makes the beat unmistakable but
   adds a string to translate and a line to maintain. Silence is cheaper and less clear.
4. **8.0s per board — right, or still too slow at 4 boards?** 30s is the top of your stated budget.
   If 4-board hands are common, 7.0s/board gives 27s total.
5. **Should skip be remembered?** A player who skips three hands running probably wants the fast path
   by default. Auto-switching is presumptuous; an offer after the third skip is not.
6. **A5 first?** The sequence leans on green/red. Fixing the colourblind label before building this
   costs little and makes the whole thing work for more people.
