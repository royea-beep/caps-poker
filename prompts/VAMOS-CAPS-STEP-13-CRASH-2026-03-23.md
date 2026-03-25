# VAMOS CAPS STEP-13-CRASH
**Date:** 2026-03-23 13:30 IST
**Priority:** 🔴 Crash located: AFTER step 13 (AsyncStorage update + game active flag)

## EVIDENCE FROM DEBUG OVERLAY (Image 3):
```
12 CapsHooks.gameCompleted
13 AsyncStorage update
🎮 setting game active flag (dirty shutdown detector)
💥 CRASH — somewhere after here
```

## WHAT RUNS AFTER STEP 13?

This is either:
1. `router.replace('/results')` — navigation
2. results.tsx mount — the new FadeInDown animations we just added
3. Something in CapsHooks.gameCompleted that triggers async

## FIND AND FIX

```
cd C:\Projects\Caps

echo "═══════════════════════════════════════"
echo "1. What code runs AFTER step 13?"
echo "═══════════════════════════════════════"
grep -n "CapsHooks\|gameCompleted\|AsyncStorage.*update\|game.*active\|router.*replace\|step.*13\|step.*14" app/game.tsx | head -20

echo ""
echo "═══════════════════════════════════════"
echo "2. The doNavigate function — FULL code after step 13"
echo "═══════════════════════════════════════"
grep -A 30 "13 AsyncStorage\|step.*13\|gameCompleted" app/game.tsx | head -40

echo ""
echo "═══════════════════════════════════════"
echo "3. What is CapsHooks.gameCompleted?"
echo "═══════════════════════════════════════"
grep -rn "CapsHooks\|gameCompleted" app/ utils/ hooks/ | grep -v node_modules | head -10
cat utils/capsHooks.ts 2>/dev/null || grep -rn "gameCompleted" utils/ | head -5

echo ""
echo "═══════════════════════════════════════"
echo "4. Results.tsx — what runs on MOUNT?"
echo "═══════════════════════════════════════"
grep -n "useEffect\|useMemo\|entering=\|FadeIn\|Animated\." app/results.tsx | head -20

echo ""
echo "═══════════════════════════════════════"
echo "5. The FadeInDown animations we added — are they crashing?"
echo "═══════════════════════════════════════"
grep -n "FadeInDown\|FadeIn\|entering=" app/results.tsx | head -10

echo ""
echo "═══════════════════════════════════════"
echo "6. How many Animated.View with entering= on results?"
echo "═══════════════════════════════════════"
grep -c "entering=" app/results.tsx
```

## MOST LIKELY CAUSE:
The FadeInDown layout animations on results.tsx.
Each `entering={FadeInDown.delay(i * 150)}` creates Reanimated worklets on mount.
If there are 4 boards × multiple elements = too many layout animations.

## FIX — Add step 14, 15 logging + try removing FadeInDown:

```typescript
// After step 13:
debugLog('14 router.replace /results START');
try {
  router.replace('/results');
  debugLog('15 router.replace DONE');
} catch (e) {
  debugLog(`14E router.replace CRASHED: ${e}`, 'error');
}
```

In results.tsx — LOG on mount:
```typescript
debugLog('R1 results.tsx mounted');
debugLog(`R2 revealData: ${revealData?.boards?.length} boards`);
debugLog('R3 rendering...');
```

## IF FadeInDown is the cause — remove it:
```typescript
// Replace:
// <Animated.View entering={FadeInDown.delay(i * 150).duration(300)}>
// With plain View:
// <View>
```

Layout animations (entering=) are Reanimated features that register worklets.
4 boards × staggered = 4+ worklets on mount.

## ALSO: Check if SafeRevealOverlay is causing issues
Image 3 shows the reveal overlay AND the results at the same time.
Are BOTH screens mounted simultaneously?

```bash
grep -n "SafeRevealOverlay\|showSafeReveal\|revealOverlay" app/game.tsx app/results.tsx | head -10
```

If both game.tsx (with overlay) and results.tsx (with animations) are mounted at the same time during navigation → double the worklets → crash.

## DEPLOY
```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5
eas update --branch production --message "fix: step 13 crash — add logging + investigate FadeInDown"
git add -A && git commit -m "fix: crash after step 13 — add steps 14-15 + results mount logging"
git push origin main
```

## REPORT — Include steps 14, 15, R1-R3

VAMOS CAPS STEP-13-CRASH — END
