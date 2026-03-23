/**
 * crash-analyzer — Deno Edge Function
 *
 * Receives a crash report ID or raw crash data, uses Claude to analyze it,
 * optionally triggers GitHub Actions to apply a fix, then sends results
 * back to Roye via WhatsApp.
 *
 * Invoked by whatsapp-bot-handler when user replies 1 or 2 to a crash alert.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const GITHUB_TOKEN         = Deno.env.get('GITHUB_TOKEN')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_ACCOUNT_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN    = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!;

const CAPS_REPO = 'royea-beep/caps-poker';

// ── WhatsApp helper ─────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: to, Body: body }).toString(),
  });
}

// ── GitHub file fetcher ─────────────────────────────────────────────────────

async function fetchFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${CAPS_REPO}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3.raw',
        },
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    // Truncate to first 300 lines to stay within context
    return text.split('\n').slice(0, 300).join('\n');
  } catch {
    return null;
  }
}

// ── Trigger GitHub Actions ──────────────────────────────────────────────────

async function triggerGitHubFix(
  summary: string,
  files: string[],
  plan: string[],
  autoApply: boolean,
): Promise<void> {
  const eventType = autoApply ? 'claude-fix-no-build' : 'claude-fix-no-build';
  await fetch(`https://api.github.com/repos/${CAPS_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: {
        summary,
        plan: plan.join('\n'),
        files: files.join(', '),
        effort: 'MEDIUM',
        severity: 'CRITICAL',
        type: 'BUG',
        project: 'caps-poker',
      },
    }),
  });
}

// ── Claude crash analysis ───────────────────────────────────────────────────

interface CrashAnalysis {
  crash_step: string;
  crash_cause: string;
  fix_description: string;
  fix_file: string;
  fix_plan: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

async function analyzeCrash(
  debugLogs: string[],
  metadata: Record<string, string>,
  sourceCode: Record<string, string>,
): Promise<CrashAnalysis> {
  const logsText = debugLogs.length > 0
    ? debugLogs.join('\n')
    : '(no debug logs available)';

  const metaText = Object.entries(metadata)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const filesText = Object.entries(sourceCode)
    .map(([path, content]) => `\n=== FILE: ${path} ===\n${content}`)
    .join('\n');

  const systemPrompt = `You are an expert React Native + Expo crash analyzer.
Stack: React Native + Expo SDK 55, Reanimated v3, TypeScript, Zustand.

Known crash patterns:
- Reanimated worklet crash: calling withTiming/withSpring on unmounted component
- Reanimated no-op: withTiming(x, …) where x is already the current value
- useAnimatedStyle returning undefined values (borderColor: undefined causes crash)
- setState called inside another setState updater (intermediate render with inconsistent state)
- cancelAnimation missing on withRepeat(-1) loops — crash on unmount
- computeOmahaEquity called in setTimeout during reveal — blocks JS thread

Respond ONLY in this exact format (no extra text):
CRASH_STEP: (which step/function crashed — e.g. "results screen mount", "CompleteOverlay unmount")
CRASH_CAUSE: (specific cause — e.g. "withTiming(0) called on 52 Card components already at 0")
FIX_DESCRIPTION: (concise fix description in English)
FIX_FILE: (primary file to fix, e.g. components/Card.tsx)
CONFIDENCE: HIGH|MEDIUM|LOW
FIX_PLAN:
1. (step 1)
2. (step 2)
3. (step 3)`;

  const userContent = `DEBUG LOGS (last 20 entries):
${logsText}

METADATA:
${metaText}

SOURCE CODE:
${filesText}

Analyze this crash and provide the fix plan.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '';

  const stepMatch  = text.match(/CRASH_STEP:\s*(.+)/);
  const causeMatch = text.match(/CRASH_CAUSE:\s*(.+)/);
  const fixMatch   = text.match(/FIX_DESCRIPTION:\s*(.+)/);
  const fileMatch  = text.match(/FIX_FILE:\s*(.+)/);
  const confMatch  = text.match(/CONFIDENCE:\s*(HIGH|MEDIUM|LOW)/);
  const planMatch  = text.match(/FIX_PLAN:\n([\s\S]*?)$/);

  const fixPlan = planMatch?.[1]
    ?.split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean) ?? [];

  return {
    crash_step:      stepMatch?.[1]?.trim()  ?? 'unknown',
    crash_cause:     causeMatch?.[1]?.trim() ?? 'unknown',
    fix_description: fixMatch?.[1]?.trim()   ?? 'unknown',
    fix_file:        fileMatch?.[1]?.trim()  ?? 'unknown',
    fix_plan:        fixPlan,
    confidence:     (confMatch?.[1]          ?? 'LOW') as CrashAnalysis['confidence'],
  };
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: {
    crashReportId?: string;
    debugLogs?: string[];
    metadata?: Record<string, string>;
    autoApply: boolean;
    from: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { crashReportId, autoApply, from } = body;
  let debugLogs: string[] = body.debugLogs ?? [];
  let metadata: Record<string, string> = body.metadata ?? {};

  console.log('[crash-analyzer] Starting analysis. autoApply:', autoApply, 'from:', from);

  // ── If we have a crash report ID, load it from Supabase ──────────────────
  if (crashReportId) {
    const { data: report } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('id', crashReportId)
      .single();

    if (report) {
      const meta = report.metadata ?? {};
      debugLogs = meta.debugLogs ?? debugLogs;
      metadata  = {
        build:     meta.build     ?? 'unknown',
        version:   meta.version   ?? 'unknown',
        device:    meta.device    ?? 'unknown',
        lastStep:  meta.lastStep  ?? 'unknown',
        crashError: meta.crashError ?? 'unknown',
        ...metadata,
      };
    }
  }

  // ── Fetch relevant source files for context ───────────────────────────────
  const filesToFetch = [
    'components/Card.tsx',
    'app/results.tsx',
    'components/CompleteOverlay.tsx',
    'components/Board.tsx',
  ];

  const sourceCode: Record<string, string> = {};
  await Promise.all(
    filesToFetch.map(async (path) => {
      const content = await fetchFile(path);
      if (content) sourceCode[path] = content;
    }),
  );

  console.log('[crash-analyzer] Source files fetched:', Object.keys(sourceCode).join(', '));

  // ── Run Claude analysis ───────────────────────────────────────────────────
  let analysis: CrashAnalysis;
  try {
    analysis = await analyzeCrash(debugLogs, metadata, sourceCode);
  } catch (e) {
    console.error('[crash-analyzer] Claude API error:', e);
    await sendWhatsApp(from, '❌ ניתוח נכשל. בדוק את ANTHROPIC_API_KEY.');
    return new Response(JSON.stringify({ error: 'Claude API failed' }), { status: 500 });
  }

  console.log('[crash-analyzer] Analysis complete:', JSON.stringify(analysis).slice(0, 200));

  // ── Save analysis to bug_reports ──────────────────────────────────────────
  const analysisPayload = {
    analysis,
    autoApply,
    analyzedAt: new Date().toISOString(),
  };

  if (crashReportId) {
    await supabase
      .from('bug_reports')
      .update({
        description: `[AUTO-ANALYSIS] ${analysis.crash_cause}`,
        metadata: { ...metadata, ...analysisPayload },
        status: autoApply ? 'fixing' : 'analyzed',
      })
      .eq('id', crashReportId);
  } else {
    await supabase.from('bug_reports').insert({
      title: `[CRASH] ${analysis.crash_step}`,
      description: `[AUTO-ANALYSIS] ${analysis.crash_cause}`,
      url: 'crash-analyzer',
      report_type: 'text',
      metadata: { ...metadata, ...analysisPayload },
      status: autoApply ? 'fixing' : 'analyzed',
    });
  }

  // ── If autoApply: trigger GitHub Actions ─────────────────────────────────
  if (autoApply) {
    try {
      await triggerGitHubFix(
        analysis.fix_description,
        [analysis.fix_file],
        analysis.fix_plan,
        true,
      );
      console.log('[crash-analyzer] GitHub Actions triggered');

      const msg = [
        '🔧 *FIX TRIGGERED*',
        '',
        `Step: ${analysis.crash_step}`,
        `Cause: ${analysis.crash_cause}`,
        `Fix: ${analysis.fix_description}`,
        `File: ${analysis.fix_file}`,
        `Confidence: ${analysis.confidence}`,
        '',
        '⚙️ GitHub Actions running — OTA תוך ~2 דקות.',
      ].join('\n');

      await sendWhatsApp(from, msg);
    } catch (e) {
      console.error('[crash-analyzer] GitHub Actions failed:', e);
      await sendWhatsApp(from, `🔧 ניתוח הצליח אך הפעלת GitHub נכשלה.\nFix: ${analysis.fix_description}\nFile: ${analysis.fix_file}`);
    }
  } else {
    // Analysis only — format and send results
    const confEmoji = analysis.confidence === 'HIGH' ? '🟢' : analysis.confidence === 'MEDIUM' ? '🟡' : '🔴';
    const planText  = analysis.fix_plan.map((s, i) => `${i + 1}. ${s}`).join('\n');

    const msg = [
      '🔍 *CRASH ANALYSIS:*',
      '',
      `Step: ${analysis.crash_step}`,
      `Cause: ${analysis.crash_cause}`,
      `Fix: ${analysis.fix_description}`,
      `File: ${analysis.fix_file}`,
      `Confidence: ${confEmoji} ${analysis.confidence}`,
      '',
      `Plan:\n${planText}`,
      '',
      'Reply *1* to apply this fix.',
    ].join('\n');

    await sendWhatsApp(from, msg);
  }

  return new Response(JSON.stringify({ ok: true, analysis }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
