/**
 * Crash Evidence System — dashcam screenshot buffer + step/action log.
 * Records what the user was doing BEFORE a crash so bot can diagnose it.
 * Think of it as a car dashcam: always recording, saves last N frames on crash.
 */
import { Platform } from 'react-native'
import { debugLog } from '../components/DebugOverlay'
import { getSupabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScreenFrame {
  id: number
  timestamp: string
  screen: string
  action: string
  base64: string
}

export interface StepLogEntry {
  id: number
  timestamp: string
  type: 'screen_change' | 'user_action' | 'debug_step' | 'error' | 'network' | 'lifecycle'
  description: string
}

export interface CrashReport {
  crashCode: string         // CR-XXXX — unique 6-char ID for WhatsApp threading
  project: string
  version: string
  timestamp: string
  device: { platform: string; os?: string }
  frames: ScreenFrame[]
  stepLog: StepLogEntry[]
  lastScreen: string
  lastAction: string
  error: { message: string; stack?: string; componentStack?: string }
  consoleErrors: string[]
  storageUrls: string[]
  fixPrompt: string
}

// ─── Batch crash queue (10s window — no spam) ─────────────────────────────────

let pendingCrashes: CrashReport[] = []
let batchTimer: ReturnType<typeof setTimeout> | null = null
const BATCH_WINDOW_MS = 10_000

export function queueCrashAlert(
  report: CrashReport,
  sendFn: (r: CrashReport) => Promise<unknown>,
): void {
  pendingCrashes.push(report)
  if (batchTimer) return
  batchTimer = setTimeout(async () => {
    const batch = [...pendingCrashes]
    pendingCrashes = []
    batchTimer = null
    for (const r of batch) {
      await sendFn(r).catch(() => {})
    }
  }, BATCH_WINDOW_MS)
}

// ─── Crash Code Generator ─────────────────────────────────────────────────────

function generateCrashCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 confusion
  const code = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `CR-${code}`
}

// ─── Module state ─────────────────────────────────────────────────────────────

let captureScreenFn: ((opts: { format: string; quality: number; result: string }) => Promise<string>) | null = null

try {
  captureScreenFn = require('react-native-view-shot').captureScreen
} catch {
  debugLog('[CrashEvidence] react-native-view-shot not available', 'warn')
}

const MAX_FRAMES = 20
const FRAME_INTERVAL_MS = 3000

let frameBuffer: ScreenFrame[] = []
let stepLog: StepLogEntry[] = []
let frameCounter = 0
let stepCounter = 0
let captureInterval: ReturnType<typeof setInterval> | null = null
let consoleErrors: string[] = []
let currentScreen = 'unknown'
let lastAction = 'none'
let isRecording = false
let origConsoleError: ((...args: unknown[]) => void) | null = null

// ─── Public API: Recording ────────────────────────────────────────────────────

export function startCrashRecording(): void {
  if (isRecording || Platform.OS === 'web') return
  isRecording = true

  // Intercept console.error
  origConsoleError = console.error as (...args: unknown[]) => void
  console.error = (...args: unknown[]) => {
    consoleErrors.push(`[${new Date().toISOString()}] ${args.map(String).join(' ')}`)
    if (consoleErrors.length > 50) consoleErrors.shift()
    origConsoleError!(...args)
  }

  // Auto-capture every 3 seconds
  captureInterval = setInterval(() => {
    captureFrame('auto').catch(() => {})
  }, FRAME_INTERVAL_MS)

  logStep('lifecycle', 'Crash recording started')
  debugLog('[CrashEvidence] dashcam started ✅')
}

export function stopCrashRecording(): void {
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
  if (origConsoleError) {
    console.error = origConsoleError as typeof console.error
    origConsoleError = null
  }
  isRecording = false
}

// ─── Public API: Tracking ─────────────────────────────────────────────────────

export function setCurrentScreen(screen: string): void {
  if (screen === currentScreen) return
  currentScreen = screen
  logStep('screen_change', `→ ${screen}`)
  captureFrame(`screen:${screen}`).catch(() => {})
}

export function trackAction(action: string): void {
  lastAction = action
  logStep('user_action', action)
  captureFrame(`action:${action}`).catch(() => {})
}

// ─── Public API: Generate Report ──────────────────────────────────────────────

export async function generateCrashReport(error: {
  message: string
  stack?: string
  componentStack?: string
}): Promise<CrashReport> {
  // Capture final crash state
  await captureFrame('CRASH_STATE').catch(() => {})

  let version = 'unknown'
  try {
    version = require('expo-constants').default?.expoConfig?.version ?? 'unknown'
  } catch {}

  const crashCode = generateCrashCode()

  const report: CrashReport = {
    crashCode,
    project: 'Caps',
    version,
    timestamp: new Date().toISOString(),
    device: {
      platform: Platform.OS,
      os: Platform.Version?.toString(),
    },
    frames: [...frameBuffer],
    stepLog: [...stepLog],
    lastScreen: currentScreen,
    lastAction,
    error,
    consoleErrors: [...consoleErrors],
    storageUrls: [],
    fixPrompt: '',
  }

  // Upload last 5 frames to Supabase Storage
  report.storageUrls = await uploadFrames(report.frames.slice(-5))

  // Save to DB
  saveToDB(report).catch(() => {})

  // Generate fix prompt
  report.fixPrompt = buildFixPrompt(report)

  return report
}

// ─── Internal: Capture ───────────────────────────────────────────────────────

async function captureFrame(action: string): Promise<void> {
  if (!captureScreenFn || Platform.OS === 'web') return
  try {
    const base64 = await captureScreenFn({ format: 'jpg', quality: 0.4, result: 'base64' })
    frameCounter++
    frameBuffer.push({
      id: frameCounter,
      timestamp: new Date().toISOString(),
      screen: currentScreen,
      action,
      base64,
    })
    if (frameBuffer.length > MAX_FRAMES) frameBuffer.shift()
  } catch {
    // silent — never crash the app
  }
}

function logStep(type: StepLogEntry['type'], description: string): void {
  stepCounter++
  stepLog.push({ id: stepCounter, timestamp: new Date().toISOString(), type, description })
  if (stepLog.length > 100) stepLog.shift()
}

// ─── Internal: Upload ─────────────────────────────────────────────────────────

async function uploadFrames(frames: ScreenFrame[]): Promise<string[]> {
  const supabase = getSupabase()
  if (!supabase || frames.length === 0) return []
  const urls: string[] = []

  for (const frame of frames) {
    try {
      const filename = `caps/crash-${Date.now()}-frame-${frame.id}.jpg`
      const binaryString = atob(frame.base64)
      const buffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i)
      }

      const { data, error } = await supabase.storage
        .from('debug-screenshots')
        .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true })

      if (!error && data) {
        const { data: urlData } = supabase.storage.from('debug-screenshots').getPublicUrl(filename)
        urls.push(urlData.publicUrl)
      }
    } catch {
      // silent
    }
  }

  debugLog(`[CrashEvidence] ${urls.length}/${frames.length} screenshots uploaded`)
  return urls
}

async function saveToDB(report: CrashReport): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  try {
    await supabase.from('crash_reports').insert({
      crash_code: report.crashCode,
      project: report.project,
      version: report.version,
      error_message: report.error.message,
      error_stack: report.error.stack ?? null,
      last_screen: report.lastScreen,
      last_action: report.lastAction,
      step_log: report.stepLog,
      screenshot_urls: report.storageUrls,
      console_errors: report.consoleErrors,
      fix_prompt: report.fixPrompt,
      device: report.device,
      status: 'new',
    })
  } catch (e) {
    debugLog(`[CrashEvidence] DB save failed: ${e}`, 'warn')
  }
}

// ─── Internal: Fix Prompt ─────────────────────────────────────────────────────

function buildFixPrompt(report: CrashReport): string {
  const steps = report.stepLog.length > 0
    ? report.stepLog
        .slice(-20)
        .map(s => `  [${s.id}] ${s.timestamp.slice(11, 19)} ${s.type}: ${s.description}`)
        .join('\n')
    : '  (no steps captured — crash happened before any navigation)'

  const screenshots = report.storageUrls.length > 0
    ? report.storageUrls.map((url, i) => `  📸 Frame ${i + 1}: ${url}`).join('\n')
    : '  (no screenshots — crash happened before 3s dashcam interval fired,\n   or upload failed. Check: SELECT * FROM crash_reports ORDER BY created_at DESC LIMIT 1)'

  const errors = report.consoleErrors.length > 0
    ? report.consoleErrors.slice(-10).join('\n  ')
    : '  none'

  return [
    `## CRASH FIX: ${report.project} v${report.version} [${report.crashCode}]`,
    `## Time: ${report.timestamp}`,
    ``,
    `Yes, allow all edits in components`,
    `Project: /c/Projects/Caps`,
    ``,
    `## ERROR`,
    `\`\`\``,
    report.error.message,
    `\`\`\``,
    ``,
    `## STACK TRACE`,
    `\`\`\``,
    report.error.stack ?? 'N/A',
    `\`\`\``,
    ``,
    `## WHERE IT CRASHED`,
    `Screen: ${report.lastScreen}`,
    `Last action: ${report.lastAction}`,
    `Platform: ${report.device.platform} ${report.device.os ?? ''}`,
    ``,
    `## STEP-BY-STEP LOG (last 20 actions before crash):`,
    steps,
    ``,
    `## SCREENSHOTS (last 5 frames before crash):`,
    screenshots,
    ``,
    `## CONSOLE ERRORS:`,
    `  ${errors}`,
    ``,
    `## TASK`,
    `1. Read the error and stack trace above`,
    `2. Look at the screenshots (if available) — they show what was on screen`,
    `3. Crash happened on screen "${report.lastScreen}" after action "${report.lastAction}"`,
    `4. Read the step log — last step before crash tells you what triggered it`,
    `5. Find the bug in the code at /c/Projects/Caps`,
    `6. Fix it`,
    `7. npx tsc --noEmit — must pass clean`,
    `8. git add -A && git commit -m "fix: crash on ${report.lastScreen} — ${report.error.message.slice(0, 50)}"`,
    `9. git push origin main`,
    ``,
    `## DEFINITION OF DONE`,
    `- Same action sequence no longer crashes`,
    `- TypeScript clean`,
    `- Pushed → EAS auto-builds`,
  ].join('\n')
}
