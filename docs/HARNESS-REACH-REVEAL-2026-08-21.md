# CAPS — the harness always worked; I never looked (2026-08-21)

Three sprints ended on *"the harness cannot reach a reveal"*. It could. The blocker was my method,
and the fix is one shared module lifted from code that already existed.

## Why Auto-Place did not complete — two causes, both mine

1. **Wrong control.** There are **two** Auto-Place affordances: a **per-board** chip
   ([Board.tsx:710](components/Board.tsx:710), rendered only while *that* board is empty) and
   **"Auto-Place ALL"** ([PlayerHand.tsx:272](components/PlayerHand.tsx:272), `aria-label`
   *"Auto-place all boards"*). I matched `/Auto-Place/` and took `.first()` — the per-board chip. It
   filled board 0 only, so `allBoardsFull` stayed false, and
   [BoardArrangement.tsx:514](components/BoardArrangement.tsx:514) is `disabled={!allBoardsFull}`:
   my Ready click was a **no-op on a disabled button**. Exactly the symptom reported three times.
2. **Wrong click primitive.** The last variant used `el.click()` in-page — a synthetic DOM click.
   RN-web `Pressable` needs a pointer sequence.

**And the repo had already solved both.** [tests/mp-full-hand.mjs:109](tests/mp-full-hand.mjs:109)
has had a working `place()` the whole time — it matches `/auto-place all/i` and clicks via a
`fire()` helper dispatching `pointerdown → mousedown → pointerup → mouseup → click`. Its docstring:
*"…both place, both ready, reveal."*

The project's rule is **Research & Reuse before any new implementation**. I wrote three placement
routines from scratch and never grepped for one. **41 test files each define their own `fire()`**
with no shared module — which is why this keeps being reinvented.

**Fix:** [tests/harness/play.mjs](tests/harness/play.mjs) — one shared module, everything lifted
rather than rewritten, which also **polls `ready-button` until it is enabled** instead of
sleeping-and-hoping (the fill is async). Both traps are documented in the file header. The other 40
`fire()` copies were **not** refactored — a separate, risky sweep.

**Fallback: not needed.** Auto-Place ALL worked first time through the helper. The per-board loop and
the tap-card-then-slot ladder exist in the module but were never reached, so they are **untested** —
said plainly so nobody assumes otherwise.

## Harness reaches `/results` by playing: **YES**

Both engines, fresh start, no deep-link and no `autoSim`:

| engine | path |
|---|---|
| webkit/430 | "PLACE 8 CARDS" → placed → armed → ready → reveal → `/results` — *"COMPLETE! You won ALL boards!"* |
| chromium/393 | same path → `/results` — *"YOU LOSE · Practice vs bot — XP only, no chips"* |

Two different outcomes from two real hands, which is what playing looks like.

## The 3px `#FFD700` WON border — captured, same frame

**webkit/430**, one frame during the reveal:

| role | measured |
|---|---|
| **WINNER** | **`rgb(255, 215, 0)` @ 3.0px** × 3 |
| control — field | `rgb(79, 214, 168)` @ 2.0px × 6 |
| control — neutral | `rgba(0, 0, 0, 0.22)` @ 1.0px × 26 |
| control — card-back edge / rings | `rgba(255,255,255,0.18)` @ 2.0px, `0.16` @ 3.0px |

**chromium/393:** winner `rgb(255,215,0)` @ **2.7px**, field 2.0px, neutral 0.7px. The 2.7-vs-3.0 is
device-pixel rounding — [Card.tsx:473](components/Card.tsx:473) warns about exactly this. **The
ordering holds on both: winner > field > neutral.**

The whole `v2Border` map is now confirmed **live and in one frame**: gold 3px won · mint 2px field ·
black-22% 1px neutral.

## Greyscale, from the painted values, corrected colour

| pair | ratio |
|---|---:|
| winner vs CLASSIC back | **12.621 : 1** (published static: 12.621 — exact match) |
| winner vs SLATE back | **5.804 : 1** (published static: 5.804 — exact match) |
| winner vs field mint | 1.300 : 1 |
| winner vs neutral | 1.218 : 1 |

**Honest reading, and it matters:** in pure greyscale the winner does **not** separate from the field
or the neutral by colour — 1.300 and 1.218 are nothing. What survives desaturation is the **width**:
3px vs 2px vs 1px. The two channels are not equal — **for a colourblind or greyscale user the width
*is* the cue** and the colour is decoration. Worth knowing before anyone "simplifies" the widths.

## Emotes — fifth criterion **observed**, not simulated

[tests/emote-pack-live.mjs](tests/emote-pack-live.mjs) drove **two real clients** into one live room
(both reached `/multiplayer-game`) after client A bought the pack through the real shop and selected
WILD in the real picker. A's live strip rendered:

**🤯 🫠 🚀 🧊 🤝 🐐** — `STRIP IS WILD: true`, `STRIP IS CLASSIC: false`

One harness bug worth recording: the first strip reader scanned for pictographic glyphs by size and
returned `["♠","♥","♣","♥","♦","♥","♣","♠"]` — **card suits match `\p{Extended_Pictographic}` too.**
Re-anchored on the per-button `aria-label` [ChatOverlay.tsx:84](components/ChatOverlay.tsx:84)
already emits. Anchor on the label, never on "things that look like emoji".

**All four families are now 5 of 5.**

## Cleanup

Rule used, stated so it can be audited: every device whose **first** analytics event falls inside
this sprint's window (2026-08-21 09:55 onward), plus anything holding a `purchases` row.
`7159-1e31-d433` first appeared 2026-08-20 and is a real bound device — **excluded by the rule, not
by hand**.

Deleted: 3 purchases · 35 chip_transactions · 19 leaderboard · 2 bindings · 2 hand_history · 47 rate
counters · 16 streaks · 16 daily_rewards · 278 analytics_events. **`purchases` back to zero**, 0 test
devices, 0 QA functions, the 2 real bindings untouched.

*Another session pushed mid-sprint (board colour repin touching `constants/visualThemes.ts`, which
the streetStencil unlock reads). Rebased, confirmed streetStencil still defined and the picker entry
intact, then pushed.*

**Nothing else changed:** no C5 option built · nothing free gated · no catalogue items or price
changes · no stake tiers, stakes UI or tournaments · MP prompt untouched · no keys.

*(handoff: `vamos_handoffs` id 86)*
