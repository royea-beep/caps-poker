// log-error v4 — backward compatible, with rate limiting + severity + better validation
// Manager-improved Apr 19. Old contract still works (message, stack, context, app fields).
// New: severity, function_name, project_slug, user_id fields supported.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Simple in-memory rate limit per isolate (per IP, 100 req/min)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return json({ ok: false, error: 'rate_limited', retry_after_seconds: 60 }, 429);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400);
  }

  // Backward-compatible field extraction
  const message = body.message || body.error;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return json({ ok: false, error: 'message required (non-empty string)' }, 400);
  }

  const severity = ['low', 'medium', 'high', 'critical'].includes(body.severity)
    ? body.severity
    : 'medium';

  const payload = {
    app_name: body.app || body.project_slug || body.project || 'unknown',
    message: message.slice(0, 1000),
    stack: typeof body.stack === 'string' ? body.stack.slice(0, 5000) : null,
    metadata: {
      ...(body.context || {}),
      ...(body.metadata || {}),
      severity,
      function_name: body.function_name || body.function || null,
      user_id: body.user_id || null,
      ip,
    },
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/error_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ ok: false, error: `db error: ${errText.slice(0, 200)}` }, 500);
    }

    return json({ ok: true, severity, app: payload.app_name });
  } catch (e: unknown) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
