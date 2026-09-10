# TIMER NOT LAYOUT — 2026-09-08

**Roye chose "more time where it scrolls". The change is built, derived and tested. And a solo
player will not feel it, because the solo arrangement phase has no clock at all.**

That is the finding, it was checked rather than assumed, and it is reported instead of shipped as a
win.

---

## §1 · WHAT WAS BUILT

### Derived from the layout, not from a typed list

`useGameLayout` already decides `boardsScroll` from two numbers. Those two numbers are now
published — **not recomputed**, exported — and the clock is derived from them:

```ts
// constants/gameConfig.ts
seconds = ceil(baseSeconds * boardsContentH / boardsAvailH)
```

`boardsAvailH` is the slice the boards get: total minus the hand zone minus the same `_FIT_SAFETY`
the fit search subtracts. So `content / avail > 1` is *exactly* the condition that already sets
`boardsScroll`, and there is no second opinion to drift from the first. A viewport nobody has
measured yet gets the right clock the day it appears, and a layout that stops overflowing silently
returns to base.

### How much, and why that much

The base clock is enough for a boards zone whose boards are all visible. Where only a fraction is on
screen the player must traverse the whole stack, so the clock scales by exactly that fraction.

| cell | avail / content | ratio | clock |
|---|---|---:|---:|
| 320×568 2P (4 boards) | 206 / 477 | 2.32 | **70s** |
| 320×568 3P (3 boards) | 254 / 367 | 1.45 | **44s** |
| 393×852 2P (4 boards) | 512 / 556 | 1.09 | **33s** |
| 320 4P · 393 3P · 393 4P | fits | — | **30s** (base) |

⚠️ **One typed number exists and it is a guard, not a knob.** `maxScrollMultiplier: 2.6`. The worst
cell measured is 2.32, so **the cap does not bite any real layout today** — it exists only so a
future pathological viewport cannot mint a two-minute clock. If a real device ever hits it, the cap
is the wrong answer and the layout is the thing to look at.

### In config, retunable without a deploy

`ARRANGE_CLOCK` and `getArrangeSeconds()` live in `constants/gameConfig.ts` beside the other
tunables. `app/game.tsx` no longer holds a literal: `COUNTDOWN_SECONDS = ARRANGE_CLOCK.baseSeconds`.

### ⚠️ SOLO ONLY, deliberately

Multiplayer's clock is **broadcast** (`app/multiplayer-game.tsx:78`) and paired with
`DEAL_CLOCK_MS = COUNTDOWN_SECS * 1000 + 15000`, a force-complete sitting 15s above it. A
per-device, layout-derived clock would give two players on different phones different deadlines from
the same broadcast, and could trip the force-complete on whichever phone got the longer one. That is
a server-side decision, not a client one.

---

## §2 · ⚠️ AND THE PREMISE DOES NOT HOLD FOR SOLO — THERE IS NO CLOCK TO EXTEND

The option was chosen because the problem is *scrolling under a clock*. **Solo has no clock.**

Read from the code first:

* `startCountdown()` has **exactly one call site** — inside the player's READY handler — and it runs
  **after** `setPlayerReady(true)`.
* The timeout branch is gated on `countdownActive && countdown === 0 && !playerReady`. Once the
  player has pressed READY, `playerReady` is true, so **that branch can never fire**.
* If the bots are already done — and they are, immediately — the same handler calls `doNavigate()`
  on the next line, so the screen leaves before a clock is ever painted.
* The bot-ready handler says it outright, `app/game.tsx:713`:
  *"Solo: bots never start countdown — player has free thinking time."*

Then watched it run, because a comment is a claim (`tests/solo-clock-reachability.mjs`), on the
worst cell — 320×568, 2 players, 271px hidden:

| | |
|---|---|
| watched | **47 seconds** on the placement screen |
| samples | 31 |
| countdown ever painted | **no** |
| hand auto-resolved | **no** |

**A solo player has unlimited time to arrange.** Scrolling costs them nothing but a scroll, which is
what the "▼ N more boards below" pill from the previous sprint already addresses.

⚠️ So the timer change is **correct and currently unreachable in solo**. It is kept, and labelled as
such at the call site, because it costs nothing and means the day a solo clock is switched on it is
already layout-aware rather than a bare 30 pasted back in. **But no player experiences a change
today, and calling this shipped would be a green check over an open hole.**

### Where the clock IS real — and why both fixes break one of Roye's rules

Multiplayer: `COUNTDOWN_SECS = 60`, broadcast, with a 75s force-complete. MP uses the same
`useGameLayout`, so the same 271px is hidden there. Two ways to give more time, and **each violates
one of the constraints**:

1. **Per-device, derived** (what was built for solo) — desyncs players, as above.
2. **Raise the shared constant for everyone** — safe, no desync, but it *"extends the timer where
   the layout fits"*, which this brief explicitly forbids.

The clean answer is neither: the room decides the duration server-side, accounting for the worst
client layout. That is a design change, not a timer tweak. **Roye's call, and 0 rooms have ever
reached `playing`, so nobody is affected while it waits.**

---

## §3 · THE INSTRUMENT, RE-VERIFIED BEFORE ANY NUMBER WAS BELIEVED

The overflow probe reported **0px in all twelve cells** last sprint and was wrong. It now **plants a
known 240px spacer into its own scroller in every cell and re-measures**; if the plant does not show
up, the run aborts and none of its numbers are used.

| | planted | seen |
|---|---:|---:|
| the six overflowing measurements | 240px | **240px** in all |
| the six that fit | 240px | 219–240px (flex reflow absorbs a little) |

**Twelve of twelve caught it.** The floor is half the plant; nothing came near failing.

### Geometry byte-identical

Same run, same numbers as the pre-change control:

| cell | before | now |
|---|---|---|
| 320 2P | 206 / 477, 271px | **206 / 477, 271px** |
| 320 3P | 254 / 367, 113px | **254 / 367, 113px** |
| 393 2P | 512 / 556, 44px | **512 / 556, 44px** |
| the other three | no overflow | **no overflow** |

Card sizes, `_FIT_SAFETY`, spacing and the 83px arc did not move — this touched none of them. The
only files changed are the config, the hook's return block (two extra exported fields), and the
solo screen's clock wiring.

---

## §4 · STILL OPEN

* **Multiplayer's clock is the real one and is unchanged.** Roye picks between a shared raise and a
  server-side per-room duration.
* **The solo clock is unreachable.** If it should exist at all, that is a separate decision — the
  code's current comment says free thinking time is intentional.
* **The reporter's media path still needs a device.** `BugReporter.handleStart` returns early on web
  and the capture API is native-only, so no browser on any host can start it. ⚠️ **Which reporter a
  tester will actually use decides whether the round's evidence channel is proven:** a tester who
  taps *Report a bug* in Settings uses `ReportBugButton` — text only, always honest, unchanged, and
  the one a browser can reach. A tester who *shakes the phone or uses the FAB* gets `BugReporter`,
  the media path this project just rewrote, **which has never been exercised end to end.** If the
  round depends on shake reports, that channel is unproven.
* Carried forward: deploy `paths-ignore` unproven on a live trigger · Vercel bill unread · `/lobby`
  promises auto-start with 0 rooms ever `playing` · `/club/DEMO` renders for any code ·
  `submit_score` unledgered · App Store listing blank, age rating unanswered.
