# VAMOS CAPS CAPS-3-REGRESSIONS
**Date:** 2026-04-28 IST | **Priority:** 3 regressions found in screenshot 11:04

## CONTEXT
After yesterday's "8-fixes" VAMOS, screenshot 11:04 reveals 3 things broke:
- Board labels (B1/B2/B3/B4 → לוח X) **disappeared entirely** — labels missing from all 4 boards
- "קהילה" label **still clipped** on bottom 2 boards despite zIndex fix
- "מיקום אוטומטי" buttons **invisible** — over-shrunk in TASK 5

Audit and fix all 3.

## RULES
- ❌ NEVER edit Card.tsx
- ✅ Show grep BEFORE/AFTER for every change
- ✅ Run `npm run web` and visually check before push
- ✅ Push OTA to BOTH channels (production + testflight)

---

## TASK 1 — Board labels missing (B1/B2/B3/B4 → לוח 1/2/3/4)

```bash
cd C:/Projects/POKER/Caps

# Find what happened to the label rendering
grep -n "לוח \|לוח\${\|<Text" components/Board.tsx | head -20

# The previous fix was at Board.tsx:318 — verify it's still there
sed -n '315,325p' components/Board.tsx
```

**Likely issue:** The replacement was `>{`לוח ${index + 1}`}</Text>` but the parent `<Text>` styling got broken, OR the conditional that renders the label requires `multiBot` flag that's now false, OR the label wrapper got hidden.

**Steps to fix:**
1. Show me the current line at Board.tsx:318 (or wherever the label is)
2. Show me the parent component that wraps it — is it conditionally rendered?
3. If conditional: identify the condition and check why it's false now
4. If text is rendered but invisible: check the style (color matching background? font size 0?)

The label MUST appear above each board, visible, in Hebrew.

---

## TASK 2 — "קהילה" still clipped on bottom boards

zIndex was added but it's not enough. The label is being overlapped by the cards on adjacent boards.

```bash
grep -n "קהילה\|community" components/Board.tsx | head -10
grep -B2 -A8 "communityLabelWrap" components/Board.tsx
```

**Look at the layout:**
- Each board has community cards + community label
- The label is positioned where? Top? Inside? Above?
- When boards are stacked vertically, the label of board N+1 might be visually on top of cards from board N

**Recommended fix:**
- Move the label INSIDE the board frame, anchored to top of the maroon card area, not floating above
- OR: increase the gap between boards by ~12px so labels don't overlap with previous board's cards
- OR: put label INLINE with cards (left side or right side) instead of above

Pick the cleanest. Show before/after styles.

---

## TASK 3 — "מיקום אוטומטי" invisible

Yesterday's fix made buttons height:22, padding:6, opacity:0.75. Too aggressive — they're now invisible.

```bash
grep -B2 -A8 "autoBtn\b\|autoBtnText\b" components/Board.tsx
```

**Restore visibility but keep less prominent than v1:**
- height: 28 → 26 (was 22 — too small)
- paddingHorizontal: rs(8) (was 6 — too cramped)
- borderColor: '#C5A028' (was 0.5 alpha — too faint)
- opacity: 1.0 (was 0.75 — invisible at 0.75 with low contrast)
- backgroundColor: 'rgba(28,5,8,0.4)' (semi-transparent dark instead of full transparent)

Tradeoff: button is visible and clearly clickable, but doesn't dominate. Show before/after.

---

## DELIVERY

```bash
# Visual check first
npm run web &
WEB_PID=$!
sleep 30  # let web load
# Manually check at http://localhost:8081 or test with Playwright

# If everything looks right:
kill $WEB_PID

git add components/Board.tsx
git commit -m "fix(ux): 3 regressions from yesterday's 8-fixes

- Board labels (לוח X) restored — wrapper was conditionally hidden
- קהילה label moved inside board frame to prevent clipping
- מיקום אוטומטי buttons restored visibility (height 26, opacity 1.0)

Reported by Roye on screenshot 11:04 after yesterday's VAMOS"

git push origin main

eas update --branch production --message "Fix 3 regressions: board labels, קהילה, auto-place buttons"
eas update --branch testflight --message "Fix 3 regressions: board labels, קהילה, auto-place buttons"
```

Update DB:
```sql
INSERT INTO deploy_log (type, version, build_number, message, deployed_at)
VALUES ('ota', '2.7.0', '328', 'Fix 3 regressions from 11:04 audit: board labels restored, קהילה moved inside frame, auto-place buttons visible. Commit [SHA].', NOW());
```

---

## REPORT BACK

```
TASK 1 — Board labels
  BEFORE: [exact line + style]
  AFTER:  [exact line + style]
  ROOT CAUSE: [what made them disappear]
  STATUS: ✅/⚠️/❌

TASK 2 — קהילה clipping
  BEFORE: [position/zIndex/parent]
  AFTER:  [position/zIndex/parent]
  STATUS: ✅/⚠️/❌

TASK 3 — מיקום אוטומטי
  BEFORE: [styles]
  AFTER:  [styles]
  STATUS: ✅/⚠️/❌

Commit SHA: [hash]
production: [hash]
testflight: [hash]
```

Yes, allow all edits.

VAMOS CAPS CAPS-3-REGRESSIONS — END
