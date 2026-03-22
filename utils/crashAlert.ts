/**
 * Crash Alert — sends WhatsApp notification via the bot handler Edge Function.
 */
import { debugLog } from '../components/DebugOverlay';

const BOT_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler';

export async function sendCrashAlert(
  videoUrl: string | null,
  lastDebugLine: string,
  meta: { build: string; version: string; device?: string },
): Promise<void> {
  try {
    const message = [
      '🔴 CAPS CRASH DETECTED',
      `Build: ${meta.build} | v${meta.version}`,
      `Device: ${meta.device ?? 'unknown'}`,
      `Last step: ${lastDebugLine}`,
      videoUrl ? `🎥 Video: ${videoUrl}` : '(no video)',
      `Time: ${new Date().toLocaleTimeString('he-IL')}`,
    ].join('\n');

    debugLog('📱 sending WhatsApp alert...');
    await fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crash_notification: true, message, videoUrl }),
    });
    debugLog('📱 WhatsApp alert sent ✅');
  } catch (e) {
    debugLog(`📱 alert failed: ${e}`, 'error');
  }
}
