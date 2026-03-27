/**
 * Bug Report WhatsApp notification — sends via whatsapp-bot-handler Edge Function.
 * Same Twilio infrastructure as crash reports.
 */

const BOT_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler';
const NTFY_TOPIC = 'caps-bugs';

export interface BugWhatsAppPayload {
  reportId: string;
  aiSummary: string | null;
  aiSeverity: string | null;
  description: string | null;
  deviceModel: string;
  deviceOsVersion: string;
  deviceBuildNumber: string;
  audioUrl: string | null;
  videoUrl: string | null;
  logCount: number;
  crumbCount: number;
  frameCount: number;
  elapsed: number;
  fixPrompt: string;
}

export function buildBugWhatsAppMessage(payload: BugWhatsAppPayload): string {
  const severity = (payload.aiSeverity ?? 'unknown').toUpperCase();
  const severityEmoji: Record<string, string> = {
    LOW: '\u{1F7E2}', MEDIUM: '\u{1F7E1}', HIGH: '\u{1F7E0}', CRITICAL: '\u{1F534}',
  };
  const emoji = severityEmoji[severity] ?? '\u26AA';

  const lines = [
    `\uD83D\uDC1B *BUG REPORT*`,
    `\uD83D\uDCF1 ${payload.deviceModel} | iOS ${payload.deviceOsVersion} | Build ${payload.deviceBuildNumber}`,
    `${emoji} Severity: *${severity}*`,
    `\u23F1 Recording: ${payload.elapsed}s | ${payload.frameCount} frames`,
    ``,
    `\uD83E\uDD16 *AI Summary:*`,
    payload.aiSummary || 'No summary yet',
  ];

  if (payload.description) {
    lines.push(``, `\uD83D\uDCDD *User note:* ${payload.description}`);
  }

  lines.push(``);
  if (payload.audioUrl) lines.push(`\uD83D\uDD0A Audio: ${payload.audioUrl}`);
  if (payload.videoUrl) lines.push(`\uD83D\uDCF8 Screenshot: ${payload.videoUrl}`);

  lines.push(
    `\uD83D\uDCCB Logs: ${payload.logCount} entries | Breadcrumbs: ${payload.crumbCount} screens`,
    ``,
    `*Reply:*`,
    `1 = \uD83D\uDD27 Auto-fix now`,
    `2 = \uD83D\uDC40 Full AI analysis`,
    `3 = \u23ED\uFE0F Dismiss`,
  );

  return lines.join('\n');
}

export function buildBugFixPrompt(opts: {
  reportId: string;
  aiSummary: string | null;
  aiSeverity: string | null;
  consoleLogs: string[];
  crumbs: Array<{ ts: string; screen: string }>;
}): string {
  const shortId = opts.reportId.slice(0, 8).toUpperCase();
  const severity = opts.aiSeverity ?? 'medium';
  const summary = opts.aiSummary ?? 'Bug reported by user';

  const relevantLogs = opts.consoleLogs
    .filter((l) => l.includes('[ERR]') || l.includes('FAIL') || l.includes('BUG-PIPE'))
    .slice(-10);

  let prompt = `VAMOS CAPS CAPS-BUGFIX-${shortId}\n\n`;
  prompt += `## BUG REPORT AUTO-FIX\n`;
  prompt += `Severity: ${severity}\n`;
  prompt += `Summary: ${summary}\n\n`;

  if (relevantLogs.length > 0) {
    prompt += `## Relevant console logs:\n\`\`\`\n`;
    relevantLogs.forEach((log) => { prompt += log + '\n'; });
    prompt += `\`\`\`\n\n`;
  }

  if (opts.crumbs.length > 0) {
    prompt += `## User path:\n`;
    opts.crumbs.forEach((c) => { prompt += `${c.ts} -> ${c.screen}\n`; });
    prompt += `\n`;
  }

  prompt += `## TASK: Fix this bug\n`;
  prompt += `1. Read the relevant file\n`;
  prompt += `2. Apply the suggested fix\n`;
  prompt += `3. Run tests: npx jest --forceExit\n`;
  prompt += `4. Deploy: npm run ota\n`;
  prompt += `\nVAMOS CAPS CAPS-BUGFIX-${shortId} -- END\n`;

  return prompt;
}

/**
 * Send bug report notification via WhatsApp (primary) + ntfy (backup).
 * Calls the Edge Function which handles Twilio send + bug_notifications insert.
 */
export async function sendBugReportToWhatsApp(payload: BugWhatsAppPayload): Promise<void> {
  const message = buildBugWhatsAppMessage(payload);
  console.log('[BUG-WA] Sending WhatsApp + ntfy for report:', payload.reportId.slice(0, 8));

  await Promise.allSettled([
    fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bug_notification: true,
        reportId: payload.reportId,
        // Edge Function queries DB to build rich 7-option message — we pass raw data
        screenshotUrl: payload.videoUrl,  // screenshot stored as videoUrl in DB
        audioUrl: payload.audioUrl,
        fixPrompt: payload.fixPrompt,
        // Fallback message if DB fetch fails
        message,
        aiSummary: payload.aiSummary,
        aiSeverity: payload.aiSeverity,
      }),
    }).then((r) => { console.log('[BUG-WA] Edge function response:', r.status); }),
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': `Bug: ${(payload.aiSummary ?? 'no summary').slice(0, 60)}`,
        'Tags': 'bug',
        'Priority': payload.aiSeverity === 'critical' ? '5' : '3',
      },
      body: message,
    }),
  ]);

  console.log('[BUG-WA] Notifications sent');
}
