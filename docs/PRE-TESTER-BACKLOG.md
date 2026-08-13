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
| Items reconciled this pass | **28** |
| **OPEN** | **7** |
| **CLOSED** | **17** |
| **UNVERIFIABLE** | **4** |
| Not yet reconciled (see the end) | 7 |

---

## OPEN — the genuinely remaining work

| Item | Roye's text / description | Evidence it is still live |
|---|---|---|
| **C4** | *"מסגרת לא מבדילה — קלף חשוף וגב-C שניהם במסגרת זהב. אותו סימון לשני מצבים הפוכים."* | `components/Card.tsx:84` — the code itself says so: *"CB2 / C4 — THE GOLD COLLISION, BROKEN."* `CARD_BACK_BORDER = '#C5A028'` (L77) is still gold. |
| **C5** | *"מונוטוניות 5 גבים זהים ברצף."* | One `CARD_BACK_BG`/`CARD_BACK_BORDER` pair; no per-card variation exists. |
| **E6** | *"'DEAL ME IN' נראה כמו באנר פרסומת מודבק; ו-3 יציאות מוערמות (REMATCH/HOME/DEAL ME IN)."* | String present 3× across `app/`. |
| **E2** | *"רגע ההפסד — 'YOU LOSE' אדום סטטי; צריך להיות רך ומעודד כדי שישחק שוב."* | `YOU LOSE` present 4× and still static. |
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

- **C5** — *"מונוטוניות 5 גבים זהים ברצף."* → **OPEN.**
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

## NOT YET RECONCILED — 7 items, stated rather than guessed

`D3` (empty slots) · `E3` (YOU LOSE / ✅ YOU WIN contradiction — may be closed by `685c83b`) ·
`E5` ("Tap to reveal" — the string is now absent, so the item may be moot or may have moved) ·
the three not-a-batch items (hand-as-text, orange XP bar, three board-label colours) ·
`card_placed` 4th path (3 track sites now exist at `game.tsx:851/955/1004` plus
`arrangement_timeout` at `:458` — whether the timeout path now emits `card_placed` was not
established).

**Do not schedule these until they are checked.** That is the whole lesson of this file.
