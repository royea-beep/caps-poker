# VAMOS CAPS CAPS-GAME-SCREEN-8-FIXES
**Date:** 2026-04-27 IST | **Priority:** UX critical — 8 distinct issues from screenshot 4:45

## CONTEXT
v2.7.0 (DB:471 / EAS:328) live. Previous OTAs `4c0fa34f` + `f0a4af1f` deployed UX cleanup. Roye took fresh screenshot in 2P game (4 boards, 16 cards). 8 issues remain. All OTA-safe.

## RULES
- ❌ NEVER edit Card.tsx — locked
- ❌ NEVER touch native config (app.json/package.json/eas.json)
- ✅ Search before editing — show grep results, don't guess paths
- ✅ Show BEFORE line + AFTER line for EVERY fix in audit
- ✅ Push OTA to BOTH channels (production + testflight)

---

## TASK 1 — "בוט" missing the number (should be "בוט 1", "בוט 2", "בוט 3")

Previous translation replaced `BOT ${index + 1}` with just `'בוט'` — losing the number.

```bash
cd C:/Projects/POKER/Caps
grep -rn "'בוט'" --include="*.tsx" --include="*.ts" 2>/dev/null
grep -rn "BOT \${" --include="*.tsx" --include="*.ts" 2>/dev/null
grep -rn "botLabel\|BotLabel" --include="*.tsx" 2>/dev/null
```

Fix every occurrence of `'בוט'` back to `` `בוט ${index + 1}` `` or `` `בוט ${botNumber}` `` depending on the variable name in scope.

Likely files: `BoardReveal.tsx`, `BoardResultCard.tsx`, `RevealSequence.tsx`, `i18n.ts`, plus the live game header in `app/game.tsx`.

---

## TASK 2 — "B1, B2, B3, B4" tab labels still in English

```bash
grep -rn "\`B\${" --include="*.tsx" 2>/dev/null
grep -rn "'B1'\|'B2'\|'B3'\|'B4'" --include="*.tsx" 2>/dev/null
```

Replace `B${i+1}` → `` `לוח ${i+1}` `` in all matches. Likely in `app/game.tsx` board header rendering.

---

## TASK 3 — "קהילה" label clipped behind cards

```bash
grep -n "קהילה" app/game.tsx components/*.tsx 2>/dev/null
```

Label is half-hidden behind community cards. Find the label container — likely needs:
- Higher `zIndex` (try `zIndex: 10`)
- OR adjust `top` value to sit above cards
- OR add `paddingTop` to cards container

Show the BEFORE styles and AFTER styles in audit.

---

## TASK 4 — 16 cards in 2 rows of 8 are cramped

For 2P games the player has 16 cards. Currently shown as 2×8 — too small.

```bash
grep -n "totalCardsToPlace\|cardsInHand\|numColumns" app/game.tsx | head -20
```

Find the FlatList or grid that renders the player hand. Change layout:
- When `cardsInHand > 12` (i.e. 2P case) → use **4 rows of 4** (`numColumns={4}`)
- When `cardsInHand <= 12` → keep current layout

Cards stay readable, fills vertical space better.

---

## TASK 5 — "מיקום אוטומטי" appears 4 times (one per board)

Each board has its own auto-place button. Visually repetitive in 2P (4 boards = 4 buttons stacked).

```bash
grep -n "מיקום אוטומטי\|autoPlace" app/game.tsx components/*.tsx 2>/dev/null
```

**Report findings first.** Show me how the buttons are rendered and what each one does. DO NOT change yet — wait for Roye's decision between:
- A: Keep 4 buttons but make them smaller/more subtle
- B: Replace with 1 master button at top "מקם הכל אוטומטית"

If unclear which is intended behavior, default to **A** (4 small buttons, less prominent).

---

## TASK 6 — "CAPS POKER" logo bleeding through overlay

A watermark with the logo shows through the game screen. Looks unprofessional.

```bash
grep -rn "CAPS POKER\|capsLogo\|caps-watermark\|watermark" --include="*.tsx" 2>/dev/null
```

Either:
- Remove the watermark entirely from game screen (best — game screen is busy enough)
- OR increase its parent overlay opacity to fully hide it

---

## TASK 7 — "✓ מוכן" styling clarity

Top-right green badge "✓ מוכן" — is it a button or just status?

```bash
grep -rn "✓ מוכן\|botsReady\|allReady" --include="*.tsx" 2>/dev/null
```

**Report the JSX context first**. If it's a `Pressable`/`TouchableOpacity` (clickable), make it look obviously tappable (more prominent, button styling). If it's just `<View>` or `<Text>` (status indicator), it's fine — but maybe add a small label "סטטוס:" or move it next to the bot indicator.

Default action if unclear: leave as-is, just report what it is.

---

## TASK 8 — Duplicate instruction "סדר 16 קלפים" + "שים 16"

Top header says "סדר N קלפים" (Order N cards). Bottom button says "שים N" (Place N). Redundant.

```bash
grep -rn "שים \${\|סדר \${" --include="*.tsx" 2>/dev/null
grep -rn "סדר.*קלפים" --include="*.tsx" 2>/dev/null
```

Pick one approach:
- Keep top header as instruction. Change bottom button text to action verb only: **"אישור"** or **"סיים"**

This is the recommended fix — cleaner CTA.

---

## DELIVERY

```bash
npx tsc --noEmit 2>&1 | tail -5

git add -A
git commit -m "fix(ux): 8 game-screen polish fixes from screenshot audit

- Bot labels include number (בוט 1/2/3 not bare בוט)
- Board tabs in Hebrew (לוח 1/2/3/4 not B1/B2/B3/B4)
- קהילה label no longer clipped behind cards
- 4x4 grid for 16-card hands (better than 2x8)
- Watermark removed from game screen
- Place button text simplified (אישור)

Reported by Roye on v2.7.0 EAS 328 screenshot at 16:45"

git push origin main

# Push OTA to BOTH channels — testflight build needs explicit testflight branch push
eas update --branch production --message "Game screen 8 fixes"
eas update --branch testflight --message "Game screen 8 fixes"
```

Update DB after OTA succeeds:
```sql
INSERT INTO deploy_log (type, version, build_number, message, deployed_at)
VALUES ('ota', '2.7.0', '328', 'Game screen 8 fixes: bot labels with numbers, board tabs Hebrew, קהילה layout, 4x4 grid, watermark removed, simplified button', NOW());
```

---

## AUDIT FORMAT — MANDATORY

For EACH of the 8 tasks, provide:

```
TASK N — [name]
  BEFORE: [exact line that was wrong, with file:line reference]
  AFTER:  [exact line that's now correct]
  FILES:  [list of files changed]
  STATUS: ✅ done / ⚠️ partial (explain) / ❌ couldn't find (explain)
```

**Do NOT report "Done" without BEFORE/AFTER lines for every task.**
If any task can't be found in the code, mark ❌ and explain what you searched and what you found instead. Don't fake success.

Yes, allow all edits.

VAMOS CAPS CAPS-GAME-SCREEN-8-FIXES — END
