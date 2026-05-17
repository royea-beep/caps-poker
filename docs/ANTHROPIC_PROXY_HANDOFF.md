# Handoff — CAPS Anthropic Proxy Edge Function

**Status:** drafted but not executed in session 2026-05-17. Empty directory created at `supabase/functions/anthropic-proxy/` — nothing else done.

**Goal:** move `EXPO_PUBLIC_ANTHROPIC_API_KEY` off the iOS client bundle by routing all Anthropic calls through a Supabase Edge Function. Apply remaining audit P0 from session 2026-05-17.

---

## Pre-flight (you / human)

1. **Rotate the Anthropic key** at https://console.anthropic.com/settings/keys. The current key `sk-ant-api03-...` is in every TestFlight `.ipa` build 450+ and must be considered compromised.
2. **Stage the new key** as a Supabase Function secret on project `gxrpunvhjcrzqnitbqah`:
   ```
   npx supabase secrets set ANTHROPIC_API_KEY=<new_key> --project-ref gxrpunvhjcrzqnitbqah
   ```

If you'd rather paste the new key into a chat and have me set it via MCP, that also works — but Supabase secrets is the canonical home.

---

## Step 1 — Drop in the Edge Function

File: `C:\projects\POKER\Caps\supabase\functions\anthropic-proxy\index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 1024;

async function getCallerUserId(authHeader: string): Promise<string | null> {
  if (!authHeader.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.auth.getUser(jwt);
    if (error) return null;
    return data?.user?.id ?? null;
  } catch { return null; }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const userId = await getCallerUserId(auth);

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'server_misconfigured', detail: 'ANTHROPIC_API_KEY not set' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: { prompt?: string; max_tokens?: number; model?: string; system?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const prompt = (body.prompt ?? '').toString();
  if (!prompt.trim()) {
    return new Response(JSON.stringify({ error: 'empty_prompt' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const max_tokens = Math.min(Math.max(1, Number(body.max_tokens) || DEFAULT_MAX_TOKENS), 4096);
  const model = typeof body.model === 'string' && body.model.length > 0 ? body.model : DEFAULT_MODEL;
  const system = typeof body.system === 'string' ? body.system : undefined;
  const messages = [{ role: 'user', content: prompt }];

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, messages, ...(system ? { system } : {}) }),
  });

  const text = await upstream.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}

  if (upstream.ok && parsed && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    admin.from('anthropic_usage').insert({
      user_id: userId,
      model,
      input_tokens: parsed.usage?.input_tokens ?? null,
      output_tokens: parsed.usage?.output_tokens ?? null,
    }).then(() => {}).catch(() => {});
  }

  return new Response(text, {
    status: upstream.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
```

The empty directory already exists. Just drop the file in. Use the Windows EBADF workaround (Node `fs.writeFileSync` from a script in `%TEMP%`) if Write/Edit tools complain.

---

## Step 2 — Migration: `anthropic_usage` table

File: `supabase/migrations/20260518000000_anthropic_usage.sql`

```sql
CREATE TABLE IF NOT EXISTS public.anthropic_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  model text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anthropic_usage_user_created_idx
  ON public.anthropic_usage (user_id, created_at DESC);

ALTER TABLE public.anthropic_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anthropic_usage_select_own ON public.anthropic_usage;
CREATE POLICY anthropic_usage_select_own ON public.anthropic_usage
  FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy → only service role (Edge Function) can write.
```

Apply via `mcp__claude_ai_Supabase__apply_migration` with `project_id: gxrpunvhjcrzqnitbqah` and `name: anthropic_usage` — that bypasses the `db push` version-conflict issue.

---

## Step 3 — Patch `components/BugReporter.tsx`

Replace lines 275–315 (the body of `triggerAITriage`) with this. Anchor pattern: starts at `const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;`.

```typescript
  const sb = getSupabase();
  if (!sb) return null;

  const logText = consoleLogs.slice(-20).join('\n');
  const prompt = `CAPS QA. Classify this bug report.
Console logs (last 20):
${logText}
User description: "${description}"
Reply JSON (no markdown): {"classification":"RELEVANT"|"UNRELATED","summary":"one sentence about the bug","severity":"low"|"medium"|"high"}`;

  try {
    const { data, error } = await sb.functions.invoke('anthropic-proxy', {
      body: { prompt, max_tokens: 300, model: 'claude-haiku-4-5-20251001' },
    });
    if (error || !data) return null;
    const raw = (data?.content?.[0]?.text ?? '{}').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const result = JSON.parse(raw);
    const summary = typeof result.summary === 'string' ? result.summary : '';
    if (summary && !summary.toLowerCase().includes('undefined') && !summary.toLowerCase().includes('tester')) {
      await sb.from('bug_reports').update({
        classification: result.classification === 'UNRELATED' ? 'UNRELATED' : 'RELEVANT',
        ai_summary: summary,
      }).eq('id', reportId);
      console.log('[BUG-PIPE] Step 5: ✅ Inline triage saved via proxy. severity:', result.severity, 'summary:', summary.slice(0, 60));
      return { summary, severity: String(result.severity ?? 'medium') };
    } else {
      console.log('[BUG-PIPE] Step 5: Inline triage returned bad output — leaving for Edge Fn to handle');
    }
  } catch (e) {
    console.error('[BUG-PIPE] Step 5: Inline triage failed:', e);
  }
  return null;
}
```

Effect: identical user-facing behavior, but the request goes to your Supabase project (which holds the key) instead of directly to Anthropic.

---

## Step 4 — Remove `EXPO_PUBLIC_ANTHROPIC_API_KEY` from envs

Grep these locations and delete the line:

```
.env
.env.local
.env.example
.env.production (if exists)
app.json (any "extra.*" field referencing it)
app.config.ts / app.config.js (if those exist)
eas.json (env block, if used)
```

Verify cleanup:
```
grep -r "EXPO_PUBLIC_ANTHROPIC" C:\projects\POKER\Caps --include="*.ts" --include="*.tsx" --include="*.json" --include=".env*"
```

Should return zero results in non-`.git` files.

---

## Step 5 — Deploy

```
cd C:\projects\POKER\Caps
npx supabase functions deploy anthropic-proxy --project-ref gxrpunvhjcrzqnitbqah
```

The function relies on these existing Supabase secrets (already set on this project):

| Secret | Provided by |
|---|---|
| `ANTHROPIC_API_KEY` | **You** — set in Pre-flight step 2 above |
| `SUPABASE_URL` | Supabase default |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase default |

---

## Step 6 — Verify

```bash
# Without auth → expect HTTP 401
curl -s -o /dev/null -w "no-auth: HTTP %{http_code}\n" \
  -X POST "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/anthropic-proxy" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hi"}'

# With anon key (or signed-in JWT) → expect HTTP 200 + Anthropic response
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/anthropic-proxy" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(npx supabase secrets list --project-ref gxrpunvhjcrzqnitbqah | grep -i anon | head -1)" \
  -d '{"prompt":"Respond with exactly the word OK"}'
```

Sanity check the usage log:
```sql
SELECT created_at, user_id, model, input_tokens, output_tokens
FROM analytics_events  -- wait, anthropic_usage
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC;
```
(use `mcp__claude_ai_Supabase__execute_sql` against `gxrpunvhjcrzqnitbqah`)

---

## Step 7 — Type-check, commit, push

```
npx tsc --noEmit
git add supabase/functions/anthropic-proxy supabase/migrations/20260518000000_anthropic_usage.sql components/BugReporter.tsx .env .env.local .env.example app.json
git commit -m "security: Anthropic API moved to server-side proxy (audit P0)"
git push origin main
```

After push, EAS / TestFlight next build will no longer have the Anthropic key in the bundle.

---

## Done state

- `EXPO_PUBLIC_ANTHROPIC_API_KEY` removed from every env file and source reference
- `anthropic-proxy` Edge Function deployed at `https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/anthropic-proxy`
- Requires `Authorization: Bearer <supabase-jwt>` (anon or authenticated)
- Per-call usage logged to `public.anthropic_usage` scoped by `user_id` for cost accounting
- BugReporter calls the proxy instead of Anthropic directly
- Old key rotated at console.anthropic.com — formerly-leaked key is dead

## Rough effort estimate

~30 minutes in a fresh session if the new Anthropic key is already in Supabase secrets when you start.

---

## Context — what was already done before this handoff

(See session log on 2026-05-17. Successfully shipped:)

- All 4 Edge Functions auth-gated (verified HTTP 401 unauth): `auto-fix-crashes`, `crash-analyzer`, `sync-bugs-to-drive`, `whatsapp-bot-handler`.
- `bug-recordings` client-side switched to `createSignedUrl(7d TTL)`. **Bucket privacy toggle still needs flipping in Supabase dashboard.**
- Mojibake in `app/game.tsx` (6 tooltips) + `components/Board.tsx` (12 hand-rank explanations) repaired.
- `app/(tabs)/cups.tsx` nested-useEffect crash fixed.
- Legacy `app/index.tsx` deleted (was duplicate home).
- `[BANKROLL]` console log removed.
- `LoginPromptModal` got `onRequestClose`.
- `session_id` wired in analytics.
- `app/_layout.tsx` hardcoded phone number → env var.
- `credentials.json` scrubbed from git history (main + 3 stale branches deleted).
- RLS lockdown migration `20260517000000_audit_rls_lockdown.sql` written, **NOT applied** — review chip_transactions client write paths before applying.

## Still pending after this handoff

1. **`bug-recordings` bucket → Private** in Supabase Storage dashboard (one toggle).
2. **Apply RLS migration** `20260517000000_audit_rls_lockdown.sql` after auditing client writes to `chip_transactions`.
3. **Regenerate iOS distribution cert** since `caps2026` password leaked (file scrubbed but anyone with old clones still has it).
4. **English-in-Hebrew translation pass** on shop.tsx, chip-store.tsx, play.tsx, friends.tsx, profile.tsx, AvatarPicker, OnboardingOverlay, ChatOverlay, BugReporter UI (~100+ strings, multi-hour).
