import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Canonical egress: HQ empire-messaging only (no direct api.twilio.com).
// Deploy requires Caps secret EMPIRE_MESSAGING_SECRET (= HQ x-empire-secret).
const EMPIRE_MESSAGING_URL =
  Deno.env.get('EMPIRE_MESSAGING_URL') ??
  'https://vjxqlqtlywovnbidovit.supabase.co/functions/v1/empire-messaging';
const EMPIRE_MESSAGING_SECRET = Deno.env.get('EMPIRE_MESSAGING_SECRET') ?? '';

function sanitize(text: string): string {
  return text.replace(/[^\x00-\x7F\u0590-\u05FF\u0600-\u06FF\n*_:()\[\]#\-=.!?+\'"@\/\\]/g, '').trim();
}

/** Heroes phone-otp pattern: POST HQ empire-messaging with project_slug. */
async function sendWhatsApp(to: string, body: string): Promise<string | null> {
  if (!EMPIRE_MESSAGING_SECRET) {
    console.error('[flush] EMPIRE_MESSAGING_SECRET missing — cannot send via empire-messaging');
    return null;
  }
  try {
    const res = await fetch(EMPIRE_MESSAGING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-empire-secret': EMPIRE_MESSAGING_SECRET,
      },
      body: JSON.stringify({
        to,
        body: sanitize(body),
        project_slug: 'caps-poker',
        channel: 'whatsapp',
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || !data.sid) {
      console.error('[flush] empire-messaging error:', res.status, JSON.stringify(data).slice(0, 200));
      return null;
    }
    return data.sid as string;
  } catch (err) {
    console.error('[flush] empire-messaging timeout or error:', err);
    return null;
  }
}

async function triggerGitHubFix(fixPrompt: string, summary: string): Promise<number | null> {
  if (!GITHUB_TOKEN) return null;
  const repo = 'royea-beep/caps-poker';
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'claude-fix-no-build', client_payload: { summary, fix_prompt: fixPrompt, plan: fixPrompt, files: '', effort: 'MEDIUM', severity: 'MEDIUM', type: 'BUG', project: 'caps-poker' } }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 204 || res.status === 200) {
      await new Promise(r => setTimeout(r, 2000));
      const rr = await fetch(`https://api.github.com/repos/${repo}/actions/runs?event=repository_dispatch&per_page=1`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(5000),
      });
      const d = await rr.json().catch(() => ({}));
      return (d.workflow_runs?.[0]?.id as number) ?? 1;
    }
    return null;
  } catch (err) {
    console.error('[flush] GitHub error:', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: Array<{ type: string; id: string; success: boolean; detail?: string }> = [];

  // JOB 1: Send pending WhatsApp outbound messages (legacy)
  const { data: pendingMsgs } = await supabase.from('whatsapp_outbound').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(10);
  if (pendingMsgs && pendingMsgs.length > 0) {
    console.log(`[flush] Sending ${pendingMsgs.length} pending WA messages`);
    for (const msg of pendingMsgs) {
      if (!msg.to_number || !msg.message) {
        await supabase.from('whatsapp_outbound').update({ status: 'failed' }).eq('id', msg.id);
        results.push({ type: 'outbound', id: msg.id, success: false, detail: 'missing fields' });
        continue;
      }
      const sid = await sendWhatsApp(msg.to_number, msg.message);
      await supabase.from('whatsapp_outbound').update({ status: sid ? 'sent' : 'failed', ...(sid ? { sent_at: new Date().toISOString() } : {}) }).eq('id', msg.id);
      results.push({ type: 'outbound', id: msg.id, success: !!sid });
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // JOB 2: Trigger GitHub fixes for approved bugs
  const { data: approvedBugs } = await supabase.from('whatsapp_sessions').select('id, report_number, claude_plan, user_note, from_number, roye_instructions').eq('status', 'bug_approved').is('github_run_id', null).order('created_at', { ascending: true }).limit(5);
  if (approvedBugs && approvedBugs.length > 0) {
    console.log(`[flush] Processing ${approvedBugs.length} approved bugs`);
    for (const bug of approvedBugs) {
      const plan = bug.claude_plan as Record<string, unknown> | null;
      let fixPrompt = (plan?.fix_prompt as string | null) ?? null;
      const aiSummary = (plan?.ai_summary as string | null) ?? 'Bug fix';
      if (!fixPrompt) {
        await supabase.from('whatsapp_sessions').update({ status: 'bug_no_prompt' }).eq('id', bug.id);
        results.push({ type: 'github', id: bug.id, success: false, detail: 'no fix_prompt' });
        continue;
      }
      const userNote = bug.user_note as string | null;
      if (userNote) fixPrompt += `\n\n## ROYE INSTRUCTION:\n"${userNote}"`;
      const runId = await triggerGitHubFix(fixPrompt, aiSummary);
      await supabase.from('whatsapp_sessions').update({ github_run_id: runId, status: runId ? 'bug_fixing' : 'bug_github_failed' }).eq('id', bug.id);
      results.push({ type: 'github', id: bug.id, success: !!runId, detail: runId ? `run=${runId}` : 'failed' });
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // JOB 3: Expire stale sessions (>30 min)
  const stale = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: expired } = await supabase.from('whatsapp_sessions').update({ status: 'timeout_expired' }).in('status', ['bug_pending', 'bug_sent', 'crash_pending']).lt('created_at', stale).is('github_run_id', null).select('*', { count: 'exact', head: true });

  const summary = { messages_sent: results.filter(r => r.type === 'outbound' && r.success).length, fixes_triggered: results.filter(r => r.type === 'github' && r.success).length, sessions_expired: expired ?? 0, results };
  console.log('[flush] Done:', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
