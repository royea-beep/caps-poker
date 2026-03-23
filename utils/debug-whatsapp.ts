/**
 * Debug WhatsApp Alert — sends auto-debug report via the whatsapp-bot-handler Edge Function.
 * Reuses the same sendCrashAlert mechanism already wired and working.
 */
import { DebugReport } from './auto-debug'
import { debugLog } from '../components/DebugOverlay'

const BOT_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler'

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
