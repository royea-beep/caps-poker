# PRE-TESTER BACKLOG — RECONCILED against code 2026-08-13

> ## ⚠️ THE CLOSURE RULE — read before editing this file
>
> **An item is not closed until THIS FILE says so. A code comment is not a closure record.**
>
> Every sprint that closes an item updates this file **in the same commit** that closes it.
> Not the next sprint, not the handoff, not a comment in the source.
>
> **Why this rule exists, specifically.** On 2026-08-13 a sprint was scheduled to fix nine
> settings items. All nine were already fixed. The fixes were recorded — meticulously — in
> `app/settings.tsx`'s own comments, which no plan reads. The sprint before it found nine more
> stale entries. Roughly twenty items across two sprints were listed as OPEN while being
> already done, and a full sprint was planned against work that did not exist.
>
> A sprint that ships changes to already-correct code is **worse** than a sprint that ships
> nothing: it adds risk to a working screen for no gain.
>
> **Iron Rule #14 applies to our own comments.** A comment saying "FIXED" is a claim. The
> evidence column below holds code locations and measurements, not assertions.

**Reconciliation method:** every entry checked against the code that would exhibit it, not
against the comment claiming it was fixed. Live measurements anchored by `testID`, fresh mounts,
both engines, where behaviour rather than source was the question.

---

## COUNTS

| | |
|---|---|
| Items reconciled | **33 of 35** |
| **OPEN** | **9** |
| **CLOSED** | **20** |
| **UNVERIFIABLE** | **4** |
| Not yet reconciled (see the end) | **2** |

**Second pass, 2026-08-13 (same day).** The seven marked DO-NOT-SCHEDULE were reconciled. Three
more closures came out of it — **including E6, which the first pass had listed as OPEN**. Two
new OPEN items came out of it as well, so the list moved in both directions, which is what a
reconciliation is supposed to do.

---

## OPEN — the genuinely remaining work

| Item | Roye's text / description | Evidence it is still live |
|---|---|---|
| **C4** | *"מסגרת לא מבדילה — קלף חשוף וגב-C שניהם במסגרת זהב. אותו סימון לשני מצבים הפוכים."* | **FIXED 2026-08-14.** The cited evidence was wrong: `CARD_BACK_BORDER = '#C5A028'` (L77) has **zero consumers** — a dead constant — and the back stopped being gold in the card-face batch. The live defect was the opposite. `const isV2 = true` (:447) is hardcoded, so `highlightBorder`/`highlightShadow` never rendered and the settled map (gold=won · mint=field) sat entirely in the dead branch; what shipped was black-25% on the winner and `borderWidth: 0` on everything else — no marking for any state. Map moved onto the live `v2Border`: gold 2.5px won · mint 2px field · black-22% 1px neutral. |
| **C5** | *"מונוטוניות 5 גבים זהים ברצף."* | **MEASURED, NOT FIXED 2026-08-14 — still OPEN and still live.** The stated cause was wrong in the same way C2/C4's was: `CARD_BACK_BG`/`CARD_BACK_BORDER` are dead constants. The live back is the "C" back, and it is a single `CARD_BACK_C_*` set consumed once (`Card.tsx:316`, `:346`), so every back is byte-identical — confirmed live on the deployed bundle, which renders 6 identical `2px rgba(255,255,255,0.18)` edge rings in one frame. Fixing it needs deterministic per-card variation keyed off card id (rotation, ring alpha, or C weight), which is a design change, not a constant swap. Larger than it reads — measured and stopped per brief. |
| **E2** | *"רגע ההפסד — 'YOU LOSE' אדום סטטי; צריך להיות רך ומעודד כדי שישחק שוב."* | `results.tsx:1045` renders the headline; still static. |
| **C2** | *"היררכיה הפוכה של הגב — הגב השחור הוא האלמנט הכי בולט; המידע שלא רואים צועק יותר מהחשוף."* | **ADDRESSED, NOT EYE-VERIFIED 2026-08-14.** Cited evidence also dead: `CARD_BACK_BG = '#1A1A2E'` (L76) has zero consumers. The live back is already neutral charcoal + white-alpha, and the face now carries a border again (C4), so the exposed card is the marked element and the back is the placeholder — which is the inversion Roye described, corrected from both ends. Needs an owner eye-test on device before closing. |
| **`card_placed` 4th path** | bot | **Confirmed OPEN by reading the block.** `game.tsx:456-468` — the countdown-expiry path emits `track('arrangement_timeout')` at `:458`, then `autoFillPlayerCards`, and **never emits `card_placed`**. Three other sites do (`:851`, `:955`, `:1004`). This is the instrument we read the tester round with. |
| **"Best possible hand" as text** | *"'Best possible hand' מציג קלפים כטקסט (Q♦ 4♠) ולא כקלפים."* | 12 live references; still rendered as text. |
| **E4** | *"אנימציות כניסה/היפוך/תגובה למגע לקלפים."* | No enter/flip/touch animation on `Card.tsx`. |
| **A7** | *"17+ בוטל ב-Apple ב-31.1.2026. Simulated Gambling מחייב 18+. חוסם אישור App Store."* | App Store Connect setting; no code. Blocks submission, not testers. |
| **8px pips / 9px `LEAD`** | bot | Measured live 2026-08-13, both engines, both widths. Explicitly *outside* the closed TYPE WORK scope (pips are graphics sized by the card). |

## CLOSED — with the evidence used

| Item | Evidence (code, not comment) |
|---|---|
| **A2** mojibake on the minus button | `settings.tsx:1161` renders `−` U+2212. Read the glyph. |
| **A3** contradictory sound controls | 0 live "Mute sounds" controls; `AmbientToggle` + `SoundToggle` are distinct assets. |
| **A4** duplicate Pro Quotes / Privacy Policy | Both duplicates gone; single Privacy Policy link at :1285. |
| **A5** wrong colorblind label | `:590` renders `'Now: Blue = Win, Orange = Lose'` when on. |
| **A6** two reset buttons | One control remains; beta twin removed. **Dialog enumerates: *"This will delete all chips, level, history and streak."*** |
| **B1** unify five look-pickers | `settings.tsx:1031` — Background/Home/Button/Card-design folded into one **VISUAL STYLE** picker (:692). Button Style was dead; Card Design removed. |
| **B3** Background Theme dead | Picker no longer exists — subsumed by B1 via `VISUAL_THEME_AXES`. |
| **B4** "Dev preview" leaked | String absent from the entire codebase. |
| **B5** DEVELOPER section open | 10 `devUnlocked` gates; 7-tap unlock. |
| **B6** brand-hostile Home Theme colours | Home Theme picker removed with B1. |
| **B7** DANGER ZONE in mint | `:1255` `{ color: '#C62828' }`, matching the button below. |
| **B8** two toggle paradigms | **Zero `<Switch>`** components. *(Residual — see Batch B below.)* |
| **C1** upgraded card face | Shipped `aa94363`, default v3. |
| **C3** visual ownership | `Card.tsx:25,58` — always-cyan ownership rim, gated by zone. |
| **E1** win moment too subtle | Verified 20 dots / 31 distinct transforms. |
| **MP hole cards on an open channel** | **CLOSED 2026-08-13.** Migration live; 5/5 proven on branch; denials re-proven on prod. |
| **"41 of 43 iOS devices silent"** | **Never real.** `device_model = "Simulator iOS"`; 66 simulator sessions/0 played vs 4 real iPhones/4 played. |

## UNVERIFIABLE — and what each needs

| Item | Needs |
|---|---|
| **Card delivery on production** | Two seated players. Denials proven on prod; delivery proven only on a branch. Roye's 3-minute check. |
| **`Board.handName` rendered size** | MP-only (`revealed &&` is hardcoded false in solo). Two devices. Edited twice before anyone checked. |
| **A3 as *sound*** | No audio measurement tooling. Verifiable as state, never as audible behaviour. |
| **Anything native-rendered** | No iOS build until memory test → certificate → build clears. |

---

## THE FOUR PREVIOUSLY-UNRECOVERED ITEMS — verbatim, with true status

- **C5** — *"מונוטוניות 5 גבים זהים ברצף."* → **OPEN.** Measured 2026-08-14: live, cause misfiled (dead constants), fix is per-card variation keyed off card id — a design change, not a constant swap.

#### Layout at 4 boards / 16 cards — measured 2026-08-14 (the configuration the arc never ran)

Forced with `?practice=true&players=2`; every probe now prints its board count, because the whole
arc had run at `players=3` without recording it. See protocol Rules 21 and 22.

| config | boards | hand cards | rows | clipped cards BEFORE | AFTER | overlaps (clip-aware) |
|---|---|---|---|---|---|---|
| 2P | **4** | **16** | 2 | **8 cut 10–11px** | **0** | 0 |
| 3P | 3 | 12 | 2 | 0 | 0 | 0 |
| 4P | 2 | 8 | 2 | 0 | 0 | 0 |

**Roye's three photographed defects:**
1. **Hand row clipped — REPRODUCED and FIXED.** 8 of 16 cards cut 10–11px at 375, 393, both
   engines. Cause: the hand-zone budget counted 18px of chrome against a real 29.7px. Fixed in
   `useGameLayout` by correcting the premise, not by shrinking anything.
2. **`Auto-Place ALL` over the action bar — NOT REPRODUCED on web.** Measured in the exact state
   (12 of 16 placed, so Cancel/Confirm present *and* the pill still on screen) at 320×568,
   375×667, 375×812, 393×852, 1706×960: clearance is **+15 to +17px** at every one, no
   intersection. `BoardArrangement.tsx:134-143` documents this exact defect ("10px of overlap at
   320 wide, 0px — touching — at 390") **and its fix** — `ACTION_BAR_CLEARANCE`. The measurement
   says that fix is live. Most likely the screenshot predates it. Needs a native measurement or a
   build number to settle; not changed on a guess.
3. **`✕` over the `Practice · no chips` pill — NOT REPRODUCED on web.** Horizontal gap **+18 to
   +21px** at every viewport including 320 wide. Same conclusion as (2).

**Boards scroll by design and that is unchanged.** `board-3` is cut off at rest at every mobile
width (67–83px) because the boards zone is a scroller — it was 55px before this fix and is larger
now, since the hand correctly reclaimed ~12px. Reachable by scrolling. Flagged rather than
buried: if Roye wants all four boards visible without scrolling, that is a card-size decision and
a separate brief.

#### Type legibility, measured 2026-08-14

- **LEAD label (reveal equity row)** — was `rf(9)`, the smallest type on the reveal. Raised to
  `rf(11)`, one step of the scale already in use there (11 / 13 / 15), with the label box widened
  `rs(30)` → `rs(38)`: at 9px the text filled the 30-wide box exactly, so raising the size alone
  would have clipped the word instead of enlarging it. Already on the reactive path
  (`screenW` passed), so no module-scope freeze.
- **8px "pips"** — **not a live condition.** `Card.tsx` `_suitFloor = 8` is a floor that never
  binds: measured on the live build, the smallest suit glyph that renders is **10px** at 375 and
  393, in placement and at the reveal, because `width * mainSuitRatio` clears 8 at every card size
  we ship. Raising the floor would change nothing. Making the pips genuinely larger means raising
  the ratio or the card width — card sizing, inside the closed layout arc. Measured and stopped.

#### C5 — the question for Roye, with costs

Variation must be keyed off a **stable hash of card id**, never off rank, suit or value: the back
is what the opponent looks at for the whole hand, and it turns face-up at the reveal. If anything
about the back correlates with the face, we have built an information leak that only becomes
visible once someone notices — the worst failure mode available here. Every option below is
id-hashed for that reason, and whichever is chosen needs a test asserting no correlation.

| Option | What varies | Cost | Risk |
|---|---|---|---|
| **A — ring alpha** | the inner ring's alpha across ~4 steps (0.10–0.22) | one constant → a small hash fn; ~10 lines in `Card.tsx` | lowest. Invisible at hand sizes, which may mean it does not answer the complaint at all |
| **B — C rotation** | the "C" glyph rotated ±2–6° in ~4 steps | ~10 lines, one `transform` | low. Reads as craft at large sizes; at 44px wide it may read as a rendering fault |
| **C — ring offset** | the ring's centre offset 1–2px in 4 directions | ~15 lines, touches the back's absolute layout | medium. It is the only one that changes geometry, so it needs a layout re-check |
| **D — pattern seed** | a subtle repeating mark seeded per card | new artwork inside the back | highest. Real design work; the only option that is unambiguously visible |

The prior question is whether the monotony Roye saw is a **problem at the size the backs actually
render**, or only in a mock. Worth measuring the rendered back size on device before choosing —
A and B may be literally invisible there, in which case the honest answer is D or nothing.

### OPEN QUESTION from the reveal verification, 2026-08-14 — do not lose this

The winner gold border (`Card.tsx` `v2Border`, shipped `694565f`) was **not observed during the
on-board reveal**. A practice 3P hand was driven to completion on the live bundle and sampled at
6s / 14s / 22s / 30s: the boards revealed (bot hands face-up, hand names shown) and the frame
carried mint community frames and neutral hand borders throughout, but **no gold appeared at any
sample**. Gold appeared only after the route changed to `/results`, where 10 elements render
`2px rgb(201,168,76)`.

Two things are unresolved and neither should be guessed at:
1. `Board.tsx` passes `highlighted={revealed && boardHighlightIds.includes(c.id)}` (:776, :817,
   :831, :862) — live-looking, but `revealed={false}` is a documented trap in this codebase and
   the sampling did not confirm `revealed` was ever true.
2. The `/results` gold measures **2px**, not the 2.5px in the source, and `results.tsx` imports
   neither `Card` nor `StaticCard` — so that gold may come from a third surface entirely.
   `components/StaticCard.tsx:60` carries its own independent `2.5px #c9a84c`.

**CLOSED 2026-08-14.** Fixed at `BoardReveal`'s community row (`258979a`), not at
`BoardArrangement:303` as the map below proposed — that surface sits *behind* the reveal. Gold
raised 2.5 → 3px in the follow-up because Chromium rounds border-width to whole device pixels and
2.5 rendered as 2, identical to mint, collapsing the width channel exactly where it was needed.
Dead implementations swept in the same pass. Historical mechanism kept below.

### QUESTION FOR ROYE — the bot and player rows have no winner cue

**Before:** `BoardReveal` marked the winning *community* cards with `winGlow` — a `#FFD700` shadow
plus `elevation: 8`. The bot and player seat rows never had a winner cue at all; they had only the
spotlight dimming that fades non-highlighted cards.

**Now:** the community row carries the settled gold border and `winGlow` is gone. The seat rows are
unchanged — still no cue, still only the dimming. So nothing was taken away from them, but the
contrast is sharper now that the community row is marked more strongly.

**Why this is not obviously "just add the same border".** The community row is *shared* — one board,
one winning five. The seat rows are *per-player*. Putting the same gold on all three rows at once
would render four gold-bordered groups on screen simultaneously, which reads as four separate
winners rather than one shared winning board. The dimming already answers "who won" by leaving the
winner's cards bright; the border answers "which cards made the hand", and that question only has a
single answer per board.

| Option | What it does | Cost | Risk |
|---|---|---|---|
| **1 — nothing, by design** | seat rows keep the dimming only | zero | the strongest cue sits on the shared row, which may be exactly right |
| **2 — same gold border on seat rows** | pass `highlighted` at `:816`/`:823` from `playerHighlightIds`/`botHighlightIds` | ~2 lines | four gold groups at once; likely reads as four winners |
| **3 — lighter variant on seat rows** | e.g. gold at 1.5px, or gold on the winner's row only and not the losers' | ~10 lines + a new width in the map | introduces a fourth border weight; the map currently has exactly three |

Recommendation is **1** until Roye says the seat rows read as unmarked — but it is his call, not a
defect.

### Dead winner-cue implementations — swept 2026-08-14

Confirmed from the **deployed bundle**, not from source, per the lesson that source can read live
and not be:
- `Card.tsx` `highlightBorder` + `highlightShadow` — **DELETED.** Bundle grep for
  `borderWidth:2.5,borderColor:'#c9a84c'` returned exactly two hits and neither was this one: the
  minifier had already folded the branch away because `isV2` is a `const true`. `suitBorderColor`
  and `isFaceCard` went with it, having no other consumer.
- `BoardReveal` `winGlow` — **DELETED** in `258979a`.
- `StaticCard.tsx:60` — **LEFT IN PLACE, unconfirmed.** Its gold *is* present in the bundle, so it
  ships; whether it can be reached is a runtime question about `BoardResultCard`, which S53 proved
  dead by instrumentation but which I have not re-instrumented this session. `/results` showed no
  card-shaped gold in two measured runs, which is consistent with dead but does not prove it.
  Deleting on that evidence is exactly the move that has burned this codebase five times.

**Historical mechanism (kept for the record):**

### Card renderer map — measured, `file:line` for import and render site

| Surface | Component | Import | Render site |
|---|---|---|---|
| Arrangement board | `Card` via `Board` | `components/Board.tsx:15` | `BoardArrangement.tsx:~295` → `Board`, **`revealed={false}` at :303** |
| On-board reveal (solo) | same as above | same | same — it is the same `Board`, never re-mounted with `revealed` true |
| Reveal overlay | `Card` as `CardComponent` | `components/BoardReveal.tsx:20` | `:816`, `:823` — **`highlighted` is never passed** |
| `/results` | `StaticCard` via `BoardResultCard` | `app/results.tsx:8` → `BoardResultCard.tsx:11` | `:195`, `:213`, `:220`, `:232` — component is instrumented-dead (S53, `visibleBoardCount=0`) |
| Player's hand | `Card` as `CardComponent` | `components/PlayerHand.tsx:8` | hand rows |

### Four independent "winner border" implementations

1. `Card.tsx:444` `v2Border` — gold `#c9a84c` **2.5px** (mine, `694565f`). In the bundle, never reached.
2. `Card.tsx:480` `highlightBorder` — gold `#c9a84c` 2.5px. Dead: `isV2 = true` is a const, so the
   minifier **folded the branch out of the deployed bundle entirely** — only two `borderWidth:2.5`
   sites survive, and neither is this one. That is proof, not inference.
3. `StaticCard.tsx:60` — gold `#c9a84c` 2.5px, else `borderWidth: 0`. Present in the bundle,
   reachable only through the dead `BoardResultCard`.
4. `BoardReveal.tsx:1308` `winGlow` — **not a border at all**: `shadowColor: '#FFD700'`,
   `shadowOpacity: 0.9`, `elevation: 8`. This is the only winner cue that actually renders, and it
   uses a *fourth* gold (`#FFD700`, not the settled `#c9a84c`).

### Why no gold on the board

`BoardArrangement.tsx:303` passes **`revealed={false}` — hardcoded**. `Board.tsx` gates every
highlight on it (`highlighted={revealed && …}` at :776, :817, :831, :862), so on the only surface
where the boards are visible, `highlighted` is false by construction. The reveal overlay does not
close the gap: it marks winners with its own wrapper glow and never passes `highlighted` down.

There is therefore **no reachable caller that sets `highlighted` true** except
`InteractiveTutorial.tsx:121` and the dead `BoardResultCard`. Five dead-path instances now, same
class as `isV2`, `isLandscape = false` and the `KILL_*` flags.

**Fix shape — named, not built.** Two candidates, and the choice is not obvious:
(a) **one line** — pass the real reveal state at `BoardArrangement.tsx:303` instead of `false`.
Cheapest, but it turns on a border on a surface that has never had one, and `winGlow` would then
fire alongside it: two winner cues in two different golds.
(b) **route the cue through one implementation** — decide whether the winner mark is a border
(`#c9a84c`, survives greyscale on luminance + width) or a glow (`#FFD700`, adds the elevation the
table surface was meant to supply), then delete the other three. Larger, and it needs the
consolidation brief.
Do not pick before the renderer map above is agreed.
- **D1** — *"לבדוק מה Felt/Vegas באמת עושים ואיפה הם נעצרים (למה לא מגיעים למסכי המשחק)."* →
  **NO LONGER A LIVE QUESTION.** It asked why the Felt/Vegas *pickers* never reached the game
  screens. Those pickers no longer exist — B1 folded them into one VISUAL STYLE axis, and the
  per-theme felt shipped 2026-07-25 (`main 1653310`). The investigation has no subject left.
  **Reclassified CLOSED-BY-OBSOLESCENCE**, not fixed.
- **E4** — *"אנימציות כניסה/היפוך/תגובה למגע לקלפים."* → **OPEN.**
- **Batch B thesis** — *"היום: 5 בוררי מראה = 1,080 שילובים, אף אחד לא תוכנן. זו הסיבה המרכזית
  לחוסר 'וואו'."* → **CLOSED.** The five pickers are one. The 1,080 combinations are gone.
  **Residual, filed as a new Batch B item:** `toggleBtn` (ON/OFF) and `selectorBtn` (radio) are
  still two visual paradigms on one screen — 9 and 11 uses. B8 *as filed* named iOS switches,
  which are gone; this is the spirit of the same complaint and is not yet addressed.

---

## SECOND-PASS CLOSURES — from the seven marked DO-NOT-SCHEDULE

| Item | Roye's text | Evidence |
|---|---|---|
| **E3** | *"סתירה רגשית — 'YOU LOSE' ענק בראש ומיד '✅ YOU WIN' בבורד 1."* | **CLOSED.** The per-board `✅ YOU WIN` banner lives in `components/BoardResultCard.tsx:263`, and that component was **proven dead** in S53-VERIFY-DETERMINISTIC (instrumented, `visibleBoardCount = 0`). The contradiction needs both strings on screen at once; the second never renders. |
| **E5** | *"'Tap to reveal' — הקריאה לפעולה המרכזית היא הטקסט הכי חלש במסך."* | **CLOSED BY OBSOLESCENCE.** The string exists nowhere in the codebase. The reveal auto-advances (BW sprint, `advanceMs` 14000 → 8000) with long-press to skip. The weak CTA was not restyled — it was removed with the interaction it belonged to. |
| **E6** | *"'DEAL ME IN' נראה כמו באנר פרסומת מודבק; ו-3 יציאות מוערמות (REMATCH/HOME/DEAL ME IN)."* | **CLOSED — and the first pass had this one wrong.** `results.tsx:1404-1419`: `rematchRow` holds **two** controls, REMATCH (⚡ REMATCH in MP) then HOME. `:192` records the banner: *"(Was: 20s → 5s → now gone entirely.)"* Three stacked exits are two, and play-again already leads. **Residual:** "Deal me in" survives at `:795` as practice re-entry copy — a different control on a different path. |
| **D3** | *"המשבצות הריקות (זיתי-בוצי) — הכי לא-אטרקטיביות ודווקא הן יעד הפעולה."* | **CLOSED.** `Board.tsx:205` — `EmptySlotAnimated` now draws from `theme.boardSlotDash` / themed background rather than the fixed olive. Per-theme felt shipped `1653310`. |

## NOT YET RECONCILED — 2 items

`XP bar orange = 7th colour in the system` · `three board labels in three unexplained colours`.
Both are colour-system judgements that need a live palette sample across screens, not a grep.

**Do not schedule these until they are checked.** That is the whole lesson of this file.
