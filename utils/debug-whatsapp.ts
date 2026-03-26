/**
 * Debug WhatsApp Alert — sends auto-debug report via the whatsapp-bot-handler Edge Function.
 * Reuses the same sendCrashAlert mechanism already wired and working.
 */
import { DebugReport } from './auto-debug'
import { CrashReport } from './crash-evidence'
import { debugLog } from '../components/DebugOverlay'

const BOT_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler'
const NTFY_TOPIC = 'caps-crash-roye'

export async function sendCrashToWhatsApp(report: CrashReport): Promise<boolean> {
  // Keep WhatsApp message SHORT — under 1000 chars, always has content
  const lastStep = report.stepLog.length > 0
    ? report.stepLog[report.stepLog.length - 1].description
    : 'unknown'

  const screenshotLine = report.storageUrls.length > 0
    ? `📸 ${report.storageUrls.length} screenshots: ${report.storageUrls[0]}`
    : `📸 0 screenshots (upload failed or crash was immediate)`

  const shortMessage = [
    `💥 *CRASH [${report.crashCode}]*`,
    `*${report.project} v${report.version}*`,
    ``,
    `❌ ${report.error.message.slice(0, 100)}`,
    `📍 ${report.lastScreen} → ${report.lastAction}`,
    `📋 Last step: ${lastStep}`,
    `📊 ${report.stepLog.length} steps · ${report.consoleErrors.length} errors`,
    screenshotLine,
    ``,
    `↩️ Reply "תתקן" to auto-fix this crash`,
    `↩️ Reply "פרטים" for full details`,
    `↩️ Reply "תתעלם" to dismiss`,
  ].join('\n')

  const [wa, ntfy] = await Promise.allSettled([
    sendViaEdgeFunction(shortMessage, report),
    sendViaNtfy(shortMessage, report),
  ])

  const waSent = wa.status === 'fulfilled' && wa.value
  const ntfySent = ntfy.status === 'fulfilled' && ntfy.value

  debugLog(`[CrashEvidence] WA: ${waSent ? '✅' : '❌'} · ntfy: ${ntfySent ? '✅' : '❌'}`)
  return waSent || ntfySent
}

async function sendViaEdgeFunction(message: string, report: CrashReport): Promise<boolean> {
  try {
    const res = await fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crash_notification: true,
        crash_code: report.crashCode,
        message,
        videoUrl: null,
        screenshotUrl: report.storageUrls[0] ?? null,
        debugLogs: report.consoleErrors.slice(-10),
        metadata: {
          version: report.version,
          device: `${report.device.platform} ${report.device.os ?? ''}`,
          lastScreen: report.lastScreen,
          lastAction: report.lastAction,
          crashCode: report.crashCode,
        },
      }),
    })
    const text = await res.text()
    debugLog(`[CrashEvidence] WA response ${res.status}: ${text.slice(0, 80)}`)
    return res.ok
  } catch (e) {
    debugLog(`[CrashEvidence] WA failed: ${e}`, 'warn')
    return false
  }
}

async function sendViaNtfy(message: string, report: CrashReport): Promise<boolean> {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': `💥 [${report.crashCode}] ${report.project}: ${report.error.message.slice(0, 40)}`,
        'Tags': 'warning,skull',
        'Priority': '5',
      },
      body: message,
    })
    return true
  } catch (e) {
    debugLog(`[CrashEvidence] ntfy failed: ${e}`, 'warn')
    return false
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
    `⏱️ ${new Date(report.timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
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
