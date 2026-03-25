# VAMOS CAPS ALL-FIXES
**Date:** 2026-03-23 13:03 IST
**Priority:** 🟡 Polish — crash is fixed, now make it look professional

## CRASH IS FIXED ✅ — PROTECT IT
**Read `feedback_reanimated_iron_rules.md` BEFORE writing any animation code.**
- Max 5 shared values per screen
- No withRepeat(-1) — only withRepeat(N) finite
- Every animation has cancelAnimation in cleanup
- No ConfettiCannon — EVER
- No CompleteOverlay with particles — EVER

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat app/game.tsx
cat app/results.tsx
cat components/Board.tsx
cat components/Card.tsx
cat components/PlayerHand.tsx
cat components/DebugOverlay.tsx
cat utils/screenRecorder.ts
cat utils/dirtyShutdown.ts
cat utils/responsive.ts
```

═══════════════════════════════════════════════════════════
FIX 1 — PERSISTENT SCREENSHOTS (disk, not RAM)
═══════════════════════════════════════════════════════════

Current: screenshots saved in memory array → lost on native crash.
Fix: save to FileSystem.documentDirectory → survives crash.

```typescript
// utils/screenRecorder.ts — replace in-memory with disk storage:
import * as FileSystem from 'expo-file-system';

const SCREENSHOT_DIR = `${FileSystem.documentDirectory}crash-screenshots/`;

async function ensureScreenshotDir() {
  const info = await FileSystem.getInfoAsync(SCREENSHOT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SCREENSHOT_DIR, { intermediates: true });
  }
}

// In startRecording — save each frame to disk:
screenshotInterval = setInterval(async () => {
  if (isCapturing || !isRecording) return;
  isCapturing = true;
  try {
    const uri = await captureScreen!({ format: 'jpg', quality: 0.3 });
    const fileName = `frame-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: SCREENSHOT_DIR + fileName });
    
    // Keep only last 10 files (5 seconds at 2fps):
    const files = await FileSystem.readDirectoryAsync(SCREENSHOT_DIR);
    if (files.length > 10) {
      const sorted = files.sort();
      for (let i = 0; i < files.length - 10; i++) {
        await FileSystem.deleteAsync(SCREENSHOT_DIR + sorted[i], { idempotent: true });
      }
    }
  } catch {} 
  finally { isCapturing = false; }
}, 500);
```

Also update dirtyShutdown.ts — on crash detection, read screenshots from disk:
```typescript
async function getPreviousScreenshots(): Promise<string[]> {
  try {
    await ensureScreenshotDir();
    const files = await FileSystem.readDirectoryAsync(SCREENSHOT_DIR);
    return files.sort().map(f => SCREENSHOT_DIR + f);
  } catch { return []; }
}

// In checkPreviousCrash — upload last screenshot:
const screenshots = await getPreviousScreenshots();
if (screenshots.length > 0) {
  const lastFrame = screenshots[screenshots.length - 1];
  // Upload to Supabase Storage...
  // Include URL in WhatsApp crash alert
}

// Clean up after upload:
await FileSystem.deleteAsync(SCREENSHOT_DIR, { idempotent: true });
await ensureScreenshotDir();
```

Also save debug logs to file (not just AsyncStorage):
```typescript
const LOG_FILE = `${FileSystem.documentDirectory}debug-log.txt`;
let logBuffer = '';

// Flush buffer every 3 seconds:
setInterval(async () => {
  if (!logBuffer) return;
  try {
    const existing = await FileSystem.readAsStringAsync(LOG_FILE).catch(() => '');
    const lines = (existing + logBuffer).split('\n').slice(-100).join('\n');
    await FileSystem.writeAsStringAsync(LOG_FILE, lines);
    logBuffer = '';
  } catch {}
}, 3000);
```

═══════════════════════════════════════════════════════════
FIX 2 — CARD SIZING + OVERLAP
═══════════════════════════════════════════════════════════

Cards on game board are too big and overlap.

### Rules:
- Community cards (5 per board): max width = floor((boardWidth - 4*gap) / 5)
- Player cards on board (4 per board): max width = floor((boardWidth - 3*gap) / 4)  
- Player hand (16 cards, 2 rows of 8): max width = floor((screenWidth - 2*padding - 7*gap) / 8)
- Card max width: NEVER above 50pt on any screen
- Card min width: NEVER below 28pt
- Card height: always width × 1.4

```bash
# Find current card sizing:
grep -n "CARD_W\|cardWidth\|commCardW\|handCardW\|getCardDimensions\|overhead" \
  app/game.tsx components/Board.tsx components/PlayerHand.tsx utils/responsive.ts | head -30
```

Fix: update getCardDimensions() in responsive.ts to enforce these limits.
Test all widths: 320, 360, 375, 380, 390, 393, 402, 414, 428, 430, 440, 480.

═══════════════════════════════════════════════════════════
FIX 3 — BUTTONS VISIBILITY
═══════════════════════════════════════════════════════════

Ensure ALL buttons are fully visible on every screen size:

1. READY / UNDO buttons at bottom of game screen
2. DEAL ME IN button on results screen
3. AUTO buttons on each board
4. Share buttons on results
5. Settings button on home

```bash
grep -n "Pressable\|Button\|button" app/game.tsx app/results.tsx app/index.tsx | head -30
grep -n "safeArea\|SafeArea\|paddingBottom\|bottom:" app/game.tsx app/results.tsx | head -10
```

Fix:
- Wrap bottom buttons in SafeAreaView or add paddingBottom for notch
- Use rb() for all button heights (minimum 44pt)
- If content overflows on short screens (SE 3, 667pt) → use ScrollView
- DEAL ME IN: position at bottom with safe area inset

═══════════════════════════════════════════════════════════
FIX 4 — TEXT SIZING
═══════════════════════════════════════════════════════════

```bash
# Find any remaining hardcoded font sizes:
grep -rn "fontSize: [0-9]" app/ components/ | grep -v "rf\|rv\|UI\.\|node_modules\|__tests__" | head -20
```

Replace ALL with rf():
```
Board labels: rf(11, 9, 13)
Card rank: proportional to card width, min 9pt
Chip amounts: rf(14, 11, 16)
Hand names: rf(13, 11, 15)
Button text: rf(16, 13, 18)
Debug overlay: keep fixed 9px (monospace, always small)
```

═══════════════════════════════════════════════════════════
FIX 5 — SAFE RESULTS ANIMATIONS (max 5 shared values)
═══════════════════════════════════════════════════════════

Results screen is currently fully static. Add back SAFE animations:

**Allowed (total 3 shared values):**

```typescript
// 1. Screen fade-in (1 shared value):
const screenOpacity = useSharedValue(0);
useEffect(() => {
  screenOpacity.value = withTiming(1, { duration: 400 });
  return () => cancelAnimation(screenOpacity);
}, []);

// 2. Board results stagger (0 shared values — uses layout animation):
import Animated, { FadeInDown } from 'react-native-reanimated';
{boards.map((board, i) => (
  <Animated.View key={i} entering={FadeInDown.delay(i * 150).duration(300)}>
    {/* board result content */}
  </Animated.View>
))}

// 3. DEAL ME IN glow (1 shared value):
const dealGlow = useSharedValue(0.5);
useEffect(() => {
  dealGlow.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 1500 }),
      withTiming(0.5, { duration: 1500 })
    ),
    3  // FINITE — 3 cycles then stop
  );
  return () => cancelAnimation(dealGlow);
}, []);

// 4. Net chips count-up (1 shared value):
const chipDisplay = useSharedValue(0);
useEffect(() => {
  chipDisplay.value = withTiming(netChips, { duration: 800 });
  return () => cancelAnimation(chipDisplay);
}, []);
```

**Total: 3 shared values (well under limit of 5).**

**COMPLETE celebration (safe — 0 shared values):**
```typescript
{isComplete && (
  <Animated.View entering={FadeInDown.duration(500)}>
    <Text style={styles.completeBanner}>🏆 COMPLETE! 🏆</Text>
    <Text style={styles.bonusText}>+{bonusAmount} bonus chips!</Text>
  </Animated.View>
)}
```

**FORBIDDEN — do NOT add:**
- ❌ ConfettiCannon
- ❌ CompleteOverlay with particles
- ❌ ProQuoteBanner (has withRepeat + Audio)
- ❌ Any withRepeat(-1)
- ❌ goldPulse withRepeat(-1)
- ❌ AnimatedChipCount with useDerivedValue+runOnJS

═══════════════════════════════════════════════════════════
FIX 6 — SAFE REVEAL (pure React, zero Reanimated)
═══════════════════════════════════════════════════════════

Currently: READY → straight to results (no reveal).
Add SafeRevealOverlay — show results board by board before navigating.

```typescript
// Already created in previous sprint — verify it's wired in.
// SafeRevealOverlay uses:
// - React state (useState)
// - setTimeout for timing
// - ZERO Reanimated
// - 1.2s per board + 0.6s buffer

// Check it's connected:
grep -n "SafeRevealOverlay\|showSafeReveal\|safeReveal" app/game.tsx | head -5

// If not connected — wire it:
// Before router.replace('/results'), show SafeRevealOverlay
// When overlay done → navigate to results
```

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

# OTA:
eas update --branch production --message "feat: persistent screenshots + card fix + button fix + safe animations + reveal"

# Build + push:
git add -A && git commit -m "feat: all fixes — persistent screenshots, card sizing, buttons, safe animations, reveal"
git push origin main
```

## VERIFY — Play 5 hands including COMPLETE

After deploying:
1. Play a normal hand (2 boards won, 2 lost) → results with animations
2. Play a COMPLETE hand (all 4 boards won) → gold banner, no crash
3. Check cards don't overlap on game screen
4. Check all buttons visible
5. Check reveal shows board-by-board before results

## REPORT
```
═══════════════════════════════════════
ALL FIXES — REPORT
═══════════════════════════════════════
Fix 1 (screenshots to disk):
  Storage: [FileSystem.documentDirectory]
  Max files: [10 rolling]
  Upload on dirty shutdown: [YES/NO]
  Debug logs to file: [YES/NO]

Fix 2 (card sizing):
  Max card width: [N]pt
  Overlap on 375pt: [YES/NO]
  Overlap on 320pt: [YES/NO]

Fix 3 (buttons):
  All visible on SE 3: [YES/NO]
  Min height 44pt: [YES/NO]
  SafeArea bottom: [YES/NO]

Fix 4 (text sizing):
  Hardcoded fontSizes: [0]
  All using rf(): [YES/NO]

Fix 5 (results animations):
  Shared values count: [N] (max 5)
  FadeInDown stagger: [YES/NO]
  DEAL ME IN glow: [YES/NO — withRepeat(3)]
  Chip count-up: [YES/NO]
  COMPLETE banner: [YES/NO]

Fix 6 (reveal):
  SafeRevealOverlay wired: [YES/NO]
  Uses Reanimated: [NO]

CRASH TEST: [played 5 hands — NO CRASH / CRASH at step X]
OTA: [ID]
Tests: [N]/[N]
═══════════════════════════════════════
```

## DO NOT
- Do NOT add ConfettiCannon
- Do NOT exceed 5 shared values on results screen
- Do NOT use withRepeat(-1)
- Do NOT skip the 5-hand test including COMPLETE
- Do NOT change game logic

VAMOS CAPS ALL-FIXES — END
