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

---

## Rule 13 — the SENTINEL: separating "it never ran" from "I cannot see it"

When a measured value is **also** a value the code could legitimately write, the reading proves
nothing. The empty slot read `0.600`, and 0.6 was both the `useSharedValue` initial **and** what
the effect's `else` branch writes — so "the effect never ran" and "the effect ran and took the
else branch" were the same observation. Two sprints were spent on that ambiguity.

**The technique:** change the initial to a value nothing else can produce, deploy, measure once.

Choose it so every branch is distinguishable. `0.137` worked because it is not `0.6`
(initial/else), not `1` or `0.72` (the pulse endpoints), not `0.4` (the previous floor), and
appears in no style in the file. A round number would not have done — it could plausibly be a
default.

**Then read the outcome as a decision table:**

| reads | means |
|---|---|
| the sentinel | nothing wrote it — the effect never ran, or its write never took effect |
| a value the code writes | that branch ran; the mechanism works |
| a moving value | it works and the earlier sample was mistimed |

**Result when first used (CG1, 2026-08-07):** 25/25 samples read `0.137`. That killed the
"Reanimated is unobservable on web" theory outright — a static shared value set in
`useSharedValue` **did** reach `getComputedStyle`, so the style bridge works. What remains is
narrower and testable: either the effect body never runs, or `withTiming` is called and its
driver never progresses.

**Why this belongs in the protocol:** it converts an unfalsifiable reading into a decision in
one deploy. It is the cheapest instrument in this document and it should be reached for the
moment a measurement is consistent with two explanations. And it is an **instrument, not a
change** — revert it in the next commit.

---

## Rule 14 — ANIMATION PROGRESSION CANNOT BE MEASURED FROM THIS PANE. AT ALL.

**Measured 2026-08-07, and it voids a whole class of result:**

```
requestAnimationFrame callbacks in 26.9 seconds : 0
document.hidden                                 : true
document.visibilityState                        : "hidden"
```

The in-app browser pane runs **hidden**. Per spec a hidden document does not run rAF — and
**Reanimated's web driver runs on rAF**. Therefore **no Reanimated animation can progress in
this pane, ever**, no matter how the app is written.

### What this invalidates

- **CH1's result.** Two live animations (`KILL_HeroParticles`/`KILL_HeroGlow`, both `false`)
  showed **0 of 220 elements changing** opacity or transform over 3.5s. That looked like "the
  driver is dead on web". It is fully explained by rAF never firing. **Neither "the driver
  works" nor "the driver is dead" is supported.**
- **CG1's conclusion, retroactively.** The sentinel `0.137` was read as "the effect never
  wrote". But the `else` branch calls `withTiming(0.6, {duration: 200})`, and **a `withTiming`
  cannot advance without rAF** — so the value staying at its initial is exactly what a
  *successfully executed* effect looks like here. "The effect never ran" is **not** supported.
- Every earlier attempt to watch an animation in this pane, going back to the reveal work.

### What survives

**Static values still measure correctly.** The sentinel proved that: `useSharedValue(0.137)`
reached `getComputedStyle` exactly. Anything that does not require a frame to advance —
computed style, geometry, colour, layout, bundle contents — remains valid. Every non-animation
measurement in this document stands.

### The rule

**Before claiming any animation does or does not run, check `document.hidden` and count rAF
callbacks.** If rAF is 0, you are measuring the harness. Two sprints produced confident,
opposite-sounding conclusions from readings that were the instrument all along.

Animation verification needs a **visible browser or a real device**. There is no way around
this from here, and pretending otherwise has already cost two sprints of misdirected work.

---

## Rule 14a — THE PREAMBLE FOR ANIMATION WORK, and the tool that runs it

Rule 14 said animation is unmeasurable from the in-app pane. That is still true **of that
pane**. The fix is a **headed** browser, and the check is now automated.

**`tests/animation-probe.mjs`** — launches Playwright **headed** (full `chromium-1228`, not the
`chromium_headless_shell`, which cannot run headed at all) and **refuses to measure until the
precondition passes**:

```
document.hidden === false   AND   rAF callbacks > 0 over a 2s window
```

Run: `node tests/animation-probe.mjs [width] [height]`. Writes `animation-probe-result.json`.

**First run, 2026-08-07, 393×852:**

| | in-app pane | headed probe |
|---|---|---|
| `document.hidden` | **true** | **false** |
| rAF in 2s | **0** | **61** |
| elements moving | 0 of 220 | **16 of 300** |

**Reanimated works on web.** The particles animate via **transform**, not opacity — their
opacity is a constant `0.045` while the element reports 40 distinct states across 40 frames.
Any probe sampling opacity alone would have called them static, which is a second reason the
old readings were wrong.

### Frame measurement is now possible — with one calibration caveat

`frameStats()` reports 119 frames, **median 33.3ms, max 34.0ms, over-50ms: 0**. That is a
steady **~30fps**, not a stutter: the spread between median and max is 0.7ms. The `over32ms`
counter reads 119/119 because it was written for a 60fps budget — **at a 30fps cap it flags
every frame and means nothing**. Judge dropped frames by the *spread* against the local
cadence, not against a hardcoded 32ms. Recalibrate the threshold before using it as a gate.

### Also settable exactly

`innerWidth 393 / innerHeight 852 / devicePixelRatio 1.0` — the headed context honours the
requested viewport exactly, so every measurement held at 375 and 393 remains comparable.

## Rule 15 — a positive control is MANDATORY for any delivery test

Correct subscribe verdicts with **zero delivery** score as clean and are wrong.

**Cited run, 2026-08-13 (Phase 0 channel proof, branch `phase0-proof-2`).** Run one produced all
three authorisation verdicts correctly — member A `SUBSCRIBED`, member B `CHANNEL_ERROR
Unauthorized`, anon `CHANNEL_ERROR` on both topics — and **A received nothing**. Reading the
statuses alone would have scored 5/5 green while delivery was entirely unproven. The cause was
the fixture, not the fix (see Rule 16), but the point stands: *subscribing is not receiving*.

Any test that claims a message arrived must show the message. Any test that claims a message was
blocked must first show an equivalent message arriving for someone entitled to it.

## Rule 16 — Supabase does not echo a broadcast to its sender

`channel.send()` does not deliver back to the sending client unless the channel is created with
`config: { broadcast: { self: true } }`. A single-client send/receive test therefore reads as
"nothing was delivered" when delivery is working perfectly. Either set `self: true`, or use a
second client as the receiver.

## Rule 17 — test the thing described, not the name given

When a report names a thing tentatively — *"X או משהו כזה"*, "the button near the bottom",
"something like that" — **the observation is the evidence and the label is a guess.** Test what
was described. Verifying the name and reporting it clean is how a real defect survives a sweep.

**Cited case, 2026-08-13.** Roye reported *"AUTO PLACE ALL או משהו כזה שנמצא למטה הוא OVERLAP
קצת על משהו אחר"*. He flagged his own uncertainty about the name and was certain about the
collision. Two sprints went into measuring the **Auto-Place-ALL button**, which is genuinely
clean at every width and height. The actual defect was the **per-board ⚡ Auto-Place row**
overlapping the hand row by **77px** — a different control, three feet away in the DOM, and
present in every phase and every animation sample.

The same sweep that returned "zero overlaps" was also comparing buttons against buttons, so
the colliding plain `<div>` was never a candidate. **Two independent method errors pointed the
same way: toward confirming the report was wrong.** It was not.

Corollary: a human looking at the actual screen found a third collision — a hint bubble
covering six cards — in seconds, where automated sweeps took two sprints and missed it. An eye
on the running product is an instrument, and this project has been under-using it.

## Rule 18 — the defect class: two heights that do not know about each other

Two independently-computed dimensions that share the same space and neither reads the other.
Each is individually correct; together they overlap. **No constant fixes it** — a value that
clears one viewport floats or clips at another, which is the tell.

**Instance 1 — `GuidedTooltip` `posBottom: { bottom: rs(110) }`.** A fixed offset from the
viewport bottom, while the hand occupies the bottom **194px at 393** and **302px at 1706×960**.
Covered 6 of 12 cards at 57-78%. Fixed by threading the layout's measured hand-zone height in.

**Instance 2 — the board stack and the hand row.** Heights computed separately and summing past
the available space: `board-2` ↔ `hand-row` overlap **414×76.7px at 1706×960** and **346×56.7px
at 393**. Still open — and note it affects BOTH ends, so "give height back on desktop" is wrong.

**How to spot it:** grep for a constant offset from a viewport edge (`bottom:`, `top:` with a
literal or a bare `rs()`), on any screen where a sibling's height varies with viewport. If the
value cannot be right at both 375 and 1706, it is this class.

**The fix is always the same shape:** derive one from the other. The dependent one is whichever
must never be occluded — for the hand, that is everything else.

## Rule 19 — an all-pairs sweep cannot tell an intentional overlay from a collision

Both are intersecting boxes. A dim layer, an attention pointer, a tooltip and a modal all
overlap the content beneath them **on purpose**, and `getBoundingClientRect` reports that
exactly the same way it reports two siblings biting into each other.

**Cited case, 2026-08-14.** A sweep reported three collisions in the header region of `/game`.
Two were the **guided tutorial**: the full-screen dim overlay and the `↑`/`↓` attention arrow
(`app/game.tsx:1379`), both `position: absolute`, both `pointerEvents: none`, both rendering
only during first-game tips 1–2 — which is precisely the state the reporter's screenshot
captured. A sprint was briefed to *delete* the arrow as a "dead scroll remnant". Deleting it
would have broken the first-run tutorial for every tester.

**Rule:** classify every intersecting pair as *normal-flow* or *overlay-kind* and report both,
in separate buckets. Do not delete the overlay bucket — an overlay that intersects is doing its
job, but "it is doing its job" is a judgement someone has to make, and it cannot be made about a
pair that was silently dropped. A sweep that cannot make the distinction manufactures defects,
and each one costs a sprint to disprove.

**How to classify — the element's own `position` is NOT the test.**

Testing `getComputedStyle(el).position === 'absolute'` misses every overlay whose *visible* box
is a normal-flow child of an absolute parent. Both of `/game`'s tooltip surfaces are exactly
that: the `Dismiss tip` pill and the `👆 Tap a card` label are static children inside absolutely
positioned wrappers, so the own-position test scored them as normal-flow content and they became
4 of the 6 reported pairs at 375/393 — pure noise, three sprints running.

The naive repair — "overlay-kind if the element *or any ancestor* is absolute" — is worse. Under
react-native-web a `ScrollView`'s content container is itself `position: absolute`, so *every*
element on the screen has an absolute ancestor and the filter suppresses everything. Measured
2026-08-14: it took the true count to **0 at all five viewports**, hiding the board↔hand residual
that the entire height-collision arc existed to close.

**Overlay-ness is a property of the PAIR, not of either element.** Walk from each element to its
nearest `absolute`/`fixed` ancestor-or-self — that node is the element's **layer** (`null` = root
flow):

```js
const layerOf = e => { let n = e; while (n && n !== document.body) {
  const p = getComputedStyle(n).position; if (p==='absolute'||p==='fixed') return n; n = n.parentElement; } return null; };
// same layer -> laid out against each other by normal flow -> a real collision
// different layer -> painted over each other by design -> overlay-kind
const isRealCollision = (a, b) => layerOf(a) === layerOf(b);
```

Boards and hand share the ScrollView's layer, so their overlap stays visible as a defect. The
tooltip lives in its own layer, so it is bucketed as intentional. Measured on the same build,
this took the reported count from 41→12 (375), 40→8 (393), 32→2 (1706×960), 35→7 (1706×820),
13→2 (1920) — and *kept* every board↔hand pair, which is the test of the filter, not the size
of the reduction.

**Second requirement: intersect CLIPPED rects, not raw ones.**

`getBoundingClientRect` returns an element's full box even when an ancestor with
`overflow: hidden/scroll/auto` is only painting part of it. Scroll content that runs past its
viewport therefore reports as an overlap with whatever sits below the viewport — while on screen
nothing is painted over anything.

Intersect each rect with every clipping ancestor's rect first:

```js
const clipped = e => { const r = e.getBoundingClientRect();
  let t=r.top,b=r.bottom,l=r.left,x=r.right, n=e.parentElement;
  while (n && n !== document.body) { const s = getComputedStyle(n);
    if (/hidden|scroll|auto|clip/.test(s.overflowY + s.overflowX)) { const q = n.getBoundingClientRect();
      t=Math.max(t,q.top); b=Math.min(b,q.bottom); l=Math.max(l,q.left); x=Math.min(x,q.right); }
    n = n.parentElement; }
  return { top:t, bottom:b, left:l, right:x, width:Math.max(0,x-l), height:Math.max(0,b-t) }; };
```

**Cited case, 2026-08-14.** With the layer test applied, `/game` still reported a 24px board↔hand
collision at 1706×820 and 4–9px at the other viewports — the last open item of the
height-collision arc. Under clipped rects the count is **0 at all five viewports**. The boards
zone scrolls at four of the five (measured overflow 33px at 1706×820, 13–17px elsewhere; 1920 is
the only viewport where the fit-search fits outright at overflow 0), and the residual tracked
that overflow one-for-one. There was never anything to fix: three sweeps' worth of "remaining
collision" was scroll content being measured outside its own viewport.

Overflow is still worth reporting — it means board content sits below the fold — but it is a
scroll-affordance finding, not a collision, and it must not be filed as one.

## Rule 23 — measure the box that occupies space, not the mark you can see; and "different layer" is not "intentional"

Two ways to miss a collision that is plainly visible on screen. Both fired on the same defect.

**23a — the glyph is not the control.** A `✕` drawn 13px wide inside a `<button>` with
`minWidth/minHeight: 44` occupies **44px**. Anchor a probe on the character and the neighbouring
element looks 18px clear; anchor it on the button and they overlap by 10. The accessibility target
is real geometry and it is invisible in a screenshot, which is exactly why it must be measured
rather than eyeballed.

Symptom to watch for: a probe using `querySelectorAll(...).pop()` or text matching. Those select
the innermost node — the `Text`, the glyph — while layout is done by an ancestor. **Select by role
or testID, and print the box you matched** so the mismatch is visible in the output.

**23b — Rule 19's layer test suppresses real chrome collisions.** Rule 19 buckets a pair as
overlay-kind when the two elements have different nearest positioned ancestors. That is right for a
tooltip, a dim layer or an attention arrow — transient things *painted over* content on purpose.
It is wrong for two **permanent controls**: an absolutely-positioned status pill overlapping a
button's touch target is in a different layer and is still a defect.

**Cited case, 2026-08-15.** The practice pill sat 10px inside the `✕` button — 10×25.3 at 393,
11×25.3 at 900 and 1100, at 3 boards and 4 boards alike. Width-independent, configuration-
independent, present in every sprint of the layout arc. Every sweep reported the header clean:
the targeted probes compared the glyph to the pill's inner `Text` (genuinely 18px apart), and the
all-pairs sweep classified the real pair as overlay-kind and dropped it. The source comment that
placed the pill recorded the same error in words — *"the ✕ (ends x 41)"* — 41 being the glyph and
56 being the button.

**Rule:** overlay-kind requires *different layer* **and** a transient/decorative role — a tooltip,
dim layer, arrow, or modal. Two permanent controls in different layers are a normal-flow defect.
When in doubt, report the pair rather than suppress it; Rule 19 exists to bucket findings, never to
delete them.

## Rule 21 — a layout sweep must state its configuration, and one board count proves nothing about another

CAPS renders a different screen per player count: **2P = 4 boards / 16 cards · 3P = 3 boards /
12 cards · 4P = 2 boards / 8 cards**. Same viewport, different content. A sweep that does not name
its configuration has not reported a result; it has reported a result *somewhere*.

**Cited case, 2026-08-14.** The entire layout-collision arc — six sprints, three corrected
constants, five viewports, two engines, a rebuilt overlap filter — ran at **3 boards / 12 cards**,
because the probe URL said `players=3` and nobody wrote the configuration down. Roye plays
2-player. He photographed a clipped hand row repeatedly while every sweep reported clean, and the
arc was declared closed at zero on a screen he was not looking at.

The defect was real and had been there the whole time: the hand-zone budget under-counted its own
chrome by ~11px at every width. At 12 cards there was slack and it hid. At 16 there is none.

**Rule:** every sweep states its configuration in the output, not just the URL. Run the
configurations that exist, or name the ones you skipped. When a report says "zero", the next
question is "at what board count" — and it should not have to be asked.

## Rule 22 — clipped content is not an overlap, and a clip-aware sweep is blind to it

Rule 19 says to intersect clipped rects, because scroll content reported as an overlap is a false
positive. The corollary is a false *negative*: content cut off by an ancestor produces **no
intersection at all**. The better the clip-aware filter, the more invisible this defect becomes.

**Cited case, 2026-08-14.** At 4 boards / 393, eight of sixteen hand cards were cut off 10px at the
bottom while the clip-aware pair-tested sweep returned **0 overlaps**. Both numbers were correct.
They answer different questions.

**Rule:** a layout sweep reports two independent lists — *overlaps* (pair-tested, clip-aware,
overlay-kind separated) and *clipped content* (own rect vs clipped rect, per element, with the cut
edge and amount). Never merge them, and never report one alone. Distinguish clipping by a
**scrolling** ancestor — content is reachable, usually by design — from clipping by a **fixed-height**
ancestor, which is a defect: the content cannot be reached at all.

## Rule 20 — a non-scaling quantity must not sit behind a scaling function

If a value renders identically at 375, 393 and 1706, wrapping it in `rs()` / `rh()` does not
make it responsive — it makes it **wrong at every width except the base**.

**Cited case, 2026-08-14.** `TOP_CHROME_H = rh(56)` produced 53–56 across viewports while the
chrome measured **90 at every width on both engines**, because it is floored by the 44px
accessibility target on the leave button plus fixed paddings. None of those parts scale. The
budget was ~34px short before a single card was sized, and the fit-search allocated room that
did not exist — which is what clipped the player's second card row.

The same file then yielded a second instance the same day: `_handMarginB = rs(72) + rs(8)` = 80
against a measured 119 of bottom chrome.

**Test:** measure the value at 375, 393 and a desktop width. If the three numbers are the same,
it is a constant and belongs written as the sum of its measured parts, so the next reader can
see which part is an accessibility floor and must not be trimmed. If they differ, keep `rs()`.

Corollary: when a consumer patches around a source constant — `BoardArrangement.tsx:354`,
*"PRD.zone.actionBarH=rs(56) under-counted the …"* — that is a report that the source is wrong.
Fix the source; a local patch leaves every other consumer still reading the bad number.

---

## 7. A branch of this project does not reproduce this project

**Iron Rule 11 says QA on a branch, never production. On CAPS that rule cannot be honoured as
written**, and pretending otherwise produces a proof of nothing.

**Measured 2026-08-23.** A fresh Supabase branch of `caps-poker` came up with **5 tables** —
`app_config`, `deploy_tracker`, `leaderboard`, `user_profiles`, `whatsapp_sessions` — against
production's **56**, and its `leaderboard` was an **older shape** (`hands_played` / `hands_won` /
`biggest_win` where production has `elo` / `games_played` / `wins` / `win_rate`).

**Cause:** `create_branch` replays the *tracked migration history*. CAPS' schema was largely built
outside it, so a branch reproduces only the fraction that was recorded. (Production data never
carries over either — that part is by design and is not the problem.)

**What to do instead.** Still create the branch, but budget for building a **minimal replica by
hand** of only the tables the change touches:

- real column types, the **real CHECK constraints**, the **real partial unique indexes** — the
  idempotency guarantee usually lives in an index, and a replica without it proves the opposite of
  what you think
- stub the guard functions (`econ_authz_probe`, `econ_rate_ok`, `econ_bind_ok`) to their pass
  behaviour so the function signature under test is identical
- **say in the report that the replica was built**, rather than writing "proven on a branch" and
  letting the reader assume it mirrored production

**Which future work this affects:** anything touching a table the tracked migrations do not create
— `hand_history`, `chip_transactions`, `game_rooms`, `room_players`, `achievements`,
`referral_links`, `user_missions`, and most of the other 51. In practice: every economy change,
every hand-recording change, every multiplayer change. Only `app_config` and `leaderboard` work
on a bare branch, and `leaderboard` only after adding the columns.

Cost was **$0.01344/hour**; delete the branch when done and confirm by listing.

---

## 8. Absence in one namespace is not absence

**Cited case, 2026-08-23 — and it caused a live regression, not just a wrong report.**

The claim was *"`resolve_hand` does not exist"*, from a `pg_proc` search that genuinely returned
nothing. The real object is an **Edge Function named `resolve-hand`** — a hyphen, not an underscore,
and a different namespace entirely. It is deployed, active, and writes one `hand_history` row per
seat.

Acting on the absence removed a guard that existed precisely because the server writes those rows,
which turned one multiplayer hand into **two** recorded hands per player: `games_played 2`, the
winner `wins 2` and `elo +40`, the loser `elo −20`.

**Test:** before reporting that something does not exist, enumerate **every** place it could live —
`pg_proc`, Edge Functions, triggers, views, cron, the client — and say **which** you checked. A
name that differs by a hyphen, a suffix (`_d`), or a namespace is the normal case in this codebase,
not the exception.
