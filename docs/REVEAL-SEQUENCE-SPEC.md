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

# BP3 — THE NON-COLOUR CHANNEL (mandatory, not a polish pass)

**Rule for the implementer: every state in this sequence must be readable with hue removed entirely.**
Colour may reinforce; it may never be the only carrier. This section exists because the default
implementation of every beat below is colour-only, and a colour-only build would ship a *worse*
reveal for colourblind players than the one it replaces.

Audit finding that makes this non-negotiable: colourblind mode swaps **green/red → blue/orange**
(`COLORBLIND_WIN_LOSE`). That is a **hue-for-hue swap with no second channel**. It helps
deuteranopia and protanopia; it does nothing for tritanopia, total achromatopsia, glare, or a cheap
screen. Redundant encoding is the only robust answer.

### Who is ahead — three channels, not one
| Channel | Encoding |
|---|---|
| **Position** | The leader's equity figure sits **left**, always. Order is the information. |
| **Text** | An explicit `LEADING` / `TRAILING` label — 11px, tracked — under each seat's figure. |
| **Length** | Bar segment length. Already non-hue by nature. |
| *(Colour)* | *Reinforces only.* |

### The equity bar — the classic failure, and the fix
Two hues side by side is exactly the case that dies without colour. Required:
- **A numeric label on each side, inside or adjacent to its own segment** (`34%` / `66%`). The
  numbers, not the fill, are the primary read.
- **A 2px high-contrast divider** at the split point, so the boundary is visible when both segments
  render as the same grey.
- **Different fill treatment per side** — the player's segment solid, the opponents' segment a
  45° hatch at 30% opacity. Texture survives hue removal and greyscale printing.
- Never encode a third seat by hue alone; at 3–4 players use stacked labelled rows, not a
  three-colour bar.

### The delta chip — `▲` / `▼` is mandatory
`+18%` in green and `−22%` in red are **the same chip** to a colourblind player at a glance. The
sign character is small and easily missed at 12px. Required: a **▲ / ▼ glyph** leading the number,
and the chip **rises 12px on a gain, falls 12px on a loss** — direction of motion is itself a
channel, and it is free because the chip is already animating.

### Dead outs — fade+shrink alone is **not** sufficient
The spec fades dead outs to low opacity and shrinks them. That is a genuine non-hue channel and it
is *nearly* enough — but "dimmed" and "small" also describe a card that is simply further away, and
at 60% scale in a fanned row the difference is subtle. **Add a strikethrough rule across the dead
card** (1.5px, high contrast, corner to corner). Unambiguous, hue-free, and it reads instantly as
"this one is gone".

### Winner resolution
Already partly solved and worth keeping: the winning five take `scale 1.06` and hold while losing
hands **desaturate** — desaturation is a hue-free channel by definition. Add the hand name in
**22px semibold** adjacent to the winning cards, so the outcome is stated in words at the moment it
is shown in cards.

### What this also helps
- **A5 / colourblind mode generally** — the reveal stops depending on the palette swap being correct.
- **Panel B-2 (opponent names at 7px)** — the `LEADING`/`TRAILING` labels and the 13px name floor
  land in the same pass.
- **The type-hierarchy inversion** — numerals and hand names become the largest marks in the reveal,
  displacing the 45px decorative suit glyph.
- **Requirement 1, "easier and faster to understand"** — every one of these additions is a
  comprehension aid first and an accessibility feature second. `LEADING`, a labelled percentage and a
  ▲ are faster to read for *everyone*, which is the argument for doing it in the default rather than
  behind the toggle.

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

---

# BY — PHASE 3 SHIPPED, 2026-08-07. Per-seat, the gap, and a slower reveal.

Roye, verbatim: *"מספר נפרד לכל יריב ומן הסתם רגע החשיפה יותר לאט כדי שיספיקו להבין
מה קורה וזה הרגע כביכול הכי מותח של המשחק אז שיהיה מותח"*.

## The beat sheet as SHIPPED (measured on live, not intended)

| t | Beat | Measured |
|---|---|---|
| 300 | flop flips | — |
| ~500 | equity + outs land | 208–539ms across runs |
| **1300–2600** | **HOLD 1** — outs known, waiting for the card that decides them | — |
| 2600 | **TURN** flips, alone | — |
| **3100** | **numbers react** (own timer, BY2) | 3252 / 3653ms observed |
| **3400–4800** | **HOLD 2** — dead outs strike through, survivors settle | — |
| 4800 | river squeeze | — |
| 5300 | river flip; equity block unmounts | 5403 / 5413 / 5205 avg into board |
| 5600 | hand names | — |
| 6100 | result | — |
| 10000 | advance | **10,006 / 10,000 / 9,987ms** |

**Totals measured on live:** 2 boards **17,821ms** · 4 boards **37,813ms**
(3 boards not run; 27.6s by construction). Inside the ~40s authorisation.

The result dwell is UNCHANGED at 3.9s. All 2.0s added went into HOLD 1 (+1.0), the
gap (+0.5) and HOLD 2 (+0.5). Nothing added is a depleting bar with nothing to want —
that is the distinction between this and the 9.9s Phase 1 deleted.

## Per-seat equity — the spec's open question 1 and 2, answered by building it

Cost is unchanged: **119.3 / 123.6 / 128.1ms** at 2/3/4 players, against ~127ms for the
you-vs-field pair it replaces. Same enumeration, more counters, as predicted.

**Tie rule:** every combination awards exactly **one point**, split equally among the seats
tied for the best hand — two of three seats chopping take 0.5 each. Raw shares therefore sum
to 1 by construction, and largest-remainder rounding forces the displayed integers to exactly
100. Verified live: `45/31/24`, `68/23/6/3`, `84/13/3/0`, `90/6/4`, `67/18/15`, `78/14/8`.

**Layout was the constraint, not compute.** Four figures cannot share one 375px bar, so the
display forks by seat count — 2 seats keep the split bar, 3–4 seats get stacked labelled
rows, which is what BP3 already required. Measured at 375 with four seats: block **343×107**,
right edge **359 of 375**, no overflow, each percentage **34px** wide at **14px**. No
fallback was needed and nothing was collapsed.

## Two defects that only measurement found

1. **Every fixed-width seat column rendered at ZERO width** (all boxes read `359-359` on a
   375px screen). React Native defaults `flexShrink` to 0; **react-native-web maps to CSS
   flexbox where it defaults to 1**, so the `flex:1` bar track took the whole row. `flexShrink: 0`
   is load-bearing on every labelled column in this file.
2. **`equity-value-seat-N` meant two different elements** — the 15px percentage in the
   multi-seat layout, the 11px standing label in the 2-seat one. One selector, two answers,
   chosen by seat count. Per-seat anchors now belong to the multi-seat layout only.

## What could NOT be measured

The **card→numbers gap** is 500ms by construction (two independent timers at t(2600) and
t(3100) scheduled in the same effect), and the numbers were observed landing at 3252ms and
3653ms. But the card flip itself was **not** directly observable in the DOM: `textContent`
does not change on flip (face-down cards still carry their text) and the community row's
child transforms returned nothing. Three observables, three failures. The empirical
card→number delta is therefore **not measured** — only the number's absolute time is.
