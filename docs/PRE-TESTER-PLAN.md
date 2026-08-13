# PRE-TESTER PLAN — ordered sequence, 2026-08-13

**This is a sequence, not a triage.** Roye's instruction is *"חובה לתקן הכל לפני טסטרים"* — everything
gets built. The only question here is order.

**Outside this plan, deliberately:** the two-device eye-test (Roye's, ~3 min) and the
memory-test → certificate → iOS build → TestFlight chain (blocked on the machine). Both are known
and neither is the panel's business.

---

## 1. THE LIST, AS IT ACTUALLY IS

### 1a. Stale entries — closed but still listed as open

Planning against these would have distorted every position below.

| Entry | Real state |
|---|---|
| **MP hole cards on an unauthenticated channel** (BLOCKS TESTERS) | **CLOSED 2026-08-13.** Migration live on prod, client `3b07f74`/`ee1f2a7`, 5/5 proven on a branch, denials re-proven on prod. Only card *delivery* on prod is unwitnessed — that is the two-device test. |
| **"41 of 43 real iOS devices emit nothing"** (BLOCKS TESTERS) | **RESOLVED — it was never real.** `device_model = "Simulator iOS"` on all of them; 66 simulator sessions/0 played vs **4 real iPhones/4 played**. The metric measured our own CI boots. |
| **Five-highest #1 — "invert the type hierarchy"** | **CLOSED 2026-08-07** (TYPE WORK block in `SCREEN-PANEL-REVIEW.md`). |
| **Five-highest #2 — "the reveal does not move"** | **Substantially addressed** by the BW→CB series: staged reveal, per-seat equity bars, outs-as-cards, board surface, landing animation, E1 confetti (verified 20 dots / 31 distinct transforms). Needs re-measuring, not re-planning. |
| **B-5 — "largest text on home is decoration"** | **Superseded / unproven.** The `/game` twin turned out to be a card *pip* inside a 54×70 card. The home 32px glyphs were never re-verified against their ancestors. Do not action until measured. |
| **E1 — confetti too subtle** | **Shipped and verified.** |
| **A4 — duplicate Pro Quotes / Privacy Policy** | **Half closed** — `ff9d591` removed the duplicate Pro Quotes control. Privacy Policy duplicate unverified. |
| **Three sub-44 back controls** (`/replay`, `/spectate`, `/chip-store`) | **Closed 2026-08-13**, measured 44px on both engines. |
| A1, C1, B2, D2, practice chip gating, desktop card blowout | Already marked done in the backlog; listed here so nobody re-opens them. |

### 1b. Open — **Roye's items** (his outrank ours; this is the ordering's backbone)

**Batch A** · A2 mojibake `â` on the Max-board-card minus button · A3 contradictory sound controls
(unverified) · A5 wrong colorblind label · A6 two reset buttons (**data-loss risk**) · A7 18+ rating
(App Store Connect setting, not code)

**Batch B** · B1 unify 5 look-pickers · B3 Background Theme dead or partial · B4 "Dev preview" leaked
to users · B5 DEVELOPER section expanded while ADVANCED is folded · B6 brand-hostile Home Theme
colours · B7 "DANGER ZONE" in mint above a red button · B8 two toggle paradigms on one screen

**Batch C (his #1)** · C2 card-back hierarchy inverted · C3 no visual ownership · C4 frame does not
differentiate · **C5 verbatim: *"מונוטוניות 5 גבים זהים ברצף."***

**Batch D (his #2)** · **D1 verbatim: *"לבדוק מה Felt/Vegas באמת עושים ואיפה הם נעצרים (למה לא מגיעים
למסכי המשחק)."*** · D3 empty slots olive-mud

**Batch E (his #3–4)** · E2 loss moment · E3 emotional contradiction · **E4 verbatim: *"אנימציות
כניסה/היפוך/תגובה למגע לקלפים."*** · E5 "Tap to reveal" is the weakest text on screen · E6 "DEAL ME
IN" reads as a pasted ad banner + 3 stacked exits

**Filed as not-a-batch** · "Best possible hand" shown as text not cards · XP bar orange = 7th colour ·
3 board labels in 3 unexplained colours

**Batch B thesis, verbatim:** *"היום: 5 בוררי מראה = 1,080 שילובים, אף אחד לא תוכנן. זו הסיבה
המרכזית לחוסר 'וואו'."* — **present in the file and quoted here in full.** All four previously
unrecovered items (C5, D1, E4, Batch B) **are in `PRE-TESTER-BACKLOG.md`**; nothing is missing.

### 1c. Open — **bot-proposed**

`card_placed` 4th path uninstrumented (`game.tsx:446`) · 68 unaudited SECURITY DEFINER functions ·
8px suit pips + 9px `LEAD` label · Auto-Place control 161×33 (<44) · ~7.5s to interactive on home ·
`/replay` deep-link shows bare "Hand not found" · `/spectate` shows "No room code provided" ·
blind-spot-#5 states never tested (returning player, mid-hand backgrounding, offline) · reveal
completion timing never measured · convert `is_room_member` prerequisites doc → n/a

---

## 2. THE ORDERED SEQUENCE

### 1 — THE SETTINGS CLUSTER · *Roye* · cheap · **do this first**
**Items:** A2, A3, A5, A6, B4, B5, B7, B8 — and the unverified half of A4.
**Why first:** nine of Roye's own filed items live in **one file**, `app/settings.tsx`. One
measurement setup, one review, one deploy. This is the `ScreenHeader` lesson — one line closed two
blockers and five unflagged screens — applied to the largest single concentration of his requests in
the backlog. It also contains **A6, a data-loss risk**: two reset buttons with no stated difference.
Nothing else on the list can hurt a tester's account.
**Delivers:** settings stops looking like a dev build, and the one destructive-mistake path is closed.

### 2 — BATCH B, MINIMUM VERSION · *Roye* · medium · **his own diagnosis of why there's no "wow"**
**Items:** B1 (minimum), B3, B6, plus the home-screen control count.
**Minimum version — this is the whole point of putting it here rather than deferring it:** do **not**
attempt the full five-picker unification. Instead: **pick one default and fold the other four
selectors behind ADVANCED.** That is the panel's own #5 — *"make ONE default spectacular rather than
adding a sixth selector"* — and it collapses 1,080 combinations to 1 curated look without a redesign.
B3 (dead Background Theme) is verify-then-fix-or-remove. B6 retires the brand-hostile palettes.
**Why here and not later:** it is the largest item on the list and therefore the one most likely to be
deferred forever. The minimum version is a fold and a default, not a rebuild — it is affordable
*now* and stops being affordable once the full unification is attempted.

### 3 — CARDS · *Roye, his stated #1* · medium
**Items:** C2, C3, C4, C5.
All four are card-face/card-back work in `components/Card.tsx` — one file, one visual review. C1 is
already shipped, so this closes the category he ranked first.

### 4 — TABLE · *Roye, his #2* · unknown until D1 is investigated
**Items:** D1, D3.
**D1 is an investigation, not a fix** — "find out what Felt/Vegas actually do and where they stop".
Its cost cannot be honestly estimated until that answer exists. **D1 must be scheduled before D3**,
because D3 (the olive-mud empty slots) may be a symptom of the same theme plumbing.

### 5 — JUICE · *Roye, his #3–4* · medium
**Items:** E2, E3, E5, E6, E4.
E4 (card enter/flip/touch animation) is the largest and the only one needing `assertAnimatable()`
discipline throughout. E3 may already be closed by `685c83b` — **verify before building.**

### 6 — THE TELEMETRY GAP · *bot* · small · **argue for moving this earlier**
`card_placed`'s fourth path (`game.tsx:446`, countdown-expiry fill) emits `arrangement_timeout` but no
`card_placed`. **Panel note:** this is the instrument we read the tester round with. Shipping the
round with a blind spot in placement telemetry means we cannot see how testers actually play. It is
half a day. Several panellists wanted it at position 1; it sits here only because it changes nothing
a tester sees.

### 7 — THE DESTRUCTIVE SUBSET OF THE 68 FUNCTIONS · *bot* · medium · **before testers**
Not all 68 — see §4.

### 8 — BLIND SPOT #5 + REVEAL TIMING · *bot* · medium
Returning player, mid-hand backgrounding, connection loss; and the reveal completion timing that has
never been measured end to end.

---

## 3. CHEAPER TOGETHER

| Group | Items | Shared cost |
|---|---|---|
| **Settings** | A2, A3, A4b, A5, A6, B4, B5, B7, B8 | one file, one review, one deploy — **9 items** |
| **Theme plumbing** | B1, B3, B6, D1, D3 | same picker/theme system; D1's answer determines B3 and D3 |
| **Card surface** | C2, C3, C4, C5 | all `components/Card.tsx` |
| **Results/reveal copy + motion** | E2, E3, E5, E6 | same two screens, one capture setup |
| **Type leftovers** | 8px pips, 9px `LEAD` | one sweep, same tooling as the closed TYPE WORK |

## 4. THE 68 UNAUDITED FUNCTIONS — **split verdict, not "after"**

13 of 81 have been reviewed and yielded **three real holes** (club-table bypass, revoked-account
deletion path, economy variants). A ~23% hit rate is too high to wave through.

But the threat model for an invited round is **accidental damage, not attack**. So:

- **BEFORE testers — the destructive subset only.** Every unaudited definer function that can
  *delete, merge, transfer or grant* on a client-supplied identity. An accident there is
  unrecoverable and it is the same shape as the two holes already found. Estimated 10–15 of the 68;
  the exact count is **unknown until they are enumerated**.
- **AFTER testers — the read/query remainder.** Invited people will not fuzz an RPC surface.

## 5. THE HOME SCREEN — the premise was wrong

**Home has been reviewed** — `SCREEN-PANEL-REVIEW.md` SCREEN 4, with capture evidence at 393 and
1706, a BROKEN section and a full panel. What is unreviewed is *"THE OTHER 48 SURFACES"*.

Its one live item is **15 controls before the player has done anything**, which is the same thesis as
settings' 29. It therefore belongs **inside sprint 2**, not as its own item. The B-5 decoration claim
must be **measured against its ancestor chain before anyone acts on it** — the `/game` twin died
exactly that way.

## 6. NOT VERIFIABLE WITH CURRENT TOOLING

| Item | Why |
|---|---|
| **A3 — sound controls** | No audio measurement. Verifiable only as *state* (which toggle writes which key), never as *sound*. |
| **`Board.handName` size** | Gated on `revealed &&`, hardcoded false in solo → MP-only. Two devices. Already edited twice before anyone checked. |
| **Reveal completion timing** | Never reached in a probe; the `ready-button` anchor has not been driven successfully end to end. |
| **Anything native-rendered** | No iOS build possible until the machine chain clears. |
| **E4 / any motion claim** | Verifiable, but *only* with `assertAnimatable()` and sampled transforms. Without it, five misattributions is the track record. |

## 7. DISAGREEMENT — recorded, not resolved

**The sharpest, on the home screen, three ways:**

- **Motion designer** wants an 8s / 3px ambient drift on the background suits — *"would make it feel
  alive at effectively zero cost"* · `ADDS`
- **Simplicity advocate** says visual ambition on home has **lower return than the reveal**, because
  players pass *through* home and stop at the reveal — and that home's 15 controls plus settings' 29
  is where the 1,080 problem actually lives · `REMOVES`
- **F2P designer** wants a first-session home showing **Play and nothing else**, expanding after hand
  one · `REMOVES`

They are not reconcilable: two panellists want the screen stripped, one wants motion added to it.
**Roye decides.**

Secondary, from the review: the panel's #3 — *"during the reveal the only interactive control is
Leave game"* — proposes deprioritising the exit at the emotional peak. That collides with the
one-way-out-of-every-screen work shipped on 2026-08-13. **Do not remove an exit; demote it visually.**

## 8. OPEN QUESTIONS — Roye only, one line each

1. Home screen: ambient motion, or strip it to Play-only for the first session? (Panel is split 2–1 toward stripping.)
2. Batch B minimum — is "one curated default + everything else behind ADVANCED" acceptable, or do you want the full five-picker unification?
3. Which single look becomes that default?
4. Cards are done (C1) — does Batch C (C2–C5) still hold your #1 slot, or does Batch B now outrank it?
5. A7 (18+ rating) is an App Store Connect setting we cannot change from code — do you want it done now or at submission?
6. Should the `card_placed` telemetry gap move to position 1, so we can see how testers actually play?
7. Two reset buttons (A6) — what is the intended difference, or should one be removed?
