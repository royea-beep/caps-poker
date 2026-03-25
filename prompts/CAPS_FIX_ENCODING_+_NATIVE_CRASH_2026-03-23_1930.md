# CAPS — FIX ENCODING + NATIVE CRASH EVIDENCE
**Date:** 2026-03-23 | **Time:** 19:30 IST
**Session:** Twilio ?? emojis + dirty-shutdown has 0 logs → save every step to DB
**Sent by:** Strategic AI → Claude Bot
**Previous commit:** e49b2d8

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## 2 PROBLEMS FROM WHATSAPP SCREENSHOT

### Problem 1: Emojis show as `??`
WhatsApp shows `?? CRASH [CR-TEST]` instead of `💥 CRASH [CR-TEST]`.
Twilio is sending the message without proper UTF-8 encoding.

### Problem 2: `dirty-shutdown` crash has 0 logs, 0 screenshots
`dirty-shutdown` = iOS killed the app (native crash, memory, background kill).
CrashBoundary only catches JS errors → never fires for native crashes.
The dashcam buffer lives in MEMORY → gone when iOS kills the process.

**Fix:** Save step log + screenshots to **DB continuously** (not just on crash).
When the app reopens after a dirty-shutdown → check DB for the last session
→ reconstruct what happened → send the evidence.

---

## TASK

### STEP 0 — READ CURRENT CODE

```bash
cd /c/Projects/Caps

echo "=== 1. How Twilio message is sent ==="
find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3
for f in $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -3); do
  echo "===== $f ====="
  cat "$f"
done

echo "=== 2. How message body is built ==="
grep -rn "body\|message\|Body\|Message" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -20

echo "=== 3. Twilio API call ==="
grep -n "twilio\|Twilio\|TWILIO\|messages.create\|api.twilio" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -10

echo "=== 4. Crash evidence — how steps are saved ==="
cat lib/crash-evidence.ts

echo "=== 5. Current supabase client ==="
grep -rn "createClient\|supabase.*from\|from.*crash" lib/crash-evidence.ts 2>/dev/null | head -10

echo "=== 6. Layout — dirty-shutdown detection ==="
cat app/_layout.tsx | head -60

echo "=== 7. AsyncStorage usage ==="
grep -rn "AsyncStorage\|asyncStorage\|MMKV\|SecureStore" . --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
```

### STEP 1 — FIX TWILIO EMOJI ENCODING

The `??` emojis happen because Twilio defaults to GSM encoding which doesn't
support emojis. Need to force **UCS-2 encoding** or use **Unicode SID**.

```bash
echo "=== Find the Twilio send call ==="
grep -A 20 "messages.create\|client.messages\|twilio.*send" $(find supabase -name "*whatsapp*" -name "*.ts" 2>/dev/null | head -1) | head -25
```

**Fix Option A — Force Unicode in Twilio API:**
```typescript
// When sending via Twilio REST API, add statusCallback or just ensure body is UTF-8
// The key: WhatsApp messages via Twilio SHOULD support emojis natively
// The bug is likely in HOW the body is assembled

// WRONG — string concatenation may lose encoding:
const body = `💥 CRASH [${code}]`  // This is fine in JS

// CHECK: Is the body being double-encoded or passed through a non-UTF8 pipe?
// The fix is usually ensuring Content-Type: application/json with the body
```

**Fix Option B — If using Twilio REST API directly:**
```typescript
// Ensure the fetch call sends with proper encoding:
const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',  // ← KEY
  },
  body: new URLSearchParams({
    To: `whatsapp:${TO_PHONE}`,
    From: `whatsapp:${FROM_PHONE}`,
    Body: message,  // JS string with emojis — URLSearchParams handles encoding
  }).toString(),
})
```

**Fix Option C — If using Twilio Node SDK in Edge Function:**
```typescript
// The Twilio SDK should handle encoding. The issue might be that
// the message is built with template literals that get corrupted.
// Fix: ensure the message is a plain string, not Buffer:

const messageText = String([
  '🔴 CAPS CRASH',
  `Build: ${build} | v${version}`,
  `Device: ${device}`,
  `Step: ${step}`,
  // ... rest
].join('\n'))

// Verify it's a proper string:
console.log('Message length:', messageText.length)
console.log('First char code:', messageText.charCodeAt(0))  // Should be > 127 for emoji
```

**Fix Option D — Replace emojis with text equivalents (guaranteed fix):**
```typescript
// If encoding can't be fixed → just use ASCII that works everywhere:
// 💥 → [CRASH]
// 🔴 → [!]
// 📍 → Screen:
// 🎯 → Action:
// 📸 → Screenshots:
// ✅ → [OK]
// ❌ → [FAIL]

function sanitizeForTwilio(text: string): string {
  return text
    .replace(/💥/g, '[CRASH]')
    .replace(/🔴/g, '[!]')
    .replace(/📍/g, 'Screen:')
    .replace(/🎯/g, 'Action:')
    .replace(/📸/g, 'Screenshots:')
    .replace(/📋/g, 'Steps:')
    .replace(/📊/g, 'Evidence:')
    .replace(/🔧/g, 'Fix:')
    .replace(/✅/g, '[OK]')
    .replace(/❌/g, '[FAIL]')
    .replace(/↩️/g, 'Reply:')
    .replace(/🧪/g, '[TEST]')
    .replace(/[^\x00-\x7F\u0590-\u05FF\u0600-\u06FF]/g, '') // strip remaining non-ASCII except Hebrew+Arabic
}

// Apply before sending:
const cleanMessage = sanitizeForTwilio(messageText)
```

**Try Option B/C first (proper encoding). If still broken → Option D (guaranteed).**

### STEP 2 — CONTINUOUS DB LOGGING (SURVIVE NATIVE CRASHES)

The dashcam buffer is in memory → dies with the process.
Instead: write every step to **Supabase DB** immediately.
When app reopens after dirty-shutdown → check last session in DB.

#### Create `debug_sessions` table:

```sql
-- A rolling log of every action — survives native crashes
CREATE TABLE IF NOT EXISTS debug_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT NOT NULL DEFAULT 'Caps',
  session_id TEXT NOT NULL,        -- unique per app launch
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL,         -- 'screen_change', 'user_action', 'lifecycle', 'error'
  description TEXT NOT NULL,
  screen TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE debug_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert" ON debug_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "public read" ON debug_sessions FOR SELECT USING (true);

-- Index for fast lookups
CREATE INDEX idx_debug_sessions_session ON debug_sessions(session_id, step_number);
CREATE INDEX idx_debug_sessions_recent ON debug_sessions(project, created_at DESC);

-- Auto-cleanup: delete sessions older than 7 days
-- (add to pg_cron or app-level cleanup)
```

#### Update `crash-evidence.ts` — write to DB on every step:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

const SESSION_KEY = 'debug_session_id'
let sessionId: string = ''
let stepNumber = 0

// Generate session ID on app launch
export function initSession(): string {
  sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  stepNumber = 0
  
  // Save to AsyncStorage so we can find it after restart
  AsyncStorage.setItem(SESSION_KEY, sessionId).catch(() => {})
  AsyncStorage.setItem('debug_last_launch', new Date().toISOString()).catch(() => {})
  
  logStepToDB('lifecycle', 'App launched', 'Splash')
  return sessionId
}

// Log EVERY step to DB immediately — survives native crash
async function logStepToDB(
  type: string, 
  description: string, 
  screen?: string, 
  data?: any
): Promise<void> {
  stepNumber++
  
  try {
    // Fire and forget — don't await, don't block the app
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl) return
    
    fetch(`${supabaseUrl}/rest/v1/debug_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',  // don't wait for response body
      },
      body: JSON.stringify({
        project: 'Caps',
        session_id: sessionId,
        step_number: stepNumber,
        step_type: type,
        description,
        screen: screen || currentScreen,
        data: data || null,
      }),
    }).catch(() => {})  // silent fail — NEVER crash the app
    
  } catch {
    // absolutely silent — debug logging must never affect the app
  }
}

// Override the existing tracking functions to also write to DB:

export function setCurrentScreen(screen: string) {
  if (screen !== currentScreen) {
    currentScreen = screen
    logStepToDB('screen_change', `→ ${screen}`, screen)
    // Also keep in-memory log (for JS crashes where CrashBoundary fires)
    logStep('screen_change', `Navigated to: ${screen}`)
  }
}

export function trackAction(action: string, data?: any) {
  lastAction = action
  logStepToDB('user_action', action, currentScreen, data)
  logStep('user_action', action, data)
}

// Log errors to DB too:
export function trackError(error: string, data?: any) {
  logStepToDB('error', error, currentScreen, data)
  logStep('error', error, data)
}
```

#### Detect dirty-shutdown on next launch:

```typescript
// In app/_layout.tsx or wherever the app initializes:

async function checkForDirtyShutdown() {
  try {
    const lastSessionId = await AsyncStorage.getItem('debug_session_id')
    const lastLaunch = await AsyncStorage.getItem('debug_last_launch')
    
    if (!lastSessionId) return // first ever launch
    
    // Check: did the last session end cleanly?
    const cleanExit = await AsyncStorage.getItem('debug_clean_exit')
    
    if (cleanExit === 'true') {
      // Last session ended normally — no crash
      await AsyncStorage.setItem('debug_clean_exit', 'false') // reset for this session
      return
    }
    
    // DIRTY SHUTDOWN — last session didn't exit cleanly
    console.warn('[Debug] Dirty shutdown detected! Last session:', lastSessionId)
    
    // Pull last session's steps from DB
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/debug_sessions?session_id=eq.${lastSessionId}&order=step_number.desc&limit=20`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )
    
    const steps = await response.json()
    
    if (steps && steps.length > 0) {
      const lastStep = steps[0]
      const stepLog = steps.reverse() // chronological order
      
      // Build crash report from DB data
      const crashReport = {
        project: 'Caps',
        version: require('../package.json').version || '1.0.0',
        timestamp: lastLaunch || new Date().toISOString(),
        error: {
          message: `Native crash (dirty-shutdown) after: ${lastStep.description}`,
          stack: `Last ${steps.length} steps recovered from DB\nSession: ${lastSessionId}`,
        },
        lastScreen: lastStep.screen || 'unknown',
        lastAction: lastStep.description || 'unknown',
        stepLog: stepLog.map((s: any) => ({
          id: s.step_number,
          timestamp: s.created_at,
          type: s.step_type,
          description: s.description,
        })),
        storageUrls: [], // no screenshots for native crashes
        consoleErrors: [],
        crashCode: `CR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        device: { platform: 'ios' },
      }
      
      // Generate fix prompt
      crashReport.fixPrompt = buildFixPromptFromDB(crashReport, stepLog)
      
      // Save to crash_reports
      await fetch(`${supabaseUrl}/rest/v1/crash_reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          project: 'Caps',
          version: crashReport.version,
          crash_code: crashReport.crashCode,
          error_message: crashReport.error.message,
          error_stack: crashReport.error.stack,
          last_screen: crashReport.lastScreen,
          last_action: crashReport.lastAction,
          step_log: crashReport.stepLog,
          screenshot_urls: [],
          console_errors: [],
          fix_prompt: crashReport.fixPrompt,
          device: crashReport.device,
          status: 'new',
        }),
      })
      
      // Send WhatsApp + ntfy alert
      const { sendCrashToWhatsApp } = require('@/lib/debug-whatsapp')
      await sendCrashToWhatsApp(crashReport).catch(() => {})
      
      console.log('[Debug] Dirty shutdown report sent:', crashReport.crashCode)
    }
    
    // Reset for this session
    await AsyncStorage.setItem('debug_clean_exit', 'false')
    
  } catch (e) {
    console.warn('[Debug] Dirty shutdown check failed:', e)
  }
}

function buildFixPromptFromDB(report: any, steps: any[]): string {
  const stepHistory = steps
    .map((s: any) => `  [${s.step_number}] ${s.created_at?.slice(11, 19) || '??'} ${s.step_type}: ${s.description}`)
    .join('\n')

  return `## NATIVE CRASH: ${report.project} v${report.version}
## Crash code: ${report.crashCode}
## Type: dirty-shutdown (iOS killed the process)

Yes, allow all edits in components
Project: /c/Projects/Caps

## WHAT HAPPENED
The app was killed by iOS (not a JS error). This means:
- Memory pressure, native module crash, or background kill
- CrashBoundary did NOT catch this (it only catches JS errors)
- Evidence recovered from DB after restart

## LAST SCREEN: ${report.lastScreen}
## LAST ACTION: ${report.lastAction}

## RECOVERED STEP LOG (${steps.length} steps from DB):
${stepHistory}

## TASK
1. The last step before crash was: "${steps[steps.length - 1]?.description || 'unknown'}"
2. Check if that screen/action has heavy memory usage
3. Check for native module issues (camera, storage, etc.)
4. Look for memory leaks (large arrays, uncleared intervals)
5. Check Xcode crash logs if available
6. Fix the issue
7. Build + push

## COMMON NATIVE CRASH CAUSES:
- Memory spike on screen "${report.lastScreen}" (large images? animations?)
- Native module crash (react-native-view-shot? Supabase realtime?)
- Background task exceeding iOS time limit
- Too many concurrent fetch() calls

## DEFINITION OF DONE
- App survives the same flow without iOS killing it
- Build clean + push`
}

// Mark clean exit when app goes to background:
// In _layout.tsx — add AppState listener:
import { AppState } from 'react-native'

useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background' || state === 'inactive') {
      AsyncStorage.setItem('debug_clean_exit', 'true').catch(() => {})
      logStepToDB('lifecycle', 'App backgrounded')
    }
    if (state === 'active') {
      logStepToDB('lifecycle', 'App foregrounded')
    }
  })
  return () => sub.remove()
}, [])
```

### STEP 3 — THROTTLE DB WRITES

Every 3 seconds × 20 steps = lots of DB writes. Batch them:

```typescript
// Instead of writing every step immediately, batch every 5 seconds:
let pendingSteps: any[] = []
let flushTimeout: ReturnType<typeof setTimeout> | null = null

function logStepToDB(type: string, description: string, screen?: string, data?: any) {
  stepNumber++
  
  pendingSteps.push({
    project: 'Caps',
    session_id: sessionId,
    step_number: stepNumber,
    step_type: type,
    description,
    screen: screen || currentScreen,
    data: data || null,
  })
  
  // Flush every 5 seconds (batch insert)
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushToDB, 5000)
  }
  
  // Also flush immediately on important events:
  if (type === 'error' || type === 'screen_change') {
    flushToDB()
  }
}

async function flushToDB() {
  if (flushTimeout) {
    clearTimeout(flushTimeout)
    flushTimeout = null
  }
  
  if (pendingSteps.length === 0) return
  
  const batch = [...pendingSteps]
  pendingSteps = []
  
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
    
    await fetch(`${supabaseUrl}/rest/v1/debug_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    })
  } catch {
    // silent
  }
}

// Flush on app background:
export function flushBeforeExit() {
  flushToDB()
}
```

### STEP 4 — CLEANUP OLD SESSIONS

```sql
-- Add to pg_cron or app-level: delete debug_sessions older than 7 days
DELETE FROM debug_sessions WHERE created_at < now() - interval '7 days';
```

Or in app on launch:
```typescript
// Cleanup old sessions (keep last 7 days)
fetch(`${supabaseUrl}/rest/v1/debug_sessions?created_at=lt.${sevenDaysAgo}`, {
  method: 'DELETE',
  headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
}).catch(() => {})
```

### STEP 5 — BUILD + DEPLOY

```bash
cd /c/Projects/Caps

npx tsc --noEmit 2>&1 | tail -10

git add -A
git commit -m "fix: Twilio emoji encoding + continuous DB logging for native crash evidence (dirty-shutdown)"
git push origin main

gh run list --repo royea-beep/Caps --limit 1 2>/dev/null
```

### STEP 6 — TEST

After deploy, test the dirty-shutdown detection:

```
1. Open app → do some actions (navigate, tap)
2. Force-kill the app (swipe up in app switcher)
3. Reopen the app
4. Should see: "Dirty shutdown detected" in console
5. WhatsApp/ntfy should receive crash report with recovered steps from DB
```

---

## CONSTRAINTS

- DB writes: batched every 5 seconds (not per step) — don't hammer Supabase
- Flush immediately on: error, screen_change, app background
- Cleanup: delete sessions > 7 days
- Encoding: try proper UTF-8 first, fallback to ASCII-safe
- All crash-evidence code in try/catch — NEVER crash the app
- AsyncStorage for session tracking (survives native crash)
- dirty-shutdown = no screenshots (process was killed) — step log only

---

## MEGA FINAL REPORT (MANDATORY)

```
ENCODING + NATIVE CRASH EVIDENCE — Caps
Commit: [hash]

PROBLEM 1 — EMOJI ENCODING:
  Root cause: [Twilio encoding / body assembly / other]
  Fix: [what changed]
  Test message: emojis show correctly ✅/❌

PROBLEM 2 — NATIVE CRASH EVIDENCE:
  debug_sessions table: ✅/❌
  Continuous DB logging: ✅/❌ (batch every 5s)
  Flush on screen_change/error: ✅/❌
  Flush on app background: ✅/❌
  dirty-shutdown detection on relaunch: ✅/❌
  Step log recovered from DB: ✅/❌
  Crash report generated from recovered data: ✅/❌
  WhatsApp/ntfy sent with recovered evidence: ✅/❌

SESSION TRACKING:
  initSession() on launch: ✅/❌
  clean_exit flag on background: ✅/❌
  Dirty shutdown = no clean_exit: ✅/❌

DB CLEANUP:
  Old sessions deleted (>7 days): ✅/❌

Build: ✅/❌
Commit: [hash]
```

---

Yes, allow all edits in components
