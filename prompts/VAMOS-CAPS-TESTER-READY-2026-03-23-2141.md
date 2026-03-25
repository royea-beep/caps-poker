# VAMOS CAPS TESTER-READY
**Date:** 2026-03-23 21:41 IST
**Priority:** 🟢 Prepare professional build for testers — crash is FIXED

## MISSION
Make the app look like a **professional product** ready for testers.
Remove ALL debug elements. Restore visual polish. Keep ALL crash safety.

## RULES
- ✅ KEEP: All crash fixes (zero Reanimated on results, cancel before navigate, withRepeat finite)
- ✅ KEEP: Dirty shutdown detector (hidden — runs silently)
- ✅ KEEP: WhatsApp crash alerts (hidden — sends if crash happens)
- ✅ KEEP: Screen recorder (hidden — captures silently)
- ✅ KEEP: Responsive system (rv/rh/rf/rs/rb/ri)
- ❌ REMOVE: Debug overlay from production (keep behind Settings toggle for dev)
- ❌ REMOVE: Auto-sim button from Settings (keep code, hide from UI)
- ❌ REMOVE: "🐛 Debug Marathon" button
- ❌ REMOVE: Numbered step logging in production (keep behind __DEV__ flag)
- ❌ REMOVE: "Calculating results..." text overlay during reveal
- ❌ REMOVE: Version badge from main screens (keep only in Settings)

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat app/_layout.tsx
cat app/game.tsx
cat app/results.tsx
cat app/index.tsx
cat app/settings.tsx
cat components/DebugOverlay.tsx
```

═══════════════════════════════════════════════════════════
AGENT 1 — HIDE DEBUG OVERLAY IN PRODUCTION
═══════════════════════════════════════════════════════════

Debug overlay should ONLY show when enabled in Settings.
Default = OFF for testers.

```typescript
// In app/_layout.tsx:
// Change DebugOverlay to only render when enabled:
const [debugEnabled, setDebugEnabled] = useState(false);

// Load from AsyncStorage on mount:
useEffect(() => {
  AsyncStorage.getItem('debug_overlay_enabled').then(v => {
    if (v === 'true') setDebugEnabled(true);
  });
}, []);

// Only render if enabled:
{debugEnabled && <DebugOverlay />}
```

```typescript
// In app/settings.tsx — add toggle (hidden behind long press on version):
// Or add a simple toggle in dev section:
<View>
  <Text>Developer</Text>
  <Switch 
    value={debugEnabled} 
    onValueChange={(v) => {
      setDebugEnabled(v);
      AsyncStorage.setItem('debug_overlay_enabled', v ? 'true' : 'false');
    }}
  />
</View>
```

═══════════════════════════════════════════════════════════
AGENT 2 — HIDE DEBUG BUTTONS FROM SETTINGS
═══════════════════════════════════════════════════════════

Remove from Settings UI (keep the code — just don't render):

```typescript
// Hide:
// - "🐛 Run Debug Simulation" button
// - "🐛 Debug Marathon (10 hands)" button
// - Any debug-related UI

// Wrap in: {__DEV__ && ( ... )} or {debugEnabled && ( ... )}
```

═══════════════════════════════════════════════════════════
AGENT 3 — QUIET NUMBERED LOGGING
═══════════════════════════════════════════════════════════

The debugLog('1 handleReady') etc. — keep them but make silent in production:

```typescript
// In components/DebugOverlay.tsx:
export function debugLog(message: string, level: string = 'info') {
  // Only log to overlay if overlay is active:
  if (globalListener) {
    // ... existing overlay logic
  }
  
  // In production — only console.log (no overlay update):
  if (!__DEV__ && !globalListener) {
    // Silent — don't even console.log in production
    return;
  }
  
  console.log(`[DEBUG] ${message}`);
}
```

═══════════════════════════════════════════════════════════
AGENT 4 — RESTORE VISUAL POLISH (SAFE ONLY)
═══════════════════════════════════════════════════════════

### Results screen — currently fully static. Add MINIMAL polish:

**SAFE to add (zero Reanimated — pure React Native):**

```typescript
// 1. Stagger board results with LayoutAnimation (built-in RN, no Reanimated):
import { LayoutAnimation, UIManager, Platform } from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// On mount:
useEffect(() => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setShowContent(true);
}, []);

// 2. DEAL ME IN button — static gold border (no animation):
<Pressable style={[styles.dealMeIn, { borderColor: '#FFD700', borderWidth: 2 }]}>
  <Text style={styles.dealMeInText}>DEAL ME IN</Text>
</Pressable>

// 3. COMPLETE banner — just a gold View (no animation):
{isComplete && (
  <View style={styles.completeBanner}>
    <Text style={styles.completeText}>🏆 COMPLETE!</Text>
    <Text style={styles.bonusText}>+{bonusAmount} bonus chips</Text>
  </View>
)}

// 4. Net chips — show with color (green for +, red for -):
<Text style={[styles.netChips, { color: net >= 0 ? '#00ff88' : '#ff4444' }]}>
  {net >= 0 ? '+' : ''}{net} chips
</Text>
```

**DO NOT ADD:**
- ❌ No Reanimated import
- ❌ No useSharedValue
- ❌ No withTiming / withRepeat / withSequence
- ❌ No Animated.View
- ❌ No ConfettiCannon
- ❌ No entering= props

### Reveal — SafeRevealOverlay should look good:

Check that SafeRevealOverlay:
1. Shows each board result clearly
2. Has a nice background (dark overlay)
3. Shows winner per board with color (green WIN, red LOSE)
4. Shows hand name
5. Auto-advances at 1.2s per board
6. Has a SKIP button

### Home screen — verify it looks premium:
1. Card fan hero
2. Gold CAPS logo
3. Particle effects (if not using withRepeat(-1))
4. Buttons with glow
5. Pro quote

```bash
# Check home screen animations:
grep -n "withRepeat\|useSharedValue" app/index.tsx | head -10
```

If home screen has withRepeat(-1) → change to withRepeat(N) finite.

### Game screen — verify clean layout:
1. 4 boards visible, cards not overlapping
2. Timer visible and working
3. READY/UNDO buttons visible
4. YOUR HAND area clean
5. BOT header clean

═══════════════════════════════════════════════════════════
AGENT 5 — VERSION BADGE — SETTINGS ONLY
═══════════════════════════════════════════════════════════

VersionBadge should:
- Show in Settings screen (always)
- NOT show on home/game/results screens
- Format: `v1.9.4 (199)` — no OTA ID for testers (confusing)

```bash
grep -rn "VersionBadge\|versionBadge" app/ components/ | head -10
```

Move VersionBadge to Settings only. Remove from other screens.

═══════════════════════════════════════════════════════════
AGENT 6 — CLEANUP DEAD CODE
═══════════════════════════════════════════════════════════

Remove or comment out code that's no longer used:

```bash
echo "=== Unused imports ==="
grep -n "import.*FadeInDown\|import.*ConfettiCannon\|import.*CompleteOverlay" app/results.tsx app/game.tsx | head -10

echo ""
echo "=== KILL flags ==="
grep -rn "KILL_\|SAFE_MODE\|KILL =" app/ components/ utils/ | grep -v node_modules | head -10
```

Clean up:
1. Remove unused imports
2. Remove KILL_ flags (they were for debugging — keep the safe behavior, remove the flag check)
3. Remove commented-out code blocks that are clearly dead
4. Remove animationKill.ts if exists

═══════════════════════════════════════════════════════════
AGENT 7 — FINAL QA CHECKLIST
═══════════════════════════════════════════════════════════

Before deploying, verify:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Tests
npx jest --forceExit 2>&1 | tail -5

# 3. No withRepeat(-1) anywhere:
grep -rn "withRepeat(-1)" app/ components/ hooks/ utils/ | grep -v node_modules | grep -v __tests__
# Should return NOTHING

# 4. No debug overlay visible by default:
grep -n "DebugOverlay" app/_layout.tsx
# Should be behind a flag

# 5. No debug buttons in settings:
grep -n "Debug Marathon\|Debug Simulation\|autoSim" app/settings.tsx
# Should be behind __DEV__ or debugEnabled

# 6. No ConfettiCannon anywhere:
grep -rn "ConfettiCannon\|confetti-cannon" app/ components/ | grep -v node_modules
# Should return NOTHING (or only commented out)

# 7. Results has ZERO Reanimated:
grep -n "reanimated\|Animated\.\|useSharedValue" app/results.tsx
# Should return NOTHING

# 8. Web builds:
npx expo export --platform web --output-dir web-dist 2>&1 | tail -5
node scripts/fix-web-html.js
```

═══════════════════════════════════════════════════════════
DEPLOY — TESTER BUILD
═══════════════════════════════════════════════════════════

```bash
# 1. Deploy OTA:
eas update --branch production --message "release: tester-ready build — debug hidden, visual polish, crash-safe"

# 2. Commit and push (triggers build):
git add -A && git commit -m "release: tester-ready — hide debug overlay, restore polish, zero Reanimated on results, clean dead code"
git push origin main

# 3. Web:
# Vercel auto-deploys on push

# 4. Update MEMORY.md with tester-ready status
```

## REPORT
```
═══════════════════════════════════════
TESTER-READY — REPORT
═══════════════════════════════════════
Debug overlay: [hidden by default / toggle in Settings]
Debug buttons: [hidden / removed from UI]
Step logging: [silent in production]
VersionBadge: [Settings only]

Visual polish:
  Home: [looks premium / issues]
  Game: [cards OK / overlap / buttons visible]
  Reveal: [SafeRevealOverlay working / skippable]
  Results: [static but clean / issues]
  COMPLETE: [gold banner / hidden]
  DEAL ME IN: [static gold button]

Dead code removed:
  Unused imports: [N removed]
  KILL flags: [removed / kept]
  ConfettiCannon: [removed]
  Old CompleteOverlay: [removed]

Safety (hidden, still active):
  Dirty shutdown detector: ✅
  WhatsApp crash alerts: ✅
  Screen recorder: ✅
  cancelAnimation before navigate: ✅
  Zero withRepeat(-1): ✅
  Zero Reanimated on results: ✅

QA:
  withRepeat(-1) count: [0]
  TS errors: [0]
  Tests: [N]/[N]
  Web export: [OK]

OTA: [ID]
Build: [triggered]
═══════════════════════════════════════
```

## DO NOT
- Do NOT remove the crash safety features (just hide the UI)
- Do NOT add Reanimated back to results.tsx
- Do NOT add ConfettiCannon
- Do NOT add withRepeat(-1)
- Do NOT show debug overlay to testers by default
- Do NOT forget to clean unused imports

VAMOS CAPS TESTER-READY — END
