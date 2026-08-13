# PRE-TESTER PLAN — rewritten against the reconciled backlog, 2026-08-13

**Supersedes the 2026-08-13 first draft (`f8bfecf`).** That version had eight sprints. Two of
them did not exist: the work was already done. This version is built from
`docs/PRE-TESTER-BACKLOG.md` **after** every item was checked against the code that would
exhibit it, rather than against the comment claiming it was fixed.

**Outside this plan, unchanged:** the two-device eye-test (Roye's, ~3 min) and the
memory-test → certificate → iOS build → TestFlight chain (blocked on the machine).

---

## DELETED SPRINTS

**Sprint 1 — the settings cluster. DELETED, empty.** All nine of Roye's items (A2, A3, A4, A5,
A6, B4, B5, B7, B8) were already closed by earlier sprints. Verified from code: the minus button
renders `−` U+2212; zero live "Mute sounds" controls; both duplicates gone; the colorblind hint
reads `'Now: Blue = Win, Orange = Lose'`; one reset control whose dialog enumerates *"chips,
level, history and streak"*; "Dev preview" absent from the codebase; 10 `devUnlocked` gates;
DANGER ZONE at `#C62828`; **zero `<Switch>` components**.

**Sprint 2 — Batch B minimum. DELETED, empty.** This was the largest item on the whole list —
Roye's own diagnosis of why the product lacked "wow" — and it is done. `settings.tsx:1031`:
Background, Home, Button-style and Card-design pickers **folded into one VISUAL STYLE axis**
(`:692`) via `VISUAL_THEME_AXES`. Button Style was dead; Card Design was removed. The 1,080
combinations no longer exist.

**Sprint 4 — the table. DELETED as scoped.** D1 asked *"why do Felt/Vegas never reach the game
screens?"* — the pickers it asked about are gone (folded by B1) and the per-theme felt shipped
2026-07-25 (`main 1653310`). The investigation has no subject. **Closed by obsolescence, not
fixed.** D3 moves to sprint B below, pending reconciliation.

---

## THE SEQUENCE, AS IT ACTUALLY STANDS

### A — CARDS · *Roye, his stated #1* · small, one file
**C4** — *"מסגרת לא מבדילה — קלף חשוף וגב-C שניהם במסגרת זהב."* The code agrees it is broken:
`components/Card.tsx:84` carries the comment *"CB2 / C4 — THE GOLD COLLISION, BROKEN"*, and
`CARD_BACK_BORDER = '#C5A028'` is still gold at `:77`.
**C5** — *"מונוטוניות 5 גבים זהים ברצף."* One back pair, no per-card variation.
**Batched because** both are `CARD_BACK_*` in one file, and C4's fix (differentiate the back's
frame from an exposed card's) is the natural place to introduce C5's variation.
**C1 and C3 are already closed** — upgraded face shipped `aa94363`; the always-cyan ownership rim
is live at `Card.tsx:25,58`. **C2 was not reconciled** — check before scheduling.

### B — RECONCILE THE REMAINING SEVEN · *bot* · half a day · **do this before sprint C**
`D3` · `E3` (may be closed by `685c83b`) · `E5` (the string "Tap to reveal" is now absent — the
item may be moot or may have moved) · `C2` · the three not-a-batch items · the `card_placed`
fourth path (three track sites now exist at `game.tsx:851/955/1004` plus `arrangement_timeout`
at `:458`; whether the timeout path emits `card_placed` is unestablished).
**Why its own slot:** this is the same work that just deleted three sprints. Seven unknowns is
enough to invent or destroy another sprint, and finding out costs hours rather than days.

### C — JUICE · *Roye, his #3–4* · medium
**E2** loss moment · **E4** card enter/flip/touch animation · **E6** "DEAL ME IN" banner and
three stacked exits. E4 is the largest and needs `assertAnimatable()` discipline throughout.
E3 and E5 join this sprint only if sprint B finds them open.

### D — THE DESTRUCTIVE SUBSET OF THE 68 FUNCTIONS · *bot* · medium · **before testers**
Unaudited SECURITY DEFINER functions that *delete, merge, transfer or grant* on a client-supplied
identity. 13 of 81 audited so far yielded three real holes; a ~23% rate is too high to wave
through, but an invited round's threat model is accident rather than attack. Estimated 10–15 of
the 68; **exact count unknown until enumerated**. The read/query remainder waits until after.

### E — BLIND SPOT #5 · *bot* · medium
Returning player, mid-hand backgrounding, connection loss, and the reveal completion timing that
has never been measured end to end.

### F — THE TWO SMALL MEASURED ITEMS · *bot* · small
8px card pips and the 9px `LEAD` label, both measured live on both engines. Explicitly outside
the closed TYPE WORK scope, since pips are graphics sized by the card rather than type — so this
is a judgement call, not a defect. **A7** (18+ rating) is an App Store Connect setting with no
code; it blocks submission, not testers, and needs Roye's timing decision.

---

## WHAT CHANGED, IN ONE LINE

Eight sprints became six, two of which are reconciliation and audit rather than product work.
The genuinely open product surface is **seven items**, and four of them are card and juice
polish. **Roye's largest structural complaint — the 1,080-combination thesis — is already
closed.**

## OPEN QUESTIONS — Roye only

1. Cards: C4 and C5 are the only card items left — still your #1, or does juice move up?
2. A7 (18+ rating): now, or at submission?
3. The `toggleBtn` vs `selectorBtn` split is the residual of B8 — worth a pass, or leave it?
4. Home: the ambient rings shipped. Do you also want the F2P proposal — a first-session home
   showing PLAY and nothing else, expanding after hand one?
