# VAMOS CAPS DEBUG-OVERLAY
**Date:** 2026-03-22 20:35 IST
**Priority:** 🔴🔴🔴 Build a visible debug overlay — see exactly what crashes

## CONCEPT
A small translucent window on screen that shows EVERY action in real-time.
User turns on iOS screen recording → plays the game → when it crashes → 
the recording shows the LAST DEBUG LINE before death.

No Supabase. No Xcode. No guessing. It's ON THE SCREEN.

## STEP 1 — Create DebugOverlay component

```typescript
// components/DebugOverlay.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const MAX_LOGS = 50;

interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

// Global log array — accessible from anywhere
let globalLogs: LogEntry[] = [];
let globalListener: ((logs: LogEntry[]) => void) | null = null;

// Call this from ANYWHERE in the app:
export function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
  
  const entry: LogEntry = { time, message, level };
  globalLogs = [...globalLogs.slice(-MAX_LOGS + 1), entry];
  
  if (globalListener) {
    globalListener([...globalLogs]);
  }
  
  // Also console.log for Metro:
  console.log(`[DEBUG ${time}] ${message}`);
}

export default function DebugOverlay() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    globalListener = setLogs;
    return () => { globalListener = null; };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom:
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [logs]);

  if (minimized) {
    return (
      <TouchableOpacity 
        style={styles.minimizedBubble} 
        onPress={() => setMinimized(false)}
      >
        <Text style={styles.bubbleText}>🐛 {logs.length}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText}>🐛 DEBUG ({logs.length})</Text>
          <TouchableOpacity onPress={() => setMinimized(true)}>
            <Text style={styles.minimizeBtn}>▼</Text>
          </TouchableOpacity>
        </View>
        <ScrollView ref={scrollRef} style={styles.logArea}>
          {logs.map((log, i) => (
            <Text 
              key={i} 
              style={[
                styles.logLine,
                log.level === 'error' && styles.errorLine,
                log.level === 'warn' && styles.warnLine,
              ]}
              numberOfLines={2}
            >
              <Text style={styles.logTime}>{log.time}</Text> {log.message}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 8,
    right: 8,
    zIndex: 99999,
    pointerEvents: 'box-none',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
    maxHeight: 200,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 0, 0.2)',
  },
  headerText: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  minimizeBtn: {
    color: '#00ff00',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  logArea: {
    maxHeight: 160,
    padding: 4,
  },
  logLine: {
    color: '#00ff00',
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 13,
    marginBottom: 1,
  },
  errorLine: {
    color: '#ff4444',
  },
  warnLine: {
    color: '#ffaa00',
  },
  logTime: {
    color: '#888888',
    fontSize: 8,
  },
  minimizedBubble: {
    position: 'absolute',
    bottom: 100,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
    zIndex: 99999,
  },
  bubbleText: {
    color: '#00ff00',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
```

## STEP 2 — Add DebugOverlay to _layout.tsx (root — always visible)

```typescript
// In app/_layout.tsx, add at the end of the root layout:
import DebugOverlay from '../components/DebugOverlay';

// Inside the layout component, add AFTER all other content:
<DebugOverlay />
```

This shows the debug overlay on EVERY screen — home, game, results, settings.

## STEP 3 — Add debugLog calls to EVERY critical point

### In app/game.tsx:
```typescript
import { debugLog } from '../components/DebugOverlay';

// On mount:
debugLog('game.tsx mounted');

// On game start:
debugLog(`game start: ${numPlayers}p, ${numBoards} boards, ${playerHand.length} cards`);

// On card select:
debugLog(`card selected: ${card.rank}${card.suit}`);

// On card place:
debugLog(`card placed: ${card.rank}${card.suit} → board ${boardIndex} (${board.playerCards.length + 1}/4)`);

// On card remove:
debugLog(`card removed: ${card.rank}${card.suit} from board ${boardIndex}`);

// On auto fill:
debugLog(`auto fill: board ${boardIndex}, ${cardsToPlace.length} cards`);

// On Ready press:
debugLog('🟡 READY pressed');
debugLog(`boards state: ${boards.map(b => b.playerCards.length + '/4').join(', ')}`);

// Before evaluate:
debugLog('🟡 evaluateAllBoards START');

// After evaluate:
debugLog(`🟢 evaluateAllBoards DONE: ${results.map(r => r.winner).join(', ')}`);

// Before store:
debugLog('🟡 setResults START');

// After store:
debugLog('🟢 setResults DONE');

// Before navigate:
debugLog('🟡 router.replace(/results) START');

// After navigate:
debugLog('🟢 navigation triggered');

// On unmount:
debugLog('game.tsx unmounting');
```

### In app/results.tsx:
```typescript
import { debugLog } from '../components/DebugOverlay';

// On mount:
debugLog('results.tsx mounted');

// On data load:
debugLog(`results loaded: ${boards.length} boards, net=${chipDelta}`);

// On DEAL ME IN press:
debugLog('DEAL ME IN pressed');

// On share:
debugLog('share triggered');
```

### In store/gameStore.ts:
```typescript
import { debugLog } from '../components/DebugOverlay';

// In setResults:
setResults: (results) => {
  debugLog(`store.setResults: ${results?.length} boards`);
  set({ results });
  debugLog('store.setResults DONE');
},

// In any persist callback:
debugLog('zustand persist: writing to AsyncStorage');
```

### In utils/gameLogic.ts:
```typescript
import { debugLog } from '../components/DebugOverlay';

// In evaluateAllBoards:
export function evaluateAllBoards(boards) {
  debugLog(`evaluateAllBoards: ${boards.length} boards`);
  
  const results = boards.map((board, i) => {
    debugLog(`eval board ${i}: player=${board.playerCards?.length} cards, community=${board.communityCards?.length}`);
    
    try {
      const result = evaluateBoard(board);
      debugLog(`eval board ${i} done: winner=${result.winner}`);
      return result;
    } catch (e) {
      debugLog(`🔴 eval board ${i} CRASHED: ${e}`, 'error');
      return defaultResult;
    }
  });
  
  debugLog(`evaluateAllBoards DONE: ${results.length} results`);
  return results;
}
```

### In utils/handEvaluator.ts:
```typescript
// In evaluateOmahaHand (only log errors, not every call — too frequent):
export function evaluateOmahaHand(playerCards, communityCards) {
  try {
    // ... evaluation
    return result;
  } catch (e) {
    debugLog(`🔴 evaluateOmahaHand CRASH: ${e} | cards: ${playerCards?.map(c => c.rank + c.suit).join(',')}`, 'error');
    return DEFAULT_RESULT;
  }
}
```

### In router navigation (app/_layout.tsx):
```typescript
// If using expo-router, add navigation state listener:
import { debugLog } from '../components/DebugOverlay';

// Inside the layout:
useEffect(() => {
  debugLog('🔵 app started');
}, []);

// If you can intercept navigation events:
// expo-router doesn't have a direct listener, but you can log in each screen's useEffect
```

## STEP 4 — Also add an auto-simulation mode

Create a button in settings that runs an automated game:

```typescript
// In app/settings.tsx, add a "Run Debug Simulation" button:

async function runDebugSimulation() {
  debugLog('🤖 AUTO-SIM: starting');
  
  // Navigate to game:
  debugLog('🤖 AUTO-SIM: navigating to game');
  router.push('/game?autoSim=true');
}

// In app/game.tsx, check for autoSim param:
const { autoSim } = useLocalSearchParams();

useEffect(() => {
  if (autoSim === 'true') {
    debugLog('🤖 AUTO-SIM: auto-placing cards');
    
    // Auto-fill all boards:
    setTimeout(() => {
      boards.forEach((board, i) => {
        if (board.playerCards.length < 4) {
          debugLog(`🤖 AUTO-SIM: auto-fill board ${i}`);
          handleAutoFill(i);
        }
      });
    }, 500);
    
    // Auto-press Ready after 2 seconds:
    setTimeout(() => {
      debugLog('🤖 AUTO-SIM: pressing Ready');
      handleReady();
    }, 2000);
  }
}, [autoSim]);
```

## STEP 5 — Deploy

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

# OTA:
eas update --branch production --message "feat: debug overlay — visible crash tracking on screen"

# Build + push:
git add -A && git commit -m "feat: debug overlay + auto-sim — visible on-screen crash tracking"
git push origin main
```

## HOW TO USE

1. **Turn on iOS screen recording** (swipe down from top-right → hold record button → start)
2. **Open CAPS** — green debug overlay appears at bottom
3. **Play a hand** — watch logs scroll
4. **When it crashes** — stop recording, send video
5. **The LAST LINE in the debug overlay = the step right before crash**

Or:
1. Go to Settings → "Run Debug Simulation"
2. It auto-plays a full hand
3. If crashes — debug overlay shows where

## REPORT
```
═══════════════════════════════════════
DEBUG OVERLAY — REPORT
═══════════════════════════════════════
DebugOverlay component: [created — file + lines]
Added to _layout.tsx: [YES/NO]

debugLog calls added:
  game.tsx: [N] log points
  results.tsx: [N] log points
  gameStore.ts: [N] log points
  gameLogic.ts: [N] log points
  handEvaluator.ts: [N] log points

Auto-sim mode: [YES/NO]

OTA: [ID]
Build: [triggered]
Tests: [N]/[N]
═══════════════════════════════════════
```

## DO NOT
- Do NOT remove the debug overlay after fixing — keep it behind a Settings toggle for future debugging
- Do NOT make the overlay block touch events on the game (pointerEvents: 'box-none')
- Do NOT log inside tight loops (evaluator inner loop) — only log errors there
- The overlay must be VISIBLE in screen recordings

VAMOS CAPS DEBUG-OVERLAY — END
