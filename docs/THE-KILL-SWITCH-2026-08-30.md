# THE KILL SWITCH — the bisect, the reproduction, and what "wow" would actually take

**2026-08-30 · nothing shipped · `KILL_Board` is still `true` in the repo and in production.**

Every flag flip in this document was made in the working tree, measured, and reverted before
the commit. `git status` after the work showed additions under `tests/` and `docs/` only.

---

## 1 · THE BISECT

### 1.1 What was set, and when

`c1f5f2d`, **2026-03-22 15:46 +0200** — *"fix(crash): KILL switch — disable all withRepeat(-1)
animations for crash bisect"*. Twelve `withRepeat` sites across six files, all gated `true`.
The commit message set the plan itself:

> Phase 4: set one flag to false at a time in animationKill.ts to find culprit.

**Phase 4 was never run to a conclusion.** The one attempt (2026-08-07, `4cd2d40`) was reverted
the same day (`a20e963`) as inconclusive. The flag has been `true` for **161 days**, minus that
one same-day window.

> A note on the date. The brief says 2026-03-19; the commit is **2026-03-22**. The 19th is the
> day the crash work started (`08a5519` … `e42c788` are all 03-19), so the memory is of the
> right week and the wrong commit. Three days, and it matters only because the New Architecture
> test below sits between them.

### 1.2 What actually crashed — and the evidence that does not exist

The crash was a **Hermes engine kill**, attributed to two things, both named in
`docs/caps-project-map.md` under NEVER:

- `ConfettiCannon` / `CompleteOverlay` — *"too many animated views"*
- `withRepeat(-1)` — *"infinite loops crash Hermes"*

The sharpest surviving statement of the mechanism is `7ff8175` (2026-03-22, four hours before
the kill switch): *"CompleteOverlay SAFE_MODE — 40 particles=160 simultaneous Reanimated
worklets → Hermes crash"*.

**There is no crash log for it.** `crash_reports` has 349 rows and its earliest is
**2026-03-23 20:48** — the table was created by `fc2eb52` on the 23rd, *the day after* the kill
switch. The evidence system was built to catch the crash and arrived one day late.

What the table does hold for the surrounding weeks is not this crash:

| date | non-dirty crashes | message |
|---|---|---|
| 03-23 | 4 | Rendered fewer hooks than expected |
| 03-24 | 5 + 1 | Rendered fewer hooks…; Cannot read properties of undefined (reading map) |
| 03-25 | 3 | Rendered fewer hooks than expected |

Twelve React hook-order crashes (fixed by `9753e82`, *"prevent 'Rendered fewer hooks than
expected' crash"*), one null-map. **Zero Hermes kills.** Everything else in the window is a
dirty-shutdown false positive. So the crash the switch was built for is attested by commit
messages and a project-map NEVER line, and by nothing else.

### 1.3 The other hypothesis — which was tested, and whose result nobody wrote down

Four days before the kill switch, `347e100` (2026-03-18) set `ios.newArchEnabled: false`. Its
message is unambiguous about what it was:

> SDK 55 defaults to New Arch ON — suspected root cause of all iOS crashes
> **Disabling New Arch is the definitive test. If crash stops → New Architecture is confirmed root cause.**

**No commit or document records the result.** And on **2026-03-30**, `3a187bb` — a build fix
titled *"patch @expo/image-utils cache to /tmp to fix EAS EACCES error"* — removed the key with
the note *"removes newArchEnabled from app.json (invalid schema)"*.

So the definitive test was turned off eight days later, as a side effect of unblocking a build,
on the grounds that it was in the wrong place in the file. If that grounds is right, the key
never took effect and **the definitive test never ran at all.** `npx expo config` today resolves
`expo.jsEngine: 'hermes'` and carries no `newArchEnabled` at any level, so the app ships on
Hermes with SDK 55's New Architecture default.

### 1.4 Is the cause still in the code?

Two separate questions. The honest answers point in opposite directions.

**The environment is essentially unchanged.** This is the finding I expected to go the other way:

| | at the kill switch (`c1f5f2d`) | today (`8324a0a`) |
|---|---|---|
| react-native-reanimated | **4.2.1** | **4.2.1 — identical** |
| react-native | 0.83.2 | 0.83.4 |
| expo | ~55.0.5 | ~55.0.15 |
| JS engine | Hermes | Hermes |
| New Architecture | SDK 55 default (the opt-out was removed 03-30, and may never have applied) | SDK 55 default |

"Five months of upgrades probably fixed it" is **not available as an argument.** Reanimated did
not move at all. Two patch bumps is the whole drift.

**The code, however, no longer contains either named cause.** Verified by grep, not by memory:

- `react-native-confetti-cannon` was removed as a dependency on 2026-03-24 (`8787750`) and is
  absent from `package.json`.
- `CompleteOverlay` still exists and is still rendered (`app/results.tsx:1060`) — but it was
  **rewritten off Reanimated**. Today it is RN `Animated` with `useNativeDriver: true`, 15
  particles (`NUM_PARTICLES = 15`), 35 `Animated.Value`s, zero worklets. The 160-worklet
  version that the commit message blames is gone. *The project map's NEVER line still names
  `CompleteOverlay` and is therefore stale — it forbids a component that no longer has the
  property it was forbidden for.*
- **No `withRepeat(-1)` remains anywhere in the app.** All six surviving sites are finite:
  `TimerController` 100 and 20, `Board` 200 ×3, `app/(tabs)/index.tsx` 50. The last infinite
  repeat lived in `ProQuoteBanner`, archived 2026-08-21.

So: the engine that crashed is the engine we ship, and the code that crashed it is gone.

### 1.5 What the flag actually disables — and how much of it is already dead anyway

`KILL_Board` gates three sites in `Board.tsx`. `<Board>` has **exactly one call site in the
whole app**, `components/BoardArrangement.tsx:299`, and what it passes decides most of this:

| site | shared value initial | reachable? | what killing it does |
|---|---|---|---|
| `EmptySlotAnimated` empty-slot pulse (L192) | `0.6` | **yes** | slot renders at a constant **0.6** |
| board `active` glow (L498) | `0.4` | **no** — call site passes `active={false}`, so the `else` branch writes `0` and `pulseStyle` returns `{}` | nothing |
| `isWinner` glow (L600) | `0` | **no** — `isWinner` is **never passed by any call site** | nothing |

**Flipping `KILL_Board` changes exactly one thing on screen: the empty-slot outline.** The
board-active glow and the winning-board glow are dead for a different reason, and would stay
dead. That is worth knowing before anyone flips the switch expecting a celebration.

`KILL_game` is different — `timerPulsing` is genuinely dynamic (`countdown <= 10 && countdown > 0`),
so both TimerController sites are live code and the flag is the only thing stopping them.

### 1.6 What is calibrated against the dead animation — measured, not estimated

Handoff 115 warned that the slot outline colours were tuned against a resting `0.6` that is the
initial value of an animation that never runs. **Confirmed, and quantified on pixels.** Board 1's
empty-slot row, same seed, same viewport, same felt:

| build | slot opacity | outline stroke luminance | vs today | contrast vs felt |
|---|---|---|---|---|
| **shipped today** | 0.600 constant | **141.7** | — | 4.22 : 1 |
| re-enabled, pulse **floor** | 0.721 | **160.9** | **×1.14** | 4.81 : 1 |
| re-enabled, pulse **peak** | 0.992 | **204.0** | **×1.44** | 7.75 : 1 |

Felt median luminance held at ~52 across all three, so the change is the stroke, not the ground.

The important shape: **the pulse never goes dimmer than what ships today.** Its floor of 0.72 is
already 1.14× the current constant 0.6. Re-enabling would not make the outlines *move* around
their present brightness — it would move them to a new band entirely above it. Nothing fails
WCAG (1.4.11 wants 3:1 for a non-text UI component and all three clear it), so this is a taste
decision and a loudness decision, not an accessibility one. **The values in
`constants/paintThemes.ts` are untouched, as instructed.**

### 1.7 The same dead-code shape, elsewhere

Built `tests/dead-branch-sweep.mjs` for this. It reads every `.tsx` in `app/` and `components/`,
binds each boolean prop to the function that declares it, and reports props that are the same
literal at **every** JSX call site, or passed by none. It reports facts about call sites — not
bugs. `active={false}` may be correct and permanent; the finding is that *the other branch has
never executed*, which is the thing that keeps being assumed.

It reproduces `revealed` — a finding made by hand months ago — which is the check that it works.

**14 findings, and 5 components it refuses to call clean.** The ones that carry weight:

| verdict | site | why it matters |
|---|---|---|
| `NEVER_PASSED` | `Board` · **`isWinner`** | the winning-board glow. Dead independently of the kill switch |
| `ALWAYS_false` | `Board` · **`active`** | the board-active glow. Same |
| `ALWAYS_false` | `Board` · `revealed` | already known — the control finding |
| `NEVER_PASSED` | `Card` · **`small`** | drives card width/height (`small ? rs(52) : rs(58)`). Dead in the CARD BIBLE, 27 call sites, none pass it |
| `NEVER_PASSED` | `Card` · **`suitsOnly`** | an entire alternate card face at `Card.tsx:607`. Never rendered |
| `NEVER_PASSED` | `ScreenHeader` · `showBackLabel` | its own comment says *"default true; false on dense screens"*. **No dense screen ever passes false**, across 14 headers |
| `NEVER_PASSED` | `StaticCard` · `isCommunityCard`, `OutsRow` · `pending`, `ConnectionStatus` · `connecting`, `BugReporter` · `overlayActive` | four more |
| `ALWAYS_true` / `ALWAYS_false` | `Badge` · `small`, `TimerController` · `isActive`, `XPBar` · `compact` | constant, possibly deliberate |

And one the sweep cannot see, found by hand: **`playGlowStyle`** in `app/(tabs)/index.tsx:682`.
`KILL_HeroGlow` is `false` — *deliberately enabled* — so the `withRepeat(50)` driver genuinely
runs on every home mount. But the `useAnimatedStyle` it produces **is applied to no element.**
The one animation in the app whose kill flag was explicitly turned off paints nothing.

Also dead, same file: **`KILL_HeroParticles` has zero usage sites** — the same
"a flag pretending to be a control" that got three others deleted on 2026-08-07. Worse, the
comment at `Board.tsx:170` *reasons from it*: "KILL_HeroParticles is already false, so if the
Home particles move on web the driver works." There are no Home particles. That test cannot be
run and its premise is false.

That is now **eight** instances of this shape (`isLandscape`, `isV2`, `revealed`, the slot pulse,
`active`, `isWinner`, `playGlowStyle`, `KILL_HeroParticles`) plus seven more the sweep surfaced.

#### What the sweep cannot tell you

Stated because a clean line here is not proof of absence (Iron Rule #8):

- JSX call sites only. A component rendered via a variable, a list of elements, or
  `React.createElement` is invisible to it.
- Spread props are **detected and reported UNSCANNABLE**, never assumed clean —
  `GameView`, both `WeeklyRecapModal` variants; plus `LevelUpModal` and `LoginPromptModal`,
  which have no JSX call site at all.
- Only props whose declared type mentions `boolean`.
- Module-level constants like `KILL_Board` are **not** in scope — the switch itself would not
  be found by this tool.

It also made two mistakes I had to fix before any of the above was trustworthy, both recorded in
its header: it first attributed a private component's props to the file's exported component
(reporting `TimerController · pulsing` as never passed, when `pulsing` is passed on line 150),
and it first counted a `<Board>` mentioned inside a `//` comment as a call site, which silently
*dropped* the real `active={false}` finding by making it look like "1 literal of 2 sites".

---

## 2 · THE REPRODUCTION

### 2.1 Why the last two attempts settled nothing

Phase 4 flipped `KILL_Board` on web and sampled the slot opacity 23 times over 2.3s. It read
**0.600 every time** and concluded the pulse did not come back.

That number cannot carry that conclusion. `0.6` was simultaneously the `useSharedValue(0.6)`
initial ("nothing ever wrote") **and** the `else`-branch resting value ("`isArrangement` was
false, wrong screen"). One reading, two opposite meanings, and the sprint correctly refused to
ship on it.

### 2.2 The discriminator

Three exports, one variable apart, with the shared value's initial moved to a number the app
cannot produce by accident:

| build | initial | `KILL_Board` |
|---|---|---|
| `dist-control` | 0.6 | `true` — **exactly what ships** |
| `dist-sentinel` | **0.137** | `true` |
| `dist-live` | **0.137** | **`false`** |

Now every outcome has one cause. `0.137` ⇒ the effect ran, took the `isArrangement` branch, and
the kill switch stopped it. `0.600` ⇒ the `else` branch ran, wrong screen. Oscillation ⇒ alive.

Two safeguards, both from this project's own scar tissue:

- **The precondition.** Reanimated's web driver is `requestAnimationFrame`, and a hidden
  document runs zero rAF callbacks by spec — measured here on 2026-08-07 as 0 in 26.9s. So the
  probe runs a **real window under Xvfb** and aborts unless `document.hidden === false` and rAF
  actually ticks. Every run reported `hidden: false`, ~121 rAF per 2s (≈60fps).
- **A canary.** A probe that finds no motion is indistinguishable from a probe that cannot see
  motion, so each run injects an element driven by the page's own rAF and asserts the sampler
  observes it changing. Every run: 16 distinct canary values. A still canary voids the run
  rather than reporting "no pulse".

### 2.3 Result: the pulse works, and nothing dies

`tests/kill-switch-probe.mjs`, practice-only route, all network to `supabase.co` /
`ftable.co.il` aborted at the context.

```
dist-control    2P/393    16 slots    STILL AT 0.600      (what ships today)
dist-sentinel   2P/393    16 slots    STILL AT 0.137      the effect ran; KILL_Board stopped it
dist-live       2P/393    16 slots    PULSING 0.72..1.0   58 distinct values in 199 samples
```

`dist-sentinel` is the load-bearing row. It eliminates "wrong screen" outright: the effect ran,
entered `if (isArrangement)`, and wrote nothing, because `if (!KILL_Board)` is `if (false)`.

Full matrix on `dist-live`, **chromium**, all clean, zero page errors:

| seats | boards | slots | 393 px | 320 px |
|---|---|---|---|---|
| 2P | 4 | 16 | PULSING 16/16 | PULSING 16/16 |
| 3P | 3 | 12 | PULSING 12/12 | PULSING 12/12 |
| 4P | 2 | 8 | PULSING 8/8 | PULSING 8/8 |

Slot counts 16 / 12 / 8 are 4 slots × the dynamic board count — the rule holds at every seat.

**webkit**, 2P/393: `PULSING — 16/16`, zero page errors. Both engines.

**Long session**, 440s, 2P/393, 7,288 samples: still pulsing, page alive, zero page errors
(the four `NotAllowedError: play() failed` entries are the headless-audio autoplay policy, a
harness artefact, present in the control too).

**Frame cost — none.** Same viewport, same screen:

| | median | p95 | frames > 32ms | frames sampled |
|---|---|---|---|---|
| control, no pulse | 16.7 ms | 17.3 ms | 2 | 1,797 |
| live, 16 slots pulsing | **16.7 ms** | **17.4 ms** | **3** | **26,395** |

Sixteen simultaneous Reanimated pulses cost 0.1 ms at p95 and three dropped frames in 26,395.

### 2.4 Why Phase 4 got a different answer

I cannot prove which of these it was, so both stand:

1. **The bundle was stale.** Handoff 123 documents this project serving *different bytes under
   the same `index-…` filename* from the CDN. Phase 4 measured `caps.ftable.co.il` and recorded
   a bundle hash — but a hash from a stale-serving CDN is not proof of freshness, as SHIP-509
   found the hard way. This is the explanation I'd bet on.
2. **The reading was ambiguous** in exactly the way §2.2 describes and could have been the
   initial value all along.

Either way the fix was the same and is now applied: measure a **local export you built**, with a
**sentinel** the app cannot produce by accident.

### 2.5 The pulse is finite — confirmed, after a first measurement that was not a result

`withRepeat(…, 200, true)` over a 2s sequence should stop at ~400s, and "finite" had until now
only ever been a claim in a comment. A **470s run**, 7,768 samples:

```
tail30s: { fromApproxSecond: 436, slotsStillMoving: 0, of: 16 }
```

**Zero of sixteen slots moving over the final 30 seconds.** The repeat exhausts and stops. Taken
with the 440s run — still moving at 330s+ — the pulse runs and then ends somewhere between 330s
and 436s, which is where a 200 × 2s bound puts it. No leaked loop, no infinite repeat.

Frame cost held over the whole 470s: median 16.6 ms, p95 17.5 ms, 14 frames over 32 ms in 28,163
(0.05%). One 170 ms spike, with a full jest suite running on the same box.

**My first attempt at this was not a result and is recorded because it nearly was.** It measured
the last *quarter* of a 440s run and reported "16/16 still moving" — but the last quarter of 440s
opens at **330s**, before the ~400s bound it was meant to test. It would have read as a finding
about an animation that does not stop. The probe now measures the last 30 seconds by wall clock.

### 2.5b What was NOT established

**Anything about native.** See below.

### 2.6 Is native testable? No — plainly

**Not from this session, and not without putting a build on Roye's phone.** Stated as a fact,
not a hedge:

- No macOS host and no device here. iOS builds go GitHub Actions → TestFlight, and TestFlight is
  where Roye tests. Dispatching an iOS build with `KILL_Board` flipped **is** shipping the flip
  to a real installed app, which the brief forbids and which is the exact sequencing this switch
  exists to prevent.
- **The web result transfers nothing.** Web does not use Hermes. Everything in §2.3 is a
  statement about a JS engine that is not the one that crashed. `KILL_FINITE_ON_THIS_PLATFORM`
  carries a comment saying precisely this — *"WEB-SAFE IS NOT HERMES-SAFE"* — and it is right.

**What a real native test needs**, in order:

1. A dedicated TestFlight build off a branch, with `KILL_Board` false, that goes to **an internal
   tester group Roye is not in** — so a crash costs a tester session, not his.
2. A crash signal that is not the app's own reporter. The 2026-03 crash was a Hermes kill; a JS
   `ErrorBoundary` cannot catch an engine death, which is why `crash_reports` has no row for it.
   That means the **Xcode device log or an App Store Connect crash report**, not `crash_reports`.
3. The placement screen held open for **>400s** at 2 players (16 slots — the heaviest case), plus
   a countdown to ≤10s to exercise `KILL_game`'s reachable site, since a native test is expensive
   enough to be worth spending on both flags.
4. Only then a decision about production.

**My recommendation: do not flip it for the pulse.** §1.5 is why. The only visible change is one
outline getting 14–44% brighter, and two of the three gated animations would stay dead because
their props are dead. That is a poor trade for the only remaining Hermes risk in the app. The
switch is worth flipping when there is something behind it worth seeing — which is §3.

---

## 3 · WHAT "WOW" WOULD TAKE

### 3.0 First: what actually moves on the home screen today

Measured on the shipped export, 393×852, 14s, 174 frames, every `div`/`span`/`svg`/`img` sampled:

> **4 of 145 elements moved.** Three `HomeCupRings` arcs — which peak at `RING_PEAK = 0.13`
> opacity — and the "Claim daily bonus" strip.

That is the whole motion budget of the home screen, and three quarters of it is at 13% opacity.
So "the home screen doesn't wow" is a true report of a measurable fact.

But the screenshot says the cause is not motion. **The hero is fifteen blank white rounded
rectangles.** `HeroTable` renders `boards × 5` empty `heroPip` views — no rank, no suit, no
colour, no face. It reads as a wireframe of a poker table rather than a poker table. Below it,
the bottom third of the screen is empty black.

**Animating fifteen blank rectangles produces fifteen drifting blank rectangles.** I would not
spend the animation budget before the art budget, and I want that on the record before the three
costings, because two of the three are cheap enough to be tempting.

### 3.1 The card fan drifting

**This one cannot be costed as asked, because there is no card fan.** It was replaced by
`HeroTable` in C2. The pips are `View`s, not `<Card>`s.

- **To build a real fan first:** `<Card>` already renders standalone (27 call sites), so a
  3–5 card fan is a layout with static rotations — perhaps 40 lines, no animation, no new
  dependency. This is the piece that would actually change how the screen reads.
- **Then to drift it:** one shared value driving `rotate`/`translateY` per card via
  `interpolate`, one `useAnimatedStyle` per card. Home currently spends **2** Reanimated shared
  values against the project's ≤5 cap, so there is room for one more. `withRepeat(N)` finite,
  per the iron rule.
- **Cost:** ~1 SV, ~5 animated styles. §2.3 measured 16 concurrent Reanimated pulses at zero
  frame cost, so the runtime cost is not the constraint.
- **Risk:** none of the confetti/mass-worklet profile. But it is the *most* Reanimated the home
  screen has ever run on Hermes, so it wants the native test in §2.6 before it goes to Roye.

### 3.2 A button responding to press

**This already exists and already works.** `app/(tabs)/index.tsx`:

```
playOnlineScale   1 → 0.97  in 80ms   (in),  → 1.0 in 150ms  (out)   line 1461–1469
playScale         1 → 0.96  in 80ms   (in),  → 1.0 in 150ms  (out)   line 1502–1509
```

RN `Animated`, `useNativeDriver: true`, both applied to a real `Animated.View`. Unlike
`playGlowStyle`, I checked the render site.

So the cost of "a button that responds to press" is **zero — the machinery is shipped.** If it
does not read as responsive, the fix is amplitude and curve, not a mechanism: **0.96 is a 4%
scale**, and 80ms in / 150ms out is nearly imperceptible on a 250pt-wide button. Taking it to
~0.94 with a short overshoot on release is a two-number change in an existing `Animated.timing`,
no new shared values, no Reanimated, no Hermes exposure at all.

**This is the highest ratio of felt improvement to risk in the whole document.**

### 3.3 The felt breathing

- **What exists:** the felt is a static `FELT_GRADIENT.classic` gradient. `HomeCupRings` already
  provides ambient motion — RN `Animated.loop` with finite `RING_LOOPS = 45` (~7 min), native
  driver, and **zero Reanimated shared values**, which is exactly the right pattern.
- **Cost:** the cheapest of the three, because the pattern is already in the file and proven.
  One more `Animated.Value` driving a slow opacity or scale on an overlay above the gradient.
  No Reanimated, no Hermes exposure, no new dependency.
- **The catch:** `HomeCupRings` peaks at **0.13 opacity** and my measurement is the reason to say
  this out loud — it moves, and on a near-black ground you cannot see it. A "breathing" felt at a
  similar amplitude will measure as motion and read as nothing. If this is worth doing it is
  worth doing at an amplitude someone notices, and that is a design call, not a code one.

### 3.4 Is a new library the answer? No.

Asked for honestly, so: **no, and I do not think it is close.**

- **Moti** is a declarative wrapper *over Reanimated*, which is already installed at 4.2.1. It
  adds ergonomics, not capability. Every motion in §3.1–3.3 is writable today. It also inherits
  every Hermes property Reanimated has, so it buys nothing on the one axis that actually
  constrains this project.
- **Skia** is a real new native dependency: a native rebuild, meaningful binary size, and a
  second rendering path to reason about. It is the right tool for GPU-drawn effects that the
  view system genuinely cannot express. Nothing in §3.1–3.3 is that.
- **Rive** is not a library so much as a content pipeline: it needs an artist authoring `.riv`
  files. That is a real answer to "make it feel premium" — but it is a hire or a contract, not
  an afternoon, and it would be spent decorating a hero that is currently fifteen blank
  rectangles.

The measurements say the constraint is not the engine. This app has **two** animation engines
installed, both working on both platforms, and it uses so little of them that 16 concurrent
Reanimated pulses cost 0.1 ms at p95 — while the home screen ships **4 moving elements out of
145**, three of them at 13% opacity, one dead animated style applied to nothing, and one kill
flag with no usage sites at all.

**A third engine would not have changed a single measurement in this document.**

### 3.5 If I had to order it

1. **§3.2, the press feel** — two numbers, zero risk, zero new machinery, ships today.
2. **The hero art** — give `HeroTable` real cards instead of blank pips. Static. Still no
   animation. This is the largest visible change available and it costs nothing at runtime.
3. **§3.3, felt breathing** — proven pattern, native driver, but pick an amplitude that is
   actually visible.
4. **§3.1, the fan drift** — only after the fan exists, and only behind the native test in §2.6.
5. **`KILL_Board`** — not for the pulse. It buys one brighter outline (§1.5) and leaves two dead
   animations dead (§1.7). Flip it when there is something behind it worth the Hermes risk.

---

## Artefacts

| file | what it is |
|---|---|
| `tests/kill-switch-probe.mjs` | the three-build discriminator, with the rAF precondition and the canary. Practice-route guard; all production/database requests aborted |
| `tests/kill-switch-probe-*.json` | 9 runs — control, sentinel, live × {2P,3P,4P} × {393,320} × {chromium,webkit} |
| `tests/dead-branch-sweep.mjs` | the boolean-prop sweep, with its own two corrected mistakes written into its header |
| `tests/dead-branch-sweep-result.json` | 14 findings, 5 UNSCANNABLE |

## What did NOT change

`KILL_Board` and `KILL_game` are `true` in the repo and in production, unchanged. No animation
library installed. Felt, panels, cues, faucet values, economy and payment flags untouched. The
slot outline values in `constants/paintThemes.ts` untouched — §1.6 measures what re-enabling
would do to them and changes nothing. No app source was committed: every flag flip was made in
the working tree and reverted.
