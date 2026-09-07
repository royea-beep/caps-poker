import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI = Deno.env.get('OPENAI_API_KEY') ?? '';
const CURRENT_OTA = 'd36473c0';

// TOKEN ROTATION 2026-09-06 — SECURITY INCIDENT, AND WHY THERE IS NO FALLBACK HERE.
//
// A LIVE Telegram bot token and the chat id were literals in this file, in a PUBLIC repository,
// from the day it was first committed. A third party read them and rewrote @caps_bug_bot's display
// name and description; they could equally have read every bug report submitted through it — free
// text, device ids, breadcrumbs — sent messages as the bot, or deleted them. Roye revoked that
// token via BotFather. THE REVOKE IS THE PROTECTION. Removing the literal from this file only
// prevents the NEXT leak; the old value is in git history forever and cannot be taken back.
//
// The replacement lives ONLY in the Supabase vault as TELEGRAM_BOT_TOKEN, read through
// get_caps_bug_telegram_config(). Deno.env is preferred if an Edge Function secret of the same
// name has been set; otherwise the vault. If NEITHER yields a token this THROWS.
//
// ⚠️ DO NOT ADD A FALLBACK TO CAPS_BUG_BOT_TOKEN. That vault row still holds the REVOKED token,
// and falling back onto it would look exactly like working while delivering nothing — which is
// precisely how the triage bug hid for months.
let TG_BOT_TOKEN = '';
let TG_CHAT_ID = '';

async function loadTelegramConfig(supabase: ReturnType<typeof createClient>): Promise<void> {
  if (TG_BOT_TOKEN && TG_CHAT_ID) return; // cached for the lifetime of this isolate

  // THE VAULT IS FIRST, AND THAT ORDER IS LOAD-BEARING. An Edge Function secret named
  // TELEGRAM_BOT_TOKEN already exists for telegram-bot-handler and, until someone updates it by
  // hand in the dashboard, it still holds the REVOKED token. Preferring the environment would
  // therefore have quietly reinstated the dead credential the moment this shipped. The vault is
  // the copy that was actually rotated, so the vault wins; the env var is only a fallback for a
  // future where it has been updated too.
  const { data, error } = await supabase.rpc('get_caps_bug_telegram_config');
  const vaultTok = (data as Record<string, unknown> | null)?.bot_token as string | undefined;
  const vaultCid = (data as Record<string, unknown> | null)?.chat_id as string | undefined;
  if (vaultTok && vaultCid) { TG_BOT_TOKEN = vaultTok; TG_CHAT_ID = vaultCid; return; }

  const envTok = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const envCid = Deno.env.get('CAPS_BUG_CHAT_ID') ?? Deno.env.get('TELEGRAM_CHAT_ID');
  if (envTok && envCid) { TG_BOT_TOKEN = envTok; TG_CHAT_ID = envCid; return; }

  throw new Error('TELEGRAM CONFIG UNAVAILABLE: neither the vault nor the TELEGRAM_BOT_TOKEN '
    + 'env var yielded credentials. Refusing to run. ' + (error?.message ?? 'no vault data'));
}

// TOKEN ROTATION 2026-09-06 — tgSend USED TO SWALLOW EVERY FAILURE (`.catch(() => {})`), so a
// revoked token, a wrong chat id and a Telegram outage all looked identical to success: silent.
// That is the same silent-failure class as the triage bug, and it is exactly what would have
// hidden a botched rotation. It now returns Telegram's own verdict and processReport records it.
async function tgSend(text: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(15000),
    });
    const d = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (r.ok && d?.ok === true) return { ok: true, detail: 'sent' };
    return { ok: false, detail: `http_${r.status}:${String(d?.description ?? 'no description').slice(0, 160)}` };
  } catch (e) {
    return { ok: false, detail: `network:${(e as Error)?.name ?? 'unknown'}` };
  }
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

// ── TRIAGE ────────────────────────────────────────────────────────────────────
// PRE-INVITE 2026-09-06 — A RESPONSE WITH NO `content` IS A FAILURE, NOT AN EMPTY SUCCESS.
//
// The previous version read the model's answer as `(d.content?.[0]?.text ?? EMPTY_OBJECT)`.
// EVERY error body the Messages API returns — 400, 401, 404, 429, 529, and every network abort —
// has no `content` array, so `raw` became a two-character string that parses PERFECTLY. The
// `catch` that was supposed to hold the fallback therefore never ran. `triage.summary` and all
// six siblings came back `undefined`, the row was stamped `status:'analyzed'`, and the tester's
// report was silently emptied while every surface said it had been triaged.
//
// PROVEN ON THIS FUNCTION, IN PRODUCTION, 2026-09-06: deployed once with a deliberately invalid
// model id, report 1579 came back status `triage_failed`, needs_review true,
// metadata.triage_ai_error `http_404:not_found_error:model: caps-probe-invalid-model`, and
// ai_summary equal to the tester's own description. Restored immediately afterwards; report 1580
// then triaged normally. The AI call itself is NOT broken — it answered report 1578 correctly.
const AI_MODEL = 'claude-haiku-4-5-20251001';
const AI_TIMEOUT_MS = 20000;

interface Triage {
  summary: string;
  severity: string;
  screen: string;
  suggested_fix: string | null;
  steps: string[];
  classification: string;
}

type TriageOutcome = { triage: Triage; ai_error: string | null };

// The non-AI path. Nothing in here can produce `undefined`, and `summary` is what the tester
// typed — unsummarised, but readable by a human, which is the point.
function fallbackTriage(description: string | null, screen: string): Triage {
  const words = (description ?? '').trim();
  return {
    summary: words.length > 0
      ? words.slice(0, 1000)
      : 'No description supplied — see screenshot, breadcrumbs and console log.',
    severity: 'medium',
    screen: screen || 'unknown',
    suggested_fix: null,
    steps: [],
    classification: 'UX_FEEDBACK',
  };
}

async function triageWithAI(description: string | null, screen: string): Promise<TriageOutcome> {
  const fallback = fallbackTriage(description, screen);
  if (!ANTHROPIC) return { triage: fallback, ai_error: 'no_api_key' };

  const prompt = `You are QA for CAPS Poker — iOS Omaha poker game with multiple boards.\n\nUser description (Hebrew): "${description ?? 'no description'}"\nScreen: ${screen}\n\nCRITICAL RULES:\n- Base analysis ONLY on what the user described.\n- If user asks for 3D floating cards → that is a feature request, not a bug.\n- Do NOT mention tester fields or undefined values.\n- Answer in English JSON only.\n\nRespond ONLY with JSON:\n{"summary":"one sentence","severity":"low|medium|high|critical","screen":"screen name","suggested_fix":"concrete fix","steps":["step1","step2"],"classification":"BUG|UX_FEEDBACK|FEATURE_REQUEST|UX_CRITICAL"}`;

  let r: Response;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      // There was no timeout at all. A hung call held the whole report hostage.
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (e) {
    return { triage: fallback, ai_error: `network:${(e as Error)?.name ?? 'unknown'}` };
  }

  const body = (await r.json().catch(() => null)) as Record<string, unknown> | null;

  if (!r.ok) {
    const err = (body?.error ?? {}) as Record<string, unknown>;
    return {
      triage: fallback,
      ai_error: `http_${r.status}:${String(err.type ?? '?')}:${String(err.message ?? '').slice(0, 200)}`,
    };
  }

  // THE FIX, NAMED. No `?? '{}'`. No content means no triage.
  const blocks = Array.isArray(body?.content) ? (body!.content as Array<Record<string, unknown>>) : null;
  const textBlock = blocks?.find((b) => b?.type === 'text');
  const text = typeof textBlock?.text === 'string' ? textBlock.text : '';
  if (!text.trim()) return { triage: fallback, ai_error: 'no_content' };

  const raw = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { triage: fallback, ai_error: 'unparseable_json' };
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) return { triage: fallback, ai_error: 'no_summary_field' };

  return {
    ai_error: null,
    triage: {
      summary,
      severity: typeof parsed.severity === 'string' && parsed.severity ? parsed.severity : 'medium',
      screen: typeof parsed.screen === 'string' && parsed.screen ? parsed.screen : (screen || 'unknown'),
      suggested_fix: typeof parsed.suggested_fix === 'string' ? parsed.suggested_fix : null,
      steps: Array.isArray(parsed.steps) ? parsed.steps.map((s) => String(s)) : [],
      classification: typeof parsed.classification === 'string' && parsed.classification ? parsed.classification : 'UX_FEEDBACK',
    },
  };
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
  const { triage, ai_error: aiError } = await triageWithAI(description, lastScreen);
  const classification = triage.classification || 'UX_FEEDBACK';

  // PRE-INVITE 2026-09-06 — the status now tells the truth. A row that the model never actually
  // read is `triage_failed`, not `analyzed`, and carries WHY on metadata.triage_ai_error.
  // `ai_summary` is non-null either way: the model's sentence, or the tester's own words.
  await supabase.from('bug_reports').update({
    status: aiError ? 'triage_failed' : 'analyzed',
    needs_review: aiError !== null,
    classification,
    ai_summary: triage.summary,
    ai_severity: triage.severity,
    ai_screen: triage.screen,
    ai_suggested_fix: triage.suggested_fix,
    ai_steps: triage.steps,
    metadata: { ...meta, triage_at: new Date().toISOString(), triage_ai_error: aiError },
  }).eq('id', id);

  // 3. Build Telegram message
  const sev = (triage.severity ?? 'medium').toUpperCase();
  const sevEmoji: Record<string,string> = { CRITICAL:'🔴', HIGH:'🟠', MEDIUM:'🟡', LOW:'🟢' };
  const otaId = (meta.otaUpdateId as string ?? rep.ota_id as string ?? '?').slice(0,8);
  const otaWarning = otaId !== CURRENT_OTA.slice(0,8) ? `\n⚠️ OLD OTA: ${otaId} (current: ${CURRENT_OTA.slice(0,8)})` : '';
  const crumbPath = breadcrumbs.filter((c,i,a) => i===0||c.screen!==a[i-1].screen).map(c=>c.screen).join(' → ');
  const dur = (meta.recordingDuration as number) ?? 0;

  // Get report number
  const { data: inserted } = await supabase.from('whatsapp_sessions').insert({
    message_sid: `tg-auto-${Date.now()}`,
    from_number: `telegram:${TG_CHAT_ID}`,
    raw_input: triage.summary,
    media_type: 'bug',
    claude_plan: { bug_report_id: id, fix_prompt: triage.suggested_fix ? `Fix: ${triage.suggested_fix}` : `Needs triage: ${triage.summary.slice(0,200)}`, ai_summary: triage.summary, audio_url: audioUrl },
    status: 'bug_pending',
  }).select('report_number').single();
  const reportNum = (inserted as Record<string,unknown>)?.report_number ?? 0;

  // A failed triage is announced, not hidden behind a plausible-looking card.
  const aiLine = aiError ? `\n\u26a0\ufe0f AI TRIAGE FAILED (${aiError}) — summary below is the tester's own words.` : '';

  const msg = [
    `${sevEmoji[sev]??'?'} <b>BUG #${reportNum} — ${sev}</b> [${classification}]${aiLine}`,
    `📱 ${dev.model??'?'} iOS ${dev.osVersion??''} Build ${dev.buildNumber??''}${otaWarning}`,
    `⏱ ${dur}s`,
    '',
    `<b>Summary:</b> ${triage.summary}`,
    `📍 ${triage.screen}`,
    triage.suggested_fix ? `🔧 <i>${triage.suggested_fix.slice(0,200)}</i>` : '',
    description ? `\n🎤 "${description.slice(0,300)}"` : '',
    crumbPath ? `\n🧭 ${crumbPath}` : '',
    screenshotUrl ? `\n🖼 <a href="${screenshotUrl}">Screenshot</a>` : '',
    audioUrl ? `🎧 <a href="${audioUrl}">Audio</a>` : '',
  ].filter(Boolean).join('\n');

  // Send screenshot first if available
  if (screenshotUrl) {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, photo: screenshotUrl, caption: `#${reportNum}: ${triage.summary.slice(0,100)}` }),
    }).catch(() => {});
  }

  const delivery = await tgSend(msg);

  // The row now records whether the report actually REACHED Roye. Before this, a report could be
  // triaged perfectly and never arrive, with nothing anywhere saying so — which is precisely how
  // a botched token rotation would have gone unnoticed.
  await supabase.from('bug_reports').update({
    telegram_notified: delivery.ok,
    metadata: { ...meta, triage_at: new Date().toISOString(), triage_ai_error: aiError, telegram_delivery: delivery.detail },
  }).eq('id', id);
}
