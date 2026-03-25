# VAMOS CAPS FIX-SCREEN-RECORDER
**Date:** 2026-03-23 07:30 IST
**Priority:** 🟡 Screen recorder shows "no package available" — install and make it work

## PROBLEM
Debug overlay shows: `screenRecorder: no package available — video disabled`
We need a working screen recorder for automated crash video capture.

## FIRST — Check what was tried
```
cd C:\Projects\Caps

echo "=== Current packages ==="
grep -i "screen.*record\|record.*screen\|replaykit" package.json

echo ""
echo "=== What's in screenRecorder.ts ==="
cat utils/screenRecorder.ts

echo ""
echo "=== Available packages ==="
npm search expo-screen-recorder 2>&1 | head -5
npm search react-native-record-screen 2>&1 | head -5
npm search @birdwingo/react-native-replaykit 2>&1 | head -5
npm search react-native-screen-capture 2>&1 | head -5
```

## TRY EACH PACKAGE — in order of compatibility

### Option 1: react-native-record-screen (most popular)
```bash
npx expo install react-native-record-screen 2>&1 | tail -10
# If not expo-compatible:
npm install react-native-record-screen --save 2>&1 | tail -10
```

### Option 2: expo-screen-recorder
```bash
npx expo install expo-screen-recorder 2>&1 | tail -10
```

### Option 3: @birdwingo/react-native-replaykit
```bash
npm install @birdwingo/react-native-replaykit --save 2>&1 | tail -10
```

### Option 4: react-native-replaykit (iOS only, native module)
```bash
npm install react-native-replaykit --save 2>&1 | tail -10
```

## After installing — update screenRecorder.ts

```typescript
// utils/screenRecorder.ts
import { Platform } from 'react-native';
import { debugLog } from '../components/DebugOverlay';

let RecordScreen: any = null;
let packageName = 'none';

// Try each package in order:
try {
  RecordScreen = require('react-native-record-screen').default ?? require('react-native-record-screen');
  packageName = 'react-native-record-screen';
} catch {}

if (!RecordScreen) {
  try {
    RecordScreen = require('expo-screen-recorder');
    packageName = 'expo-screen-recorder';
  } catch {}
}

if (!RecordScreen) {
  try {
    RecordScreen = require('@birdwingo/react-native-replaykit');
    packageName = '@birdwingo/react-native-replaykit';
  } catch {}
}

debugLog(RecordScreen 
  ? `screenRecorder: ${packageName} loaded ✅` 
  : 'screenRecorder: no package available — video disabled', 
  RecordScreen ? 'info' : 'warn'
);

export async function startRecording(): Promise<boolean> {
  if (!RecordScreen) return false;
  try {
    debugLog('🎥 Recording START');
    
    // react-native-record-screen API:
    if (RecordScreen.startRecording) {
      await RecordScreen.startRecording({ mic: false });
    }
    // expo-screen-recorder API:
    else if (RecordScreen.default?.startRecording) {
      await RecordScreen.default.startRecording(false);
    }
    
    return true;
  } catch (e) {
    debugLog(`🎥 Start failed: ${e}`, 'error');
    return false;
  }
}

export async function stopRecording(): Promise<string | null> {
  if (!RecordScreen) return null;
  try {
    debugLog('🎥 Recording STOP');
    
    // react-native-record-screen:
    if (RecordScreen.stopRecording) {
      const result = await RecordScreen.stopRecording();
      return result?.result?.outputURL ?? result?.outputURL ?? null;
    }
    // expo-screen-recorder:
    if (RecordScreen.default?.stopRecording) {
      return await RecordScreen.default.stopRecording();
    }
    
    return null;
  } catch (e) {
    debugLog(`🎥 Stop failed: ${e}`, 'error');
    return null;
  }
}
```

## IMPORTANT — Check Expo compatibility

Some packages need native modules that don't work with Expo managed workflow.
```bash
# Check if package needs custom native code:
npx expo config --type prebuild 2>&1 | grep -i "record\|replay" | head -5

# If it needs native: check if there's a config plugin:
grep -r "plugin" node_modules/react-native-record-screen/app.plugin.js 2>/dev/null
grep -r "plugin" node_modules/expo-screen-recorder/app.plugin.js 2>/dev/null
```

If package needs native and has a config plugin → add to app.json plugins.
If package needs native and has NO config plugin → WON'T WORK with EAS managed build.

**In that case:** use `react-native-view-shot` as fallback (screenshot every 500ms → GIF):
```bash
# view-shot is already installed (we use it for share cards):
grep "view-shot" package.json
```

```typescript
// Fallback: capture screenshots every 500ms
import { captureRef } from 'react-native-view-shot';

let screenshotInterval: NodeJS.Timeout | null = null;
let screenshots: string[] = [];

export async function startRecording(): Promise<boolean> {
  screenshots = [];
  screenshotInterval = setInterval(async () => {
    try {
      // Capture the root view:
      const uri = await captureRef(rootViewRef, { format: 'jpg', quality: 0.5 });
      screenshots.push(uri);
      if (screenshots.length > 60) screenshots.shift(); // keep last 30 seconds at 2fps
    } catch {}
  }, 500);
  return true;
}

export async function stopRecording(): Promise<string | null> {
  if (screenshotInterval) clearInterval(screenshotInterval);
  // Return the last screenshot as "video" (or create a contact sheet):
  return screenshots[screenshots.length - 1] ?? null;
}
```

## DEPLOY
```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5
eas update --branch production --message "fix: screen recorder package installed"
git add -A && git commit -m "fix: install screen recorder package for crash video capture"
git push origin main
```

## REPORT
```
Package installed: [name / none worked]
Screen recorder working: [YES / NO — fallback to view-shot]
Debug overlay shows: [message]
OTA: [ID]
```

## DO NOT
- Do NOT crash the app if package fails to load — graceful fallback
- Do NOT add native modules without config plugins (breaks EAS managed)
- Do NOT forget the numbered debug logging from previous VAMOS

VAMOS CAPS FIX-SCREEN-RECORDER — END
