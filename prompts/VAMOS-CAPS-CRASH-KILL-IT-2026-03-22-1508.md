# VAMOS CAPS CRASH-KILL-IT
**Date:** 2026-03-22 15:08 IST
**Priority:** 🔴🔴🔴🔴 FOURTH ATTEMPT. Previous 3 fixes ALL FAILED. NEW APPROACH.

## WHAT HAPPENED
- Fix 1: cancelAnimation on Board + TimerBar + ProQuoteBanner → STILL CRASHES
- Fix 2: InteractionManager + fast evaluator → STILL CRASHES
- Fix 3: cancelAnimation on CircularTimer → STILL CRASHES
- We keep finding ONE withRepeat(-1) at a time. There are MORE hiding.

## NEW APPROACH: SCORCHED EARTH

### Phase 1: Find and list EVERY animation in the ENTIRE codebase
### Phase 2: DISABLE ALL OF THEM
### Phase 3: Verify crash is gone
### Phase 4: Re-enable ONE AT A TIME until crash returns
### Phase 5: Fix the actual culprit permanently

## FIRST ACTIONS
```
cd C:\Projects\Caps
```

## PHASE 1 — FIND EVERY ANIMATION

```bash
echo "═══════════════════════════════════════"
echo "ALL withRepeat (INFINITE LOOPS — most dangerous)"
echo "═══════════════════════════════════════"
grep -rn "withRepeat" app/ components/ hooks/ utils/ | grep -v node_modules | grep -v __tests__

echo ""
echo "═══════════════════════════════════════"
echo "ALL withTiming / withSpring / withSequence / withDelay"
echo "═══════════════════════════════════════"
grep -rn "withTiming\|withSpring\|withSequence\|withDelay" app/ components/ hooks/ utils/ | grep -v node_modules | grep -v __tests__

echo ""
echo "═══════════════════════════════════════"
echo "ALL useSharedValue"
echo "═══════════════════════════════════════"
grep -rn "useSharedValue" app/ components/ hooks/ utils/ | grep -v node_modules | grep -v __tests__

echo ""
echo "═══════════════════════════════════════"
echo "ALL cancelAnimation"
echo "═══════════════════════════════════════"
grep -rn "cancelAnimation" app/ components/ hooks/ utils/ | grep -v node_modules | grep -v __tests__

echo ""
echo "═══════════════════════════════════════"
echo "ALL runOnJS"
echo "═══════════════════════════════════════"
grep -rn "runOnJS" app/ components/ hooks/ utils/ | grep -v node_modules | grep -v __tests__

echo ""
echo "═══════════════════════════════════════"
echo "ALL Animated.View / Animated.Text without cleanup"
echo "═══════════════════════════════════════"
grep -rn "Animated\." app/ components/ hooks/ | grep -v node_modules | grep -v __tests__ | grep -v "import" | head -30

echo ""
echo "═══════════════════════════════════════"
echo "COMPARISON: withRepeat COUNT vs cancelAnimation COUNT"
echo "═══════════════════════════════════════"
echo "withRepeat: $(grep -rn 'withRepeat' app/ components/ hooks/ | grep -v node_modules | grep -v __tests__ | wc -l)"
echo "cancelAnimation: $(grep -rn 'cancelAnimation' app/ components/ hooks/ | grep -v node_modules | grep -v __tests__ | wc -l)"
echo "If withRepeat > cancelAnimation → THERE ARE LEAKS"
```

## PHASE 2 — CREATE A KILL SWITCH

Create a global flag that disables ALL Reanimated animations:

```typescript
// In utils/responsive.ts or a new file utils/animationConfig.ts:
export const ANIMATIONS_ENABLED = false; // KILL SWITCH — set to false to disable ALL animations

// Usage in EVERY file that has withRepeat/withTiming/etc:
// BEFORE:
// pulseScale.value = withRepeat(withSequence(...), -1);
// AFTER:
// if (ANIMATIONS_ENABLED) { pulseScale.value = withRepeat(withSequence(...), -1); }
```

**OR — simpler approach:** Comment out ALL animation code temporarily:

Go through EVERY file from Phase 1 results and wrap EVERY animation in a condition:

```typescript
const KILL = true; // TEMPORARY — remove after finding the crash

// Instead of:
useEffect(() => {
  scale.value = withRepeat(withTiming(1.1, ...), -1);
}, []);

// Do:
useEffect(() => {
  if (!KILL) {
    scale.value = withRepeat(withTiming(1.1, ...), -1);
  }
  return () => { cancelAnimation(scale); };
}, []);
```

**Do this for EVERY SINGLE animation in:**
- app/game.tsx
- components/Board.tsx
- components/Card.tsx
- components/PlayerHand.tsx
- components/CompleteOverlay.tsx
- components/HandNameOverlay.tsx
- components/FloatingChips.tsx
- components/ProQuoteBanner.tsx
- components/TimerBar.tsx
- hooks/useRevealSequence.ts
- hooks/useGameTimer.ts
- ANY other file with Reanimated

## PHASE 3 — TEST WITH ALL ANIMATIONS OFF

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

# Deploy OTA with animations killed:
eas update --branch production --message "test: all animations disabled — crash test"
```

Tell user to test: "Play 5 hands. Does it crash?"

If NO CRASH → animations are the cause → proceed to Phase 4.
If STILL CRASHES → it's NOT animations → look at evaluation/state/navigation.

## PHASE 4 — RE-ENABLE ONE FILE AT A TIME

If Phase 3 confirmed animations cause the crash:

```
Round 1: Enable ONLY Board.tsx animations → test → crash?
Round 2: Enable ONLY Card.tsx animations → test → crash?
Round 3: Enable ONLY useRevealSequence animations → test → crash?
Round 4: Enable ONLY CompleteOverlay animations → test → crash?
Round 5: Enable ONLY game.tsx animations → test → crash?
...etc
```

For each round: change KILL to false in ONE file, deploy OTA, test.
The file that makes it crash = THE CULPRIT.

## PHASE 5 — FIX THE ACTUAL CULPRIT

Once found, the fix is one of:
1. Missing cancelAnimation cleanup in useEffect return
2. Animation accessing stale shared value after unmount
3. runOnJS calling function that doesn't exist anymore
4. Too many simultaneous animations overwhelming native thread
5. withRepeat(-1) without a way to cancel

**For EVERY withRepeat in the codebase, add cleanup:**
```typescript
useEffect(() => {
  sharedValue.value = withRepeat(withSequence(...), -1);
  return () => {
    cancelAnimation(sharedValue);
    sharedValue.value = 0; // reset to default
  };
}, []);
```

**ALSO — add a master cleanup on game screen unmount:**
```typescript
// In game.tsx, at the TOP of the component:
const allSharedValues = useRef<SharedValue<number>[]>([]);

// Register every shared value:
const pulseScale = useSharedValue(1);
allSharedValues.current.push(pulseScale);

// On unmount — cancel EVERYTHING:
useEffect(() => {
  return () => {
    allSharedValues.current.forEach(sv => {
      cancelAnimation(sv);
    });
  };
}, []);
```

## PHASE 6 — RE-ENABLE ALL ANIMATIONS AND VERIFY

After fixing the culprit:
1. Set KILL = false in ALL files (re-enable all animations)
2. Test 5 hands — no crash
3. Deploy OTA + build

## DEPLOY

```bash
# After each phase — deploy OTA:
eas update --branch production --message "fix: [describe current phase]"

# After final fix — full deploy:
npx tsc --noEmit
npx jest --forceExit
git add -A && git commit -m "fix: reveal crash — [exact cause and fix]"
git push origin main
```

## REPORT AFTER EACH PHASE

```
PHASE 1:
  Total withRepeat: [N]
  Total cancelAnimation: [N]
  LEAKS (withRepeat without cancel): [N] — list each file:line

PHASE 2:
  Files modified: [N]
  All animations disabled: [YES]

PHASE 3 (animations OFF):
  OTA deployed: [YES — ID]
  CRASHES WITHOUT ANIMATIONS: [YES / NO]
  → If NO: proceed to Phase 4
  → If YES: problem is NOT animations — investigate [what]

PHASE 4 (one at a time):
  Board.tsx: [CRASH / OK]
  Card.tsx: [CRASH / OK]
  useRevealSequence: [CRASH / OK]
  CompleteOverlay: [CRASH / OK]
  game.tsx: [CRASH / OK]
  → CULPRIT: [file name]

PHASE 5:
  Exact cause: [file:line — description]
  Fix applied: [description]
  
PHASE 6:
  All animations re-enabled: [YES]
  5 hands played: [NO CRASH / CRASH]
  
FINAL:
  OTA: [ID]
  Build: [triggered]
  Tests: [N]/[N]
```

## DO NOT
- Do NOT patch ONE animation and hope for the best (failed 3 times)
- Do NOT skip Phase 1 (find ALL animations)
- Do NOT skip Phase 3 (test with ALL off)
- Do NOT re-enable all at once — one file at a time
- Do NOT change game logic

VAMOS CAPS CRASH-KILL-IT — END
