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

// Twilio SMS/WhatsApp over REST uses application/x-www-form-urlencoded.
// URLSearchParams percent-encodes emoji correctly, but some Twilio plans
// default to GSM7 which strips non-ASCII. Replace emojis with readable ASCII.
function sanitizeForTwilio(text: string): string {
  return text
    .replace(/💥|🔴/g, '[CRASH]')
    .replace(/❌/g, '[FAIL]')
    .replace(/✅/g, '[OK]')
    .replace(/📍/g, 'Screen:')
    .replace(/🎯/g, 'Action:')
    .replace(/📸/g, 'Screenshots:')
    .replace(/📋/g, 'Steps:')
    .replace(/📊/g, 'Evidence:')
    .replace(/🔧/g, 'Fix:')
    .replace(/↩️/g, 'Reply:')
    .replace(/🧪/g, '[TEST]')
    .replace(/⏱️/g, '')
    .replace(/[^\x00-\x7F\u0590-\u05FF\u0600-\u06FF\n*_]/g, '') // keep ASCII + Hebrew + WhatsApp bold/italic
    .trim()
}

async function sendWhatsApp(to: string, body: string, mediaUrl?: string): Promise<string | null> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error('[sendWhatsApp] Twilio credentials missing! Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM as Edge Function secrets.');
    return null;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const safeBody = sanitizeForTwilio(body);
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: to,
    Body: safeBody,
  });
  if (mediaUrl) params.append('MediaUrl0', mediaUrl);
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.sid) {
    console.error('[sendWhatsApp] Twilio error:', res.status, JSON.stringify(data).slice(0, 200));
    return null;
  }
  console.log('[sendWhatsApp] Sent OK. SID:', data.sid, '| To:', to.slice(-12));
  return data.sid as string;
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

// ── Transcribe bug report audio (Supabase Storage — public URL, no Twilio auth) ────
// Used in bug_notification block to give AI the user's verbal description.

async function transcribeBugAudio(audioUrl: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.error('[TRANSCRIBE] OPENAI_API_KEY missing');
    return null;
  }
  try {
    console.log('[TRANSCRIBE] Downloading audio:', audioUrl.slice(0, 80));
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
    if (!audioRes.ok) {
      console.error('[TRANSCRIBE] Download failed:', audioRes.status);
      return null;
    }
    const audioBlob = await audioRes.blob();
    // Detect extension from URL
    const ext = audioUrl.includes('.m4a') ? 'm4a' : audioUrl.includes('.mp3') ? 'mp3' : 'mp4';
    const form = new FormData();
    form.append('file', audioBlob, `recording.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'he');  // Hebrew-first; Whisper auto-detects if wrong
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    const data = await whisperRes.json().catch(() => ({}));
    if (data.text) {
      console.log('[TRANSCRIBE] OK:', String(data.text).slice(0, 100));
      return String(data.text);
    }
    console.error('[TRANSCRIBE] Whisper error:', JSON.stringify(data).slice(0, 200));
    return null;
  } catch (err) {
    console.error('[TRANSCRIBE] Exception:', err);
    return null;
  }
}

// ── Build rich fix prompt from DB report (built AFTER AI + Whisper complete) ─────
// This is what Claude Bot receives when Roye replies "1". Includes everything.

function buildFixPromptFromReport(report: Record<string, unknown>, transcription: string | null): string {
  const id = (report.id as string | null)?.slice(0, 8)?.toUpperCase() ?? 'UNKNOWN';
  const sev = (report.ai_severity as string | null) ?? 'medium';
  const summary = (report.ai_summary as string | null) ?? 'Bug reported by user';
  const suggestedFix = (report.ai_suggested_fix as string | null) ?? '';
  const screen = (report.ai_screen as string | null) ?? '';
  const steps = (report.ai_steps as string[] | null) ?? [];
  const dev = (report.device_info as Record<string, string> | null) ?? {};
  const logs = (report.console_logs as string[] | null) ?? [];
  const crumbs = (report.breadcrumbs as Array<{ ts: string; screen: string }> | null) ?? [];

  const gameLogs = logs
    .filter((l) => !l.includes('[BUG-PIPE]') && !l.includes('[FILE-READER]') && !l.includes('[PIPE-TEST]')
      && !l.includes('[TIMEOUT]') && !l.includes('[BUG-AUDIO]') && !l.includes('[BUG-WA]')
      && l !== '--- PIPELINE LOGS ---')
    .slice(-15);

  let prompt = `VAMOS CAPS CAPS-BUGFIX-${id}\n\n`;

  // PROJECT MAP — embedded so Claude Code knows exactly where files are
  prompt += `## PROJECT MAP (CAPS Poker — React Native + Expo SDK 55, TypeScript strict)\n`;
  prompt += `Key files:\n`;
  prompt += `- components/Card.tsx — Single card component. Props: card, faceDown, small, highlighted, dimmed, cardWidth, cardHeight, hideCornerLabels\n`;
  prompt += `- components/PlayerHand.tsx — Player's 4 hole cards at bottom ("YOUR HAND" area). All cards already use hideCornerLabels={true}\n`;
  prompt += `- components/Board.tsx — One game board (community cards + player card placement slots)\n`;
  prompt += `- components/BoardReveal.tsx — Full-screen reveal animation after cards placed\n`;
  prompt += `- app/game.tsx — Main game screen with boards + PlayerHand + timer + bot\n`;
  prompt += `- app/results.tsx — Results screen ("X beats Y"). ZERO Reanimated here — use RN Animated only\n`;
  prompt += `- app/index.tsx — Lobby + PLAY button\n`;
  prompt += `- utils/responsive.ts — rv(mobile,mobileWeb,tablet,desktop,native) and rs(n) for all sizes. Base width 390pt.\n`;
  prompt += `- constants/gameConfig.ts — Card type, COLORS, game constants\n`;
  prompt += `Styling: bg #1C0508, boardBg #6B1520, gold #c9a84c. Dark theme always.\n`;
  prompt += `NEVER: Dimensions.get() at module level (crashes web) | expo-file-system legacy functions | Alert.alert on web\n`;
  prompt += `NEVER: withRepeat(-1) in Reanimated | ConfettiCannon (use pure RN Animated particles instead)\n\n`;

  prompt += `## BUG REPORT — AUTO-FIX\n`;
  prompt += `**ID:** ${id} | **Severity:** ${sev}\n`;
  if (screen) prompt += `**Screen/Component:** ${screen}\n`;
  prompt += `**Device:** ${dev.model ?? 'unknown'} | ${dev.osVersion ?? ''} | Build ${dev.buildNumber ?? ''}\n\n`;

  if (transcription) {
    prompt += `## WHAT THE USER SAID (Hebrew audio transcribed by Whisper — THIS IS THE PRIMARY REQUIREMENT):\n`;
    prompt += `"${transcription}"\n\n`;
  }
  if (summary) {
    prompt += `## AI ANALYSIS:\n${summary}\n\n`;
  }
  if (suggestedFix) {
    prompt += `## SUGGESTED FIX:\n${suggestedFix}\n\n`;
  }
  if (steps.length > 0) {
    prompt += `## Steps to reproduce:\n`;
    steps.forEach((s) => { prompt += `- ${s}\n`; });
    prompt += `\n`;
  }
  if (gameLogs.length > 0) {
    prompt += `## Game console logs:\n\`\`\`\n`;
    gameLogs.forEach((l) => { prompt += l + '\n'; });
    prompt += `\`\`\`\n\n`;
  }
  if (crumbs.length > 0) {
    prompt += `## User navigation path:\n`;
    crumbs.forEach((c) => { prompt += `${(c.ts ?? '?').slice(11, 19)} -> ${c.screen}\n`; });
    prompt += `\n`;
  }

  prompt += `## TASK — DO THIS IN ORDER:\n`;
  prompt += `1. Read the relevant file(s) using the PROJECT MAP above — do NOT guess file names\n`;
  prompt += `2. Find the exact code that needs to change based on the user's description\n`;
  prompt += `3. Make the change — verify it actually solves what the user described\n`;
  prompt += `4. If a prop was already added (like hideCornerLabels), check if it's actually being USED correctly\n`;
  prompt += `5. npx tsc --noEmit\n`;
  prompt += `6. npx jest --forceExit\n`;
  prompt += `7. git add -A && git commit -m "autofix(${id}): ${summary.slice(0, 50)}" && git push origin main\n\n`;
  prompt += `Yes, allow all edits in components/ during this session.\n`;
  prompt += `VAMOS CAPS CAPS-BUGFIX-${id} — END\n`;

  return prompt;
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
): Promise<number | null> {
  const repo = REPO_MAP[project] ?? REPO_MAP['caps-poker'];
  if (!GITHUB_TOKEN) {
    console.error('[GITHUB] GITHUB_TOKEN missing in Edge Function secrets');
    return null;
  }
  const url = `https://api.github.com/repos/${repo}/dispatches`;
  console.log('[GITHUB] Dispatching to:', url, 'event:', eventType);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          summary:    plan.summary,
          plan:       plan.plan.join('\n'),
          fix_prompt: plan.plan.join('\n'), // alias — workflow reads this directly
          files:      plan.files.join(', '),
          effort:     plan.effort,
          severity:   plan.severity,
          type:       plan.type,
          project,
        },
      }),
    });
    if (res.status === 204 || res.status === 200) {
      console.log('[GITHUB] Dispatch OK. Status:', res.status);
      // Fetch real run ID (wait 2s for GitHub to register the workflow run)
      try {
        await new Promise((r) => setTimeout(r, 2000));
        const runsRes = await fetch(
          `https://api.github.com/repos/${repo}/actions/runs?event=repository_dispatch&per_page=1`,
          { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } },
        );
        const runsData = await runsRes.json().catch(() => ({}));
        const runId = (runsData.workflow_runs?.[0]?.id as number | null) ?? null;
        console.log('[GITHUB] Run ID:', runId);
        return runId ?? 1; // fallback to 1 if GitHub hasn't registered yet
      } catch {
        return 1; // fallback
      }
    } else {
      const body = await res.text().catch(() => '');
      console.error('[GITHUB] Dispatch failed. Status:', res.status, '| Body:', body.slice(0, 500));
      return null;
    }
  } catch (err) {
    console.error('[GITHUB] Exception during dispatch:', err);
    return null;
  }
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

// ── Build rich bug message for WhatsApp (7-option triage) ─────────────────────

function buildBugMessage(report: Record<string, unknown>, fixPrompt: string | null, transcription?: string | null): string {
  const deviceInfo = report.device_info as Record<string, string> | null;
  const metadata = report.metadata as Record<string, unknown> | null;
  const sev = ((report.ai_severity as string | null) ?? 'MEDIUM').toUpperCase();
  const sevMap: Record<string, string> = { LOW: '[LOW]', MEDIUM: '[MED]', HIGH: '[HIGH]', CRITICAL: '[CRIT]' };

  const model = deviceInfo?.model ?? 'Unknown device';
  const osVer = deviceInfo?.osVersion ?? '';
  const build = deviceInfo?.buildNumber ?? '';
  const duration = (metadata?.recordingDuration as number | null) ?? 0;
  const frames = (metadata?.frameCount as number | null) ?? 0;
  const logs = (report.console_logs as string[] | null) ?? [];
  const crumbs = (report.breadcrumbs as Array<{ ts: string; screen: string }> | null) ?? [];
  const screen = (report.ai_screen as string | null) ?? '';
  const fix = (report.ai_suggested_fix as string | null) ?? '';
  const desc = (report.description as string | null) ?? '';

  const reportNum = (report.report_number as number | null) ?? null;
  const reportNumStr = reportNum !== null ? `#${reportNum}` : '';

  let msg = `🐛 *באג ${reportNumStr}*\n`;
  msg += `${model} | iOS ${osVer} | Build ${build}\n`;
  msg += `${sevMap[sev] ?? '[?]'} Severity: ${sev}\n`;
  msg += `Recording: ${duration}s | ${frames} frames\n`;
  msg += '\n';
  msg += `*AI Summary:*\n${(report.ai_summary as string | null) ?? 'Analyzing...'}\n`;
  if (screen) msg += `\nScreen: ${screen}\n`;
  if (fix) msg += `Fix: ${fix.slice(0, 200)}\n`;
  if (transcription) msg += `\nUser said: "${transcription.slice(0, 300)}"\n`;
  else if (desc) msg += `\nUser note: ${desc}\n`;
  msg += `\nLogs: ${logs.length} | Breadcrumbs: ${crumbs.length}\n`;
  const audioLink = (report.audio_url as string | null) ?? '';
  const videoLink = (report.video_url as string | null) ?? '';
  if (audioLink) msg += `Audio: ${audioLink}\n`;
  if (videoLink) msg += `Screenshot: ${videoLink}\n`;
  msg += '\n';
  if (reportNum !== null) {
    msg += `*Reply:*\n`;
    msg += `${reportNum}:1 = תיקון אוטומטי (auto-fix)\n`;
    msg += `${reportNum}:2 = הוסף לספרינט\n`;
    msg += `${reportNum}:3 = בקלוג (עדיפות נמוכה)\n`;
    msg += `${reportNum}:6 = לא באג - בטל\n`;
    msg += `Or just reply 1-7 for the most recent report.\n`;
  } else {
    msg += '*Reply:*\n';
    msg += '1 = Fix now (auto-fix)\n';
    msg += '2 = Add to sprint\n';
    msg += '3 = Low priority (backlog)\n';
    msg += '4 = Show logs + breadcrumbs\n';
    msg += '5 = Send audio\n';
    msg += '6 = Not a bug - dismiss\n';
    msg += '7 = Ask tester for more info\n';
  }
  return msg;
}

// ── Bug Report Reply Handler (reply 1-7) ────────────────────────────────────────────

const BUG_REPLY_WINDOW_MS = 10 * 60 * 1000;

async function handleBugReply(
  msgText: string,
  session: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  from: string,
): Promise<string | null> {
  const plan = session.claude_plan as Record<string, unknown>;
  const reportId = plan?.bug_report_id as string | null;
  const fixPrompt = plan?.fix_prompt as string | null;
  const aiSummary = plan?.ai_summary as string | null;
  const audioUrl = (plan?.audio_url as string | null) ?? null;
  const trimmed = msgText.trim();

  // Fetch report for options 4 and 5
  let report: Record<string, unknown> | null = null;
  if (['4', '5'].includes(trimmed) && reportId) {
    const { data } = await supabase.from('bug_reports')
      .select('ai_summary,ai_suggested_fix,ai_screen,audio_url,video_url,console_logs,breadcrumbs,ai_severity')
      .eq('id', reportId).single();
    report = data;
  }

  if (trimmed === '1') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_approved' }).eq('id', session.id);
    if (reportId) {
      await supabase.from('bug_notifications').update({ approved_at: new Date().toISOString() }).eq('bug_report_id', reportId);
    }
    if (fixPrompt) {
      const claudePlan = {
        type: 'BUG' as const,
        summary: aiSummary ?? 'Bug fix from report',
        severity: 'MEDIUM' as const,
        plan: [fixPrompt],
        files: [],
        effort: 'MEDIUM' as const,
        project: 'caps-poker',
      };
      const runId = await triggerGitHubAction(claudePlan, 'caps-poker', 'claude-fix-no-build');
      if (runId !== null) {
        await supabase.from('whatsapp_sessions').update({ github_run_id: runId, status: 'bug_fixing' }).eq('id', session.id);
        return `Auto-fix dispatched to Claude Bot (run #${runId}). Will notify when done.`;
      } else {
        return 'Auto-fix failed to dispatch. Check GITHUB_TOKEN in Edge Function secrets (Supabase Dashboard → Edge Functions → whatsapp-bot-handler → Secrets).';
      }
    }
    return 'Marked as approved.';
  }

  if (trimmed === '2') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_sprint' }).eq('id', session.id);
    if (reportId) await supabase.from('bug_reports').update({ status: 'sprint_queued' }).eq('id', reportId);
    return 'Added to next sprint.';
  }

  if (trimmed === '3') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_backlog' }).eq('id', session.id);
    if (reportId) await supabase.from('bug_reports').update({ status: 'backlog' }).eq('id', reportId);
    return 'Moved to backlog (low priority).';
  }

  if (trimmed === '4') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_analyzing' }).eq('id', session.id);
    if (!report) return 'Bug report not found.';
    const logs = (report.console_logs as string[] | null) ?? [];
    const crumbs = (report.breadcrumbs as Array<{ ts: string; screen: string }> | null) ?? [];
    const logLines = logs.slice(-20).map((l) => l.slice(0, 100)).join('\n');
    const crumbLines = crumbs.map((c) => `${(c.ts ?? '').slice(11, 19)} -> ${c.screen ?? '?'}`).join('\n');
    let logsMsg = '*CONSOLE LOGS (last 20):*\n' + (logLines || '(none)');
    logsMsg += '\n\n*BREADCRUMBS:*\n' + (crumbLines || '(none)');
    if (logsMsg.length > 1500) logsMsg = logsMsg.slice(0, 1500) + '\n... (truncated)';
    return logsMsg;
  }

  if (trimmed === '5') {
    const url = audioUrl ?? (report?.audio_url as string | null);
    if (url) {
      await sendWhatsApp(from, 'Audio recording:', url);
      return null; // already sent directly
    }
    return 'No audio available for this report.';
  }

  if (trimmed === '6') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_dismissed' }).eq('id', session.id);
    if (reportId) {
      await Promise.allSettled([
        supabase.from('bug_notifications').update({ dismissed_at: new Date().toISOString() }).eq('bug_report_id', reportId),
        supabase.from('bug_reports').update({ status: 'dismissed' }).eq('id', reportId),
      ]);
    }
    return 'Bug dismissed.';
  }

  if (trimmed === '7') {
    await supabase.from('whatsapp_sessions').update({ status: 'bug_needs_info' }).eq('id', session.id);
    if (reportId) await supabase.from('bug_reports').update({ status: 'needs_info' }).eq('id', reportId);
    return 'Marked as needs more info. Tester will be asked next time they open the app.';
  }

  return null;
}

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
        let newCrashSessionId: string | null = null;
        let crashReportNumber: number | null = null;
        try {
          const { data: crashInserted } = await supabase.from('whatsapp_sessions').insert({
            message_sid: `crash-${Date.now()}`,
            from_number: ROYE_NUMBER,
            raw_input: msg,
            media_type: 'crash',
            claude_plan: { debugLogs: json.debugLogs ?? [], metadata: json.metadata ?? {}, videoUrl: json.videoUrl, screenshotUrl: json.screenshotUrl },
            status: 'crash_pending',
          }).select('id, status, report_number').single();
          newCrashSessionId = (crashInserted as Record<string, unknown> | null)?.id as string | null;
          crashReportNumber = (crashInserted as Record<string, unknown> | null)?.report_number as number | null;

          // Task 4: If DB trigger auto-dismissed this as dirty-shutdown, skip WhatsApp
          const crashStatus = (crashInserted as Record<string, unknown> | null)?.status as string | null;
          if (crashStatus === 'crash_skipped') {
            console.log('[whatsapp-bot] Dirty-shutdown crash auto-skipped by DB trigger');
            return new Response(JSON.stringify({ sent: false, skipped: true, reason: 'dirty_shutdown' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }
        } catch { /* fire and forget */ }

        // Build crash message — prefix with report_number if available
        const crashMsgWithNum = crashReportNumber !== null
          ? `💥 *קריסה #${crashReportNumber}*\n${msg}`
          : msg;

        // Send WhatsApp — wrapped in try/catch so a Twilio error never breaks the response
        let whatsappSent = false;
        let whatsappError: string | null = null;
        try {
          if (autoFixEnabled) {
            // Auto-fix: skip menu, go straight to analyzer
            await sendWhatsApp(ROYE_NUMBER, `AUTO-FIX: קריסה בשלב ${json.metadata?.lastStep ?? 'unknown'}. מנתח + מתקן...`);
            const analyzerUrl = `${SUPABASE_URL}/functions/v1/crash-analyzer`;
            fetch(analyzerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ debugLogs: json.debugLogs, metadata: json.metadata, autoApply: true, from: ROYE_NUMBER }),
            }).catch(() => {});
          } else {
            const crashSid = await sendWhatsApp(ROYE_NUMBER, crashMsgWithNum);
            whatsappSent = crashSid !== null;
            if (crashSid && newCrashSessionId) {
              supabase.from('whatsapp_sessions')
                .update({ message_sid: crashSid })
                .eq('id', newCrashSessionId)
                .then(() => {}).catch(() => {});
            }
          }
        } catch (sendErr) {
          whatsappError = String(sendErr);
          console.error('[whatsapp-bot] sendWhatsApp failed for crash notification:', sendErr);
        }

        return new Response(JSON.stringify({ sent: whatsappSent, autoFix: autoFixEnabled, twilioError: whatsappError, msgPreview: msg.slice(0, 80) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // ── Bug notification from the app ────────────────────────────────
      if (json?.bug_notification) {
        console.log('[whatsapp-bot] Bug notification received, reportId:', json.reportId);
        const ROYE_WA = Deno.env.get('ROYE_WHATSAPP_NUMBER') ?? 'whatsapp:+972504141513';
        const bugReportId = json.reportId ?? null;
        const bugFixPrompt = json.fixPrompt ?? null;
        const screenshotUrl: string | null = json.screenshotUrl ?? json.videoUrl ?? null;
        const audioUrl: string | null = json.audioUrl ?? null;

        // Query full report from DB
        let bugReport: Record<string, unknown> | null = null;
        if (bugReportId) {
          const { data } = await supabase
            .from('bug_reports')
            .select('id,ai_summary,ai_severity,ai_suggested_fix,ai_screen,ai_steps,device_info,metadata,console_logs,breadcrumbs,description,audio_url,video_url')
            .eq('id', bugReportId).single();
          bugReport = data;
          console.log('[whatsapp-bot] Bug report fetched:', { sev: bugReport?.ai_severity, summary: (bugReport?.ai_summary as string | null)?.slice(0, 50) });
        }

        // FIX 2: Transcribe bug report audio (if available) — give AI the user's verbal description
        let bugAudioTranscription: string | null = null;
        const _bugAudioUrl = audioUrl ?? (bugReport?.audio_url as string | null);
        if (_bugAudioUrl && OPENAI_API_KEY) {
          console.log('[whatsapp-bot] Transcribing bug report audio...');
          try {
            bugAudioTranscription = await transcribeBugAudio(_bugAudioUrl);
            if (bugAudioTranscription && bugReportId) {
              // Save transcription to DB description field (if description is empty)
              const existingDesc = (bugReport?.description as string | null) ?? '';
              if (!existingDesc.trim()) {
                await supabase.from('bug_reports').update({ description: bugAudioTranscription }).eq('id', bugReportId);
                if (bugReport) bugReport = { ...bugReport, description: bugAudioTranscription };
              }
            }
          } catch (_tErr) {
            console.error('[whatsapp-bot] Audio transcription failed (non-blocking):', _tErr);
          }
        }

        // FIX 1: Run AI triage if: (a) ai_summary is empty, OR (b) existing summary looks wrong
        // (contains "undefined", "tester", etc.) — meaning the app's inline triage ran on bad data.
        // Also re-run if we now have a transcription that wasn't available when inline triage ran.
        const _existingSummary = (bugReport?.ai_summary as string | null) ?? '';
        const _summaryLooksBad = !_existingSummary.trim()
          || _existingSummary.toLowerCase().includes('undefined')
          || _existingSummary.toLowerCase().includes('tester')
          || _existingSummary.toLowerCase().includes('metadata')
          || _existingSummary === 'Bug reported by user';
        const _shouldRetriage = bugReportId && bugReport && (_summaryLooksBad || (!!bugAudioTranscription && !_existingSummary.includes(bugAudioTranscription.slice(0, 20))));

        if (_shouldRetriage) {
          console.log('[whatsapp-bot] Running AI triage. summaryLooksBad:', _summaryLooksBad, '| hasTranscription:', !!bugAudioTranscription);
          try {
            const _report = bugReport!;
            const _logs   = (_report.console_logs as string[] | null) ?? [];
            const _crumbs = (_report.breadcrumbs  as Array<{ ts: string; screen: string }> | null) ?? [];
            const _dev    = (_report.device_info  as Record<string, string> | null) ?? {};

            // STRICTLY filtered game logs — NO pipeline noise, NO metadata fields
            const _gameLogs = _logs.filter((l) => {
              if (!l) return false;
              if (l.includes('[BUG-PIPE]')) return false;
              if (l.includes('[BUG-AUDIO]')) return false;
              if (l.includes('[BUG-WA]')) return false;
              if (l.includes('[FILE-READER]')) return false;
              if (l.includes('[PIPE-TEST]')) return false;
              if (l.includes('[TIMEOUT]')) return false;
              if (l.includes('[CRASH]')) return false;
              if (l.includes('expo-file-system')) return false;
              if (l === '--- PIPELINE LOGS ---') return false;
              return true;
            }).slice(-20);

            const _crumbText = _crumbs.map((c) => `${(c.ts ?? '?').slice(11, 19)} -> ${c.screen}`).join('\n');

            // The transcription is THE PRIMARY SOURCE OF TRUTH
            const _userDescription = bugAudioTranscription || (_report.description as string | null) || null;

            const _prompt = `Analyze this bug report from CAPS Poker (a mobile Omaha poker card game, React Native + Expo).

${_userDescription
  ? `## USER'S DESCRIPTION (THIS IS THE MOST IMPORTANT PART):\n"${_userDescription}"\n\nThe user recorded this as a voice message in Hebrew. This is what they want fixed. Your entire analysis should be based on THIS.`
  : `## No user description provided.\nAnalyze based on logs and navigation path only.`}

## Device:
${_dev.model ?? 'Unknown'} | ${_dev.osName ?? _dev.platform ?? 'iOS'} ${_dev.osVersion ?? ''} | Build ${_dev.buildNumber ?? ''}

${_gameLogs.length > 0 ? `## Game console logs (last ${_gameLogs.length} entries):\n${_gameLogs.join('\n')}` : '## No game logs captured.'}

## User navigation path:
${_crumbText || 'No breadcrumbs'}

## CRITICAL RULES:
1. The user's description (transcribed from audio) is the PRIMARY source. Base your analysis on what THEY said.
2. If the user describes a UI issue (like "remove the small numbers", "everything is crowded"), analyze THAT.
3. Do NOT analyze internal fields like tester_name, metadata format, or pipeline status.
4. Do NOT mention "undefined", "null", "missing fields", or "tester" — those are internal app fields, not bugs.
5. Be specific: name the React Native component, the screen file, the style property.
6. CAPS Poker context: cards have rank+suit display, boards show community cards, "YOUR HAND" is the player's hole cards at the bottom of the screen.

Respond with ONLY valid JSON, no markdown backticks:
{"severity":"low|medium|high|critical","summary":"One sentence about the ACTUAL bug the user described","suggested_fix":"Technical fix — which file, which component, what to change","screen":"The .tsx file or component name","steps":["Step 1","Step 2","Step 3"],"extra_bugs":[]}`;

            console.log('[TRIAGE] Calling Claude API. hasTranscription:', !!_userDescription, _userDescription ? '| "' + _userDescription.slice(0, 50) + '..."' : '');

            const _aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{ role: 'user', content: _prompt }] }),
              signal: AbortSignal.timeout(15000),
            });

            if (_aiRes.ok) {
              const _aiData = await _aiRes.json();
              const _raw = (_aiData.content?.[0]?.text ?? '{}').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
              let _triage: Record<string, unknown> = {};
              try { _triage = JSON.parse(_raw); } catch { /* ignore */ }
              console.log('[TRIAGE] Parsed:', (_triage.severity as string | null), '|', (_triage.summary as string | null)?.slice(0, 80));

              // Accept result if summary looks real (no "undefined"/"tester" pollution)
              const _triageSummary = (_triage.summary as string | null) ?? '';
              const _triageOk = !!_triageSummary && !_triageSummary.toLowerCase().includes('undefined') && !_triageSummary.toLowerCase().includes('tester');

              if (_triageOk) {
                await supabase.from('bug_reports').update({
                  ai_severity:      _triage.severity      ?? 'medium',
                  ai_summary:       _triageSummary,
                  ai_suggested_fix: _triage.suggested_fix ?? null,
                  ai_screen:        _triage.screen        ?? null,
                  ai_steps:         _triage.steps         ?? null,
                }).eq('id', bugReportId);

                const { data: _enriched } = await supabase
                  .from('bug_reports')
                  .select('id,ai_summary,ai_severity,ai_suggested_fix,ai_screen,ai_steps,device_info,metadata,console_logs,breadcrumbs,description,audio_url,video_url')
                  .eq('id', bugReportId).single();
                if (_enriched) {
                  bugReport = _enriched;
                  console.log('[TRIAGE] Enriched. severity:', _enriched.ai_severity, 'summary:', (_enriched.ai_summary as string | null)?.slice(0, 60));
                }
              } else {
                // AI gave bad output — use transcription directly as fallback summary
                if (_userDescription && bugReportId) {
                  const _fallbackSummary = 'User reported: ' + _userDescription.slice(0, 150);
                  await supabase.from('bug_reports').update({
                    ai_severity: 'medium',
                    ai_summary: _fallbackSummary,
                    ai_suggested_fix: 'Review the audio recording and screenshot for details',
                  }).eq('id', bugReportId);
                  if (bugReport) bugReport = { ...bugReport, ai_summary: _fallbackSummary, ai_severity: 'medium' };
                  console.log('[TRIAGE] Used transcription fallback summary');
                }
              }
            } else {
              console.error('[TRIAGE] AI API error:', _aiRes.status, (await _aiRes.text().catch(() => '')).slice(0, 200));
              // Fallback: save transcription as summary
              if (_userDescription && bugReportId) {
                const _fallbackSummary = 'User reported: ' + _userDescription.slice(0, 150);
                await supabase.from('bug_reports').update({ ai_severity: 'medium', ai_summary: _fallbackSummary }).eq('id', bugReportId);
                if (bugReport) bugReport = { ...bugReport, ai_summary: _fallbackSummary, ai_severity: 'medium' };
              }
            }
          } catch (_aiErr) {
            console.error('[TRIAGE] AI failed (non-blocking):', _aiErr);
          }
        }

        // Build rich fix_prompt NOW — after AI triage + Whisper transcription are done.
        // This is what Claude Bot receives when Roye replies "1".
        const richFixPrompt = bugReport
          ? buildFixPromptFromReport(bugReport, bugAudioTranscription)
          : (bugFixPrompt ?? 'Bug fix requested');
        console.log('[whatsapp-bot] richFixPrompt length:', richFixPrompt.length);

        // Build rich message from DB data (fallback to json.message if DB empty)
        const bugMsg = bugReport
          ? buildBugMessage(bugReport, richFixPrompt, bugAudioTranscription)
          : (json.message ?? 'Bug report received');
        const bugAiSummary = (bugReport?.ai_summary as string | null) ?? (json.aiSummary as string | null);
        const effectiveAudio = audioUrl ?? (bugReport?.audio_url as string | null);
        const effectiveScreenshot = screenshotUrl ?? (bugReport?.video_url as string | null);

        // Insert session and fetch report_number
        let insertedSession: { status: string; report_number: number | null } | null = null;
        try {
          const { data: insertedRows } = await supabase.from('whatsapp_sessions').insert({
            message_sid: `bug-${Date.now()}`,
            from_number: ROYE_WA,
            raw_input: bugMsg,
            media_type: 'bug',
            claude_plan: {
              bug_report_id: bugReportId,
              fix_prompt: richFixPrompt,
              ai_summary: bugAiSummary,
              audio_url: effectiveAudio,
              screenshot_url: effectiveScreenshot,
            },
            status: 'bug_pending',
          }).select('id, status, report_number').single();
          insertedSession = insertedRows as { status: string; report_number: number | null } | null;
        } catch { /* non-critical */ }

        // Rebuild bugMsg with report_number now that we have it
        const reportNumber = insertedSession?.report_number ?? null;
        const finalBugMsg = bugReport
          ? buildBugMessage({ ...bugReport, report_number: reportNumber }, richFixPrompt, bugAudioTranscription)
          : bugMsg;
        if (bugReportId) {
          try {
            await supabase.from('bug_notifications').insert({
              bug_report_id: bugReportId,
              channel: 'whatsapp',
              recipient: ROYE_WA,
              message: bugAiSummary,
              status: 'sent',
              fix_prompt: bugFixPrompt,
            });
          } catch { /* non-critical */ }
        }

        let bugWaSent = false;
        let bugTwilioSid: string | null = null;
        let bugWaError: string | null = null;
        try {
          // Send main message with screenshot embedded as media
          bugTwilioSid = await sendWhatsApp(ROYE_WA, finalBugMsg, effectiveScreenshot ?? undefined);
          bugWaSent = bugTwilioSid !== null;
          // Send audio as second message
          if (bugTwilioSid && effectiveAudio) {
            await sendWhatsApp(ROYE_WA, 'Audio recording:', effectiveAudio).catch(() => {});
          }
          if (bugTwilioSid) {
            supabase.from('whatsapp_sessions')
              .update({ message_sid: bugTwilioSid, status: 'bug_sent' })
              .eq('from_number', ROYE_WA).eq('status', 'bug_pending')
              .order('created_at', { ascending: false }).limit(1)
              .then(() => {}).catch(() => {});
            if (bugReportId) {
              supabase.from('bug_notifications')
                .update({ status: 'delivered' })
                .eq('bug_report_id', bugReportId)
                .then(() => {}).catch(() => {});
            }
          } else {
            bugWaError = 'Twilio returned no SID (check credentials or message format)';
          }
        } catch (e) {
          bugWaError = String(e);
        }
        console.log('[whatsapp-bot] Bug notification result:', { bugWaSent, bugTwilioSid, bugWaError });
        return new Response(JSON.stringify({ sent: bugWaSent, sid: bugTwilioSid, reportId: bugReportId, twilioError: bugWaError }), {
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

  // ── autofix_callback from GitHub Actions ───────────────────────────────────
  // Called after claude-fix.yml finishes — sends WhatsApp result to Roye.
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(rawBody);
      if (json?.type === 'autofix_callback') {
        console.log('[whatsapp-bot] autofix_callback received:', json);
        const { run_id, result, has_changes, test_passed } = json as Record<string, unknown>;
        const ROYE_WA = Deno.env.get('ROYE_WHATSAPP_NUMBER') ?? 'whatsapp:+972504141513';

        // Find the session with this run_id
        let session: Record<string, unknown> | null = null;
        if (run_id) {
          const { data } = await supabase
            .from('whatsapp_sessions')
            .select('id,from_number,status')
            .eq('github_run_id', run_id)
            .single();
          session = data;
        }
        // Fallback: latest bug_fixing session
        if (!session) {
          const { data } = await supabase
            .from('whatsapp_sessions')
            .select('id,from_number,status')
            .eq('status', 'bug_fixing')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          session = data;
        }

        const { message: callbackMsg, claude_available } = json as Record<string, unknown>;
        let message = '';
        let newStatus = 'bug_fixed';
        if (result === 'fixed' && test_passed) {
          message = '[OK] Auto-fix complete! Code committed + OTA deployed. All tests pass.';
          newStatus = 'bug_fixed';
        } else if (result === 'fixed' && !test_passed) {
          message = 'Auto-fix applied but some tests failed. Changes committed — review needed.';
          newStatus = 'bug_fix_partial';
        } else if (result === 'manual_no_key') {
          message = 'ANTHROPIC_API_KEY not in GitHub Secrets. Add it at: github.com/royea-beep/caps-poker/settings/secrets/actions — then reply "1" again.';
          newStatus = 'bug_manual';
        } else if (result === 'claude_failed') {
          message = 'Claude Code install failed in CI. Prompt saved to docs/prompts/. Send to local Claude Bot for manual fix.';
          newStatus = 'bug_manual';
        } else if (result === 'manual') {
          message = 'Claude Code not available on CI. Prompt saved to docs/prompts/. Run locally.';
          newStatus = 'bug_manual';
        } else if (result === 'no_changes') {
          message = 'Claude Code analyzed the code but made no changes — fix may need more context. Check run: github.com/royea-beep/caps-poker/actions';
          newStatus = 'bug_no_changes';
          // Escalate via RPC so DB trigger can re-queue or notify
          const escalateSessionId = session?.id as string | null;
          if (escalateSessionId) {
            supabase.rpc('escalate_no_changes', {
              p_session_id: escalateSessionId,
              p_reason: 'Claude Code analyzed the code but determined no changes were needed. The issue may require manual investigation or more context.',
            }).then(() => {}).catch(() => {});
          }
        } else {
          message = (callbackMsg as string | null) ?? `Auto-fix run #${run_id ?? '?'} finished (result: ${result ?? 'unknown'}).`;
          newStatus = 'bug_fix_done';
        }

        if (session) {
          await supabase.from('whatsapp_sessions').update({ status: newStatus }).eq('id', session.id);
          const toNumber = (session.from_number as string | null) ?? ROYE_WA;
          await sendWhatsApp(toNumber, message);
        } else {
          // No session found — notify Roye directly
          await sendWhatsApp(ROYE_WA, message);
        }

        console.log('[whatsapp-bot] autofix_callback handled. result:', result, 'newStatus:', newStatus);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    } catch { /* ignore parse errors */ }
  }

  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Twilio signature verification — log but don't block (sandbox doesn't always sign correctly)
  const twilioSignature = req.headers.get('x-twilio-signature') ?? '';
  if (twilioSignature) {
    const valid = await verifyTwilioSignature(req.url, params, twilioSignature);
    if (!valid) {
      console.warn('[whatsapp-bot] Signature mismatch — rejecting request');
      return new Response('forbidden', { status: 403 });
    }
  } else {
    console.warn('[whatsapp-bot] No signature header — rejecting request');
    return new Response('forbidden', { status: 403 });
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

  // ── Route incoming replies through handle_whatsapp_reply() RPC ───────────────
  // Handles: numbered replies (1-7), report-prefixed replies (82:1), and crash keywords
  const isReplyCandidate = (
    /^\d+(:\d+)?(\s|$)/.test(msgBody.trim()) ||
    ['FIX','SKIP','MARATHON','AUTO','DASHBOARD','RETRY','R','תקן','דלג','אוטו','דשבורד','נסה שוב'].includes(upperBody)
  );

  if (isReplyCandidate) {
    const { data: rpcData } = await supabase.rpc('handle_whatsapp_reply', {
      p_from_number: from,
      p_reply: msgBody.trim(),
    });

    if (rpcData?.success) {
      // RPC handled it — special case: option 5 (audio) needs to send media directly
      if (rpcData.action === 'send_audio' && rpcData.audio_url) {
        await sendWhatsApp(from, 'Audio recording:', rpcData.audio_url);
      } else if (rpcData.message_he) {
        await sendWhatsApp(from, rpcData.message_he);
      }
      return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    } else if (rpcData?.success === false) {
      // RPC explicitly failed — send error message but continue (may be a new report)
      if (rpcData?.message_he && rpcData.message_he !== 'not_a_reply') {
        await sendWhatsApp(from, rpcData.message_he || 'שגיאה בעיבוד התגובה');
        return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
      }
      // rpcData.message_he === 'not_a_reply' or rpcData is null → fall through to legacy handlers
    }

    // ── Fallback: legacy inline handlers (when RPC is not deployed yet) ──────
    if (['1', '2', '3', '4', '5', '6', '7'].includes(upperBody)) {
      const bugWinStart = new Date(Date.now() - BUG_REPLY_WINDOW_MS).toISOString();
      const { data: bugSession } = await supabase
        .from('whatsapp_sessions').select('*')
        .eq('from_number', from).eq('status', 'bug_pending')
        .gte('created_at', bugWinStart)
        .order('created_at', { ascending: false }).limit(1).single();
      if (bugSession) {
        const bugReply = await handleBugReply(msgBody, bugSession, supabase, from);
        if (bugReply) {
          await sendWhatsApp(from, bugReply);
          return new Response('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
        }
      }
    }

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
