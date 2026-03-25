# VAMOS CAPS CRASH-FOUND
**Date:** 2026-03-22 21:50 IST
**Priority:** 🔴🔴🔴 CRASH LOCATION CONFIRMED — between READY and Step A

## THE EVIDENCE
Debug overlay last line: `🟡 READY pressed — boards: 4/4 4/4 4/4`
Steps A-G: NEVER REACHED.
Crash happens IMMEDIATELY after `setPlayerReady(true)`.

## WHAT TO DO

### Step 1 — Find the useEffect that triggers on playerReady
```
cd C:\Projects\Caps
cat app/game.tsx
```

Find the code path:
```bash
grep -n "playerReady\|setPlayerReady\|allBotsReady\|navigateToReveal\|useEffect" app/game.tsx | head -30
```

The crash is in the useEffect that watches `playerReady`. It does something that kills the app BEFORE InteractionManager even starts.

### Step 2 — Add debugLog INSIDE that useEffect

```typescript
// Find the useEffect that triggers on playerReady change:
useEffect(() => {
  debugLog('🟡 useEffect: playerReady triggered'); // ADD THIS
  
  if (!playerReady) return;
  debugLog('🟡 useEffect: playerReady=true, checking bots'); // ADD THIS
  
  if (!allBotsReady) return;
  debugLog('🟡 useEffect: allBotsReady=true, calling navigateToReveal'); // ADD THIS
  
  try {
    navigateToReveal(boardsRef.current);
    debugLog('🟢 useEffect: navigateToReveal returned'); // ADD THIS
  } catch (e) {
    debugLog(`🔴 useEffect CRASH: ${e}`, 'error'); // ADD THIS
    // Fallback — go to results directly:
    router.replace('/results');
  }
}, [playerReady, allBotsReady]);
```

### Step 3 — Read navigateToReveal function COMPLETELY

```bash
grep -A 50 "function navigateToReveal\|const navigateToReveal" app/game.tsx
```

The crash is INSIDE navigateToReveal. What does it do?
- Does it call InteractionManager?
- Does it call calculateHandResultsMulti?
- Does it modify state?
- Does it access any undefined values?

### Step 4 — Add debugLog to EVERY line of navigateToReveal

```typescript
function navigateToReveal(boards) {
  debugLog('navigateToReveal: START');
  debugLog(`navigateToReveal: boards=${boards?.length}`);
  
  // Log before EVERY operation:
  debugLog('navigateToReveal: InteractionManager starting');
  InteractionManager.runAfterInteractions(() => {
    debugLog('navigateToReveal: InteractionManager callback');
    
    try {
      debugLog('navigateToReveal: step A — calculating');
      const results = calculateHandResultsMulti(boards);
      debugLog(`navigateToReveal: step A done — ${results?.length} results`);
      
      debugLog('navigateToReveal: step B — building revealBoards');
      // ... etc
      
      debugLog('navigateToReveal: step F — router.replace');
      router.replace('/results');
      debugLog('navigateToReveal: step G — done');
    } catch (e) {
      debugLog(`navigateToReveal: CRASH — ${e}`, 'error');
      debugLog(`navigateToReveal: stack — ${e?.stack?.slice(0, 300)}`, 'error');
      // FALLBACK — always reach results:
      try { router.replace('/results'); } catch {}
    }
  });
  debugLog('navigateToReveal: InteractionManager scheduled');
}
```

### Step 5 — BUT ALSO: Maybe the crash is BEFORE navigateToReveal

The useEffect might do something else before calling navigateToReveal.
Check if there's:
- A sound playing: `playSound('ready')` — could crash on missing file
- A haptic: `haptic()` — could crash on web or simulator
- A Reanimated animation trigger
- An Animated.timing start
- A state update that triggers another useEffect that crashes

```bash
# Find ALL code between setPlayerReady and navigateToReveal:
grep -B 5 -A 50 "playerReady.*true\|setPlayerReady" app/game.tsx
```

### Step 6 — SIMPLIFY the Ready handler to absolute minimum

Replace the ENTIRE Ready flow with:
```typescript
function handleReady() {
  debugLog('handleReady: START');
  
  // Skip ALL intermediate steps. No sounds. No haptics. No animations.
  // Just: calculate → navigate.
  
  debugLog('handleReady: evaluating');
  let results;
  try {
    results = evaluateAllBoards(boards);
    debugLog(`handleReady: ${results?.length} results`);
  } catch (e) {
    debugLog(`handleReady: eval CRASH: ${e}`, 'error');
    results = boards.map(() => ({ winner: 'tie', playerHand: null, botHand: null, pot: 0 }));
  }
  
  debugLog('handleReady: storing results');
  try {
    // Store results however results.tsx expects them:
    // Check what results.tsx reads from gameStore/route params
    gameStore.getState().setRevealData?.(results);
    // OR:
    // gameStore.getState().setResults?.(results);
  } catch (e) {
    debugLog(`handleReady: store CRASH: ${e}`, 'error');
  }
  
  debugLog('handleReady: navigating');
  try {
    router.replace('/results');
  } catch (e) {
    debugLog(`handleReady: navigate CRASH: ${e}`, 'error');
    try { router.replace('/'); } catch {}
  }
  
  debugLog('handleReady: DONE');
}
```

**Remove setPlayerReady(true) entirely.** Don't go through the useEffect chain. Just: calculate → store → navigate. Direct. No intermediaries.

### Step 7 — Fix the bugs dashboard

The dashboard at caps.ftable.co.il/bugs/ is broken ("Unmatched Route").
Vercel auto-deploy probably deployed the Expo web app over the static files.

```bash
# Check if web-dashboard files are in the web-dist:
ls web-dist/bugs/ 2>/dev/null
ls web-dist/hand/ 2>/dev/null

# If missing — the Expo web export doesn't include them.
# Need to copy them into web-dist AFTER export:
cp web-dashboard/index.html web-dist/bugs/index.html
cp web-replay/index.html web-dist/hand/index.html

# OR: add to vercel.json rewrites
cat vercel.json
```

Fix: ensure `scripts/fix-web-html.js` copies dashboard and replay files:
```javascript
// In scripts/fix-web-html.js — add at the end:
const fs = require('fs');
const path = require('path');

// Copy bug dashboard:
const bugsDir = path.join(__dirname, '..', 'web-dist', 'bugs');
if (!fs.existsSync(bugsDir)) fs.mkdirSync(bugsDir, { recursive: true });
fs.copyFileSync(
  path.join(__dirname, '..', 'web-dashboard', 'index.html'),
  path.join(bugsDir, 'index.html')
);

// Copy hand replay:
const handDir = path.join(__dirname, '..', 'web-dist', 'hand');
if (!fs.existsSync(handDir)) fs.mkdirSync(handDir, { recursive: true });
fs.copyFileSync(
  path.join(__dirname, '..', 'web-replay', 'index.html'),
  path.join(handDir, 'index.html')
);
```

### Step 8 — Deploy

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

# OTA with the fix:
eas update --branch production --message "fix: crash after READY — bypass useEffect chain, direct calculate→navigate"

# Build:
git add -A && git commit -m "fix: crash after READY — direct flow, no useEffect chain + dashboard route fix"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
CRASH FOUND — REPORT
═══════════════════════════════════════
Crash location: AFTER setPlayerReady(true), BEFORE Step A
  Specifically: [useEffect / navigateToReveal / sound / haptic / animation / other]
  Exact line: [file:line]
  Error: [message if caught]

Fix: [what changed]
  setPlayerReady removed: [YES/NO]
  Direct calculate→navigate: [YES/NO]
  
Dashboard fixed: [YES/NO]
  bugs/ route: [working/broken]
  hand/ route: [working/broken]

OTA: [ID]
Build: [triggered]
Tests: [N]/[N]
═══════════════════════════════════════
```

## DO NOT
- Do NOT keep the setPlayerReady → useEffect → navigateToReveal chain
- Do NOT add sounds, haptics, or animations to the Ready flow
- Do NOT use InteractionManager — just call functions directly
- Ready → calculate → store → navigate. FOUR LINES. Nothing else.

VAMOS CAPS CRASH-FOUND — END
