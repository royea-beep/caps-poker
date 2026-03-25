# VAMOS CAPS NUMBERED-DEBUG
**Date:** 2026-03-23 07:06 IST
**Priority:** 🔴🔴🔴 Add sequential number to EVERY line of code from READY to results

## CONCEPT
```
DEBUG overlay shows:
  1   handleReady called
  2   boards validated: 4 boards
  3   doNavigate START
  4   calculateHandResultsMulti START
  4.1 board 0: evaluating
  4.2 board 1: evaluating
  4.3 board 2: evaluating
  4.4 board 3: evaluating
  5   calculateHandResultsMulti DONE: 4 results
  6   setRevealData START
  7   setRevealData DONE
  8   addChips START
  8.1 board 0: +150
  8.2 board 1: -100
  8.3 board 2: +200
  8.4 board 3: +50
  9   addChips DONE: net +300
  10  isComplete check: true
  11  setShowComplete(true)
  12  router.replace(/results) START
  💥  ← crash between 11 and 12 = setShowComplete is the problem
```

User records screen → crash → last number = exact crash location.

## FIRST ACTIONS
```
cd C:\Projects\Caps
cat app/game.tsx
```

## THE RULE
Add `debugLog('N description')` before EVERY SINGLE LINE that does anything.
"Anything" = function call, state update, variable assignment, if-check, loop iteration.

Not just "before each function" — before EACH LINE inside each function.

## STEP 1 — Number the ENTIRE flow from READY to results

Read the COMPLETE code path that runs when READY is pressed.
Print every line. Then add a debugLog before each one.

```typescript
import { debugLog } from '../components/DebugOverlay';

// Find handleReady or wherever READY triggers:
function handleReady() {
  debugLog('1 handleReady called');
  
  // Whatever is next:
  debugLog('2 checking boards');
  const allFull = boards.every(b => b.playerCards.length === CARDS_PER_BOARD);
  debugLog(`3 allFull=${allFull}`);
  
  if (!allFull) {
    debugLog('3.1 NOT all full — returning');
    return;
  }
  
  debugLog('4 calling doNavigate');
  doNavigate(boards);
  debugLog('5 doNavigate returned');
}

function doNavigate(boards) {
  debugLog('6 doNavigate START');
  
  debugLog('7 calculateHandResultsMulti START');
  let results;
  try {
    results = calculateHandResultsMulti(boards);
    debugLog(`8 calculateHandResultsMulti DONE: ${results?.length} results`);
  } catch (e) {
    debugLog(`8E calculateHandResultsMulti CRASHED: ${e}`, 'error');
    return;
  }
  
  debugLog('9 building revealBoards');
  // ... whatever builds revealBoards
  debugLog('10 revealBoards built');
  
  debugLog('11 addChips START');
  try {
    // If there's a loop:
    results.forEach((r, i) => {
      debugLog(`11.${i+1} addChips board ${i}: ${r.chipDelta}`);
      // ... add chips
    });
    debugLog('12 addChips DONE');
  } catch (e) {
    debugLog(`12E addChips CRASHED: ${e}`, 'error');
  }
  
  debugLog('13 setRevealData START');
  try {
    setRevealData(revealBoards);
    debugLog('14 setRevealData DONE');
  } catch (e) {
    debugLog(`14E setRevealData CRASHED: ${e}`, 'error');
  }
  
  debugLog('15 isComplete check');
  const isComplete = results.every(r => r.winner === 'player');
  debugLog(`16 isComplete=${isComplete}`);
  
  if (isComplete) {
    debugLog('17 setShowComplete(true)');
    try {
      setShowComplete(true);
      debugLog('18 setShowComplete DONE');
    } catch (e) {
      debugLog(`18E setShowComplete CRASHED: ${e}`, 'error');
    }
  }
  
  debugLog('19 router.replace(/results) START');
  try {
    router.replace('/results');
    debugLog('20 router.replace DONE');
  } catch (e) {
    debugLog(`20E router.replace CRASHED: ${e}`, 'error');
  }
  
  debugLog('21 doNavigate COMPLETE');
}
```

## STEP 2 — Also number results.tsx mount

```typescript
// In app/results.tsx:
useEffect(() => {
  debugLog('R1 results.tsx mounted');
  debugLog(`R2 boards: ${boards?.length}`);
  debugLog(`R3 showComplete: ${showComplete}`);
  debugLog(`R4 chipBalance: ${chipBalance}`);
  // ... every line
}, []);
```

## STEP 3 — Also number CompleteOverlay if it still renders

```typescript
// In SafeCompleteOverlay:
debugLog('C1 SafeCompleteOverlay mounted');
debugLog(`C2 winner=${winner}`);
debugLog(`C3 bonusAmount=${bonusAmount}`);
// If there's a timer:
debugLog('C4 dismiss timer started');
// On dismiss:
debugLog('C5 onDone called');
```

## STEP 4 — Also number the gameStore actions

```typescript
// In store/gameStore.ts:
setRevealData: (data) => {
  debugLog('S1 gameStore.setRevealData START');
  debugLog(`S2 data boards: ${data?.length}`);
  set({ revealData: data });
  debugLog('S3 gameStore.setRevealData DONE');
},

addChips: (amount) => {
  debugLog(`S4 gameStore.addChips: ${amount}`);
  set(state => ({ chips: state.chips + amount }));
  debugLog('S5 gameStore.addChips DONE');
},
```

## STEP 5 — Deploy OTA

```bash
npx tsc --noEmit
eas update --branch production --message "debug: numbered logging — every line numbered 1-N, loops X.Y"
git add -A && git commit -m "debug: numbered logging for crash detection"
git push origin main
```

## EXPECTED OUTPUT ON SCREEN
```
🐛 DEBUG (21)
1  handleReady called
2  checking boards  
3  allFull=true
4  calling doNavigate
6  doNavigate START
7  calculateHandResultsMulti START
8  calculateHandResultsMulti DONE: 4 results
9  building revealBoards
10 revealBoards built
11 addChips START
11.1 addChips board 0: +150
11.2 addChips board 1: -100
11.3 addChips board 2: +200
11.4 addChips board 3: +50
12 addChips DONE
13 setRevealData START
14 setRevealData DONE
15 isComplete check
16 isComplete=true
17 setShowComplete(true)
💥 ← LAST NUMBER = 17 → crash is in setShowComplete or CompleteOverlay mount
```

## DO NOT
- Do NOT skip any line — EVERY operation gets a number
- Do NOT number only function starts — number INSIDE functions too
- Do NOT forget loops — use decimal: 11.1, 11.2, 11.3
- Do NOT remove try-catch — keep them, but number inside too
- Do NOT change any logic — ONLY add debugLog calls

VAMOS CAPS NUMBERED-DEBUG — END
