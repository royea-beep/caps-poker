import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// PRE-INVITE 2026-09-06 — a LIVE Telegram bot token and chat id were literals in this file, and
// have been in git history since it was first committed. analyze-bug-report was de-hardcoded onto
// the vault on 2026-05-24; this copy was missed. Same RPC, same env-var fallback.
// ⚠️ The token is still exposed in history and should be rotated — that is Roye's call, not ours.
let BOT_TOKEN = '';
let CHAT_ID = '';

async function loadTelegramConfig(supabase: ReturnType<typeof createClient>): Promise<void> {
  if (BOT_TOKEN && CHAT_ID) return;
  const envTok = Deno.env.get('CAPS_BUG_BOT_TOKEN');
  const envCid = Deno.env.get('CAPS_BUG_CHAT_ID');
  if (envTok && envCid) { BOT_TOKEN = envTok; CHAT_ID = envCid; return; }
  const { data, error } = await supabase.rpc('get_caps_bug_telegram_config');
  if (error || !data) throw new Error('Failed to load telegram config from vault: ' + (error?.message ?? 'no data'));
  BOT_TOKEN = data.bot_token as string;
  CHAT_ID = data.chat_id as string;
}

async function tgSend(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  }).catch(() => {});
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

// PRE-INVITE 2026-09-06 — SAME DEFECT AS analyze-bug-report, SAME FIX.
// `(d.content?.[0]?.text ?? '{}')` turned every API error body into a clean-parsing empty
// object, so a failed call looked like a successful one with every field `undefined`. A call
// that returns no usable text is now a failure, and the fallback carries the tester's words.
const AI_MODEL = 'claude-haiku-4-5-20251001';
const AI_TIMEOUT_MS = 20000;

interface Triage {
  summary: string;
  severity: string;
  screen: string;
  suggested_fix: string | null;
  steps: string[];
}

type TriageOutcome = { triage: Triage; ai_error: string | null };

function fallbackTriage(description: string | null): Triage {
  const words = (description ?? '').trim();
  return {
    summary: words.length > 0
      ? words.slice(0, 1000)
      : 'No description supplied — see screenshot, breadcrumbs and console log.',
    severity: 'medium',
    screen: 'unknown',
    suggested_fix: null,
    steps: [],
  };
}

async function triageWithAI(description: string | null, audioUrl: string | null, screenshotUrl: string | null, breadcrumbs: unknown[]): Promise<TriageOutcome> {
  const fallback = fallbackTriage(description);
  if (!ANTHROPIC) return { triage: fallback, ai_error: 'no_api_key' };

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

  let r: Response;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (e) {
    return { triage: fallback, ai_error: `network:${(e as Error)?.name ?? 'unknown'}` };
  }

  const body = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok) {
    const err = (body?.error ?? {}) as Record<string, unknown>;
    return { triage: fallback, ai_error: `http_${r.status}:${String(err.type ?? '?')}:${String(err.message ?? '').slice(0, 200)}` };
  }

  const blocks = Array.isArray(body?.content) ? (body!.content as Array<Record<string, unknown>>) : null;
  const textBlock = blocks?.find((b) => b?.type === 'text');
  const text = typeof textBlock?.text === 'string' ? textBlock.text : '';
  if (!text.trim()) return { triage: fallback, ai_error: 'no_content' };

  const raw = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw) as Record<string, unknown>; }
  catch { return { triage: fallback, ai_error: 'unparseable_json' }; }

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) return { triage: fallback, ai_error: 'no_summary_field' };

  return {
    ai_error: null,
    triage: {
      summary,
      severity: typeof parsed.severity === 'string' && parsed.severity ? parsed.severity : 'medium',
      screen: typeof parsed.screen === 'string' && parsed.screen ? parsed.screen : 'unknown',
      suggested_fix: typeof parsed.suggested_fix === 'string' ? parsed.suggested_fix : null,
      steps: Array.isArray(parsed.steps) ? parsed.steps.map((x) => String(x)) : [],
    },
  };
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  await loadTelegramConfig(supabase);

  // A `triage_failed` row DOES carry an ai_summary — the tester's own words — so filtering on
  // `ai_summary IS NULL` alone would never re-pick one and this retry path would be dead on
  // arrival. Either shape qualifies: never triaged, or triaged and the AI call failed.
  const { data: reports } = await supabase
    .from('bug_reports')
    .select('*')
    .in('status', ['open', 'analyzing', 'triage_failed'])
    .or('ai_summary.is.null,status.eq.triage_failed')
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

    // 2. AI triage.
    // The tester's TYPED description was being discarded here: only `transcription` was passed,
    // so a text-only report reached the model as "(no verbal description)" and, on a failed call,
    // fell back to "No description supplied" over a report that had a description all along.
    const described = ((rep.description as string | null) ?? null) || transcription;
    const { triage, ai_error: aiError } = await triageWithAI(described, audioUrl, screenshotUrl, breadcrumbs);

    // 3. Classify
    const sev = triage.severity;
    const summary = triage.summary;
    const fix = triage.suggested_fix ?? '';
    const text = (summary + ' ' + fix).toLowerCase();
    let classification = 'UX_FEEDBACK';
    if (/crash|exception|error|freeze/.test(text)) classification = 'BUG';
    else if (/audio|sound/.test(text)) classification = 'BUG';
    else if (sev === 'critical') classification = 'UX_CRITICAL';
    else if (/feature|request|want|add/.test(text)) classification = 'FEATURE_REQUEST';

    // 4. Update DB
    await supabase.from('bug_reports').update({
      status: aiError ? 'triage_failed' : 'analyzed',
      needs_review: aiError !== null,
      classification,
      ai_summary: summary,
      ai_severity: sev,
      ai_screen: triage.screen,
      ai_suggested_fix: triage.suggested_fix,
      ai_steps: triage.steps,
      metadata: { ...meta, triage_at: new Date().toISOString(), triage_ai_error: aiError },
    }).eq('id', id);

    // 5. Send to Telegram with full context
    const sevEmoji: Record<string,string> = { critical: '', high: '', medium: '', low: '' };
    const dur = meta.recordingDuration as number ?? 0;
    const crumbPath = (breadcrumbs as Array<{ts:string;screen:string}>)
      .filter((c,i,a) => i === 0 || c.screen !== a[i-1].screen)
      .map(c => c.screen).join(' → ');

    const msg = [
      `${sevEmoji[sev] ?? ''} <b>BUG ${sev.toUpperCase()}</b> — ${classification}`,
      aiError ? `\u26a0\ufe0f AI TRIAGE FAILED (${aiError}) — summary below is the tester's own words.` : '',
      `📱 ${device.model ?? '?'} iOS ${device.osVersion ?? ''} Build ${device.buildNumber ?? ''}`,
      `⏱ ${dur}s recording`,
      '',
      `<b>Summary:</b> ${summary}`,
      `📍 Screen: ${triage.screen}`,
      fix ? `🔧 Fix: ${fix.slice(0, 200)}` : '',
      described ? `\n🎤 User said: "${described.slice(0, 300)}"` : '',
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
