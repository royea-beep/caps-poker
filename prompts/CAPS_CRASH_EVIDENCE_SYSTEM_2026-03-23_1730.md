# CAPS — AUTO-DEBUG: ADD CRASH EVIDENCE (SCREENSHOTS + VIDEO)
**Date:** 2026-03-23 | **Time:** 17:30 IST
**Session:** Fix: WhatsApp alert has no crash report → bot can't fix
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** c18b7f3

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## PROBLEM

Auto-debug WhatsApp alert fires on crash ✅ but the MESSAGE has no useful data:
- No screenshot of what was on screen when it crashed
- No video recording of the steps before the crash
- No numbered log of which screen/action was last
- Bot receives "fix this" but has NOTHING to look at → "אין דוח קריסה"

The alert is useless without EVIDENCE.

---

## SOLUTION

**Continuous screenshot buffer** — save a screenshot after EVERY step, EVERY screen
change, and EVERY user action. When a crash happens, the last N screenshots + the
full step log are ALREADY SAVED and get attached to the WhatsApp alert.

Think of it like a dashcam — always recording, and when there's a crash,
the last 30 seconds are saved automatically.

---

## TASK

### STEP 0 — READ CURRENT SYSTEM

```bash
cd /c/Projects/Caps

echo "=== Current auto-debug ==="
cat lib/auto-debug.ts 2>/dev/null || find . -name "auto-debug*" | grep -v node_modules | head -1 | xargs cat
cat lib/debug-suite.ts 2>/dev/null || find . -name "debug-suite*" | grep -v node_modules | head -1 | xargs cat

echo "=== Current WhatsApp send ==="
grep -rn "sendDebug\|whatsapp\|WhatsApp" lib/ --include="*.ts" | head -10
cat lib/debug-whatsapp.ts 2>/dev/null || grep -A 30 "sendDebug" lib/auto-debug.ts 2>/dev/null

echo "=== Supabase Storage buckets ==="
grep -rn "storage\|bucket\|upload" lib/ --include="*.ts" | grep -v node_modules | head -10

echo "=== Screenshot capability ==="
grep -rn "captureScreen\|captureRef\|view-shot\|screenshot\|Screenshot" . --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
cat package.json | grep "view-shot\|screenshot\|capture" | head -5

echo "=== BugReporter (has screenshot code) ==="
find . -name "BugReporter*" | grep -v node_modules | head -3
cat $(find . -name "BugReporter*" | grep -v node_modules | head -1) 2>/dev/null | grep -A 10 "capture\|screenshot\|Screen"

echo "=== Supabase config ==="
grep "SUPABASE_URL\|SUPABASE_ANON" .env.local 2>/dev/null | head -3

echo "=== Debug screen ==="
cat app/debug.tsx 2>/dev/null | head -80
```

### STEP 1 — BUILD THE CRASH EVIDENCE SYSTEM

Create `lib/crash-evidence.ts`:

```typescript
import { captureScreen } from 'react-native-view-shot'
// OR if captureScreen not available:
// import ViewShot from 'react-native-view-shot'
import { supabase } from './supabase' // use existing client
import { Platform } from 'react-native'

// ─── Types ──────────────────────────────────────────

export interface ScreenFrame {
  id: number
  timestamp: string
  stepId?: number
  stepName?: string
  screen?: string           // current route/screen name
  action?: string           // what user did: "tap_deal", "navigate_home"
  base64: string            // screenshot as base64 PNG
}

export interface CrashReport {
  project: string
  version: string
  timestamp: string
  device: {
    platform: string
    model?: string
    os?: string
  }
  // The evidence:
  frames: ScreenFrame[]       // last N screenshots (dashcam buffer)
  stepLog: StepLogEntry[]     // numbered log of everything that happened
  lastScreen: string          // which screen was active
  lastAction: string          // what was the last user action
  error: {
    message: string
    stack?: string
    componentStack?: string   // React error boundary
  }
  consoleErrors: string[]     // captured console.error calls
  // Generated:
  storageUrls: string[]       // uploaded screenshot URLs
  videoUrl?: string           // stitched video URL (if possible)
  fixPrompt: string           // ready-to-paste prompt for Claude Bot
}

export interface StepLogEntry {
  id: number
  timestamp: string
  type: 'screen_change' | 'user_action' | 'debug_step' | 'error' | 'network' | 'lifecycle'
  description: string
  data?: any
}

// ─── The Dashcam (Screenshot Buffer) ────────────────

const MAX_FRAMES = 20  // keep last 20 screenshots
const FRAME_INTERVAL = 3000  // auto-capture every 3 seconds

let frameBuffer: ScreenFrame[] = []
let stepLog: StepLogEntry[] = []
let frameCounter = 0
let stepCounter = 0
let captureInterval: ReturnType<typeof setInterval> | null = null
let consoleErrors: string[] = []
let currentScreen = 'unknown'
let lastAction = 'none'
let isRecording = false

// Start the dashcam — call this on app launch
export function startCrashRecording() {
  if (isRecording) return
  isRecording = true
  
  // Capture console errors
  const origError = console.error
  console.error = (...args: any[]) => {
    consoleErrors.push(`[${new Date().toISOString()}] ${args.map(String).join(' ')}`)
    if (consoleErrors.length > 50) consoleErrors.shift()
    origError.apply(console, args)
  }
  
  // Auto-capture screenshots every 3 seconds
  captureInterval = setInterval(async () => {
    await captureFrame('auto', undefined, currentScreen)
  }, FRAME_INTERVAL)
  
  logStep('lifecycle', 'Crash recording started')
}

export function stopCrashRecording() {
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
  isRecording = false
}

// ─── Capture a Frame ────────────────────────────────

async function captureFrame(
  action: string,
  stepId?: number,
  screen?: string
): Promise<void> {
  try {
    const base64 = await captureScreen({
      format: 'jpg',
      quality: 0.5,     // low quality = small size = fast upload
      result: 'base64',
    })
    
    frameCounter++
    const frame: ScreenFrame = {
      id: frameCounter,
      timestamp: new Date().toISOString(),
      stepId,
      stepName: action,
      screen: screen || currentScreen,
      action,
      base64,
    }
    
    frameBuffer.push(frame)
    
    // Rolling buffer — keep only last N
    if (frameBuffer.length > MAX_FRAMES) {
      frameBuffer.shift()
    }
  } catch (e) {
    // Silent fail — don't crash the app because of debug
    console.warn('[CrashEvidence] Frame capture failed:', e)
  }
}

// ─── Log a Step ─────────────────────────────────────

export function logStep(
  type: StepLogEntry['type'],
  description: string,
  data?: any
) {
  stepCounter++
  stepLog.push({
    id: stepCounter,
    timestamp: new Date().toISOString(),
    type,
    description,
    data,
  })
  
  // Keep last 100 steps
  if (stepLog.length > 100) stepLog.shift()
}

// ─── Track Screen Changes ───────────────────────────

export function setCurrentScreen(screen: string) {
  if (screen !== currentScreen) {
    currentScreen = screen
    logStep('screen_change', `Navigated to: ${screen}`)
    // Capture screenshot on every screen change
    captureFrame(`screen:${screen}`, undefined, screen)
  }
}

// ─── Track User Actions ─────────────────────────────

export function trackAction(action: string, data?: any) {
  lastAction = action
  logStep('user_action', action, data)
  // Capture screenshot on significant actions
  captureFrame(`action:${action}`)
}

// ─── Generate Crash Report ──────────────────────────

export async function generateCrashReport(error: {
  message: string
  stack?: string
  componentStack?: string
}): Promise<CrashReport> {
  // Take one final screenshot of the crash state
  await captureFrame('CRASH_STATE').catch(() => {})
  
  const report: CrashReport = {
    project: 'Caps',
    version: require('../../package.json').version || '1.0.0',
    timestamp: new Date().toISOString(),
    device: {
      platform: Platform.OS,
      os: Platform.Version?.toString(),
    },
    frames: [...frameBuffer],     // copy of the dashcam buffer
    stepLog: [...stepLog],        // full step log
    lastScreen: currentScreen,
    lastAction,
    error,
    consoleErrors: [...consoleErrors],
    storageUrls: [],
    fixPrompt: '',
  }
  
  // Upload screenshots to Supabase Storage
  report.storageUrls = await uploadFrames(report.frames)
  
  // Generate fix prompt with FULL evidence
  report.fixPrompt = generateFixPrompt(report)
  
  return report
}

// ─── Upload Frames to Supabase Storage ──────────────

async function uploadFrames(frames: ScreenFrame[]): Promise<string[]> {
  const urls: string[] = []
  const bucket = 'debug-screenshots' // create if not exists
  
  // Upload only the last 5 frames (most relevant to crash)
  const relevantFrames = frames.slice(-5)
  
  for (const frame of relevantFrames) {
    try {
      const filename = `caps/crash-${Date.now()}-frame-${frame.id}.jpg`
      const base64Data = frame.base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filename, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      
      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filename)
        urls.push(urlData.publicUrl)
      }
    } catch (e) {
      console.warn('[CrashEvidence] Upload failed for frame', frame.id, e)
    }
  }
  
  return urls
}

// ─── Generate Fix Prompt with FULL Evidence ─────────

function generateFixPrompt(report: CrashReport): string {
  const stepHistory = report.stepLog
    .slice(-20) // last 20 steps
    .map(s => `  [${s.id}] ${s.timestamp.slice(11, 19)} ${s.type}: ${s.description}`)
    .join('\n')
  
  const frameList = report.storageUrls.length > 0
    ? report.storageUrls.map((url, i) => `  Frame ${i + 1}: ${url}`).join('\n')
    : '  (no screenshots uploaded)'
  
  const consoleList = report.consoleErrors.length > 0
    ? report.consoleErrors.slice(-10).join('\n  ')
    : '  none'

  return `## CRASH REPORT: ${report.project} v${report.version}
## Generated: ${report.timestamp}

Yes, allow all edits in components
Project: /c/Projects/${report.project}

## CRASH DETAILS
Error: ${report.error.message}
Stack: ${report.error.stack || 'N/A'}
Last screen: ${report.lastScreen}
Last action: ${report.lastAction}
Platform: ${report.device.platform} ${report.device.os || ''}

## STEP-BY-STEP LOG (last 20 actions before crash):
${stepHistory}

## SCREENSHOTS (last 5 frames before crash):
${frameList}

## CONSOLE ERRORS:
  ${consoleList}

## TASK
1. Look at the screenshots — they show EXACTLY what was on screen before the crash
2. Read the step log — it shows the EXACT sequence of actions
3. The crash happened at step [${report.stepLog.length}] on screen "${report.lastScreen}"
4. Read the error stack trace above
5. Find the bug in the code
6. Fix it
7. Build clean + commit + push

## DEFINITION OF DONE
- App doesn't crash on the same action sequence
- Build clean
- Push to main → EAS auto-builds`
}
```

### STEP 2 — CREATE STORAGE BUCKET

```bash
echo "=== Check if debug-screenshots bucket exists ==="
grep -rn "debug-screenshot\|bug-report\|storage.*bucket" . --include="*.ts" | grep -v node_modules | head -10
```

Create bucket via Supabase API or code:
```typescript
// Add to app init or to the crash-evidence module:
async function ensureBucket() {
  const { data } = await supabase.storage.getBucket('debug-screenshots')
  if (!data) {
    await supabase.storage.createBucket('debug-screenshots', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
    })
  }
}
```

Or apply via SQL:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('debug-screenshots', 'debug-screenshots', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow anon upload (for debug)
CREATE POLICY "anon upload debug" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'debug-screenshots');

CREATE POLICY "public read debug" ON storage.objects
  FOR SELECT USING (bucket_id = 'debug-screenshots');
```

### STEP 3 — WIRE INTO APP ROOT (Error Boundary + Navigation)

Update `app/_layout.tsx`:

```bash
cat app/_layout.tsx
```

Add:

```typescript
import { startCrashRecording, setCurrentScreen, trackAction, generateCrashReport } from '@/lib/crash-evidence'
import { sendCrashToWhatsApp } from '@/lib/debug-whatsapp'

// Start recording on app launch
useEffect(() => {
  if (__DEV__) {
    startCrashRecording()
  }
}, [])

// Track screen changes (if using React Navigation)
// Find the NavigationContainer and add:
// onStateChange={(state) => {
//   const route = state?.routes?.[state.index]?.name
//   if (route) setCurrentScreen(route)
// }}
```

### STEP 4 — ERROR BOUNDARY THAT CAPTURES EVIDENCE

Create `components/CrashBoundary.tsx`:

```typescript
import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { generateCrashReport } from '@/lib/crash-evidence'
import { sendCrashToWhatsApp } from '@/lib/debug-whatsapp'
import * as Clipboard from 'expo-clipboard'

interface State {
  hasError: boolean
  report: any
  sending: boolean
}

export class CrashBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, report: null, sending: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Generate full crash report with ALL evidence
    const report = await generateCrashReport({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack || undefined,
    })

    this.setState({ report })

    // Auto-send to WhatsApp with evidence
    try {
      this.setState({ sending: true })
      await sendCrashToWhatsApp(report)
      this.setState({ sending: false })
    } catch (e) {
      console.warn('WhatsApp send failed:', e)
      this.setState({ sending: false })
    }
  }

  render() {
    if (this.state.hasError) {
      const { report, sending } = this.state
      return (
        <View style={{ flex: 1, backgroundColor: '#1a0000', padding: 20, justifyContent: 'center' }}>
          <Text style={{ color: '#ff4444', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
            💥 Crash Detected
          </Text>
          <Text style={{ color: '#ff8888', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            {report?.error?.message || 'Unknown error'}
          </Text>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            Screen: {report?.lastScreen} | Action: {report?.lastAction}
          </Text>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            {report?.frames?.length || 0} screenshots captured | {report?.stepLog?.length || 0} steps logged
          </Text>
          
          {/* Screenshots uploaded indicator */}
          <Text style={{ color: sending ? '#ffaa00' : '#44ff44', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            {sending ? '📤 Sending crash report to WhatsApp...' : 
             report?.storageUrls?.length > 0 ? `✅ ${report.storageUrls.length} screenshots uploaded + WhatsApp sent` :
             '⏳ Uploading evidence...'}
          </Text>

          {/* Copy fix prompt */}
          {report?.fixPrompt && (
            <TouchableOpacity 
              onPress={() => Clipboard.setStringAsync(report.fixPrompt)}
              style={{ backgroundColor: '#2563eb', padding: 16, borderRadius: 12, marginTop: 20, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                📋 Copy Fix Prompt for Claude Bot
              </Text>
            </TouchableOpacity>
          )}

          {/* Screenshot URLs */}
          {report?.storageUrls?.length > 0 && (
            <ScrollView style={{ marginTop: 12, maxHeight: 100 }}>
              {report.storageUrls.map((url: string, i: number) => (
                <Text key={i} style={{ color: '#4488ff', fontSize: 10, marginTop: 2 }}>
                  📸 Frame {i + 1}: {url}
                </Text>
              ))}
            </ScrollView>
          )}

          {/* Restart */}
          <TouchableOpacity 
            onPress={() => this.setState({ hasError: false, report: null })}
            style={{ backgroundColor: '#333', padding: 14, borderRadius: 12, marginTop: 12, alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontSize: 14 }}>🔄 Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}
```

Wrap the app in `_layout.tsx`:
```tsx
<CrashBoundary>
  {/* existing app content */}
</CrashBoundary>
```

### STEP 5 — UPDATE WHATSAPP SENDER WITH EVIDENCE

Update `lib/debug-whatsapp.ts` (or wherever WhatsApp sends):

```typescript
export async function sendCrashToWhatsApp(report: CrashReport) {
  const screenshotLinks = report.storageUrls.length > 0
    ? report.storageUrls.map((url, i) => `📸 Frame ${i + 1}: ${url}`).join('\n')
    : '(no screenshots)'
  
  const lastSteps = report.stepLog
    .slice(-5)
    .map(s => `  ${s.id}. ${s.description}`)
    .join('\n')

  const message = [
    `💥 *CRASH: ${report.project} v${report.version}*`,
    ``,
    `❌ *Error:* ${report.error.message}`,
    `📍 *Screen:* ${report.lastScreen}`,
    `🎯 *Last action:* ${report.lastAction}`,
    `📱 *Device:* ${report.device.platform} ${report.device.os || ''}`,
    ``,
    `📋 *Last 5 steps before crash:*`,
    lastSteps,
    ``,
    `📸 *Screenshots (${report.storageUrls.length}):*`,
    screenshotLinks,
    ``,
    `📊 *Evidence:* ${report.frames.length} frames | ${report.stepLog.length} steps | ${report.consoleErrors.length} errors`,
    ``,
    `🔧 *Fix prompt ready* — copy from crash screen in app`,
  ].join('\n')

  // Use existing WhatsApp Edge Function
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

  await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-bot-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      type: 'crash_report',
      message,
      project: report.project,
      error: report.error.message,
      screen: report.lastScreen,
      screenshots: report.storageUrls,
      fixPrompt: report.fixPrompt,
    }),
  })
}
```

### STEP 6 — UPDATE WHATSAPP EDGE FUNCTION TO HANDLE CRASH REPORTS

```bash
echo "=== Read current Edge Function ==="
find supabase -name "*whatsapp*" 2>/dev/null | head -3
cat $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) 2>/dev/null
```

If the Edge Function only handles GET (webhook verification) and simple POST:
Add handling for `type: 'crash_report'` that includes screenshot URLs in the message.

### STEP 7 — ALSO SAVE CRASH REPORT TO DB

```sql
CREATE TABLE IF NOT EXISTS crash_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT NOT NULL,
  version TEXT,
  error_message TEXT,
  error_stack TEXT,
  last_screen TEXT,
  last_action TEXT,
  step_log JSONB,
  screenshot_urls TEXT[],
  console_errors TEXT[],
  fix_prompt TEXT,
  device JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crash_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert" ON crash_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read" ON crash_reports FOR SELECT USING (true);
```

Save to DB in generateCrashReport:
```typescript
await supabase.from('crash_reports').insert({
  project: report.project,
  version: report.version,
  error_message: report.error.message,
  error_stack: report.error.stack,
  last_screen: report.lastScreen,
  last_action: report.lastAction,
  step_log: report.stepLog,
  screenshot_urls: report.storageUrls,
  console_errors: report.consoleErrors,
  fix_prompt: report.fixPrompt,
  device: report.device,
})
```

### STEP 8 — ADD TRACKING TO KEY USER ACTIONS

```bash
echo "=== Find main user interaction points ==="
grep -rn "onPress\|onClick\|handlePress\|handleDeal\|handleBet\|handleFold" app/ components/ --include="*.tsx" | grep -v node_modules | head -20
```

Add `trackAction()` calls to the most important user actions:

```typescript
// Example — in the deal button handler:
import { trackAction } from '@/lib/crash-evidence'

const handleDeal = () => {
  trackAction('deal_pressed', { balance: currentBalance })
  // ... existing code
}

const handleBet = (amount: number) => {
  trackAction('bet_placed', { amount, hand: currentHand })
  // ... existing code
}

// Navigation:
import { setCurrentScreen } from '@/lib/crash-evidence'
// In each screen component:
useEffect(() => { setCurrentScreen('HomeScreen') }, [])
```

Add to AT LEAST these Caps actions:
- Deal button
- Bet/Raise/Call/Fold
- Navigation between screens
- Game start / game end
- Any async operation (fetch, Supabase call)

### STEP 9 — BUILD + DEPLOY

```bash
cd /c/Projects/Caps

npx tsc --noEmit 2>&1 | tail -10

git add -A
git commit -m "feat: crash evidence system — dashcam screenshots, step log, WhatsApp with evidence, CrashBoundary, crash_reports DB"
git push origin main

# EAS will auto-build
gh run list --repo royea-beep/Caps --limit 1 2>/dev/null
```

### STEP 10 — TEST WITH A REAL CRASH

After build deploys, trigger a real crash to verify:

```typescript
// Add a temporary crash button to debug screen:
<TouchableOpacity 
  onPress={() => { throw new Error('TEST CRASH — verify evidence system') }}
  style={{ backgroundColor: '#ff0000', padding: 12, borderRadius: 8, marginTop: 20 }}
>
  <Text style={{ color: 'white', textAlign: 'center' }}>💥 Trigger Test Crash</Text>
</TouchableOpacity>
```

Expected result:
1. Crash happens → CrashBoundary catches it
2. Last 5 screenshots uploaded to Supabase Storage
3. Step log saved (last 20 actions)
4. WhatsApp message arrives with:
   - Error message
   - Last screen + last action
   - 5 screenshot links
   - Last 5 steps
5. Fix prompt copyable from crash screen
6. Crash saved to DB

---

## CONSTRAINTS

- Screenshots: JPG quality 0.5 (small + fast upload)
- Buffer: 20 frames max (rolling, oldest deleted)
- Auto-capture: every 3 seconds (not too aggressive)
- Upload: only last 5 frames on crash (not all 20)
- `__DEV__` only — don't record in production unless explicitly enabled
- Silent fail — crash evidence system NEVER crashes the app itself
- CrashBoundary wraps entire app

---

## DEFINITION OF DONE

1. ✅ crash-evidence.ts with dashcam buffer (20 frames, 3s interval)
2. ✅ startCrashRecording() called on app launch
3. ✅ setCurrentScreen() on every navigation
4. ✅ trackAction() on key user actions (deal, bet, fold, navigate)
5. ✅ CrashBoundary.tsx wraps the app
6. ✅ On crash: screenshots upload to Supabase Storage
7. ✅ On crash: WhatsApp message with screenshot links + step log
8. ✅ On crash: fix prompt with full evidence
9. ✅ crash_reports table in DB
10. ✅ Test crash button on debug screen
11. ✅ Build clean, pushed

---

## MEGA FINAL REPORT (MANDATORY)

```
CRASH EVIDENCE SYSTEM — Caps
Commit: [hash]

WHAT'S NEW:
  crash-evidence.ts: ✅/❌ (dashcam buffer)
  CrashBoundary.tsx: ✅/❌ (wraps app)
  Screenshot capture: ✅/❌ (every 3s + on action)
  Supabase Storage bucket: ✅/❌ (debug-screenshots)
  crash_reports DB table: ✅/❌

ON CRASH:
  Screenshots uploaded: ✅/❌ (last 5 frames)
  Step log included: ✅/❌ (last 20 steps)
  WhatsApp message: ✅/❌ (with screenshot URLs)
  Fix prompt: ✅/❌ (with full evidence)
  DB saved: ✅/❌

TRACKED ACTIONS: [X] user actions instrumented
TRACKED SCREENS: [X] screen changes tracked

TEST CRASH:
  Triggered: ✅/❌
  Evidence captured: ✅/❌
  WhatsApp received with screenshots: ✅/❌
  Fix prompt useful: ✅/❌

NEXT: replicate to 9Soccer + Wingman
```

---

Yes, allow all edits in components
