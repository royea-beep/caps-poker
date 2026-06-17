# VAMOS CAPS CAPS-UX-THINKER-AUDIT
**Date:** 2026-04-27 IST | **Lens:** UI/UX Systems Thinker

## YOUR ROLE
You are a Senior Product Designer who optimizes for user behavior, not screen aesthetics. Design a complete experience audit for CAPS Poker — a multi-board poker game in TestFlight beta (v2.7.0 EAS 328, Hebrew, iOS).

## RULES
- Design friction intentionally — some friction should stay, some must go
- Assume real users, incomplete data, errors, skill variance
- No wireframes without behavioral rationale
- Output reads like a behavioral design brief, NOT a UX checklist

## CONTEXT — what Roye reported today (signal, not noise)
- Cards animation felt "unstable" → translateY drop replaced with fade-in
- "62 players" felt fake → hidden in beta
- Daily reward modal popped immediately on launch → delayed to post-game-1
- Hebrew strings missing → 18 fixed
- Watermark bleeding through → removed
- "B1/B2/B3/B4" labels in English → translated
- 16 cards in 2x8 row felt cramped → changed to 4x4

**The pattern:** Roye keeps reporting things that look correct in code but feel wrong on phone. The bot fixes the literal request and misses the behavioral intent. We need a deeper lens.

---

## DELIVER IN THIS ORDER

### 1. Intent mapping — primary/conflicting user intents

For each main screen (Home, Game, Results, Settings), identify:
- **Primary intent:** what the user came here to do
- **Conflicting intent:** what the screen is also trying to do (monetize, retain, educate)
- **Where friction stays:** the deliberate slowdowns (confirm before deleting account)
- **Where friction must go:** unintentional friction killing the primary intent

Specifically search the codebase to find evidence:
```bash
cd C:/Projects/POKER/Caps
ls app/(tabs)/
ls app/
grep -l "modal\|Modal" app/ components/ -r --include="*.tsx" 2>/dev/null | head -20
```

For each modal found, ask: does it interrupt primary intent or support it?

---

### 2. Behavioral design — how hierarchy, disclosure, motion guide decisions

Look at game.tsx specifically. Map the visual hierarchy:
- What does the eye land on FIRST (biggest, brightest, motion)?
- What does the user need to do FIRST (place 16 cards correctly)?
- Are these the same thing?

If watermark, ambient sound, daily reward, AI quote, bot status, board labels, hand cards, and place button all compete for attention — that's hierarchy collapse. Identify which 2-3 elements MUST win the eye, demote the rest.

```bash
grep -n "fontSize\|fontWeight" app/game.tsx | head -30
grep -n "zIndex\|elevation" app/game.tsx components/Board.tsx components/PlayerHand.tsx 2>/dev/null
```

Report findings as a hierarchy table: element → current weight → should be → why.

---

### 3. Interface systems — navigation, form, feedback

For navigation:
- 5 tabs (בית/שחק/חברים/כוסות/פרופיל). When does a beta tester actually need each?
- "חברים" and "כוסות" — meaningful with 0 friends and 0 cup wins? Or empty-state graveyard?

For feedback:
- After placing 16 cards → user taps אישור → what happens? Loading? Animation? Result screen?
- After winning a board → does the user understand WHY they won?
- After losing → "So close!" → does it teach or does it just console?

Audit the result/reveal flow:
```bash
ls components/BoardReveal* components/RevealSequence* components/BoardResultCard* 2>/dev/null
grep -n "result\|reveal\|win\|lose" components/BoardReveal.tsx 2>/dev/null | head -10
```

---

### 4. Edge cases — empty states, incomplete data, error recovery

Find every empty state in the app:
```bash
grep -rn "isEmpty\|length === 0\|NoData\|empty" --include="*.tsx" app/ components/ 2>/dev/null | head -20
```

For each — what does the user see? Is there a CTA? Or a dead end?

Specific cases to verify:
- New user opens "חברים" tab with no friends — what shows?
- New user opens "כוסות" tab with no wins — what shows?
- Hand history with no hands played — what shows?
- Network failure during game — does the user understand what happened?

---

### 5. Skill-level adaptation — new user vs power user

Beta has both: Roye (knows the game cold) and naive testers (have never seen multi-board poker).

For each, what should the FIRST 3 minutes feel like?
- Naive user: "I don't know how to play. Teach me without lecturing."
- Power user: "I know poker. Skip the tutorials. Let me play fast."

Where in the code is skill detected or assumed?
```bash
grep -rn "tutorial\|onboarding\|firstTime\|hasPlayed" --include="*.tsx" app/ components/ utils/ 2>/dev/null | head -15
```

If everything assumes a new user — power users (Roye) feel patronized. If everything assumes a veteran — new users bounce. Find the mismatch.

---

### 6. Anti-patterns — 3-5 UX decisions that look correct but damage decision quality

These are decisions that pass code review but fail user behavior. Examples to look for:
- **Fake social proof** — the "62 שחקנים" we already removed. Are there more? (fake leaderboard ranks, fake friend counts, fake activity feeds)
- **Loss-aversion exploitation** — daily streak that punishes missing a day
- **Forced engagement** — modals that block the primary intent (we caught daily reward)
- **Vanity metrics** — XP and chips the user can't actually do anything with
- **Settings that don't settle** — toggles that don't persist or don't take effect

```bash
grep -rn "streak\|loseStreak\|missedDay" --include="*.tsx" --include="*.ts" 2>/dev/null | head -10
grep -rn "leaderboard" --include="*.tsx" --include="*.ts" 2>/dev/null | head -10
```

---

## OUTPUT FORMAT

Write a behavioral design brief, NOT a checklist. Structure:

```
## CAPS UX BEHAVIORAL AUDIT — v2.7.0 EAS 328

### Section 1 — Intent map
[paragraph form, not bullets, explaining what each screen tries to do
 vs what user came for vs where they collide]

### Section 2 — Hierarchy collapse on game screen
[evidence-based finding: which elements compete, which should win,
 what changes will redirect attention to the primary task]

### Section 3 — Feedback gaps
[specific moments where the system doesn't tell the user what happened
 or why — with file:line references where the gap lives]

### Section 4 — Empty state graveyard
[which tabs/screens are dead ends for new users, what each should do instead]

### Section 5 — Skill-level mismatch
[where the app assumes naive vs veteran, and where that assumption fails]

### Section 6 — Three anti-patterns to kill before launch
[3 specific decisions in current code that look fine but will damage user trust,
 with the behavioral mechanism that makes each one harmful]

### Section 7 — Top 5 fixes prioritized
[ordered list. Each: WHAT change, WHERE in code, WHY it matters behaviorally,
 EFFORT (S/M/L), IMPACT on retention or trust]
```

DO NOT push code yet. This is research output. After Roye reads it, he'll pick which fixes to ship.

---

## DELIVERABLE

A single markdown file at `docs/ux-audit-2026-04-27.md` with the brief above.

Also create a summary commit-ready VAMOS at `docs/VAMOS-NEXT.md` with the top 5 fixes pre-formatted, ready for Roye to send to bot when he wants to ship them.

```bash
git add docs/ux-audit-2026-04-27.md docs/VAMOS-NEXT.md
git commit -m "docs: UX behavioral audit + next-steps VAMOS draft"
git push origin main
```

No OTA needed — this is documentation only.

---

## REPORT BACK

```
ux-audit file created:        ✅/❌
VAMOS-NEXT file created:      ✅/❌
Sections all present:         1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣
Top 5 fixes identified:       [list them in 1 line each]
Commit SHA:                   [hash]
```

Yes, allow all edits. Output reads like behavioral design brief, NOT a UX checklist.

VAMOS CAPS CAPS-UX-THINKER-AUDIT — END
