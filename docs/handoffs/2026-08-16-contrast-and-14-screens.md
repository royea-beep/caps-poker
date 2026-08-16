# 2026-08-16 — Contrast, then the 14 unreviewed screens

Shipped `1a28f47` and `c834357`, both deployed. `tsc` exit 0. Four fixes, two artifacts caught
before they became fixes.

## Task 1 — the `★ Best hand from…` caption

`components/BoardResultCard.tsx:344`, `#8B6914` → **`#e8c96a`**.

Verified by painted pixels on the live build, **all four configurations**:

| engine / width | painted | on | contrast |
|---|---|---|---|
| chromium @390 | `rgb(232,201,106)` | `rgb(22,25,34)` | **10.86:1** |
| chromium @320 | `rgb(232,201,106)` | `rgb(22,25,34)` | **10.86:1** |
| webkit @390 | `rgb(232,201,106)` | `rgb(22,25,34)` | **10.86:1** |
| webkit @320 | `rgb(232,201,106)` | `rgb(22,25,34)` | **10.86:1** |

Was 3.45:1, below AA. Deliberately **not** `#FFD700`: that now means "you won", and a caption must
not shout in the winner colour.

### The colour was not swept — the other two sites judged on their own standard

- **chip-store BEST VALUE badge** (`chip-store.tsx:193`) — **not measured, and unchanged.** The
  badge did not render on the live chip-store during any run, so there was nothing to sample. It is
  a *background* rather than text, so the 4.5:1 text rule would not have applied to it anyway.
  Reported as unmeasured rather than as passing.
- **player-count selector border** (`index.tsx:1471`) — **left alone.** 3.89:1, and it is a
  non-text UI component where AA asks 3:1. It passes its own standard.

## Task 2 — the 14 screens

**Checked (14):** `/cups` · `/play` · `/profile` · `/achievements` · `/chip-store` ·
`/hand-history` · `/missions` · `/rank` · `/referral` · `/stats` · `/theme-pick` ·
`/orientation-pick` · `/gameover` · `/lobby/private`

**Not checked (4), and why:** `/debug` and `/simulate` are dev-only tools, not tester-facing;
`/club/[code]` needs a real club code to render anything; `/multiplayer-game` needs two live
clients and was exercised separately in the MP work.

**56 of 56** screen × engine × width combinations measured — no blanks, no unmounted screens, and
**no WebKit crash** during the sweep itself.

### Results

| | before | after |
|---|---|---|
| text under 10px | **8** | **0** |
| touch targets under 44px | **8** | **0** |
| clipped text | 0 | 0 |
| off-screen text | 6 | 6 — *artifact, see below* |
| overlap candidates | 12 | 12 — *artifact, see below* |

### Fixed — clear-cut only

1. **`/chip-store` dismiss ✕ — 21×19.** All four configurations. `hitSlop 8` lifted the touchable
   area to 37×35, still under 44 — and hitSlop does not enlarge the box an audit can see, so the
   control failed both in the hand and on inspection. Sized the control itself; hitSlop stays as
   extra margin.
2. **`/lobby/private` ‹ Back — 60×21 at 390, 49×17 at 320.** All four. `hitSlop 10` made it 41 tall,
   still short. Same treatment.
3. **`/lobby/private` 9px text at 320**, four labels, both engines. `rf(11)` clamps to
   `[8.25, 13.75]`, so 320 rendered 9px — below the project's own 10px floor. Added the
   second-argument floor `rf(11, 10)`, the fix already used elsewhere in the codebase.

### Reported, not fixed — both were artifacts

**`/achievements` off-screen labels** ("Collection" at 390, plus "Social" at 320). Walked the
ancestors: at depth 2 sits a container with `overflowX: auto`, `scrollWidth 451` vs
`clientWidth 390`. It is a **horizontally scrollable tab strip** — the labels are reachable by
scrolling. Same shape as the `/battle-pass` off-screen items ruled an artifact earlier.

**`/missions` overlaps** ("EASY / Play 3 games", "HARD / Marathon"). This is **box-not-ink**. The
title *element* is full width (right edge 357) and the badge sits at 326–353, so their boxes
intersect — but measuring the glyph extent with a `Range` shows the text ends far earlier:

```
"Play 3 games"  ink ends x=125   EASY badge starts x=326   gap 201px
"Marathon"      ink ends x=102   HARD badge starts x=322   gap 220px
inkOverlap: false, both pairs
```

A box-based overlap check cannot see this; a `Range` can. Nothing overlaps visually.

### Artifact filters that were applied

The sweep filters, by name, every artifact class this project has been burned by: the **parked
drawer** (`transform: matrix(1,0,0,1,293,0)` and `pointerEvents: none`), **decorative glyphs**
(`♠♥♦♣` and card ranks, which are supposed to be small), **containers not text nodes** (touch
targets measure the pressable box), **nested duplicates** (overlap boxes deduped by geometry — the
same doubling that made the highlight probe find nothing), and **unsettled layout** (each screen is
read, waited on, and re-read before anything is reported).

**Occlusion is deliberately not filtered** — it cannot be detected from styles alone, which is why
overlaps are reported as *candidates* and were verified by hand rather than trusted.

The probe **exits non-zero if it measured nothing**, because a run that collects no nodes reads
exactly like a clean one.

## DB state

All probe rows removed and verified. This run's hands created rows across ~11 devices; all deleted.

```
hand_history 151 (baseline) | leaderboard 782 (baseline) | bot_ rows 0 | probe- rows 0
bug_reports 250 | rooms 11 (11/11 clean) | room_players 0
```

No `game_rooms` / `room_players` rows deleted.

## MACHINE

`tsc` exit 0 on every run this session. Two WebKit tabs crashed during the *colour* measurements
(not the sweep); both were rerun and the rerun succeeded. Memory test still not run, so local
results stay PROVISIONAL.

=== STRATEGIST HANDOFF — CONTRAST + 14 SCREENS ===
TASK 1 CONTRAST:
  - ★ Best hand label: #8B6914 -> #e8c96a, measured 10.86:1 after (was 3.45:1).
    components/BoardResultCard.tsx:344. NOT #FFD700 — that means "you won" now.
  - chip-store BEST VALUE badge: NOT MEASURED — the badge did not render on the live chip-store in
    any run, so there was nothing to sample. Unchanged. It is a BACKGROUND, so the 4.5:1 text rule
    would not govern it in any case. Reported as unmeasured, not as passing.
  - player-count selector border 3.89:1 — LEFT ALONE. Non-text UI component, AA asks 3:1, it
    passes its own standard.
  - painted pixels verified, both engines, 390 and 320? YES — all four read rgb(232,201,106) on
    rgb(22,25,34) = 10.86:1. webkit@320 crashed once and was rerun, per the harness rule.
TASK 2 THE 14 SCREENS:
  - checked (14): /cups /play /profile /achievements /chip-store /hand-history /missions /rank
    /referral /stats /theme-pick /orientation-pick /gameover /lobby/private
  - NOT checked (4): /debug and /simulate (dev-only, not tester-facing), /club/[code] (needs a real
    club code), /multiplayer-game (needs two live clients; covered by the MP work).
  - 56 of 56 screen x engine x width combinations measured. No blanks, no unmounted screens.
  - totals BEFORE: tiny<10 8 | off-screen 6 | clipped 0 | tap<44 8 | overlap candidates 12
    totals AFTER:  tiny<10 0 | off-screen 6 | clipped 0 | tap<44 0 | overlap candidates 12
    (the two unchanged numbers are the two artifacts, below)
  - artifacts filtered and named: parked drawer (matrix translate + pointerEvents none),
    decorative glyphs, containers-not-text-nodes, nested duplicates, unsettled layout. Occlusion
    NOT filtered by design — undetectable from styles, so overlaps are candidates only.
  - FIXED (clear-cut): chip-store ✕ 21x19 (hitSlop 8 gave only 37x35) -> minWidth/minHeight 44;
    lobby/private Back 60x21 / 49x17 (hitSlop 10 gave 41 tall) -> minHeight 44; lobby/private
    rf(11) rendering 9px at 320 -> rf(11, 10), the project's own floor.
  - REPORTED not fixed, both ARTIFACTS: /achievements off-screen labels sit in a container with
    overflowX auto, scrollWidth 451 vs clientWidth 390 — a horizontal tab strip, reachable by
    scrolling. /missions overlaps are box-not-ink: measured with a Range, "Play 3 games" ink ends
    at x=125 while the EASY badge starts at x=326, a 201px gap; inkOverlap false for both pairs.
  - any WebKit crash? Not during the sweep. Two crashes during the colour measurements; both rerun
    and the rerun succeeded.
LIVE: main c834357 | deployed (run 31954808710, success) | chromium + webkit, 390 and 320.
tsc: exit code 0 (by exit code, not output).
DB: probe rows cleaned — hand_history 151, leaderboard 782, bot_ 0, probe- 0, bug_reports 250,
    rooms 11/11 clean, room_players 0. Nothing deleted from game_rooms/room_players.
HANDOFF: file + vamos_handoffs slug 2026-08-16-contrast-and-14-screens + chars, code-point match? Y
WHAT I DID NOT CHECK: the BEST VALUE badge never rendered, so its contrast is unmeasured; colour
  contrast was NOT swept across the 14 screens (only the caption was in scope) — a full contrast
  audit of those screens has still never been done; /club/[code], /debug, /simulate and
  /multiplayer-game were not swept; and screens were checked in their default empty state, so
  populated states (a long player name, a full mission list) are unverified.
=== END ===
