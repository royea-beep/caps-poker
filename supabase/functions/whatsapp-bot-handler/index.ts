import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Multi-project routing ───────────────────────────────────────────────────

const REPO_MAP: Record<string, string> = {
  'caps-poker':       'royea-beep/caps-poker',
  'wingman':          'royea-beep/wingman',
  'keydrop':          'royea-beep/KeyDrop',
  'analyzer':         'royea-beep/analyzer-standalone',
  'explainit':        'royea-beep/ExplainIt',
  'postpilot':        'royea-beep/PostPilot',
  'ftable':           'royea-beep/ftable',
  'letsmakebillions': 'royea-beep/letsmakebillions',
};

const PROJECT_KEYWORDS: Record<string, string[]> = {
  'caps-poker':       ['caps', 'poker', 'קלפים', 'קפס', 'בורד', 'board', 'omaha'],
  'wingman':          ['wingman', 'ווינגמן', 'שידוך', 'dating', 'מינגמן'],
  'keydrop':          ['keydrop', 'key drop', 'מפתח', 'קיידרופ', 'credentials'],
  'analyzer':         ['analyzer', 'אנלייזר', 'מנתח', 'analyse', 'analyze', 'product'],
  'explainit':        ['explainit', 'explain', 'הסבר', 'אקספליין', 'video', 'וידאו'],
  'postpilot':        ['postpilot', 'post pilot', 'פוסט', 'social', 'scheduler'],
  'ftable':           ['ftable', 'פנטזי', 'fantasy', 'football', 'שולחן'],
  'letsmakebillions': ['billions', 'ביליונים', 'crypto', 'קריפטו', 'trading', 'whale'],
};

const PROJECT_STACKS: Record<string, string> = {
  'caps-poker':       'React Native + Expo SDK 55, Omaha poker game',
  'wingman':          'Next.js + Supabase, social matchmaking app',
  'keydrop':          'Next.js + Prisma + Neon, encrypted one-time credential links',
  'analyzer':         'Next.js + Claude Vision + LemonSqueezy, product analyzer',
  'explainit':        'Next.js + Playwright, explainer video generator',
  'postpilot':        'Next.js + Prisma, social media post scheduler',
  'ftable':           'Vanilla JS, fantasy football table game',
  'letsmakebillions': 'Python + Railway, crypto trading bot',
};

function detectProject(text: string): string {
  const lower = text.toLowerCase();
  for (const [project, keywords] of Object.entries(PROJECT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return project;
  }
  return 'caps-poker'; // default
}

// ── Twilio signature verification ──────────────────────────────────────────

async function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort();
  let str = url;
  for (const key of sortedKeys) {
    str += key + params[key];
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TWILIO_AUTH_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(str));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  return computed === signature;
}

// ── Twilio send message ─────────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: to,
    Body: body,
  });
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}

// ── Transcribe audio via OpenAI Whisper ────────────────────────────────────

async function transcribeAudio(mediaUrl: string): Promise<string> {
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${creds}` },
  });
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append('file', audioBlob, 'audio.ogg');
  form.append('model', 'whisper-1');
  form.append('language', 'he');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  return data.text ?? '';
}

// ── Describe image via Claude Vision ───────────────────────────────────────

async function describeImage(mediaUrl: string): Promise<string> {
  console.log('[whatsapp-bot] Fetching image from:', mediaUrl);
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const imgRes = await fetch(mediaUrl, {
    headers: { 'Authorization': `Basic ${creds}` },
  });

  console.log('[whatsapp-bot] Image fetch status:', imgRes.status, imgRes.headers.get('content-type'));

  if (!imgRes.ok) {
    throw new Error(`Image fetch failed: ${imgRes.status}`);
  }

  const imgBuf = await imgRes.arrayBuffer();
  const uint8 = new Uint8Array(imgBuf);

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  console.log('[whatsapp-bot] Image size:', imgBuf.byteLength, 'bytes, type:', contentType);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: contentType, data: base64 },
            },
            {
              type: 'text',
              text: 'תאר את צילום המסך הזה לדיווח באג. התמקד במה שגלוי על המסך, שגיאות, בעיות UI, או התנהגות לא צפויה. היה תמציתי בעברית.',
            },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  console.log('[whatsapp-bot] Vision response:', JSON.stringify(data).slice(0, 200));
  return data.content?.[0]?.text ?? '';
}

// ── GitHub file fetcher ────────────────────────────────────────────────────

async function fetchFileFromGitHub(repo: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3.raw',
        },
      },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const KEYWORD_FILES: Record<string, string[]> = {
  'קלף':         ['components/Card.tsx'],
  'card':         ['components/Card.tsx'],
  'בורד':         ['components/Board.tsx'],
  'board':        ['components/Board.tsx'],
  'סאונד':        ['utils/sounds.ts'],
  'sound':        ['utils/sounds.ts'],
  'audio':        ['utils/sounds.ts'],
  'quote':        ['components/ProQuoteBanner.tsx', 'constants/proQuotes.ts'],
  'ציטוט':       ['components/ProQuoteBanner.tsx', 'constants/proQuotes.ts'],
  'משפט':        ['components/ProQuoteBanner.tsx', 'constants/proQuotes.ts'],
  'שחקן':        ['components/ProQuoteBanner.tsx'],
  'complete':     ['components/CompleteOverlay.tsx'],
  'reveal':       ['hooks/useRevealSequence.ts'],
  'timer':        ['app/game.tsx'],
  'tutorial':     ['components/Tutorial.tsx'],
  'setting':      ['app/settings.tsx'],
  'הגדר':        ['app/settings.tsx'],
  'multiplayer':  ['utils/realtimeMultiplayer.ts'],
  'lobby':        ['app/lobby/host.tsx', 'app/lobby/internet-join.tsx'],
  'leaderboard':  ['app/leaderboard.tsx'],
  'chip':         ['components/ChipsDisplay.tsx', 'utils/economy.ts'],
  "צ'יפ":        ['components/ChipsDisplay.tsx', 'utils/economy.ts'],
};

function getRelevantFiles(message: string): string[] {
  const files = new Set<string>();
  const lower = message.toLowerCase();
  for (const [keyword, paths] of Object.entries(KEYWORD_FILES)) {
    if (lower.includes(keyword)) {
      paths.forEach((p) => files.add(p));
    }
  }
  return Array.from(files).slice(0, 3);
}

// ── Generate plan via Claude ────────────────────────────────────────────────

interface ClaudePlan {
  type: 'BUG' | 'FEATURE' | 'QUESTION';
  summary: string;
  severity: 'CRITICAL' | 'MEDIUM' | 'LOW';
  plan: string[];
  files: string[];
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  project?: string;
}

async function generatePlan(
  input: string,
  project: string,
  manifest: string | null,
  relevantFileContents: string[],
): Promise<ClaudePlan> {
  const stack = PROJECT_STACKS[project] ?? PROJECT_STACKS['caps-poker'];
  const manifestSection = manifest
    ? `PROJECT MANIFEST (source of truth — trust this over assumptions):\n${manifest}`
    : 'PROJECT MANIFEST: Not available';
  const filesSection = relevantFileContents.length > 0
    ? `RELEVANT SOURCE FILES (actual code from the repo):\n${relevantFileContents.join('\n')}`
    : 'RELEVANT SOURCE FILES: None fetched';

  const systemPrompt = `You are a dev assistant for the project: ${project} (${stack}).

${manifestSection}

${filesSection}

RULES:
- Base your plan ONLY on what you see in the manifest and source files above
- If a feature is described as "text only" in the manifest, do NOT suggest audio fixes
- If you can't find evidence of something in the code, say so explicitly
- Do NOT assume files or features exist — check the manifest first

Analyze this bug report or feature request.
CRITICAL: Respond ONLY in Hebrew (עברית). All text in your response must be in Hebrew.
Respond in this EXACT format (no extra text):
TYPE: BUG|FEATURE|QUESTION
SUMMARY: (תיאור קצר בעברית, עד 100 תווים)
SEVERITY: CRITICAL|MEDIUM|LOW
(CRITICAL = קריסה/שבירת gameplay, MEDIUM = בעיית UX/ויזואל, LOW = שיפור/polish)
PLAN:
1. (שינוי 1 בעברית)
2. (שינוי 2 בעברית)
FILES: file1.tsx, file2.ts
EFFORT: LOW|MEDIUM|HIGH`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: input }],
    }),
  });
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '';

  const typeMatch     = text.match(/TYPE:\s*(BUG|FEATURE|QUESTION)/);
  const summaryMatch  = text.match(/SUMMARY:\s*(.+)/);
  const severityMatch = text.match(/SEVERITY:\s*(CRITICAL|MEDIUM|LOW)/);
  const planMatch     = text.match(/PLAN:\n([\s\S]*?)(?=FILES:|$)/);
  const filesMatch    = text.match(/FILES:\s*(.+)/);
  const effortMatch   = text.match(/EFFORT:\s*(LOW|MEDIUM|HIGH)/);

  const planLines = planMatch?.[1]
    ?.split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean) ?? [];

  return {
    type:     (typeMatch?.[1]     ?? 'BUG')    as ClaudePlan['type'],
    summary:   summaryMatch?.[1]?.trim()        ?? 'Unknown issue',
    severity: (severityMatch?.[1] ?? 'MEDIUM') as ClaudePlan['severity'],
    plan:      planLines,
    files:    (filesMatch?.[1]    ?? '').split(',').map((f) => f.trim()).filter(Boolean),
    effort:   (effortMatch?.[1]   ?? 'MEDIUM') as ClaudePlan['effort'],
    project,
  };
}

// ── Count pending fixes since last deploy ──────────────────────────────────

async function countPendingFixes(supabase: ReturnType<typeof createClient>, project: string): Promise<number> {
  const { count } = await supabase
    .from('deploy_tracker')
    .select('*', { count: 'exact', head: true })
    .eq('project', project)
    .is('deployed_at', null);
  return count ?? 0;
}

// ── Bot recommendation logic ───────────────────────────────────────────────

function getBotRecommendation(severity: string, pendingFixes: number): { option: number; reason: string } {
  if (severity === 'CRITICAL') {
    return { option: 2, reason: 'באג קריטי — מומלץ לעדכן גרסה מיד' };
  }
  if (pendingFixes >= 5) {
    return { option: 2, reason: `כבר ${pendingFixes} תיקונים ממתינים — מומלץ לעדכן גרסה` };
  }
  if (pendingFixes >= 3 && severity === 'MEDIUM') {
    return { option: 2, reason: `${pendingFixes} תיקונים + באג בינוני — שווה לעדכן` };
  }
  return { option: 1, reason: 'תיקון קטן — שווה לצבור עוד לפני build חדש' };
}

// ── Trigger GitHub Actions ──────────────────────────────────────────────────

async function triggerGitHubAction(
  plan: ClaudePlan,
  project: string,
  eventType: 'claude-fix-no-build' | 'claude-fix-and-deploy',
): Promise<void> {
  const repo = REPO_MAP[project] ?? REPO_MAP['caps-poker'];
  await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: {
        summary:  plan.summary,
        plan:     plan.plan.join('\n'),
        files:    plan.files.join(', '),
        effort:   plan.effort,
        severity: plan.severity,
        type:     plan.type,
        project,
      },
    }),
  });
}

// ── Format reply message ────────────────────────────────────────────────────

function formatPlanReply(
  plan: ClaudePlan,
  pendingFixes: number,
  transcript?: string,
): string {
  const typeEmoji = plan.type === 'BUG' ? '🐛' : plan.type === 'FEATURE' ? '✨' : '❓';
  const typeHe    = plan.type === 'BUG' ? 'באג' : plan.type === 'FEATURE' ? 'פיצ\'ר' : 'שאלה';
  const effortHe  = plan.effort === 'LOW' ? 'נמוך' : plan.effort === 'HIGH' ? 'גבוה' : 'בינוני';
  const sevEmoji  = plan.severity === 'CRITICAL' ? '🔴' : plan.severity === 'MEDIUM' ? '🟡' : '🟢';

  const planText = plan.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const projectDisplay = plan.project ?? 'caps-poker';
  const transcriptSection = transcript ? `🎤 שמעתי: "${transcript}"\n\n` : '';

  const { option: recOption, reason: recReason } = getBotRecommendation(plan.severity, pendingFixes);
  const recText = recOption === 1
    ? `💡 המלצה: 1️⃣ (תיקון בלבד) — ${recReason}`
    : `💡 המלצה: 2️⃣ (תיקון + build) — ${recReason}`;

  return `${transcriptSection}${typeEmoji} סוג: ${typeHe} | פרויקט: ${projectDisplay}
חומרה: ${sevEmoji} ${plan.severity}

${plan.summary}

תוכנית:
${planText}

קבצים: ${plan.files.join(', ')}
מאמץ: ${effortHe}

═══════════════════
📊 תיקונים ממתינים מאז הגרסה האחרונה: ${pendingFixes}
═══════════════════

השב 1️⃣ לתיקון בלבד (commit, בלי build חדש)
השב 2️⃣ לתיקון + build חדש ל-TestFlight
השב 3️⃣ לביטול ❌

${recText}`;
}

// ── Merge window (60s) ──────────────────────────────────────────────────────
// When media arrives, we store it as 'pending_merge' and wait for more context.
// If a second message arrives within MERGE_WINDOW_MS, we combine them into one plan.
const MERGE_WINDOW_MS = 60_000;
const AUTO_CANCEL_STALE_MS = 5 * 60_000; // Only cancel old sessions (>5 min)

// ── Crash Control Panel (reply 1-7) ────────────────────────────────────────

const AUTO_FIX_KEY = 'caps_auto_fix_mode';
const CRASH_REPLY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

async function handleCrashReply(
  msgText: string,
  supabase: ReturnType<typeof createClient>,
  from: string,
): Promise<string | null> {
  const trimmed = msgText.trim();
  const upper = trimmed.toUpperCase();

  // Option 1: Auto-fix
  if (['1', 'FIX', 'תקן'].includes(upper)) {
    const { data: latest } = await supabase
      .from('bug_reports')
      .select('*')
      .ilike('title', '[CRASH]%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!latest) return 'אין דוח קריסה. שלח וידאו קודם.';
    // Trigger crash-analyzer
    const analyzerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crash-analyzer`;
    fetch(analyzerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ crashReportId: latest.id, autoApply: true, from }),
    }).catch(() => {});
    await supabase.from('whatsapp_sessions')
      .update({ status: 'crash_processing' })
      .eq('from_number', from)
      .eq('status', 'crash_pending');
    return '🔧 מנתח ומתקן... OTA תוך ~2 דקות.';
  }

  // Option 2: Show analysis
  if (trimmed === '2') {
    const { data: latest } = await supabase
      .from('bug_reports')
      .select('*')
      .ilike('title', '[CRASH]%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!latest) return 'אין דוח קריסה.';
    const analyzerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crash-analyzer`;
    fetch(analyzerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ crashReportId: latest.id, autoApply: false, from }),
    }).catch(() => {});
    return '🔍 מנתח... תוצאות תוך ~30 שניות.';
  }

  // Option 3: Skip
  if (['3', 'SKIP', 'דלג'].includes(upper)) {
    await supabase.from('whatsapp_sessions')
      .update({ status: 'crash_skipped' })
      .eq('from_number', from)
      .eq('status', 'crash_pending');
    await supabase.from('bug_reports')
      .update({ status: 'skipped' })
      .ilike('title', '[CRASH]%')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);
    return '⏭️ דולג. התראה על הקריסה הבאה.';
  }

  // Option 4: Marathon
  if (['4', 'MARATHON'].includes(upper)) {
    await supabase.from('app_config').upsert({
      key: 'run_marathon',
      value: { requested: true, timestamp: new Date().toISOString() },
    });
    return '🔄 מרתון התבקש! פתח את האפליקציה — יתחיל 10 ידיים אוטומטית.';
  }

  // Option 5: AUTO-FIX ON
  if (['5', 'AUTO', 'אוטו'].includes(upper)) {
    await supabase.from('app_config').upsert({
      key: AUTO_FIX_KEY,
      value: { enabled: true, since: new Date().toISOString() },
    });
    return '🟢 *AUTO-FIX ON*\n\nכל קריסה תנותח ותתוקן אוטומטית ללא אישור.\nהשב 6 לביטול.';
  }

  // Option 6: AUTO-FIX OFF
  if (trimmed === '6') {
    await supabase.from('app_config').upsert({
      key: AUTO_FIX_KEY,
      value: { enabled: false, since: new Date().toISOString() },
    });
    return '🔴 *AUTO-FIX OFF*\n\nתישאל לאשר כל תיקון.';
  }

  // Option 7: Dashboard
  if (['7', 'DASHBOARD', 'דשבורד'].includes(upper)) {
    const [{ count: total }, { count: fixed }, { data: cfg }] = await Promise.all([
      supabase.from('bug_reports').select('*', { count: 'exact', head: true }).ilike('title', '[CRASH]%'),
      supabase.from('bug_reports').select('*', { count: 'exact', head: true }).ilike('title', '[CRASH]%').eq('status', 'fixed'),
      supabase.from('app_config').select('value').eq('key', AUTO_FIX_KEY).single(),
    ]);
    const autoOn = cfg?.value?.enabled ?? false;
    return [
      '📊 *CRASH DASHBOARD:*',
      `Total: ${total ?? 0}`,
      `Fixed: ${fixed ?? 0}`,
      `Open: ${(total ?? 0) - (fixed ?? 0)}`,
      `Auto-fix: ${autoOn ? '🟢 ON' : '🔴 OFF'}`,
      '',
      'https://caps.ftable.co.il/bugs/',
    ].join('\n');
  }

  return null; // Not a crash reply
}

async function findPendingMerge(
  supabase: ReturnType<typeof createClient>,
  from: string,
): Promise<Record<string, unknown> | null> {
  const windowStart = new Date(Date.now() - MERGE_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('from_number', from)
    .eq('status', 'pending_merge')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

async function generateAndSendPlan(
  supabase: ReturnType<typeof createClient>,
  from: string,
  inputText: string,
  detectedMediaType: string,
  messageSid: string,
  audioTranscript: string | undefined,
  sessionId?: string, // if merging into existing session
): Promise<void> {
  const project = detectProject(inputText);
  const repo = REPO_MAP[project] ?? REPO_MAP['caps-poker'];
  const [manifest, ...fetchedFiles] = await Promise.all([
    fetchFileFromGitHub(repo, 'docs/PROJECT_MANIFEST.md'),
    ...getRelevantFiles(inputText).map(async (path) => {
      const content = await fetchFileFromGitHub(repo, path);
      if (!content) return null;
      const truncated = content.split('\n').slice(0, 200).join('\n');
      return `\n--- FILE: ${path} ---\n${truncated}`;
    }),
  ]);
  const relevantFileContents = fetchedFiles.filter((f): f is string => f !== null);

  let plan: ClaudePlan;
  try {
    plan = await generatePlan(inputText, project, manifest, relevantFileContents);
  } catch {
    await sendWhatsApp(from, '❌ שגיאה ב-Claude API. נסה שוב בעוד רגע.');
    return;
  }

  const pendingFixes = await countPendingFixes(supabase, project);

  if (sessionId) {
    // Merging — update the existing pending_merge session
    await supabase
      .from('whatsapp_sessions')
      .update({ raw_input: inputText, media_type: detectedMediaType, claude_plan: plan, status: 'pending_approval' })
      .eq('id', sessionId);
  } else {
    // Cancel stale pending_approval sessions (older than 5 min)
    const staleThreshold = new Date(Date.now() - AUTO_CANCEL_STALE_MS).toISOString();
    await supabase
      .from('whatsapp_sessions')
      .update({ status: 'cancelled' })
      .eq('from_number', from)
      .eq('status', 'pending_approval')
      .lt('created_at', staleThreshold);

    await supabase.from('whatsapp_sessions').insert({
      message_sid: messageSid,
      from_number: from,
      raw_input:   inputText,
      media_type:  detectedMediaType,
      claude_plan: plan,
      status:      'pending_approval',
    });
  }

  await sendWhatsApp(from, formatPlanReply(plan, pendingFixes, audioTranscript));
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  console.log('[whatsapp-bot] Request received:', req.method, req.url);

  // Meta Cloud API webhook verification (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? 'caps-whatsapp-verify-2026';
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      console.log('[whatsapp-bot] Webhook verified');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const rawBody = await req.text();
  console.log('[whatsapp-bot] Body:', rawBody.slice(0, 300));

  // ── Last message status check (diagnostic) ────────────────────────────────
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(rawBody);
      if (json?.check_last_msg) {
        const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const h = { Authorization: `Basic ${creds}` };
        const base = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
        const WEBHOOK = 'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler';

        const [sandboxRes, notifRes, inboundRes, convRes] = await Promise.all([
          fetch(`${base}/Sandbox.json`, { headers: h }),
          fetch(`${base}/Notifications.json?PageSize=5`, { headers: h }),
          fetch(`${base}/Messages.json?PageSize=5&From=whatsapp%3A%2B972526173700`, { headers: h }),
          fetch('https://conversations.twilio.com/v1/Configuration', { headers: h }),
        ]);

        const [sandbox, notifications, inbound, conversations] = await Promise.all([
          sandboxRes.json().catch(() => null),
          notifRes.json().catch(() => null),
          inboundRes.json().catch(() => null),
          convRes.json().catch(() => null),
        ]);

        // If sandbox found but webhook wrong → fix it
        let webhookFixed = false;
        if (sandbox && !sandbox.code && sandbox.inbound_request_url !== WEBHOOK) {
          const fixRes = await fetch(`${base}/Sandbox.json`, {
            method: 'POST',
            headers: { ...h, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ InboundRequestUrl: WEBHOOK, InboundMethod: 'POST' }).toString(),
          });
          webhookFixed = fixRes.ok;
        }

        // Check outbound messages TO Roye
        const outboundRes = await fetch(`${base}/Messages.json?PageSize=5&To=whatsapp%3A%2B972526173700`, { headers: h });
        const outbound = await outboundRes.json().catch(() => null);
        const outMsgs = (outbound?.messages ?? []).map((m: Record<string, string>) => ({
          to: m.to, body: m.body?.slice(0, 30), status: m.status, error_code: m.error_code, date: m.date_sent,
        }));

        const inboundMsgs = (inbound?.messages ?? []).map((m: Record<string, string>) => ({
          from: m.from, body: m.body?.slice(0, 40), status: m.status, date: m.date_sent,
        }));
        const notifList = (notifications?.notifications ?? []).map((n: Record<string, string>) => ({
          message: n.message_text, date: n.date_created,
        }));

        // Check Conversations Addresses (WhatsApp bindings that intercept messages)
        const addrRes   = await fetch('https://conversations.twilio.com/v1/Configuration/Addresses?PageSize=20', { headers: h });
        const addrData  = await addrRes.json().catch(() => null);
        const addresses = addrData?.address_configurations ?? [];

        // Delete any WhatsApp address bindings
        const deleted: string[] = [];
        for (const addr of addresses) {
          if (addr.type === 'whatsapp' || addr.address?.includes('14155238886')) {
            const delRes = await fetch(
              `https://conversations.twilio.com/v1/Configuration/Addresses/${addr.sid}`,
              { method: 'DELETE', headers: h },
            );
            if (delRes.ok || delRes.status === 204) deleted.push(addr.sid);
          }
        }

        // Check Twilio Debugger alerts
        const alertsRes  = await fetch('https://monitor.twilio.com/v1/Alerts?PageSize=5', { headers: h });
        const alertsData = await alertsRes.json().catch(() => null);
        const alerts     = (alertsData?.alerts ?? []).map((a: Record<string, string>) => ({
          alert_text: a.alert_text?.slice(0, 80), date: a.date_generated,
        }));

        // Send direct outbound test message
        const directRes = await fetch(`${base}/Messages.json`, {
          method: 'POST',
          headers: { ...h, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: 'whatsapp:+972526173700', Body: 'Direct test — if you see this, outbound works!' }).toString(),
        });
        const directMsg = await directRes.json().catch(() => null);

        return new Response(JSON.stringify({
          conversationsAddresses: addresses.map((a: Record<string, string>) => ({ sid: a.sid, type: a.type, address: a.address })),
          deletedAddresses: deleted,
          debuggerAlerts: alerts,
          directSend: { status: directRes.status, msgStatus: directMsg?.status, error: directMsg?.error_code, sid: directMsg?.sid },
          sandbox: sandbox?.code ? `ERROR ${sandbox.code}` : { webhook: sandbox?.inbound_request_url },
          outboundToRoye: outMsgs.slice(0, 2),
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    } catch { /* ignore */ }
  }

  // ── Crash notification from the app ────────────────────────────────────────
  // Content-Type: application/json, body = { crash_notification: true, message, videoUrl }
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(rawBody);
      if (json?.crash_notification) {
        console.log('[whatsapp-bot] Crash notification received');
        const ROYE_NUMBER = Deno.env.get('ROYE_WHATSAPP_NUMBER') ?? 'whatsapp:+972504141513';
        const msg = json.message ?? '🔴 CAPS CRASH (no details)';

        // Check auto-fix mode
        const { data: cfg } = await supabase.from('app_config').select('value').eq('key', AUTO_FIX_KEY).single();
        const autoFixEnabled = cfg?.value?.enabled ?? false;

        // Record crash_pending session so user replies 1-7 are routed correctly
        try {
          await supabase.from('whatsapp_sessions').insert({
            message_sid: `crash-${Date.now()}`,
            from_number: ROYE_NUMBER,
            raw_input: msg,
            media_type: 'crash',
            claude_plan: { debugLogs: json.debugLogs ?? [], metadata: json.metadata ?? {}, videoUrl: json.videoUrl, screenshotUrl: json.screenshotUrl },
            status: 'crash_pending',
          });
        } catch { /* fire and forget */ }

        // Send WhatsApp — wrapped in try/catch so a Twilio error never breaks the response
        let whatsappSent = false;
        let whatsappError: string | null = null;
        try {
          if (autoFixEnabled) {
            // Auto-fix: skip menu, go straight to analyzer
            await sendWhatsApp(ROYE_NUMBER, `🤖 AUTO-FIX: קריסה בשלב ${json.metadata?.lastStep ?? 'unknown'}. מנתח + מתקן...`);
            const analyzerUrl = `${SUPABASE_URL}/functions/v1/crash-analyzer`;
            fetch(analyzerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ debugLogs: json.debugLogs, metadata: json.metadata, autoApply: true, from: ROYE_NUMBER }),
            }).catch(() => {});
          } else {
            await sendWhatsApp(ROYE_NUMBER, msg);
          }
          whatsappSent = true;
        } catch (sendErr) {
          whatsappError = String(sendErr);
          console.error('[whatsapp-bot] sendWhatsApp failed for crash notification:', sendErr);
        }

        return new Response(JSON.stringify({ sent: whatsappSent, autoFix: autoFixEnabled, twilioError: whatsappError, msgPreview: msg.slice(0, 80) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    } catch (e) {
      console.error('[whatsapp-bot] crash notification error:', e);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Twilio signature verification — log but don't block (sandbox doesn't always sign correctly)
  const twilioSignature = req.headers.get('x-twilio-signature') ?? '';
  if (twilioSignature) {
    const valid = await verifyTwilioSignature(req.url, params, twilioSignature);
    if (!valid) {
      console.warn('[whatsapp-bot] Signature mismatch — proceeding in sandbox mode');
    }
  } else {
    console.log('[whatsapp-bot] No signature header — sandbox mode');
  }

  const from       = params['From'] ?? '';
  const msgBody    = params['Body']?.trim() ?? '';
  const messageSid = params['MessageSid'] ?? '';
  const numMedia   = parseInt(params['NumMedia'] ?? '0', 10);
  const mediaUrl   = params['MediaUrl0'];
  const mediaType  = params['MediaContentType0'] ?? '';

  // ── Handle approval replies (1/2/3) ──────────────────────────────────────
  const upperBody  = msgBody.trim().toUpperCase();
  const isFixOnly  = ['1', 'FIX', 'תקן'].includes(upperBody);
  const isFixBuild = ['2', 'BUILD', 'בנה', 'APPROVE', 'כן', 'אשר'].includes(upperBody);
  const isCancel   = ['3', 'CANCEL', 'לא', 'בטל'].includes(upperBody);

  // ── Crash threading: תתקן / פרטים / תתעלם — work with crash_reports table ─
  const crashCodeMatch = msgBody.match(/CR-[A-Z0-9]{4}/i)
  const isCrashFix     = /^תתקן(\s|$)/u.test(msgBody.trim()) || msgBody.trim() === 'תתקן'
  const isCrashDetails = /פרטים/.test(msgBody)
  const isCrashDismiss = /תתעלם/.test(msgBody)
  const isFixAll       = /תתקן\s+הכל/.test(msgBody)

  if (isCrashFix || isCrashDetails || isCrashDismiss) {
    const crashCodeUpper = crashCodeMatch ? crashCodeMatch[0].toUpperCase() : null

    if (isCrashFix && !isFixAll) {
      // Find specific crash by code, or latest unresolved
      let crashQuery = supabase.from('crash_reports').select('*').eq('project', 'Caps').is('resolved_at', null)
      if (crashCodeUpper) crashQuery = supabase.from('crash_reports').select('*').eq('crash_code', crashCodeUpper)
      const { data: crash } = await (crashCodeUpper
        ? supabase.from('crash_reports').select('*').eq('crash_code', crashCodeUpper).single()
        : supabase.from('crash_reports').select('*').eq('project', 'Caps').is('resolved_at', null).order('created_at', { ascending: false }).limit(1).single()
      )
      if (!crash) {
        await sendWhatsApp(from, '❓ לא נמצאה קריסה. פתח אפליקציה → Debug → העתק Fix Prompt.')
      } else {
        await supabase.from('crash_reports').update({ status: 'fixing', resolved_at: new Date().toISOString() }).eq('id', crash.id)
        const replyMsg = [
          `🔧 *מתקן קריסה [${crash.crash_code ?? 'N/A'}]*`,
          ``,
          `📋 Fix prompt (${crash.fix_prompt?.length ?? 0} chars):`,
          ``,
          (crash.fix_prompt ?? 'No fix prompt').slice(0, 1500),
          ``,
          `העתק ⬆️ והדבק ל-Claude Bot`,
        ].join('\n')
        await sendWhatsApp(from, replyMsg)
      }
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }

    if (isFixAll) {
      const { data: crashes } = await supabase.from('crash_reports').select('id, crash_code, error_message, last_screen').eq('project', 'Caps').is('resolved_at', null).order('created_at', { ascending: false }).limit(5)
      if (!crashes?.length) {
        await sendWhatsApp(from, '✅ אין קריסות פתוחות.')
      } else {
        const list = crashes.map((c, i) => `${i+1}. [${c.crash_code ?? '?'}] ${c.last_screen}: ${(c.error_message ?? '').slice(0, 60)}`).join('\n')
        await sendWhatsApp(from, `🔧 *${crashes.length} קריסות פתוחות:*\n\n${list}\n\nשלח "תתקן [CODE]" לתיקון ספציפי`)
      }
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }

    if (isCrashDetails) {
      const { data: crash } = await (crashCodeUpper
        ? supabase.from('crash_reports').select('*').eq('crash_code', crashCodeUpper).single()
        : supabase.from('crash_reports').select('*').eq('project', 'Caps').order('created_at', { ascending: false }).limit(1).single()
      )
      if (!crash) {
        await sendWhatsApp(from, '❓ לא נמצאה קריסה.')
      } else {
        const screenshotLines = (crash.screenshot_urls ?? []).slice(0, 3).map((u: string, i: number) => `  📸 ${i+1}: ${u}`).join('\n')
        const stepLines = (crash.step_log ?? []).slice(-5).map((s: Record<string, unknown>) => `  ${s.id}. ${s.description}`).join('\n')
        const details = [
          `📊 *Crash [${crash.crash_code ?? 'N/A'}]*`,
          `Error: ${crash.error_message}`,
          `Screen: ${crash.last_screen}`,
          `Action: ${crash.last_action}`,
          `Time: ${crash.created_at}`,
          ``,
          `Screenshots: ${(crash.screenshot_urls ?? []).length}`,
          screenshotLines,
          ``,
          `Steps: ${(crash.step_log ?? []).length}`,
          stepLines,
        ].filter(Boolean).join('\n')
        await sendWhatsApp(from, details)
      }
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }

    if (isCrashDismiss) {
      const { data: crash } = await (crashCodeUpper
        ? supabase.from('crash_reports').select('id, crash_code').eq('crash_code', crashCodeUpper).single()
        : supabase.from('crash_reports').select('id, crash_code').eq('project', 'Caps').is('resolved_at', null).order('created_at', { ascending: false }).limit(1).single()
      )
      if (crash) {
        await supabase.from('crash_reports').update({ status: 'dismissed', resolved_at: new Date().toISOString() }).eq('id', crash.id)
        await sendWhatsApp(from, `✅ קריסה [${crash.crash_code ?? 'N/A'}] סומנה כ-dismissed.`)
      } else {
        await sendWhatsApp(from, '❓ לא נמצאה קריסה פתוחה.')
      }
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }
  }

  // ── Check crash_pending FIRST — routes 1-7 replies to crash control panel ─
  if (['1','2','3','4','5','6','7','FIX','SKIP','MARATHON','AUTO','DASHBOARD','תקן','דלג','אוטו','דשבורד'].includes(upperBody)) {
    const windowStart = new Date(Date.now() - CRASH_REPLY_WINDOW_MS).toISOString();
    const { data: crashSession } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('from_number', from)
      .eq('status', 'crash_pending')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (crashSession) {
      const reply = await handleCrashReply(msgBody, supabase, from);
      if (reply) {
        await sendWhatsApp(from, reply);
        return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
      }
    }
  }

  // ── Handle video from WhatsApp (user sends crash video) ────────────────────
  if (numMedia > 0 && mediaUrl && mediaType.startsWith('video/')) {
    console.log('[whatsapp-bot] Video received, uploading to crash-recordings');
    try {
      const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const vidRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${creds}` } });
      const vidBuf = await vidRes.arrayBuffer();
      const fileName = `crash-video-${Date.now()}.mp4`;
      await supabase.storage.from('crash-recordings').upload(
        fileName, new Uint8Array(vidBuf), { contentType: 'video/mp4', upsert: false },
      );
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/crash-recordings/${fileName}`;
      await supabase.from('bug_reports').insert({
        title: '[CRASH-VIDEO] WhatsApp',
        description: '[CRASH-VIDEO] Video received via WhatsApp',
        url: 'whatsapp/video',
        report_type: 'text',
        screenshot_url: publicUrl,
        metadata: { videoUrl: publicUrl, timestamp: new Date().toISOString() },
      });
      // Record crash_pending session for the video
      try {
        await supabase.from('whatsapp_sessions').insert({
          message_sid: `video-${Date.now()}`,
          from_number: from,
          raw_input: `[CRASH-VIDEO] ${publicUrl}`,
          media_type: 'video',
          claude_plan: { videoUrl: publicUrl },
          status: 'crash_pending',
        });
      } catch { /* fire and forget */ }
      const reply = [
        '🎥 וידאו התקבל ונשמר!',
        `קישור: ${publicUrl}`,
        '',
        '*השב:*',
        '1 = 🔧 Auto-fix',
        '2 = 👀 ניתוח',
        '3 = ⏭️ דלג',
      ].join('\n');
      await sendWhatsApp(from, reply);
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    } catch (e) {
      console.error('[whatsapp-bot] Video upload failed:', e);
    }
  }

  if (isFixOnly || isFixBuild || isCancel) {
    // Check if there's a stale pending_merge that never got a second message → promote it first
    const staleMerge = await findPendingMerge(supabase, from);
    if (staleMerge) {
      console.log('[whatsapp-bot] Found stale pending_merge — promoting to pending_approval before handling approval');
      await generateAndSendPlan(
        supabase, from,
        String(staleMerge['raw_input'] ?? ''),
        String(staleMerge['media_type'] ?? 'text'),
        String(staleMerge['message_sid'] ?? ''),
        undefined,
        String(staleMerge['id']),
      );
      // Now the merge is promoted — find it again as pending_approval
    }

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('from_number', from)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      await sendWhatsApp(from, 'לא נמצאה בקשה ממתינה. שלח דיווח באג קודם.');
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    }

    if (isCancel) {
      await supabase.from('whatsapp_sessions').update({ status: 'cancelled' }).eq('id', session.id);
      await sendWhatsApp(from, '❌ בוטל. לא בוצעו שינויים.');
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    }

    const plan    = session.claude_plan as ClaudePlan;
    const project = plan.project ?? 'caps-poker';

    if (isFixOnly) {
      await supabase.from('whatsapp_sessions').update({ status: 'approved' }).eq('id', session.id);
      await triggerGitHubAction(plan, project, 'claude-fix-no-build');
      await supabase.from('deploy_tracker').insert({
        project,
        fix_summary: plan.summary,
        severity:    plan.severity ?? 'MEDIUM',
        session_id:  session.id,
      });
      const pending = await countPendingFixes(supabase, project);
      await sendWhatsApp(from, `⚙️ תיקון בביצוע על ${project}. לא עולה גרסה.\n(סה״כ ${pending} תיקונים ממתינים)`);
    } else {
      await supabase.from('whatsapp_sessions').update({ status: 'approved' }).eq('id', session.id);
      await triggerGitHubAction(plan, project, 'claude-fix-and-deploy');
      const pendingBefore = await countPendingFixes(supabase, project);
      const totalDeployed = pendingBefore + 1;
      await supabase
        .from('deploy_tracker')
        .update({ deployed_at: new Date().toISOString() })
        .eq('project', project)
        .is('deployed_at', null);
      await sendWhatsApp(from, `🚀 תיקון + build חדש ל-TestFlight!\n(${totalDeployed} תיקונים עולים בגרסה הזאת)`);
    }

    return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Extract text from new message ─────────────────────────────────────────
  let inputText = '';
  let detectedMediaType = 'text';
  let audioTranscript: string | undefined;

  if (numMedia > 0 && mediaUrl) {
    if (mediaType.startsWith('audio/')) {
      detectedMediaType = 'audio';
      if (OPENAI_API_KEY) {
        try {
          audioTranscript = await transcribeAudio(mediaUrl);
          inputText = msgBody ? msgBody + '\n\n[Voice note]: ' + audioTranscript : audioTranscript;
        } catch (e) {
          console.error('[whatsapp-bot] Audio transcription failed:', e);
          inputText = msgBody || '[Voice note received — transcription unavailable]';
        }
      } else {
        inputText = msgBody || '[הודעה קולית התקבלה — שירות התמלול אינו מוגדר. שלח טקסט במקום]';
      }
    } else if (mediaType.startsWith('image/')) {
      detectedMediaType = 'image';
      try {
        const imageDesc = await describeImage(mediaUrl);
        inputText = msgBody ? `${msgBody}\n\nצילום מסך: ${imageDesc}` : `צילום מסך: ${imageDesc}`;
      } catch (e) {
        console.error('[whatsapp-bot] Image description failed:', e);
        inputText = msgBody || 'קיבלתי צילום מסך אך לא הצלחתי לנתח אותו. אנא תאר את הבעיה בטקסט.';
      }
    } else {
      inputText = msgBody || `[Media received: ${mediaType}]`;
    }
  } else {
    inputText = msgBody;
  }

  if (!inputText) {
    await sendWhatsApp(from, '⚠️ הודעה ריקה. שלח תיאור באג, הודעה קולית, או צילום מסך.');
    return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Check for pending_merge (multi-input window) ───────────────────────────
  const pendingMerge = await findPendingMerge(supabase, from);

  if (pendingMerge) {
    // Merge: combine the first message's content with this new one
    const combined = `${String(pendingMerge['raw_input'] ?? '')}\n\n---\n${inputText}`;
    const mergedType = `${String(pendingMerge['media_type'] ?? 'text')}+${detectedMediaType}`;
    console.log('[whatsapp-bot] Merging into session', pendingMerge['id']);
    await generateAndSendPlan(
      supabase, from, combined, mergedType, messageSid, audioTranscript,
      String(pendingMerge['id']),
    );
    return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Check for free-text addition to existing pending_approval ─────────────
  // e.g., "List both fixes please" → append context and regenerate
  if (numMedia === 0 && msgBody.length > 3) {
    const { data: existingSession } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('from_number', from)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingSession) {
      const augmented = `${String(existingSession['raw_input'] ?? '')}\n\n[הוספת הקשר]: ${inputText}`;
      console.log('[whatsapp-bot] Appending context to existing session', existingSession['id']);
      await generateAndSendPlan(
        supabase, from, augmented, String(existingSession['media_type'] ?? 'text'),
        messageSid, audioTranscript, String(existingSession['id']),
      );
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    }
  }

  // ── First message: media ──────────────────────────────────────────────────
  if (numMedia > 0) {
    const isAudio = detectedMediaType === 'audio';
    const hasCaption = msgBody.length > 0;
    const processImmediately = isAudio || (detectedMediaType === 'image' && hasCaption);

    if (processImmediately) {
      // Image+caption or audio → complete report, process now
      await generateAndSendPlan(supabase, from, inputText, detectedMediaType, messageSid, audioTranscript);
    } else {
      // Image only, no caption → wait for context (user may send description)
      await supabase.from('whatsapp_sessions').insert({
        message_sid: messageSid,
        from_number: from,
        raw_input:   inputText,
        media_type:  detectedMediaType,
        claude_plan: null,
        status:      'pending_merge',
      });
      await sendWhatsApp(from, `📸 צילום מסך התקבל ✓\n\nשולח תיאור? (טקסט / הודעה קולית)\nשלח תוך 60 שניות ואצרף לדו״ח אחד.`);
    }
    return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Pure text new report: generate plan immediately ───────────────────────
  await generateAndSendPlan(supabase, from, inputText, 'text', messageSid, undefined);

  return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
});
