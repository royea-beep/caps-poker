import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;

// ── Timeout / batch guards ─────────────────────────────────────────────────
const MAX_CRASHES_PER_PROJECT = 2;          // Guard 1 — was implicitly 3, now 2
const OPERATION_TIMEOUT_MS    = 30_000;     // Guard 2 — 30s per individual HTTP op
const MAX_TOTAL_DURATION_MS   = 120_000;    // Guard 3 — hard stop at 120s (before 150s limit)

/** Reject a promise after `ms` milliseconds. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}


async function requireServiceRole(req) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });
  const token = auth.slice('Bearer '.length).trim();
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!expected || token !== expected) return new Response('forbidden', { status: 403 });
  return null;
}

const PROJECT_CONFIG: Record<string, {
  supabaseUrl: string;
  supabaseKey: string;
  repo: string;
  defaultBranch: string;
}> = {
  caps: {
    // Use built-in service role key — Edge Function is deployed on Caps project
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? Deno.env.get('CAPS_SUPABASE_URL') ?? '',
    supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('CAPS_SUPABASE_KEY') ?? '',
    repo: 'royea-beep/caps-poker',
    defaultBranch: 'main',
  },
  '9soccer': {
    supabaseUrl: Deno.env.get('NINESOCCER_SUPABASE_URL') ?? '',
    supabaseKey: Deno.env.get('NINESOCCER_SUPABASE_KEY') ?? '',
    repo: 'royea-beep/90Soccer-Mascots',
    defaultBranch: 'main',
  },
  wingman: {
    supabaseUrl: Deno.env.get('WINGMAN_SUPABASE_URL') ?? '',
    supabaseKey: Deno.env.get('WINGMAN_SUPABASE_KEY') ?? '',
    repo: 'royea-beep/Wingman',
    defaultBranch: 'main',
  },
};

// Screen name → likely source file (Caps-specific)
const CAPS_SCREEN_MAP: Record<string, string[]> = {
  'Splash': ['app/index.tsx', 'app/_layout.tsx'],
  'Game': ['app/game.tsx', 'components/Board.tsx'],
  'Home': ['app/index.tsx'],
  'Results': ['app/results.tsx'],
  'Settings': ['app/settings.tsx'],
  'Lobby': ['app/lobby.tsx'],
};

// Extract file paths from a stack trace string
function extractFilePaths(stack: string, lastScreen?: string): string[] {
  const paths: string[] = [];
  const patterns = [
    /at\s+[\w.<>]+\s+\(([^)]+\.tsx?):[\d]+:[\d]+\)/g,
    /at\s+([^()\s]+\.tsx?):[\d]+:[\d]+/g,
    /([a-zA-Z0-9_/.-]+\.tsx?)(?::\d+)?/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(stack)) !== null) {
      const p = match[1].replace(/^.*?(?=components\/|app\/|utils\/|hooks\/|constants\/|store\/|screens\/|src\/)/, '');
      if (p && !p.includes('node_modules') && !paths.includes(p)) {
        paths.push(p);
      }
    }
  }
  // Expand bare filenames to likely repo paths
  const expanded: string[] = [];
  const dirPrefixes = ['components/', 'app/', 'utils/', 'hooks/', 'store/', 'constants/', 'screens/', 'src/'];
  for (const p of paths) {
    if (p.includes('/')) {
      expanded.push(p);
    } else {
      // Try each dir prefix — will be resolved when fetching (404 = skip)
      for (const prefix of dirPrefixes) {
        expanded.push(prefix + p);
      }
    }
  }

  // Fallback: use last_screen to guess file paths
  if (expanded.length === 0 && lastScreen) {
    const mapped = CAPS_SCREEN_MAP[lastScreen] ?? [];
    expanded.push(...mapped);
  }

  return [...new Set(expanded)].slice(0, 6); // Cap at 6 files (some may 404)
}

// Return true if this crash is a dirty-shutdown (not a code bug — skip auto-fix)
function isDirtyShutdown(crash: Record<string, unknown>): boolean {
  const msg = String(crash.error_message ?? '').toLowerCase();
  return msg.includes('dirty-shutdown') || msg.includes('dirty shutdown') || msg.includes('native crash (dirty');
}

// Fetch file content from GitHub
async function fetchFileFromGitHub(repo: string, branch: string, filePath: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
  const resp = await withTimeout(
    fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    }),
    OPERATION_TIMEOUT_MS,
    `fetchFile ${filePath}`
  );
  if (!resp.ok) return null;
  return await resp.text();
}

// Get file SHA for GitHub commit
async function getFileSha(repo: string, branch: string, filePath: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
  const resp = await withTimeout(
    fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }),
    OPERATION_TIMEOUT_MS,
    `getFileSha ${filePath}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.sha ?? null;
}

// Commit a file fix to GitHub
async function commitFix(repo: string, branch: string, filePath: string, content: string, message: string): Promise<string | null> {
  const sha = await getFileSha(repo, branch, filePath);
  if (!sha) return null;
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const resp = await withTimeout(
    fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: encoded,
        sha,
        branch,
      }),
    }),
    OPERATION_TIMEOUT_MS,
    `commitFix ${filePath}`
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub commit failed: ${err}`);
  }
  const data = await resp.json();
  return data.commit?.sha ?? null;
}

// Call Claude to get a fix
async function askClaude(crash: Record<string, unknown>, sourceFiles: Record<string, string>): Promise<{ file: string; content: string } | null> {
  const fileSection = Object.entries(sourceFiles)
    .map(([path, code]) => `### ${path}\n\`\`\`typescript\n${code.slice(0, 8000)}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are an expert React Native / Next.js developer. A crash was reported in production.

## CRASH DETAILS
Code: ${crash.crash_code}
Error: ${crash.error_message}
Stack:
\`\`\`
${crash.error_stack ?? '(no stack)'}
\`\`\`
Last screen: ${crash.last_screen ?? 'unknown'}
Last action: ${crash.last_action ?? 'unknown'}

## RELEVANT SOURCE FILES
${fileSection || '(no source files found — use error message and stack to infer fix)'}

## TASK
Analyze the crash and produce a minimal fix.

Respond with ONLY valid JSON in this exact format.
IMPORTANT: base64-encode the fixedContent to avoid JSON escaping issues.

{
  "canFix": true,
  "file": "relative/path/to/file.tsx",
  "fixedContentBase64": "<base64-encoded complete fixed file>",
  "explanation": "one sentence"
}

OR if you cannot confidently fix it:
{
  "canFix": false,
  "reason": "why you cannot fix it"
}

Rules:
- Only change what is necessary to fix the crash
- Return the COMPLETE fixed file content base64-encoded (not a diff)
- The file path must match one of the source files provided
- Do not add comments unless explaining the fix`;

  const resp = await withTimeout(
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    }),
    OPERATION_TIMEOUT_MS,
    'askClaude API call'
  );

  if (!resp.ok) throw new Error(`Claude API error: ${resp.status}`);
  const data = await resp.json();
  const text = data.content?.[0]?.text ?? '';

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude response had no JSON');
  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.canFix) throw new Error(`Claude declined: ${parsed.reason}`);
  let content: string;
  if (parsed.fixedContentBase64) {
    content = new TextDecoder().decode(Uint8Array.from(atob(parsed.fixedContentBase64), c => c.charCodeAt(0)));
  } else {
    content = parsed.fixedContent ?? '';
  }
  return { file: parsed.file, content };
}

// Send ntfy alert
async function sendNtfy(channel: string, title: string, body: string) {
  await fetch(`https://ntfy.sh/${channel}`, {
    method: 'POST',
    headers: { 'Title': title, 'Priority': '4' },
    body,
  }).catch(() => {});
}

// Process a single project's crashes
async function processProject(projectKey: string, startTime: number) {
  const config = PROJECT_CONFIG[projectKey];
  if (!config?.supabaseUrl || !config?.supabaseKey) return { project: projectKey, error: 'missing config' };

  const sb = createClient(config.supabaseUrl, config.supabaseKey);

  const { data: crashes, error } = await sb
    .from('crash_reports')
    .select('*')
    .eq('status', 'new')
    .lt('auto_fix_attempts', 3)
    .order('created_at', { ascending: true })
    .limit(MAX_CRASHES_PER_PROJECT); // Guard 1 — capped at 2

  if (error) return { project: projectKey, error: error.message };
  if (!crashes?.length) return { project: projectKey, crashes: 0, message: 'No new crashes' };

  const results = [];

  for (const crash of crashes) {
    // Guard 3 — stop early if approaching the 150s function limit
    if (Date.now() - startTime > MAX_TOTAL_DURATION_MS) {
      console.log(`[${projectKey}] Approaching time limit, stopping early`);
      results.push({ crashCode: crash.crash_code, status: 'DEFERRED_TIME_LIMIT' });
      break;
    }

    // Guard 4 — mark as auto_fixing BEFORE processing so a timeout
    // on this invocation won't reprocess the same crash immediately.
    await sb.from('crash_reports').update({
      status: 'auto_fixing',
      auto_fix_attempts: (crash.auto_fix_attempts ?? 0) + 1,
    }).eq('id', crash.id);

    // Skip dirty-shutdown crashes — they're OS kills, not code bugs
    if (isDirtyShutdown(crash)) {
      await sb.from('crash_reports').update({
        status: 'needs_human',
        auto_fix_attempts: 3,
        auto_fix_error: 'Skipped: dirty-shutdown is an OS kill, not a code bug',
      }).eq('id', crash.id);
      results.push({ crashCode: crash.crash_code, status: 'SKIPPED_DIRTY_SHUTDOWN' });
      continue;
    }

    try {
      // Extract file paths from stack trace + last_screen fallback
      const stackText = [crash.error_stack, crash.fix_prompt].filter(Boolean).join('\n');
      const filePaths = extractFilePaths(stackText, crash.last_screen as string | undefined);

      // Fetch source files from GitHub (each individually guarded by withTimeout)
      const sourceFiles: Record<string, string> = {};
      for (const fp of filePaths) {
        // Skip remaining file fetches if time is running short
        if (Date.now() - startTime > MAX_TOTAL_DURATION_MS) break;
        const content = await fetchFileFromGitHub(config.repo, config.defaultBranch, fp);
        if (content) sourceFiles[fp] = content;
      }

      // Ask Claude for a fix (guarded by withTimeout inside askClaude)
      const fix = await askClaude(crash, sourceFiles);
      if (!fix) throw new Error('No fix returned');

      // Commit the fix (guarded by withTimeout inside commitFix)
      const commitMessage = `fix: auto-fix ${crash.crash_code} — ${(crash.error_message ?? '').slice(0, 80)}`;
      const commitSha = await commitFix(config.repo, config.defaultBranch, fix.file, fix.content, commitMessage);

      // Mark as auto_fixed
      await sb.from('crash_reports').update({
        status: 'auto_fixed',
        auto_fix_commit: commitSha,
        auto_fix_details: `Fixed ${fix.file}`,
        resolved_at: new Date().toISOString(),
      }).eq('id', crash.id);

      results.push({ crashCode: crash.crash_code, status: 'FIXED', commit: commitSha });

    } catch (err) {
      const attempts = (crash.auto_fix_attempts ?? 0) + 1;
      const escalate = attempts >= 3;

      await sb.from('crash_reports').update({
        status: escalate ? 'needs_human' : 'new',
        auto_fix_error: String(err),
      }).eq('id', crash.id);

      if (escalate) {
        const ntfyMap: Record<string, string> = {
          caps: 'caps-crash-roye',
          '9soccer': '9soccer-bugs-roye',
          wingman: 'wingman-debug-roye',
        };
        await sendNtfy(
          ntfyMap[projectKey] ?? 'caps-crash-roye',
          `🚨 ${crash.crash_code} needs human`,
          `Project: ${projectKey}\nError: ${crash.error_message}\nAuto-fix failed 3× — fix prompt:\n${(crash.fix_prompt ?? '').slice(0, 500)}`
        );
      }

      results.push({ crashCode: crash.crash_code, status: escalate ? 'ESCALATED' : 'RETRY_LATER', error: String(err) });
    }
  }

  return { project: projectKey, results };
}

serve(async (req) => {
  const denied = await requireServiceRole(req);
  if (denied) return denied;
  const startTime = Date.now();
  try {
    // Guard — run projects sequentially, not in parallel, so Claude calls
    // don't all fire at once and collectively blow the 150s budget.
    const capsResult    = await processProject('caps',     startTime);
    const soccerResult  = await processProject('9soccer',  startTime);
    const wingmanResult = await processProject('wingman',  startTime);

    return new Response(JSON.stringify({
      ok: true,
      results: [capsResult, soccerResult, wingmanResult],
      elapsed_ms: Date.now() - startTime,
      ts: new Date().toISOString(),
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
