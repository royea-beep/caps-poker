# VAMOS CAPS RESUME-AND-FINISH
**Date:** 2026-03-21 07:03 IST
**Priority:** Close it out

## CONTEXT
Computer crashed mid-sprint. Recovery report confirms:
- 5 files with uncommitted changes — ALL survived
- 0 TS errors, 126/126 tests pass
- 2 micro-fixes still needed

## STEP 1 — Commit the surviving work FIRST
```
cd C:\Projects\Caps
git add -A
git commit -m "feat: P0 card readability + hand size + hints + complete 3s"
```

## STEP 2 — MICRO-FIX A: "HISTORY" → "HAND HISTORY"

File: `app/index.tsx`

Find the link that says "HISTORY" and change it to "HAND HISTORY".
If 4 links don't fit in one row, add `adjustsFontSizeToFit minimumFontScale={0.6}` to all link texts.

## STEP 3 — MICRO-FIX B: Haptic on COMPLETE Gold Pulse

File: `app/results.tsx`

Find where the gold pulse animation triggers (the withRepeat/withSequence block for goldPulse, around the COMPLETE detection area).

Add these 3 lines right next to it:
```typescript
setTimeout(() => Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium), 0);
setTimeout(() => Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium), 400);
setTimeout(() => Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium), 800);
```

If Haptics is not imported in results.tsx, add the same lazy-load pattern used in CompleteOverlay.tsx:
```typescript
let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch {}
```

## STEP 4 — Verify + Deploy
```
npx tsc --noEmit — 0 errors
npx jest --forceExit — 126+ pass
npx expo export --platform web --output-dir web-dist
node scripts/fix-web-html.js
cd web-dist && vercel --prod --yes
git add -A && git commit -m "fix: HAND HISTORY label + COMPLETE haptic pulses — P0 complete 7/7"
git push origin main
Update MEMORY.md: P0 fully done, all 7/7 verified
```

## SUCCESS CRITERIA
- ✅ "HAND HISTORY" shows on home screen (not "HISTORY")
- ✅ 3 haptic pulses fire during COMPLETE gold board animation
- ✅ All 126+ tests pass, 0 TS errors
- ✅ Web live, git pushed, MEMORY.md updated

VAMOS CAPS RESUME-AND-FINISH — END
