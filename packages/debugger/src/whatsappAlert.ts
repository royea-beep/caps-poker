/**
 * @caps/debugger — WhatsApp Alert
 * Sends crash notification to the WhatsApp bot via Supabase Edge Function.
 * Fire-and-forget — does not throw.
 *
 * Reply options shown in message:
 * 1 = 🔧 Auto-fix now
 * 2 = 👀 Show analysis
 * 3 = ⏭️ Skip
 * 4 = 🔄 Run marathon again
 * 5 = 🟢 AUTO-FIX ON
 * 6 = 🔴 AUTO-FIX OFF
 * 7 = 📊 Crash dashboard
 */
import { debugLog } from './debugLog';
import { getConfig } from './config';

export async function sendCrashAlert(
  message: string,
  screenshotPaths?: string[],
): Promise<void> {
  try {
    const config = getConfig();
    if (!config.enabled) return;

    debugLog(`📱 sending WhatsApp crash alert to ${config.alertPhone}...`);

    await fetch(config.whatsappEdgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crash_notification: true,
        message,
        screenshotPaths: screenshotPaths ?? [],
        app: config.appName,
        version: config.version,
      }),
    });

    debugLog('📱 WhatsApp crash alert sent ✅');
  } catch (e) {
    debugLog(`📱 alert failed: ${e}`, 'error');
  }
}
