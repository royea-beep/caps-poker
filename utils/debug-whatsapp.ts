/**
 * Debug WhatsApp Alert — sends auto-debug report via the whatsapp-bot-handler Edge Function.
 * Reuses the same sendCrashAlert mechanism already wired and working.
 */
import { DebugReport } from './auto-debug'
import { CrashReport } from './crash-evidence'
import { debugLog } from '../components/DebugOverlay'

const BOT_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export async function sendCrashToWhatsApp(report: CrashReport): Promise<void> {
  const lastSteps = report.stepLog
    .slice(-5)
    .map(s => `  ${s.id}. [${s.type}] ${s.description}`)
    .join('\n')

  const screenshots = report.storageUrls.length > 0
    ? report.storageUrls.map((url, i) => `📸 Frame ${i + 1}: ${url}`).join('\n')
    : '  (no screenshots)'

  const message = [
    `💥 *CRASH: ${report.project} v${report.version}*`,
    ``,
    `❌ *Error:* ${report.error.message}`,
    `📍 *Screen:* ${report.lastScreen}`,
    `🎯 *Last action:* ${report.lastAction}`,
    `📱 *Device:* ${report.device.platform} ${report.device.os ?? ''}`,
    ``,
    `📋 *Last 5 steps before crash:*`,
    lastSteps,
    ``,
    `📸 *Screenshots (${report.storageUrls.length}):*`,
    screenshots,
    ``,
    `📊 *Evidence:* ${report.frames.length} frames | ${report.stepLog.length} steps | ${report.consoleErrors.length} errors`,
    ``,
    `🔧 *Fix prompt ready* — copy from crash screen`,
  ].join('\n')

  try {
    debugLog('[CrashEvidence] sending WhatsApp crash report...')
    await fetch(BOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        crash_notification: true,
        message,
        videoUrl: null,
        screenshotUrl: report.storageUrls[report.storageUrls.length - 1] ?? null,
        debugLogs: report.consoleErrors.slice(-20),
        metadata: {
          version: report.version,
          device: `${report.device.platform} ${report.device.os ?? ''}`,
          lastScreen: report.lastScreen,
          screenshots: report.storageUrls,
        },
      }),
    })
    debugLog('[CrashEvidence] WhatsApp crash report sent ✅')
  } catch (e) {
    debugLog(`[CrashEvidence] WhatsApp send failed: ${e}`, 'warn')
  }
}

export async function sendDebugReportToWhatsApp(report: DebugReport): Promise<void> {
  if (!report.failedAt) return  // all passed — no alert needed

  const failed = report.results.find(r => r.stepId === report.failedAt)
  const passedList = report.results
    .filter(r => r.stepId < report.failedAt!)
    .map(r => `  ✅ ${r.stepId}: ${r.stepName}`)
    .join('\n')

  const message = [
    `🔴 *AUTO-DEBUG: ${report.project} v${report.version} (${report.build})*`,
    `❌ Step ${report.failedAt}/${report.totalSteps}: "${report.failedStep}"`,
    `✅ Passed: ${report.passed}/${report.totalSteps}`,
    ``,
    `*Error:*`,
    `\`${failed?.error ?? 'unknown'}\``,
    ``,
    passedList ? `*Passed:*\n${passedList}` : '',
    ``,
    `Fix prompt ready — open /debug in app`,
    `⏱️ ${new Date(report.timestamp).toLocaleString('he-IL')}`,
  ].filter(Boolean).join('\n')

  try {
    debugLog('[AutoDebug] sending WhatsApp alert...')
    await fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crash_notification: true,
        message,
        videoUrl: null,
        screenshotUrl: null,
        debugLogs: report.results.map(r => `Step ${r.stepId} [${r.status}] ${r.stepName}: ${r.error ?? 'ok'}`),
        metadata: {
          build: report.build,
          version: report.version,
          device: 'auto-debug runner',
        },
      }),
    })
    debugLog('[AutoDebug] WhatsApp alert sent ✅')
  } catch (e) {
    debugLog(`[AutoDebug] WhatsApp alert failed: ${e}`, 'warn')
  }
}
