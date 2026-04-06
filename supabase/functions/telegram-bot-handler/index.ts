import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN        = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_CHAT_ID          = Deno.env.get('TELEGRAM_CHAT_ID')!;
const GITHUB_TOKEN              = Deno.env.get('GITHUB_TOKEN')!;
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const AUTO_FIX_KEY = 'caps_auto_fix_mode';
const REPLY_WINDOW = 10 * 60 * 1000;
const REPO_MAP: Record<string, string> = { 'caps-poker': 'royea-beep/caps-poker', 'wingman': 'royea-beep/wingman' };

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }) },
  );
  const data = await res.json().catch(() => ({}));
  if (!data.ok) { console.error('[tg] failed:', JSON.stringify(data).slice(0, 200)); return false; }
  return true;
}

interface ClaudePlan { type: 'BUG' | 'FEATURE' | 'QUESTION'; summary: string; severity: 'CRITICAL' | 'MEDIUM' | 'LOW'; plan: string[]; files: string[]; effort: 'LOW' | 'MEDIUM' | 'HIGH'; project?: string; }

async function triggerGitHubAction(plan: ClaudePlan, project: string, eventType: string): Promise<number | null> {
  const repo = REPO_MAP[project] ?? REPO_MAP['caps-poker'];
  if (!GITHUB_TOKEN) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, client_payload: { summary: plan.summary, plan: plan.plan.join('\n'), fix_prompt: plan.plan.join('\n'), files: plan.files.join(', '), effort: plan.effort, severity: plan.severity, type: plan.type, project } }),
    });
    if (res.status === 204 || res.status === 200) {
      await new Promise((r) => setTimeout(r, 2000));
      const rr = await fetch(`https://api.github.com/repos/${repo}/actions/runs?event=repository_dispatch&per_page=1`, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } });
      const d = await rr.json().catch(() => ({}));
      return (d.workflow_runs?.[0]?.id as number | null) ?? 1;
    }
    return null;
  } catch { return null; }
}

async function handleBugReply(msgText: string, session: Record<string, unknown>, supabase: ReturnType<typeof createClient>, chatId: string): Promise<string | null> {
  const plan = session.claude_plan as Record<string, unknown>;
  const reportId = plan?.bug_report_id as string | null;
  const fixPrompt = plan?.fix_prompt as string | null;
  const aiSummary = plan?.ai_summary as string | null;
  const audioUrl = (plan?.audio_url as string | null) ?? null;
  const trimmed = msgText.trim();
  let report: Record<string, unknown> | null = null;
  if (['4', '5'].includes(trimmed) && reportId) {
    const { data } = await supabase.from('bug_reports').select('ai_summary,ai_suggested_fix,ai_screen,audio_url,video_url,console_logs,breadcrumbs,ai_severity').eq('id', reportId).single();
    report = data;
  }
  if (trimmed === '1') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_approved' }).eq('id', session.id);
    if (reportId) await supabase.from('bug_notifications').update({ approved_at: new Date().toISOString() }).eq('bug_report_id', reportId);
    if (fixPrompt) {
      const cp: ClaudePlan = { type: 'BUG', summary: aiSummary ?? 'Bug fix', severity: 'MEDIUM', plan: [fixPrompt], files: [], effort: 'MEDIUM', project: 'caps-poker' };
      const runId = await triggerGitHubAction(cp, 'caps-poker', 'claude-fix-no-build');
      if (runId !== null) {
        await supabase.from('whatsapp_sessions').update({ github_run_id: runId, status: 'bug_fixing' }).eq('id', session.id);
        return `🔧 Auto-fix dispatched (run #${runId}).`;
      }
      return '❌ Auto-fix failed. Check GITHUB_TOKEN.';
    }
    return '✅ Marked as approved.';
  }
  if (trimmed === '2') { await supabase.from('whatsapp_sessions').update({ status: 'bug_sprint' }).eq('id', session.id); if (reportId) await supabase.from('bug_reports').update({ status: 'sprint_queued' }).eq('id', reportId); return `📋 Bug${reportId ? ' #' + (session.report_number ?? '') : ''} added to next sprint.`; }
  if (trimmed === '3') { await supabase.from('whatsapp_sessions').update({ status: 'bug_backlog' }).eq('id', session.id); if (reportId) await supabase.from('bug_reports').update({ status: 'backlog' }).eq('id', reportId); return `📦 Bug${reportId ? ' #' + (session.report_number ?? '') : ''} moved to backlog.`; }
  if (trimmed === '4') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_analyzing' }).eq('id', session.id);
    if (!report) return 'Bug report not found.';
    const logs = (report.console_logs as string[] | null) ?? [];
    const crumbs = (report.breadcrumbs as Array<{ ts: string; screen: string }> | null) ?? [];
    let msg = 'LOGS:\n' + logs.slice(-20).map((l) => l.slice(0, 100)).join('\n') + '\n\nCRUMBS:\n' + crumbs.map((c) => `${(c.ts ?? '').slice(11, 19)} -> ${c.screen ?? '?'}`).join('\n');
    return msg.length > 3500 ? msg.slice(0, 3500) + '\n...' : msg;
  }
  if (trimmed === '5') { const url = audioUrl ?? (report?.audio_url as string | null); if (url) { await sendTelegram(chatId, `Audio:\n${url}`); return null; } return 'No audio available.'; }
  if (trimmed === '6') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_dismissed' }).eq('id', session.id);
    if (reportId) { await Promise.allSettled([supabase.from('bug_notifications').update({ dismissed_at: new Date().toISOString() }).eq('bug_report_id', reportId), supabase.from('bug_reports').update({ status: 'dismissed' }).eq('id', reportId)]); }
    return '✅ Bug dismissed.';
  }
  if (trimmed === '7') { await supabase.from('whatsapp_sessions').update({ status: 'bug_needs_info' }).eq('id', session.id); if (reportId) await supabase.from('bug_reports').update({ status: 'needs_info' }).eq('id', reportId); return 'ℹ️ Marked needs_info.'; }
  return null;
}

async function handleCrashReply(msgText: string, supabase: ReturnType<typeof createClient>, chatId: string): Promise<string | null> {
  const trimmed = msgText.trim(); const upper = trimmed.toUpperCase();
  if (['1', 'FIX'].includes(upper)) {
    const { data: latest } = await supabase.from('bug_reports').select('*').ilike('title', '[CRASH]%').order('created_at', { ascending: false }).limit(1).single();
    if (!latest) return '❌ No crash report found.';
    fetch(`${SUPABASE_URL}/functions/v1/crash-analyzer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ crashReportId: latest.id, autoApply: true, from: `telegram:${chatId}` }) }).catch(() => {});
    await supabase.from('whatsapp_sessions').update({ status: 'crash_processing' }).eq('from_number', `telegram:${chatId}`).eq('status', 'crash_pending');
    return '🔧 Analyzing and fixing...';
  }
  if (trimmed === '2') {
    const { data: l } = await supabase.from('bug_reports').select('ai_summary,ai_suggested_fix,ai_screen,console_logs,breadcrumbs').ilike('title', '[CRASH]%').order('created_at', { ascending: false }).limit(1).single();
    if (!l) return 'No crash report.';
    const logs = (l.console_logs as string[] | null) ?? []; const crumbs = (l.breadcrumbs as Array<{ ts: string; screen: string }> | null) ?? [];
    let msg = `*Crash Analysis*\nSummary: ${l.ai_summary ?? 'none'}\nScreen: ${l.ai_screen ?? '?'}\nFix: ${(l.ai_suggested_fix ?? '').slice(0, 200)}\n\nLogs:\n${logs.slice(-10).map((x: string) => x.slice(0, 100)).join('\n')}`;
    if (crumbs.length > 0) msg += `\nPath:\n${crumbs.map((c) => `${(c.ts ?? '').slice(11, 19)} -> ${c.screen}`).join('\n')}`;
    return msg.length > 3500 ? msg.slice(0, 3500) + '\n...' : msg;
  }
  if (trimmed === '3') { await supabase.from('whatsapp_sessions').update({ status: 'crash_skipped' }).eq('from_number', `telegram:${chatId}`).eq('status', 'crash_pending'); return 'Crash skipped.'; }
  if (trimmed === '4') { fetch(`${SUPABASE_URL}/functions/v1/crash-analyzer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ autoApply: false }) }).catch(() => {}); return 'Running crash marathon again...'; }
  if (upper === '5' || upper === 'AUTO ON') { await supabase.from('app_config').upsert({ key: AUTO_FIX_KEY, value: { enabled: true } }); return 'AUTO-FIX ON.'; }
  if (upper === '6' || upper === 'AUTO OFF') { await supabase.from('app_config').upsert({ key: AUTO_FIX_KEY, value: { enabled: false } }); return 'AUTO-FIX OFF.'; }
  if (trimmed === '7') {
    const { data: r } = await supabase.from('bug_reports').select('title,created_at,status').order('created_at', { ascending: false }).limit(5);
    if (!r?.length) return 'No recent crash reports.';
    return `*Last 5:*\n${(r as Array<Record<string, string>>).map((x) => `- ${x.title?.slice(0, 40) ?? '?'} (${x.status ?? '?'})`).join('\n')}`;
  }
  return null;
}

function buildBugMessage(report: Record<string, unknown>): string {
  const di = report.device_info as Record<string, string> | null;
  const meta = report.metadata as Record<string, unknown> | null;
  const sev = ((report.ai_severity as string | null) ?? 'MEDIUM').toUpperCase();
  const sevEmoji: Record<string, string> = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴' };
  const reportNum = (report.report_number as number | null) ?? null;
  const logs = (report.console_logs as string[] | null) ?? [];
  const crumbs = (report.breadcrumbs as Array<unknown> | null) ?? [];
  let msg = `*BUG REPORT${reportNum !== null ? ` #${reportNum}` : ''}*\n`;
  msg += `${di?.model ?? 'Unknown'} | iOS ${di?.osVersion ?? ''} | Build ${di?.buildNumber ?? ''}\n`;
  msg += `${sevEmoji[sev] ?? '?'} Severity: ${sev}\n`;
  msg += `${(meta?.recordingDuration as number | null) ?? 0}s | ${(meta?.frameCount as number | null) ?? 0} frames\n\n`;
  const isSilent = ((report.ai_summary as string | null) ?? '').startsWith('Silent report from');
  msg += isSilent
    ? `*Status:* 🔕 Silent report — no audio, no description\n`
    : `*AI Summary:*\n${(report.ai_summary as string | null) ?? 'Analyzing...'}\n`;
  const screen = (report.ai_screen as string | null) ?? '';
  const fix = (report.ai_suggested_fix as string | null) ?? '';
  const desc = (report.description as string | null) ?? '';
  const audio = (report.audio_url as string | null) ?? '';
  const video = (report.video_url as string | null) ?? '';
  if (screen) msg += `Screen: ${screen}\n`;
  if (fix) msg += `Fix: ${fix.slice(0, 200)}\n`;
  if (desc) msg += `Note: ${desc}\n`;
  msg += `Logs: ${logs.length} | Crumbs: ${crumbs.length}\n`;
  if (audio) msg += `Audio: ${audio}\n`;
  if (video) msg += `Screenshot: ${video}\n`;
  const CURRENT_OTA = 'fe21b607';
  const testerOTA = ((report.metadata as Record<string, string> | null)?.otaUpdateId ?? 'unknown').slice(0, 8);
  if (testerOTA !== 'embedded' && testerOTA !== 'unknown' && testerOTA !== CURRENT_OTA) msg += `⚠️ OLD OTA: ${testerOTA} (current: ${CURRENT_OTA})\n`;
  msg += '\nReply:\n';
  if (reportNum !== null) { msg += `${reportNum}:1 Fix | ${reportNum}:2 Sprint | ${reportNum}:3 Backlog | ${reportNum}:6 Dismiss`; }
  else { msg += '1 Fix | 2 Sprint | 3 Backlog | 4 Logs | 5 Audio | 6 Dismiss | 7 Needs info'; }
  return msg;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let json: Record<string, unknown>;
  try { json = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  console.log('[tg-bot] keys:', Object.keys(json).join(', '));

  if (json.github_callback) {
    const gcb = json as Record<string, unknown>;
    const ok = gcb.status === 'success';
    const rn = gcb.report_num ?? '?';
    const msg = ok ? `✅ Bug #${rn} FIXED\nOTA deploying... ETA 2 min.\nCommit: ${gcb.commit_hash ?? '?'}` : `❌ Auto-fix failed for bug #${rn}\nRun: ${gcb.run_id ?? '?'}\nReason: ${gcb.error_reason ?? 'unknown'}`;
    await sendTelegram(TELEGRAM_CHAT_ID, msg);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  if (json.crash_notification) {
    const msg = (json.message as string | null) ?? 'CAPS CRASH (no details)';
    const { data: cfg } = await supabase.from('app_config').select('value').eq('key', AUTO_FIX_KEY).single();
    const autoFix = (cfg as Record<string, Record<string, boolean>> | null)?.value?.enabled ?? false;
    let reportNum: number | null = null;
    try {
      const { data: ins } = await supabase.from('whatsapp_sessions').insert({
        message_sid: `tg-crash-${Date.now()}`, from_number: `telegram:${TELEGRAM_CHAT_ID}`,
        raw_input: msg, media_type: 'crash',
        claude_plan: { debugLogs: json.debugLogs ?? [], metadata: json.metadata ?? {} },
        status: 'crash_pending',
      }).select('id, status, report_number').single();
      reportNum = (ins as Record<string, unknown> | null)?.report_number as number | null;
      if ((ins as Record<string, unknown> | null)?.status === 'crash_skipped') {
        return new Response(JSON.stringify({ sent: false, skipped: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    } catch { /* */ }
    let sent = false;
    if (autoFix) {
      await sendTelegram(TELEGRAM_CHAT_ID, 'AUTO-FIX: crash detected. Analyzing...');
      fetch(`${SUPABASE_URL}/functions/v1/crash-analyzer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ debugLogs: json.debugLogs, metadata: json.metadata, autoApply: true }) }).catch(() => {});
    } else {
      sent = await sendTelegram(TELEGRAM_CHAT_ID, reportNum !== null ? `CRASH #${reportNum}\n${msg}` : msg);
    }
    return new Response(JSON.stringify({ sent, autoFix }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  if (json.bug_notification) {
    const reportId = json.reportId as string | null;
    let report: Record<string, unknown> | null = null;
    let transcription: string | null = null;
    if (reportId) {
      const { data } = await supabase.from('bug_reports').select('*').eq('id', reportId).single();
      report = data;
      const audioUrl = (report?.audio_url as string | null) ?? (json.audioUrl as string | null);
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (audioUrl && openaiKey) {
        try {
          const aRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
          if (aRes.ok) {
            const blob = await aRes.blob();
            const ext = audioUrl.includes('.m4a') ? 'm4a' : 'mp4';
            const form = new FormData();
            form.append('file', blob, `recording.${ext}`);
            form.append('model', 'whisper-1');
            form.append('language', 'he');
            const wRes = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}` }, body: form, signal: AbortSignal.timeout(20000) });
            const wData = await wRes.json().catch(() => ({}));
            if (wData.text) transcription = wData.text;
          }
        } catch { /* */ }
      }
    }
      if (transcription && reportId) {
        // A: Update description if empty (transcription-before-triage fix)
        await supabase.from('bug_reports').update({ description: transcription.slice(0, 500) }).eq('id', reportId).is('description', null);
        // Run AI triage with transcription content
        const ak = Deno.env.get('ANTHROPIC_API_KEY');
        if (ak) {
          const tr = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ak, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: 'Bug transcription: "' + transcription.slice(0,300) + '". Reply JSON only: {"severity":"LOW|MEDIUM|HIGH|CRITICAL","summary":"one sentence"}' }] }) }).catch(() => null);
          const td = tr ? await tr.json().catch(() => ({})) : {};
          const tt = (td.content?.[0]?.text as string | null) ?? '';
          try { const pa = JSON.parse(tt.match(/\{[\s\S]*\}/)?.[0] ?? '{}'); if (pa.severity && pa.summary) await supabase.from('bug_reports').update({ ai_severity: pa.severity.toLowerCase(), ai_summary: pa.summary }).eq('id', reportId); } catch { /* */ }
        }
      } else if (reportId) {
        // B: Silent report — no audio and no description. Skip AI, mark for manual review.
        const reportDesc = (report?.description as string | null) ?? null;
        if (!reportDesc) {
          const lastScreen = (report?.screen as string | null) ?? 'unknown screen';
          const silentSummary = `Silent report from ${lastScreen} — screenshot only`;
          await supabase.from('bug_reports').update({ ai_summary: silentSummary, ai_severity: 'low' }).eq('id', reportId);
          if (report) { report.ai_summary = silentSummary; report.ai_severity = 'low'; }
        }
      }
    let fixPrompt: string | null = null;
    if (report) {
      const id = reportId?.slice(0, 8).toUpperCase() ?? 'UNKNOWN';
      fixPrompt = `VAMOS CAPS CAPS-BUGFIX-${id}\n## BUG REPORT AUTO-FIX\nSeverity: ${report.ai_severity ?? 'medium'}\nSummary: ${report.ai_summary ?? 'Bug'}\n\nVAMOS CAPS CAPS-BUGFIX-${id} — END`;
    }
    const bugMsg = report ? buildBugMessage(report) + (transcription ? `\n\nUser said: "${transcription.slice(0, 300)}"` : '') : (json.message as string | null) ?? 'Bug reported';
    let sessionId: string | null = null;
    try {
      const { data: ins } = await supabase.from('whatsapp_sessions').insert({
        message_sid: `tg-bug-${Date.now()}`, from_number: `telegram:${TELEGRAM_CHAT_ID}`,
        raw_input: bugMsg, media_type: 'bug',
        claude_plan: { bug_report_id: reportId, fix_prompt: fixPrompt, ai_summary: (report?.ai_summary as string | null), audio_url: (report?.audio_url as string | null) ?? (json.audioUrl as string | null) },
        status: 'bug_pending',
      }).select('id').single();
      sessionId = (ins as Record<string, unknown> | null)?.id as string | null;
    } catch { /* */ }
    const sent = await sendTelegram(TELEGRAM_CHAT_ID, bugMsg);
    return new Response(JSON.stringify({ sent, sessionId }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  if (json.update_id) {
    const tgMsg = json.message as Record<string, unknown> | null;
    const chatId = String((tgMsg?.chat as Record<string, unknown> | null)?.id ?? '');
    const text = (tgMsg?.text as string | null) ?? '';

    if (text.trim() === '/status') {
      const [bugsRes, sessRes] = await Promise.allSettled([
        supabase.from('bug_reports')
          .select('status', { count: 'exact', head: false })
          .in('status', ['open', 'bug_pending', 'needs_info', 'sprint_queued']),
        supabase.rpc('get_session_stats_7d').maybeSingle(),
      ]);
      const bugs = bugsRes.status === 'fulfilled' ? (bugsRes.value.data as Array<Record<string, string>> | null) ?? [] : [];
      const openBugs = bugs.filter((b) => ['open', 'bug_pending', 'needs_info'].includes(b.status ?? '')).length;
      const sprintBugs = bugs.filter((b) => b.status === 'sprint_queued').length;

      const { data: fixedRes } = await supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'fixed').gte('updated_at', new Date(Date.now() - 7 * 86400000).toISOString());
      const fixed7d = (fixedRes as unknown as { count?: number } | null)?.count ?? 0;

      const sessData = sessRes.status === 'fulfilled' ? (sessRes.value.data as Record<string, number> | null) : null;
      const sessions7d = sessData?.total_sessions ?? 0;
      const testers7d = sessData?.unique_testers ?? 0;

      const CURRENT_OTA = 'f8193796';
      let msg = `📊 *CAPS Poker Status*\n\n`;
      msg += `🐛 Open bugs: ${openBugs}\n`;
      msg += `📋 Sprint queue: ${sprintBugs}\n`;
      msg += `✅ Fixed (7d): ${fixed7d}\n`;
      msg += `📦 OTA: \`${CURRENT_OTA}\`\n\n`;
      msg += `📈 *Last 7 days:*\n`;
      msg += `- Testers active: ${testers7d}\n`;
      msg += `- Sessions: ${sessions7d}\n`;

      await sendTelegram(chatId, msg);
      return new Response('OK', { status: 200 });
    }
    if (!TELEGRAM_CHAT_ID || chatId !== TELEGRAM_CHAT_ID) return new Response('OK', { status: 200 });
    if (!text) return new Response('OK', { status: 200 });
    const specificMatch = text.match(/^(\d+):([1-7])$/);
    if (specificMatch) {
      const [, reportNumStr, option] = specificMatch;
      const { data: sessions } = await supabase.from('whatsapp_sessions').select('*').eq('from_number', `telegram:${chatId}`).in('status', ['bug_pending']).order('created_at', { ascending: false }).limit(20);
      const matched = (sessions as Record<string, unknown>[] | null)?.find((s) => String(s.report_number) === reportNumStr);
      if (matched) { const reply = await handleBugReply(option, matched, supabase, chatId); if (reply) await sendTelegram(chatId, reply); }
      else { await sendTelegram(chatId, `Report #${reportNumStr} not found.`); }
      return new Response('OK', { status: 200 });
    }
    const cutoff = new Date(Date.now() - REPLY_WINDOW).toISOString();
    const { data: active } = await supabase.from('whatsapp_sessions').select('*').eq('from_number', `telegram:${chatId}`).in('status', ['bug_pending', 'crash_pending']).gte('created_at', cutoff).order('created_at', { ascending: false }).limit(1);
    const sess = (active as Record<string, unknown>[] | null)?.[0];
    if (sess) {
      const mt = sess.media_type as string;
      const reply = mt === 'bug' ? await handleBugReply(text.trim(), sess, supabase, chatId) : mt === 'crash' ? await handleCrashReply(text.trim(), supabase, chatId) : null;
      if (reply) await sendTelegram(chatId, reply);
    } else {
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (anthropicKey && !text.startsWith('/')) {
        const cr = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, system: 'You are the CAPS Poker assistant. CAPS is an iOS Omaha poker game with multiple boards. You help the developer (Roye) manage the app, analyze bugs, and make decisions. Be concise. Answer in Hebrew if the user writes in Hebrew. You have context about: build 295, OTA live, TestFlight live, recent sprints S78-S89.', messages: [{ role: 'user', content: text }] }) }).catch(() => null);
        const cd = cr ? await cr.json().catch(() => ({})) : {};
        const reply = (cd.content?.[0]?.text as string | null) ?? null;
        if (reply) { await sendTelegram(chatId, reply); return new Response('OK', { status: 200 }); }
      }
      await sendTelegram(chatId, 'No active session. Send a bug/crash reply or ask me anything!');
    }
    return new Response('OK', { status: 200 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
