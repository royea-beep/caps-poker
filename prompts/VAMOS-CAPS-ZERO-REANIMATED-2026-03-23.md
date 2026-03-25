# VAMOS CAPS ZERO-REANIMATED
**Date:** 2026-03-23 IST
**Priority:** 🔴🔴🔴🔴🔴 STILL CRASHING. NUCLEAR.

## THE SIMPLE TRUTH
Every time we add ANY Reanimated to results screen — it crashes.
Every time we remove it — something else crashes.
The problem: game.tsx has 7 shared values + withRepeat(-1).
During transition BOTH screens are in memory.

## THE FIX — TWO THINGS

### Thing 1: results.tsx = ZERO Reanimated

```
Remove from results.tsx:
- import Animated (entire import)
- import anything from react-native-reanimated
- ALL useSharedValue
- ALL useAnimatedStyle
- ALL withTiming / withRepeat / withSequence
- ALL Animated.View → replace with View
- ALL cancelAnimation
- EVERYTHING Reanimated. ZERO.

results.tsx should import ONLY from:
- react
- react-native (View, Text, Pressable, ScrollView, etc)
- expo-router
- our own utils (no Reanimated inside them)
```

### Thing 2: game.tsx — cancel ALL animations before navigating

```typescript
// Before router.replace('/results'):
// Cancel EVERY shared value in game.tsx:
cancelAnimation(shake0);
cancelAnimation(shake1);
cancelAnimation(shake2);
cancelAnimation(shake3);
cancelAnimation(pulseScale);  // CircularTimer
cancelAnimation(progress);    // TimerBar
cancelAnimation(pulseOpacity);

// THEN navigate:
router.replace('/results');
```

## DO IT NOW

```
cd C:\Projects\Caps

echo "=== 1. ALL Reanimated in results.tsx ==="
grep -n "Animated\|reanimated\|useSharedValue\|withTiming\|withRepeat\|cancelAnimation\|useAnimatedStyle\|entering=" app/results.tsx | head -30

echo ""
echo "=== 2. ALL shared values in game.tsx ==="  
grep -n "useSharedValue" app/game.tsx | head -15

echo ""
echo "=== 3. Cancel calls before navigation ==="
grep -B5 -A5 "router.replace" app/game.tsx | head -20
```

### Remove ALL Reanimated from results.tsx:
- Replace `import Animated, { ... } from 'react-native-reanimated'` with NOTHING
- Replace every `<Animated.View ...>` with `<View>`
- Replace every `</Animated.View>` with `</View>`
- Remove every `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withRepeat`, `cancelAnimation`
- The DEAL ME IN button glow? REMOVE. Use a static gold border instead.
- The screenOpacity fade? REMOVE. Screen appears instantly.
- The chipsReveal animation? REMOVE. Show chips immediately.

### Add cancel-all before navigation in game.tsx:
Find EVERY router.replace('/results') call.
Before each one, add cancelAnimation for ALL shared values.

## DEPLOY
```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5
eas update --branch production --message "fix: ZERO Reanimated on results + cancel all animations before navigation"
git add -A && git commit -m "fix: ZERO Reanimated on results screen + cancel all game animations before navigate"
git push origin main
```

## VERIFY
Play 3 hands. If it crashes — the problem is NOT Reanimated at all, 
and we need to look at something completely different (navigation, zustand, memory).

VAMOS CAPS ZERO-REANIMATED — END
