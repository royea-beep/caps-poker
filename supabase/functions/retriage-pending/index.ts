import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI = Deno.env.get('OPENAI_API_KEY') ?? '';
const BOT_TOKEN = '8732793466:AAEI5_92OWkGvFGyr1aOH5tyBK3-0U4XZYM';
const CHAT_ID = '5002917348';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function tgSend(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
}

async function transcribeAudio(url: string): Promise<string | null> {
  if (!OPENAI) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const blob = await r.blob();
    const form = new FormData();
    form.append('file', blob, 'audio.m4a');
    form.append('model', 'whisper-1');
    form.append('language', 'he');
    const wr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: form, signal: AbortSignal.timeout(25000),
    });
    const d = await wr.json().catch(() => ({}));
    return d.text ?? null;
  } catch { return null; }
}

async function triageWithAI(description: string | null, audioUrl: string | null, screenshotUrl: string | null, breadcrumbs: unknown[]): Promise<Record<string, unknown>> {
  const crumbPath = (breadcrumbs as Array<{ts:string;screen:string}>).map(c => `${c.ts?.slice(11,19)} -> ${c.screen}`).join('\n');
  const ctx = description ? `User described: "${description}"` : '(no verbal description)';
  const prompt = `You are QA for CAPS Poker — iOS Omaha poker game with multiple boards.
Analyze this bug report.

${ctx}

Navigation path:
${crumbPath || 'unknown'}

Screenshot: ${screenshotUrl ?? 'none'}

Based on the navigation path: the user went through sit-and-go, settings, game, and results screens.
Identify what the bug likely is based on WHERE they reported it and what they described.

Respond ONLY with JSON:
{"summary":"one sentence","severity":"low|medium|high|critical","screen":"screen name","suggested_fix":"concrete fix","steps":["step1","step2"]}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  const d = await r.json();
  const raw = (d.content?.[0]?.text ?? '{}').replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(raw); } catch { return { summary: 'Bug report — needs review', severity: 'medium', screen: 'unknown', suggested_fix: 'Review audio and screenshot', steps: [] }; }
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: reports } = await supabase
    .from('bug_reports')
    .select('*')
    .in('status', ['open', 'analyzing'])
    .is('ai_summary', null)
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });

  if (!reports?.length) {
    await tgSend('No pending reports to triage.');
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  await tgSend(`Processing ${reports.length} unanalyzed bug reports...`);

  for (const rep of reports as Record<string, unknown>[]) {
    const id = rep.id as string;
    const audioUrl = rep.audio_url as string | null;
    const screenshotUrl = rep.video_url as string | null;
    const breadcrumbs = (rep.breadcrumbs as unknown[]) ?? [];
    const device = (rep.device_info as Record<string,string>) ?? {};
    const meta = (rep.metadata as Record<string,unknown>) ?? {};

    // 1. Transcribe audio if available
    let transcription: string | null = null;
    if (audioUrl) {
      transcription = await transcribeAudio(audioUrl);
      if (transcription) {
        await supabase.from('bug_reports').update({ description: transcription }).eq('id', id);
      }
    }

    // 2. AI triage
    const triage = await triageWithAI(transcription, audioUrl, screenshotUrl, breadcrumbs);

    // 3. Classify
    const sev = triage.severity as string;
    const summary = triage.summary as string;
    const fix = triage.suggested_fix as string;
    const text = (summary + ' ' + fix).toLowerCase();
    let classification = 'UX_FEEDBACK';
    if (/crash|exception|error|freeze/.test(text)) classification = 'BUG';
    else if (/audio|sound/.test(text)) classification = 'BUG';
    else if (sev === 'critical') classification = 'UX_CRITICAL';
    else if (/feature|request|want|add/.test(text)) classification = 'FEATURE_REQUEST';

    // 4. Update DB
    await supabase.from('bug_reports').update({
      status: 'analyzed',
      classification,
      ai_summary: summary,
      ai_severity: sev,
      ai_screen: triage.screen as string,
      ai_suggested_fix: fix,
      ai_steps: triage.steps,
    }).eq('id', id);

    // 5. Send to Telegram with full context
    const sevEmoji: Record<string,string> = { critical: '', high: '', medium: '', low: '' };
    const dur = meta.recordingDuration as number ?? 0;
    const crumbPath = (breadcrumbs as Array<{ts:string;screen:string}>)
      .filter((c,i,a) => i === 0 || c.screen !== a[i-1].screen)
      .map(c => c.screen).join(' → ');

    const msg = [
      `${sevEmoji[sev] ?? ''} <b>BUG ${sev.toUpperCase()}</b> — ${classification}`,
      `📱 ${device.model ?? '?'} iOS ${device.osVersion ?? ''} Build ${device.buildNumber ?? ''}`,
      `⏱ ${dur}s recording`,
      '',
      `<b>Summary:</b> ${summary}`,
      `📍 Screen: ${triage.screen as string}`,
      `🔧 Fix: ${fix.slice(0, 200)}`,
      transcription ? `\n🎤 User said: "${transcription.slice(0, 300)}"` : '',
      '',
      `🧭 Path: ${crumbPath}`,
      screenshotUrl ? `\n🖼 <a href="${screenshotUrl}">Screenshot</a>` : '',
      audioUrl ? `🎧 <a href="${audioUrl}">Audio recording</a>` : '',
    ].filter(s => s !== undefined).join('\n');

    await tgSend(msg);
    await new Promise(r => setTimeout(r, 500));
  }

  await tgSend(`Done. ${reports.length} reports analyzed and sent.`);
  return new Response(JSON.stringify({ processed: reports.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
