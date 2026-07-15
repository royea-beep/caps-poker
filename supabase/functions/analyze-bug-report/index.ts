import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI = Deno.env.get('OPENAI_API_KEY') ?? '';
const CURRENT_OTA = 'd36473c0';

// De-hardcoded 2026-05-24: BOT_TOKEN and CHAT_ID now come from vault via
// public.get_caps_bug_telegram_config() RPC (service-role only). Env-var
// fallback so Roye can later set CAPS_BUG_BOT_TOKEN / CAPS_BUG_CHAT_ID
// in the dashboard and skip the RPC round-trip.
let TG_BOT_TOKEN = '';
let TG_CHAT_ID = '';

async function loadTelegramConfig(supabase: ReturnType<typeof createClient>): Promise<void> {
  if (TG_BOT_TOKEN && TG_CHAT_ID) return; // cached for the lifetime of this isolate
  const envTok = Deno.env.get('CAPS_BUG_BOT_TOKEN');
  const envCid = Deno.env.get('CAPS_BUG_CHAT_ID');
  if (envTok && envCid) {
    TG_BOT_TOKEN = envTok;
    TG_CHAT_ID = envCid;
    return;
  }
  const { data, error } = await supabase.rpc('get_caps_bug_telegram_config');
  if (error || !data) throw new Error('Failed to load telegram config from vault: ' + (error?.message ?? 'no data'));
  TG_BOT_TOKEN = envTok ?? (data.bot_token as string);
  TG_CHAT_ID = envCid ?? (data.chat_id as string);
}

async function tgSend(text: string) {
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

async function transcribe(audioUrl: string): Promise<string | null> {
  if (!OPENAI) return null;
  try {
    const r = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const blob = await r.blob();
    const form = new FormData();
    form.append('file', blob, 'audio.m4a');
    form.append('model', 'whisper-1');
    form.append('language', 'he');
    const wr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` },
      body: form, signal: AbortSignal.timeout(25000),
    });
    const d = await wr.json().catch(() => ({}));
    return d.text ?? null;
  } catch { return null; }
}

async function triageWithAI(description: string | null, screen: string): Promise<Record<string, unknown>> {
  if (!ANTHROPIC) return { summary: description ?? 'Bug report', severity: 'medium', screen, suggested_fix: 'Review the report', steps: [] };
  const prompt = `You are QA for CAPS Poker — iOS Omaha poker game with multiple boards.\n\nUser description (Hebrew): "${description ?? 'no description'}"\nScreen: ${screen}\n\nCRITICAL RULES:\n- Base analysis ONLY on what the user described.\n- If user asks for 3D floating cards → that is a feature request, not a bug.\n- Do NOT mention tester fields or undefined values.\n- Answer in English JSON only.\n\nRespond ONLY with JSON:\n{\"summary\":\"one sentence\",\"severity\":\"low|medium|high|critical\",\"screen\":\"screen name\",\"suggested_fix\":\"concrete fix\",\"steps\":[\"step1\",\"step2\"],\"classification\":\"BUG|UX_FEEDBACK|FEATURE_REQUEST|UX_CRITICAL\"}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  const d = await r.json();
  const raw = (d.content?.[0]?.text ?? '{}').replace(/```json?\n?/g,'').replace(/```/g,'').trim();
  try { return JSON.parse(raw); } catch { return { summary: description ?? 'Bug', severity: 'medium', screen, suggested_fix: 'Review report', steps: [], classification: 'UX_FEEDBACK' }; }
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  await loadTelegramConfig(supabase);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const reportId = body.bug_report_id as string | null;
  if (!reportId) {
    // Batch mode: process all open pending
    const { data: reports } = await supabase
      .from('bug_reports')
      .select('*')
      .in('status', ['open'])
      .is('ai_summary', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!reports?.length) return new Response(JSON.stringify({ processed: 0 }), { status: 200 });

    let count = 0;
    for (const rep of reports as Record<string, unknown>[]) {
      await processReport(rep, supabase);
      count++;
    }
    return new Response(JSON.stringify({ processed: count }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  // Single report mode
  const { data: rep } = await supabase.from('bug_reports').select('*').eq('id', reportId).single();
  if (!rep) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  await processReport(rep as Record<string, unknown>, supabase);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});

async function processReport(rep: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const id = rep.id as string;
  const audioUrl = rep.audio_url as string | null;
  const breadcrumbs = (rep.breadcrumbs as Array<{ts:string;screen:string}>) ?? [];
  const lastScreen = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length-1].screen : 'unknown';
  const dev = (rep.device_info as Record<string,string>) ?? {};
  const meta = (rep.metadata as Record<string,unknown>) ?? {};
  const screenshotUrl = rep.video_url as string | null;

  // 1. Transcribe FIRST
  let description = rep.description as string | null;
  if (!description && audioUrl) {
    description = await transcribe(audioUrl);
    if (description) {
      await supabase.from('bug_reports').update({ description }).eq('id', id);
    }
  }

  // 2. Triage with AI
  const triage = await triageWithAI(description, lastScreen);
  const classification = (triage.classification as string) || 'UX_FEEDBACK';

  await supabase.from('bug_reports').update({
    status: 'analyzed',
    classification,
    ai_summary: triage.summary,
    ai_severity: triage.severity,
    ai_screen: triage.screen,
    ai_suggested_fix: triage.suggested_fix,
    ai_steps: triage.steps,
  }).eq('id', id);

  // 3. Build Telegram message
  const sev = ((triage.severity as string) ?? 'medium').toUpperCase();
  const sevEmoji: Record<string,string> = { CRITICAL:'🔴', HIGH:'🟠', MEDIUM:'🟡', LOW:'🟢' };
  const otaId = (meta.otaUpdateId as string ?? rep.ota_id as string ?? '?').slice(0,8);
  const otaWarning = otaId !== CURRENT_OTA.slice(0,8) ? `\n⚠️ OLD OTA: ${otaId} (current: ${CURRENT_OTA.slice(0,8)})` : '';
  const crumbPath = breadcrumbs.filter((c,i,a) => i===0||c.screen!==a[i-1].screen).map(c=>c.screen).join(' → ');
  const dur = (meta.recordingDuration as number) ?? 0;

  // Get report number
  const { data: inserted } = await supabase.from('whatsapp_sessions').insert({
    message_sid: `tg-auto-${Date.now()}`,
    from_number: `telegram:${TG_CHAT_ID}`,
    raw_input: triage.summary as string,
    media_type: 'bug',
    claude_plan: { bug_report_id: id, fix_prompt: `Fix: ${triage.suggested_fix}`, ai_summary: triage.summary, audio_url: audioUrl },
    status: 'bug_pending',
  }).select('report_number').single();
  const reportNum = (inserted as Record<string,unknown>)?.report_number ?? 0;

  const msg = [
    `${sevEmoji[sev]??'?'} <b>BUG #${reportNum} — ${sev}</b> [${classification}]`,
    `📱 ${dev.model??'?'} iOS ${dev.osVersion??''} Build ${dev.buildNumber??''}${otaWarning}`,
    `⏱ ${dur}s`,
    '',
    `<b>Summary:</b> ${triage.summary}`,
    `📍 ${triage.screen}`,
    triage.suggested_fix ? `🔧 <i>${(triage.suggested_fix as string).slice(0,200)}</i>` : '',
    description ? `\n🎤 "${description.slice(0,300)}"` : '',
    crumbPath ? `\n🧭 ${crumbPath}` : '',
    screenshotUrl ? `\n🖼 <a href="${screenshotUrl}">Screenshot</a>` : '',
    audioUrl ? `🎧 <a href="${audioUrl}">Audio</a>` : '',
  ].filter(Boolean).join('\n');

  // Send screenshot first if available
  if (screenshotUrl) {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, photo: screenshotUrl, caption: `#${reportNum}: ${(triage.summary as string).slice(0,100)}` }),
    }).catch(() => {});
  }

  await tgSend(msg);
}
