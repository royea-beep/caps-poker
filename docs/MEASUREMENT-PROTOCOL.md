# MEASUREMENT PROTOCOL

**Why this exists:** five wrong findings in two days, one root cause — *the instrument selected the
wrong element and the report was confident.* Every one was measured, and every one was wrong. This is
a procedure, not a reminder to be careful.

| # | The claim | The truth |
|---|---|---|
| 1 | "The reveal is static" | Measured **geometry**; the animation is opacity / rotateY / scaleY — none of which move a bounding box. |
| 2 | "The 35px glyph is decoration" | It's a **card pip** — ancestor chain `19×41 → 54×70 → 54×70`, inside a card. |
| 3 | "The primary action is 10px" | That was a **header status chip**. Four elements read `✓ READY`; the button is 16px. |
| 4 | "`rf(11)` renders as 7px" | **Two elements, two files.** `BoardReveal.sectionLabel` (rf(11), `🤖 Bot`) vs `Board.rowLabel` (rf(7), `Bot 1`). |
| 5 | "`adjustsFontSizeToFit` shrinks handName to 10px" | It's **`HandBadge`**, two literals by prop. And `Board.handName` **never renders in solo at all**. |

---

## The six rules

### 1. Never identify an element by its text content alone
Text repeats, and the duplicates are usually the trap:
- **four** elements read `✓ READY` — one is the button, the rest are status
- `Bot 1` exists in **two components** (`Board.rowLabel`, `BoardResultCard`)
- `🤖 Bot 1` and `Bot 1` are **different controls in different files** — and a regex anchored `^Bot \d$`
  silently excludes the emoji one, so you sample one file while reading the other

Identify by a **stable structural anchor**: a `testID`, the ancestor chain, or a uniquely-shaped
parent. *"The row that contains a bare `Bot N` label and four cards"* is an anchor. *"The element
whose text is `Bot 1`"* is not.

### 2. Walk the ancestors before classifying anything
**"Decoration" and "primary action" are claims about ROLE, and role lives in the tree, not in the
font size.** Finding #2 died the moment the chain showed a 54×70 card. One `parentElement` loop would
have prevented it — and prevented #3 and #5 too.

### 3. Confirm the element is reachable on the path you are testing
Before measuring *or editing*. `Board.handName` was edited **twice** while being unrenderable in solo
play — it is gated on `revealed &&`, hardcoded `false` at `game.tsx:1245` and
`BoardArrangement.tsx:260`. Grep the prop that gates it and check who passes what.

### 4. A mechanism that explains the numbers is a hypothesis, not a finding
The most dangerous of the five. `16 × 0.65 = 10.4` matched the `10` on screen, so a completely wrong
explanation looked *confirmed by arithmetic*. **A coincidence that fits is not evidence.**

> **Require a second, independent confirmation: change the input and PREDICT the output before
> measuring it.** If `adjustsFontSizeToFit` were really governing, widening the box would change the
> rendered size. That test takes one minute and would have killed the hypothesis immediately.

### 5. Fresh mount, never resize
Memoized layouts do not re-lay-out on window resize. Reload at the target size. This produced two
further wrong conclusions ("identical at all four widths", "constant 129px overflow") — see
MEMORY.md (6).

### 6. Weight and colour carry hierarchy too
Size alone is a poor proxy. `/results` renders a **31px** `—` beside a **24px** headline, which reads
as an inversion until you see it is `fontWeight: 300` in `textDim` next to 41px black numerals — i.e.
visually **recessive**. Read the whole computed style before calling a size a defect.

---

## Proposal: `testID` on the elements this project keeps re-measuring

**Not added in this sprint — this is the list, so the size of it is visible before anyone commits.**
One prop per element, and it ends this entire class of error: a `testID` cannot be ambiguous, cannot
be duplicated by a coincidence of copy, and does not move when the text is translated.

| # | testID | Element | File | Times mis-measured |
|---|---|---|---|---|
| 1 | `seat-label` | `Bot N` row label | `Board.tsx:966` | 2 |
| 2 | `reveal-section-label` | `🤖 Bot N` section header | `BoardReveal.tsx:888` | 1 |
| 3 | `hand-badge` | hand name badge (both sizes) | `HandBadge.tsx` | 1 |
| 4 | `board-hand-name` | MP-only hand name | `Board.tsx:1110` | 2 |
| 5 | `ready-button` | the actual READY/Confirm button | `BoardArrangement.tsx:455` | 1 |
| 6 | `ready-status-chip` | the header chip that is **not** the button | `game.tsx` header | 1 |
| 7 | `score-numerals` | `/results` score pair | `results.tsx:876` | 0 (pre-emptive) |
| 8 | `result-headline` | `YOU WIN` / `YOU LOSE` | `results.tsx:862` | 0 (pre-emptive) |
| 9 | `breakdown-hand` / `breakdown-vs` | per-board hand names | `results.tsx:1543/1550` | 0 (pre-emptive) |
| 10 | `card-pip` | card face suit glyph | `Card.tsx` | 1 |

**10 elements, ~10 lines.** Six of them have already cost a sprint each.

---

## STATUS: shipped and verified on live (BW1, 2026-08-07)

All ten are in the app. `testID` emits as `data-testid` on this Expo /
react-native-web version — verified, not assumed.

Measured on `caps.ftable.co.il` at 393×852, fresh mount, solo practice.
Two hands were needed: a 2-player hand (4 boards) and a 4-player hand
(2 boards), because three anchors are unreachable in the first.

| testID | Resolves | Count | Text | Rendered |
|---|---|---|---|---|
| `seat-label` | yes | 6 | `Bot 1` | **13px** |
| `reveal-section-label` | yes | 3 | `🤖 Bot 1` | 11px |
| `hand-badge-normal` | yes | 2 | `STRAIGHT` | **16px** |
| `hand-badge-small` | yes | 2 | `ONE PAIR` | **13px** |
| `ready-button` | yes | 1 | `Confirm` → `✓ READY` | 16px |
| `ready-status-chip` | yes | 1 | `✓ READY` | 10px |
| `result-headline` | yes | 1 | `PERFECT!` | 24px |
| `score-numerals` | yes | 1 | `2 — 0` | 41px |
| `breakdown-hand` | yes | 2 | `Ace-High Flush` | **16px** |
| `breakdown-vs` | yes | 2 | `vs Ace-High Straight` | **13px** |
| `board-hand-name` | **no** | 0 | — | MP-only, `revealed` is false in solo |

Bold = a type fix from an earlier sprint, now confirmed live rather than
inferred from source.

The live scale reads **41 / 24 / 16 / 13 / 11 / 10** — measured end to end
in one pass for the first time.

### Reachability is a property of game configuration

`hand-badge-small` renders only for **non-first** bots
(`isFirstBot ? <HandBadge/> : <HandBadge size="small"/>`, `BoardReveal.tsx:653`).
A 2-player game has exactly one bot, so the branch is dead there. It took a
4-player game to reach it. Before recording an element as unreachable, vary
the player count — "absent" and "unreachable" are not the same claim.

### Rule 7 — an anchor is not real until it is in the shipped bundle

`ready-status-chip` was added to the correct-looking element and shipped, and
it resolved to nothing. `app/game.tsx` renders the bot-status pill **twice**:
once in the dead `SafeAreaView` header and once in the live path. The dead
copy compiles out, so the anchor vanished with it.

What caught it was not reading the source again — it was counting the string
in the deployed bundle:

```js
const src = [...document.querySelectorAll('script[src]')].map(s=>s.src).find(s=>s.includes('index-'));
const txt = await (await fetch(src)).text();
txt.split('my-test-id').length - 1   // 0 means it never shipped
```

Nine anchors returned 1. One returned 0. Run this before trusting any anchor.

### Rule 8 — a duplicated anchor count can mean a stale mount

Mid-session, every anchor read ×2 — `board-0` twice, `ready-button` twice. That
was the previous `/game` still mounted under the new one after client-side
navigation, not two real elements. A count that suddenly doubles is a mount
artifact until proven otherwise. Hard-reload and re-measure; this is Rule 5
(fresh mount) in its second disguise.

### Rule 9 — text is an even worse anchor than it looked

Once all boards are placed, `ready-button` **changes its own label** from
`Confirm` to `✓ READY`. At that moment two elements on screen read `✓ READY`:
the button (16px, 169×52, y=792) and the status chip (10px, 51×13, y=59).
The earlier "the primary action is 10px" finding was this exact collision.

---

## Rule 7, completed — the MECHANISM, now known (BX1, 2026-08-07)

Rule 7 said an anchor is not real until it is in the shipped bundle, and gave the
bundle-string count as the check. That was right, but it left *why* open. The cause is
now identified exactly, and it is worse than "someone edited the wrong copy".

`app/game.tsx:154` read:

```ts
const isLandscape = false;   // S86: portrait-only — Iron Rule 2
```

and line 1163 read `if (isLandscape) {` followed by a **148-line** landscape
`<SafeAreaView>` return. Because the gate is a **hardcoded constant**, Metro constant-folds
`if (false)` and **eliminates the entire branch from the bundle**. So the block was not
merely unreachable at runtime — it did not exist in the artifact at all. A `testID` added
inside it could never resolve, no matter how correct the source looked.

**This is the third dead-render-path incident**, and all three share the hardcoded-gate
shape:

| # | Site | Gate |
|---|---|---|
| 1 | `Board.handName` | `revealed={false}` passed as a literal at both call sites |
| 2 | `RevealSequence.tsx` | component never imported |
| 3 | `game.tsx` landscape return | `const isLandscape = false` |

**The check, in order:**

1. `grep` the JSX you are about to edit and confirm there is exactly **one** of it.
2. Trace the gate to a *variable*, not a literal. A gate that is `false` at the top of the
   file is a deleted feature wearing a conditional.
3. After deploy, count the string in the artifact:

```js
const src = [...document.querySelectorAll('script[src]')].map(s=>s.src).find(s=>s.includes('index-'));
const txt = await (await fetch(src)).text();
txt.split('my-test-id').length - 1   // 0 means it never shipped
```

Source correctness does not imply the element renders. **Test the artifact, not the
intention.**

The landscape block and its 67-line `landscapeStyles` sheet were deleted in BX1 — 215 lines
removed. `multiplayer-game.tsx` was swept the same way and has **no** landscape branch and
no twins; it did not inherit this.

---

## Rule 10 — know what your instrument cannot see (BX3, 2026-08-07)

Two frame-timing methods were tried and **both returned nothing**, for reasons that are
properties of the harness, not of the app:

| Method | Result | Why |
|---|---|---|
| `requestAnimationFrame` deltas | `n: 0` after 32s | rAF is **suspended** in a hidden browser pane — no compositing, no callbacks |
| `PerformanceObserver({entryTypes:['longtask']})` | registered, **0 entries** even for a deliberate 120ms main-thread burn | not delivered in this pane either |

So **frame-drop verification is not possible from the in-app pane while it is hidden.**
Saying "no frames dropped" on the strength of a counter that never incremented would be the
same error as the geometry probe that reported the reveal was static. What was measured
instead is the underlying risk — main-thread work per board, timed against the real code:
**127 / 150 / 133ms** at 2/3/4 players, run off the paint path. Frame verification needs a
visible browser or a real device.

Two further harness facts, both of which corrupted a run before being identified:

- **Background tabs throttle `setInterval` to ~1Hz.** A recorder sampling at 140ms returned a
  single sample in 15s. Front the tab (`tabs_select`) before timing anything.
- **Querying the DOM during an active reveal wedges the hidden renderer.** Every direct probe
  mid-animation timed out at 30s. The pattern that works: install an interval recorder that
  writes to a global, let the sequence finish, then read the global in one call.

## Rule 11 — a field name is a claim, and claims get checked

`BoardReveal` receives `openCards` and `closedCards`. "Open" was read as "the community
cards that are open" — i.e. all five. It is **the flop only**; turn and river are in
`closedCards`, which is why lines 389 and 590 of that same file both build the community as
`[...openCards, ...closedCards]`.

Slicing `openCards` for the turn silently produced a **three-card** turn, so turn equity came
out identical to flop equity on every board, the displayed number never moved, and the delta
chip was unreachable by construction. The code read as correct. What exposed it was the live
timeline showing one value per board where two were expected.

**Check what a field contains before slicing it — and prefer the derivation the file already
uses over the one the name suggests.**

---

## Rule 12 — a style that behaves differently on web and native cannot be verified by reading it

`flexShrink` defaults to **0** in React Native and to **1** in CSS, which is what
react-native-web compiles to. A fixed-`width` child beside a `flex: 1` sibling therefore
behaves differently on the two platforms — and only one of them is in front of you.

**But the divergence is conditional, and that matters more than the divergence.** Measured
directly in the browser rather than assumed:

| case | fixed 36px child renders |
|---|---|
| row does **not** overflow | **36px** — no shrink |
| row **overflows**, no `flexShrink` set | **29px** — shrinks |
| row **overflows**, `flexShrink: 0` | **36px** — holds |

`flex-shrink` only fires when the row **overflows**. So the pattern "fixed width beside
flex:1" is *necessary but not sufficient*; without overflow it is harmless.

### What the sweep actually found

An AST sweep of 91 `.tsx` files / 278 row containers found **34 rows matching the pattern**
and **zero that can overflow** — the largest fixed basis in any of them is 144px against a
343px track. So there are **no confirmed instances of this bug in the codebase**, and none
were "fixed", because there was nothing to fix.

### The correction that matters

The one instance previously reported — seat columns in `EquityBar` measuring `359-359`
(zero width) — is **not explained by this mechanism**. That row's fixed basis is 119px
against 343px; it cannot overflow, so it cannot shrink. The reading came from a DOM with two
`EquityBar`s mounted at once: it reported **three** seats while showing the **11px** label
that exists only in the **two**-seat layout, which is impossible in one consistent render.
That is **Rule 8** (a stale mount), and I applied Rule 8 to other people's measurements and
not to my own.

`flexShrink: 0` was left in place: it is free, correct on both platforms, and makes the row
immune if the labels ever grow. It is not load-bearing and the comment in that file now says
so.

**The general rule stands even though this instance dissolved:** when a style's behaviour
differs by platform, reading the source tells you what one platform does. Only a measurement
on the platform in question tells you what the user sees — and a mechanism that explains the
numbers is still a hypothesis until it is tested on its own (Rule 4).

---

## Rule 8, worked example — recorded, guarded, not chased (CB4, 2026-08-07)

`BoardSurface` was measured once at full-bleed: width 375, left 0, `margin-left: 0px`,
`border-radius: 0px` — while its own `border-width: 2px` and `border-color` from the **same
inline style object** were applied correctly. Border constants are literals; margin and radius
go through `rs(v, screenW)`, which is `value * screenW / BASE_WIDTH`. So `screenW` arrived as
**0** in that render, and every derived dimension collapsed while every literal survived. A
sibling `rs(2)` inside `BoardArrangement` returned 2 in the same frame, so the app-wide value
was fine.

**It did not reproduce**: four fresh-mount samples over 3s, then again across a full auto-fill
→ READY cycle, all returned the correct 359 / left 8 / radius 17.

**What was done, and what was not.** Not done: hunting the cause. An unreproducible single
sample is not a bug report, and chasing it would have cost the sprint. Done: a one-expression
defensive default — `screenW && screenW > 0 ? screenW : SCREEN_W` — because the failure mode is
*silent*. A zero-margin, zero-radius surface does not look broken; it looks like a background,
which is exactly the thing that component exists to stop being. The guard converts an invisible
wrong render into a correct one.

**The rule this illustrates:** when a reading contradicts every other reading, record it, guard
the failure mode if the guard is cheap, and move on. Do not delete the observation, and do not
build a theory on one sample.

**The diagnostic that made it legible** is worth reusing: *literals rendered, computed values
did not*. When a subset of one style object applies and the rest does not, suspect the input to
the computation, not the style system.
