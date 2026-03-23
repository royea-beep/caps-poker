/**
 * Crash Alert — sends WhatsApp notification via the bot handler Edge Function.
 * Includes 7-option crash control menu.
 */
import { debugLog } from '../components/DebugOverlay';

const BOT_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler';

export async function sendCrashAlert(
  videoUrl: string | null,
  screenshotUrl: string | null,
  lastStep: string,
  debugLogs: string[],
  meta: { build: string; version: string; device?: string },
): Promise<void> {
  try {
    const lines = [
      '🔴 *CAPS CRASH*',
      `Build: ${meta.build} | v${meta.version}`,
      `Device: ${meta.device ?? 'unknown'}`,
      `Step: ${lastStep}`,
      `Time: ${new Date().toLocaleTimeString('he-IL')}`,
      '',
      videoUrl      ? `🎥 Video: ${videoUrl}`           : '',
      screenshotUrl ? `📸 Screenshot: ${screenshotUrl}` : '',
      `📝 Logs: ${debugLogs.length} entries`,
      '',
      '*Reply:*',
      '1 = 🔧 Auto-fix now',
      '2 = 👀 Show analysis',
      '3 = ⏭️ Skip',
      '4 = 🔄 Run marathon again',
      '5 = 🟢 AUTO-FIX ON',
      '6 = 🔴 AUTO-FIX OFF',
      '7 = 📊 Crash dashboard',
    ];

    const message = lines.filter(Boolean).join('\n');

    debugLog('📱 sending WhatsApp crash alert...');
    await fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crash_notification: true,
        message,
        videoUrl,
        screenshotUrl,
        debugLogs: debugLogs.slice(-20),
        metadata: meta,
      }),
    });
    debugLog('📱 WhatsApp crash alert sent ✅');
  } catch (e) {
    debugLog(`📱 alert failed: ${e}`, 'error');
  }
}
