# VAMOS CAPS MEGA-DEBUG-SYSTEM
**Date:** 2026-03-22 21:07 IST
**Priority:** 🔴🔴🔴 Build the ULTIMATE debugging machine — no crash can hide

## WHAT WE'RE BUILDING

The most advanced mobile crash detection system ever:

```
┌─────────────────────────────────────────────────┐
│                  CAPS POKER                      │
│                                                  │
│   [Game screen with cards and boards]            │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │ 🐛 DEBUG (23)                          ▼ │   │
│   │ 20:31:22.005 🟡 READY pressed           │   │
│   │ 20:31:22.006 🟡 evaluateAllBoards START  │   │
│   │ 20:31:22.019 🟢 eval DONE               │   │
│   │ 20:31:22.020 🟡 setResults START         │   │
│   │ 20:31:22.021 🔴 CRASH: undefined map     │   │
│   │ 🎥 REC ● 00:47                          │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│   [ READY (0 left) ]                             │
└─────────────────────────────────────────────────┘
         │
         ▼ on crash or game end
   ┌─────────────────┐
   │ Auto-upload to   │
   │ Supabase Storage │
   │ + WhatsApp alert │
   └─────────────────┘
```

**5 components working together:**
1. **Debug Overlay** — green terminal on screen (already built)
2. **Screen Recorder** — records entire session via ReplayKit
3. **Auto-Sim** — plays hands automatically (already built)
4. **Auto-Upload** — crash video → Supabase Storage → URL
5. **WhatsApp Alert** — sends crash video link + last debug line

## FIRST ACTIONS
```
cd C:\Projects\Caps
Read MEMORY.md

# Check if expo-screen-recorder is compatible:
npm search expo-screen-recorder 2>&1 | head -5
npx expo install expo-screen-recorder 2>&1 | tail -10

# If expo-screen-recorder doesn't work with Expo SDK 55,
# check alternatives:
npm search react-native-screen-recorder 2>&1 | head -5
npm search react-native-replaykit 2>&1 | head -5
```

═══════════════════════════════════════════════════════════
AGENT 1 — SCREEN RECORDER: Install + Configure
═══════════════════════════════════════════════════════════

### 1A. Install expo-screen-recorder

```bash
npx expo install expo-screen-recorder
```

If it doesn't exist or isn't compatible, try:
```bash
npx expo install react-native-record-screen
# OR
npm install expo-screen-recorder --save
```

If NONE of these packages work with Expo SDK 55, use **react-native-view-shot** as fallback:
- Instead of video, capture screenshots every 500ms during reveal
- Stitch into a GIF or sequence
- Not as good as video but works without native modules

### 1B. Create the recording service

```typescript
// utils/screenRecorder.ts
import { Platform } from 'react-native';
import { debugLog } from '../components/DebugOverlay';

let ScreenRecorder: any = null;

// Lazy import — won't crash if package isn't available
try {
  if (Platform.OS === 'ios') {
    ScreenRecorder = require('expo-screen-recorder');
  }
} catch {
  debugLog('Screen recorder not available', 'warn');
}

// Alternative: react-native-record-screen
if (!ScreenRecorder) {
  try {
    ScreenRecorder = require('react-native-record-screen');
  } catch {}
}

let isRecording = false;
let recordingStartTime = 0;

export async function startRecording(): Promise<boolean> {
  if (!ScreenRecorder || isRecording) return false;
  
  try {
    debugLog('🎥 Screen recording START');
    
    if (ScreenRecorder.startRecording) {
      // expo-screen-recorder API:
      await ScreenRecorder.startRecording(false); // no mic
    } else if (ScreenRecorder.RecordScreen) {
      // react-native-record-screen API:
      await ScreenRecorder.RecordScreen.startRecording({ 
        mic: false,
        fps: 30,
        bitrate: 1024000,
      });
    }
    
    isRecording = true;
    recordingStartTime = Date.now();
    return true;
  } catch (e) {
    debugLog(`🎥 Record start failed: ${e}`, 'error');
    return false;
  }
}

export async function stopRecording(): Promise<string | null> {
  if (!ScreenRecorder || !isRecording) return null;
  
  try {
    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
    debugLog(`🎥 Screen recording STOP (${duration}s)`);
    
    let videoUri: string | null = null;
    
    if (ScreenRecorder.stopRecording) {
      // expo-screen-recorder:
      videoUri = await ScreenRecorder.stopRecording();
    } else if (ScreenRecorder.RecordScreen) {
      // react-native-record-screen:
      const result = await ScreenRecorder.RecordScreen.stopRecording();
      videoUri = result?.result?.outputURL;
    }
    
    isRecording = false;
    debugLog(`🎥 Recording saved: ${videoUri?.slice(-30)}`);
    return videoUri;
  } catch (e) {
    debugLog(`🎥 Record stop failed: ${e}`, 'error');
    isRecording = false;
    return null;
  }
}

export function isCurrentlyRecording(): boolean {
  return isRecording;
}

export function getRecordingDuration(): number {
  if (!isRecording) return 0;
  return Math.floor((Date.now() - recordingStartTime) / 1000);
}
```

═══════════════════════════════════════════════════════════
AGENT 2 — AUTO-UPLOAD: Video → Supabase Storage → URL
═══════════════════════════════════════════════════════════

### 2A. Create Supabase Storage bucket

```sql
-- Run via Supabase dashboard or migration:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('crash-recordings', 'crash-recordings', true)
ON CONFLICT DO NOTHING;

-- Allow anonymous uploads (for the app):
CREATE POLICY "anon_upload_crash" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'crash-recordings');

-- Allow public read:
CREATE POLICY "public_read_crash" ON storage.objects 
FOR SELECT USING (bucket_id = 'crash-recordings');
```

### 2B. Upload service

```typescript
// utils/crashUploader.ts
import * as FileSystem from 'expo-file-system';
import { debugLog } from '../components/DebugOverlay';
import { getSupabase } from './supabase';

export async function uploadCrashVideo(
  videoUri: string, 
  debugLogs: string[],
  metadata: {
    build: string;
    version: string;
    device: string;
    lastStep: string;
    crashError?: string;
  }
): Promise<string | null> {
  try {
    debugLog('📤 Uploading crash video...');
    
    const supabase = getSupabase();
    if (!supabase) {
      debugLog('📤 No Supabase — skip upload', 'warn');
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `crash-${timestamp}.mp4`;
    
    // Read video file as base64:
    const base64 = await FileSystem.readAsStringAsync(videoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to Uint8Array:
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Upload to Supabase Storage:
    const { data, error } = await supabase.storage
      .from('crash-recordings')
      .upload(fileName, bytes, {
        contentType: 'video/mp4',
        upsert: false,
      });
    
    if (error) {
      debugLog(`📤 Upload failed: ${error.message}`, 'error');
      return null;
    }
    
    // Get public URL:
    const { data: urlData } = supabase.storage
      .from('crash-recordings')
      .getPublicUrl(fileName);
    
    const publicUrl = urlData?.publicUrl;
    debugLog(`📤 Uploaded: ${publicUrl?.slice(-40)}`);
    
    // Also log crash metadata to bug_reports:
    await supabase.from('bug_reports').insert({
      description: `[CRASH-VIDEO] ${metadata.lastStep} | ${metadata.crashError ?? 'unknown'}`,
      severity: 'CRITICAL',
      screenshot_url: publicUrl,
      status: 'open',
      metadata: JSON.stringify({
        ...metadata,
        videoUrl: publicUrl,
        debugLogs: debugLogs.slice(-20), // last 20 logs
        timestamp: new Date().toISOString(),
      }),
    });
    
    debugLog('📤 Crash report saved to Supabase');
    return publicUrl;
  } catch (e) {
    debugLog(`📤 Upload crashed: ${e}`, 'error');
    return null;
  }
}
```

═══════════════════════════════════════════════════════════
AGENT 3 — WHATSAPP ALERT: Auto-notify on crash
═══════════════════════════════════════════════════════════

```typescript
// utils/crashAlert.ts
import { debugLog } from '../components/DebugOverlay';

export async function sendCrashAlert(
  videoUrl: string | null,
  lastDebugLine: string,
  metadata: Record<string, string>
): Promise<void> {
  try {
    const message = [
      '🔴 CAPS CRASH DETECTED',
      `Build: ${metadata.build}`,
      `Last step: ${lastDebugLine}`,
      videoUrl ? `Video: ${videoUrl}` : 'No video',
      `Time: ${new Date().toLocaleTimeString('he-IL')}`,
    ].join('\n');
    
    debugLog(`📱 Sending WhatsApp alert...`);
    
    // Call the WhatsApp bot handler to send notification:
    await fetch(
      'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crash_notification: true,
          message,
          videoUrl,
        }),
      }
    );
    
    debugLog('📱 WhatsApp alert sent');
  } catch (e) {
    debugLog(`📱 Alert failed: ${e}`, 'error');
  }
}
```

═══════════════════════════════════════════════════════════
AGENT 4 — CRASH DETECTOR: Tie everything together
═══════════════════════════════════════════════════════════

```typescript
// utils/crashDetector.ts
import { startRecording, stopRecording, isCurrentlyRecording } from './screenRecorder';
import { uploadCrashVideo } from './crashUploader';
import { sendCrashAlert } from './crashAlert';
import { debugLog, getGlobalLogs } from '../components/DebugOverlay';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const BUILD = Constants.expoConfig?.ios?.buildNumber ?? 'unknown';
const VERSION = Constants.expoConfig?.version ?? 'unknown';

// Auto-start recording when a game begins:
export async function onGameStart() {
  debugLog('🎮 Game started — starting crash detection');
  await startRecording();
}

// Auto-stop recording when game ends normally:
export async function onGameEnd() {
  debugLog('🎮 Game ended normally');
  const videoUri = await stopRecording();
  // Don't upload — game ended fine. Delete temp video.
  debugLog('🎮 Recording discarded (no crash)');
}

// Called by ErrorBoundary or when crash is detected:
export async function onCrashDetected(error?: Error) {
  const logs = getGlobalLogs();
  const lastLine = logs[logs.length - 1]?.message ?? 'unknown';
  
  debugLog(`💀 CRASH DETECTED: ${error?.message ?? 'unknown'}`, 'error');
  
  // Stop recording and get video:
  let videoUri: string | null = null;
  if (isCurrentlyRecording()) {
    videoUri = await stopRecording();
  }
  
  // Upload video + metadata:
  let videoUrl: string | null = null;
  if (videoUri) {
    videoUrl = await uploadCrashVideo(videoUri, logs.map(l => l.message), {
      build: BUILD,
      version: VERSION,
      device: `${Device.modelName} (${Device.osVersion})`,
      lastStep: lastLine,
      crashError: error?.message,
    });
  }
  
  // Send WhatsApp alert:
  await sendCrashAlert(videoUrl, lastLine, {
    build: BUILD,
    version: VERSION,
  });
}
```

═══════════════════════════════════════════════════════════
AGENT 5 — WIRE INTO THE APP
═══════════════════════════════════════════════════════════

### 5A. Update ErrorBoundary to trigger crash detection

```typescript
// In components/ErrorBoundary.tsx:
import { onCrashDetected } from '../utils/crashDetector';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Trigger full crash detection pipeline:
    onCrashDetected(error);
  }
  // ... rest of ErrorBoundary
}
```

### 5B. Start recording on game start

```typescript
// In app/game.tsx:
import { onGameStart, onGameEnd } from '../utils/crashDetector';
import { debugLog } from '../components/DebugOverlay';

// On mount:
useEffect(() => {
  debugLog('game.tsx mounted');
  onGameStart(); // 🎥 starts screen recording
  
  return () => {
    debugLog('game.tsx unmounting');
    onGameEnd(); // 🎥 stops recording (no crash = discard)
  };
}, []);
```

### 5C. Catch native crashes with global error handler

```typescript
// In app/_layout.tsx — add global error handlers:
import { onCrashDetected } from '../utils/crashDetector';

// Catch unhandled JS errors:
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler(async (error, isFatal) => {
  if (isFatal) {
    await onCrashDetected(error);
  }
  originalHandler(error, isFatal);
});

// Catch unhandled promise rejections:
const rejectionTracking = require('promise/setimmediate/rejection-tracking');
rejectionTracking.enable({
  allRejections: true,
  onUnhandled: (id: number, error: Error) => {
    onCrashDetected(error);
  },
});
```

### 5D. Update Debug Overlay with recording indicator

```typescript
// In components/DebugOverlay.tsx — add recording status:
import { isCurrentlyRecording, getRecordingDuration } from '../utils/screenRecorder';

// In the header:
<View style={styles.header}>
  <Text style={styles.headerText}>🐛 DEBUG ({logs.length})</Text>
  {isCurrentlyRecording() && (
    <Text style={styles.recIndicator}>🎥 REC ● {getRecordingDuration()}s</Text>
  )}
  <TouchableOpacity onPress={() => setMinimized(true)}>
    <Text style={styles.minimizeBtn}>▼</Text>
  </TouchableOpacity>
</View>

// Update every second to show duration:
useEffect(() => {
  const interval = setInterval(() => {
    if (isCurrentlyRecording()) {
      setLogs(prev => [...prev]); // force re-render to update duration
    }
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

### 5E. Export getGlobalLogs from DebugOverlay

```typescript
// In components/DebugOverlay.tsx — add export:
export function getGlobalLogs(): LogEntry[] {
  return [...globalLogs];
}
```

═══════════════════════════════════════════════════════════
AGENT 6 — AUTO-SIM UPGRADE: Continuous crash hunting
═══════════════════════════════════════════════════════════

Upgrade the auto-sim to run MULTIPLE hands automatically:

```typescript
// In app/game.tsx — upgrade autoSim:

useEffect(() => {
  if (autoSim === 'true') {
    const simCount = parseInt(autoSimCount ?? '1');
    debugLog(`🤖 AUTO-SIM: starting hand ${currentSimHand}/${simCount}`);
    
    // Auto-fill all boards:
    setTimeout(() => {
      boards.forEach((_, i) => {
        debugLog(`🤖 AUTO-SIM: auto-fill board ${i}`);
        handleAutoFill(i);
      });
    }, 1500);
    
    // Auto-press Ready:
    setTimeout(() => {
      debugLog('🤖 AUTO-SIM: pressing Ready');
      handleReady();
    }, 3000);
  }
}, [autoSim]);
```

Settings button upgrade:
```typescript
// In app/settings.tsx:
<TouchableOpacity onPress={() => {
  debugLog('🤖 Starting 10-hand auto-sim marathon');
  router.push('/game?autoSim=true&autoSimCount=10');
}}>
  <Text>🐛 Run 10-Hand Debug Marathon</Text>
</TouchableOpacity>
```

On results screen — auto-replay if simCount > 1:
```typescript
// In app/results.tsx:
const { autoSim, autoSimCount, currentSimHand } = useLocalSearchParams();

useEffect(() => {
  if (autoSim === 'true') {
    const count = parseInt(autoSimCount ?? '1');
    const current = parseInt(currentSimHand ?? '1');
    
    if (current < count) {
      debugLog(`🤖 AUTO-SIM: hand ${current}/${count} done — starting next in 2s`);
      setTimeout(() => {
        router.replace(`/game?autoSim=true&autoSimCount=${count}&currentSimHand=${current + 1}`);
      }, 2000);
    } else {
      debugLog(`🤖 AUTO-SIM: ${count} hands complete — NO CRASH! 🎉`);
    }
  }
}, []);
```

═══════════════════════════════════════════════════════════
AGENT 7 — SUPABASE: Storage bucket + WhatsApp handler update
═══════════════════════════════════════════════════════════

### 7A. Create storage bucket
```bash
# Create migration:
cat > supabase/migrations/crash_recordings_bucket.sql << 'EOF'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('crash-recordings', 'crash-recordings', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "anon_upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'crash-recordings');

CREATE POLICY "public_read" ON storage.objects 
FOR SELECT USING (bucket_id = 'crash-recordings');
EOF

npx supabase db push 2>&1 || echo "Run migration manually in Supabase dashboard"
```

### 7B. Update WhatsApp handler to support crash notifications

In `supabase/functions/whatsapp-bot-handler/index.ts`, add:
```typescript
// Handle crash notifications:
if (body?.crash_notification) {
  const message = body.message;
  const videoUrl = body.videoUrl;
  
  // Send to Roye's WhatsApp:
  await sendWhatsAppMessage(
    ROYE_PHONE, // configured in env
    `${message}\n${videoUrl ? `\n🎥 Video: ${videoUrl}` : ''}`
  );
  
  return new Response(JSON.stringify({ sent: true }), { status: 200 });
}
```

═══════════════════════════════════════════════════════════
AGENT 8 — DASHBOARD: Crash Videos Tab
═══════════════════════════════════════════════════════════

Add a "Crash Videos" tab to `web-dashboard/index.html`:

```javascript
// In the dashboard — new tab:
function renderCrashVideos(reports) {
  const crashes = reports.filter(r => r.description?.includes('[CRASH-VIDEO]'));
  
  return crashes.map(crash => {
    const meta = JSON.parse(crash.metadata || '{}');
    return `
      <div class="crash-card">
        <div class="crash-header">
          <span class="crash-time">${new Date(crash.created_at).toLocaleString('he-IL')}</span>
          <span class="crash-build">Build ${meta.build}</span>
          <span class="crash-device">${meta.device}</span>
        </div>
        <div class="crash-step">Last step: ${meta.lastStep}</div>
        <div class="crash-error">${meta.crashError ?? 'unknown'}</div>
        ${meta.videoUrl ? `
          <video controls width="300" style="border-radius: 8px; margin-top: 8px;">
            <source src="${meta.videoUrl}" type="video/mp4">
          </video>
          <a href="${meta.videoUrl}" target="_blank" class="video-link">🎥 Open Full Video</a>
        ` : '<span class="no-video">No video</span>'}
        <div class="crash-logs">
          <details>
            <summary>Debug Logs (${meta.debugLogs?.length ?? 0})</summary>
            <pre>${(meta.debugLogs ?? []).join('\n')}</pre>
          </details>
        </div>
      </div>
    `;
  }).join('');
}
```

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

# OTA:
eas update --branch production --message "feat: MEGA debug — screen recording + auto-upload + WhatsApp crash alerts"

# Build + push:
git add -A && git commit -m "feat: MEGA debug system — screen recorder + crash detector + auto-upload + WhatsApp alerts + crash videos dashboard"
git push origin main
```

═══════════════════════════════════════════════════════════
HOW IT WORKS — END TO END
═══════════════════════════════════════════════════════════

```
1. Player opens CAPS
   └→ Debug overlay appears (green terminal)

2. Player starts a game (or Auto-Sim from Settings)
   └→ 🎥 Screen recording starts automatically
   └→ Debug logs appear on screen in real-time

3. Player plays hand → presses Ready
   └→ debugLog: "🟡 READY pressed"
   └→ debugLog: "🟡 evaluateAllBoards START"
   └→ debugLog: "🟢 evaluateAllBoards DONE"
   └→ debugLog: "🟡 router.replace(/results)"

4a. Game completes normally → Results screen
   └→ 🎥 Recording stops, video DISCARDED (no crash)
   └→ If Auto-Sim: auto-starts next hand

4b. 💥 CRASH
   └→ ErrorBoundary / global handler catches it
   └→ 🎥 Recording STOPS
   └→ 📤 Video uploaded to Supabase Storage
   └→ 📝 Crash report saved with video URL + debug logs
   └→ 📱 WhatsApp: "🔴 CAPS CRASH — Last step: setResults | Video: https://..."
   └→ 🖥️ Dashboard: crash video playable in "Crash Videos" tab
```

**Roye opens WhatsApp → sees crash alert with video link → opens video → 
sees exact screen + debug overlay showing the last line before crash.**

**No guessing. No Xcode. No "reproduce it". It's all on video.**

═══════════════════════════════════════════════════════════
REPORT
═══════════════════════════════════════════════════════════

```
═══════════════════════════════════════
MEGA DEBUG SYSTEM — REPORT
═══════════════════════════════════════
Screen Recorder:
  Package installed: [expo-screen-recorder / react-native-record-screen / fallback]
  startRecording works: [YES/NO]
  stopRecording returns video: [YES/NO]

Auto-Upload:
  Supabase Storage bucket: [created / already exists]
  Upload function works: [YES/NO]
  Public URL works: [YES/NO]

WhatsApp Alert:
  Handler updated: [YES/NO]
  Test notification sent: [YES/NO]

Crash Detector:
  ErrorBoundary wired: [YES/NO]
  Global error handler: [YES/NO]
  Promise rejection handler: [YES/NO]
  onGameStart/End wired: [YES/NO]

Debug Overlay:
  Recording indicator: [YES/NO]
  getGlobalLogs exported: [YES/NO]

Auto-Sim Upgrade:
  10-hand marathon: [YES/NO]
  Auto-replay on results: [YES/NO]

Dashboard:
  Crash Videos tab: [YES/NO]
  Video player embedded: [YES/NO]

OTA: [ID]
Build: [triggered]
Tests: [N]/[N]
═══════════════════════════════════════
```

## DO NOT
- Do NOT make screen recording blocking — it must run in background
- Do NOT crash because of the debug system (try-catch EVERYTHING)
- Do NOT record audio (privacy)
- Do NOT upload if no crash (waste of storage)
- Do NOT forget the 10-hand marathon auto-sim
- Do NOT block the UI with upload — fire and forget

## THIS IS A GEM — Save for all projects
After building: copy utils/screenRecorder.ts, utils/crashDetector.ts, 
utils/crashUploader.ts, utils/crashAlert.ts, components/DebugOverlay.tsx
to C:\Projects\docs\DEBUG_SYSTEM_GEM\

VAMOS CAPS MEGA-DEBUG-SYSTEM — END
