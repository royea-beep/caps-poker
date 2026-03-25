/**
 * @caps/debugger — Crash Reporter
 * Inserts crash data into Supabase bug_reports table,
 * then fires WhatsApp alert.
 */
import { debugLog } from './debugLog';
import { getConfig } from './config';
import { sendCrashAlert } from './whatsappAlert';

export interface CrashReport {
  app: string;
  version: string;
  build: string;
  crashType: string;     // e.g. 'dirty-shutdown', 'js-error', 'manual'
  message: string;
  stack?: string;
  ota?: string;
  device?: string;
  screenshots?: string[];
}

export async function reportCrash(report: CrashReport): Promise<void> {
  const config = getConfig();
  if (!config.enabled) return;

  debugLog(`🐛 reportCrash: ${report.crashType} — ${report.message}`);

  // 1. Insert into Supabase bug_reports
  try {
    const url = `${config.supabaseUrl}/rest/v1/bug_reports`;
    const body = JSON.stringify({
      title: `[${report.app.toUpperCase()}][${report.crashType}] ${report.message}`,
      description: [
        `Build: ${report.build} | v${report.version}`,
        report.ota ? `OTA: ${report.ota}` : null,
        report.device ? `Device: ${report.device}` : null,
        report.stack ? `Stack: ${report.stack.slice(0, 500)}` : null,
      ].filter(Boolean).join('\n'),
      url: report.crashType,
      report_type: 'text',
    });

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Prefer': 'return=minimal',
      },
      body,
    });
    debugLog('🐛 crash inserted into bug_reports ✅');
  } catch (e) {
    debugLog(`🐛 bug_reports insert failed: ${e}`, 'error');
  }

  // 2. Send WhatsApp alert
  const alertLines = [
    `🔴 *${report.app.toUpperCase()} CRASH*`,
    `Build: ${report.build} | v${report.version}`,
    `Device: ${report.device ?? 'unknown'}`,
    `Type: ${report.crashType}`,
    `Msg: ${report.message}`,
    `Time: ${new Date().toLocaleTimeString('he-IL')}`,
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

  await sendCrashAlert(alertLines.join('\n'), report.screenshots);
}
